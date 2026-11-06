import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Independent per-monitor workspaces, simulated (v0.2).
//
// Mutter has one global workspace list shared by every monitor, so there is no
// native per-monitor workspace. We simulate it:
//   * We commandeer TWO real workspaces: index 0 = "stage" (visible) and
//     index 1 = "park" (a holding pen GNOME keeps hidden because it is never
//     the active workspace). The shell is pinned to the stage.
//   * Every managed window carries a virtual-desktop index per the monitor it
//     lives on. A window is shown (moved to the stage) when its virtual index
//     matches its monitor's active one, otherwise it is parked.
//   * Switching a monitor only re-stages/parks windows ON THAT MONITOR, leaving
//     the other monitors untouched — the independence we want.
// Each monitor has its own dynamic count of virtual desktops ("add as many as
// you want").
export class PanespaceManager {
    constructor(settings) {
        this._settings = settings;
        this._stage = 0;
        this._park = 1;

        this._count = new Map();    // monitor -> number of virtual desktops
        this._active = new Map();   // monitor -> current virtual desktop
        this._windows = new Map();  // Meta.Window -> virtual desktop index
        this._idles = [];
        this._keys = [];
        this._guard = false;
        this._onChanged = null;     // callback for the indicator

        this._mutter = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        this._wmPrefs = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'});
    }

    enable() {
        const initial = Math.max(1, this._settings.get_int('num-virtual'));

        // Take over the workspace model: static, exactly 2 real workspaces, and
        // ensure EVERY monitor honours workspace membership. Without the last
        // one, non-primary monitors show windows on all workspaces, so parking
        // a window there would not hide it.
        this._savedDynamic = this._mutter.get_boolean('dynamic-workspaces');
        this._savedNum = this._wmPrefs.get_int('num-workspaces');
        this._savedOnlyPrimary = this._mutter.get_boolean('workspaces-only-on-primary');
        this._mutter.set_boolean('dynamic-workspaces', false);
        this._wmPrefs.set_int('num-workspaces', 2);
        this._mutter.set_boolean('workspaces-only-on-primary', false);

        const nMon = Main.layoutManager.monitors.length;
        for (let m = 0; m < nMon; m++) {
            this._count.set(m, initial);
            this._active.set(m, 0);
        }

        // Adopt existing windows onto desktop 0 (all on the stage, visible).
        const wsm = global.workspace_manager;
        wsm.get_workspace_by_index(this._stage)?.activate(global.get_current_time());
        for (const win of this._allManaged()) {
            this._track(win, 0);
            this._moveTo(win, this._stage);
        }

        global.display.connectObject(
            'window-created', (_d, win) => this._onWindowCreated(win), this);

        // Keep the shell pinned to the stage so the park stays hidden.
        wsm.connectObject('active-workspace-changed', () => this._pinStage(), this);

        this._bindKeys();
        this._emit();
    }

    disable() {
        for (const id of this._idles)
            GLib.Source.remove(id);
        this._idles = [];

        for (const name of this._keys)
            Main.wm.removeKeybinding(name);
        this._keys = [];

        global.display.disconnectObject(this);
        global.workspace_manager.disconnectObject(this);

        // Un-park everything back to the stage so nothing is left hidden.
        for (const win of this._windows.keys()) {
            this._moveTo(win, this._stage);
            win?.disconnectObject?.(this);
        }
        this._windows.clear();
        this._count.clear();
        this._active.clear();

        // Restore the user's workspace settings.
        if (this._savedDynamic !== undefined)
            this._mutter.set_boolean('dynamic-workspaces', this._savedDynamic);
        if (this._savedNum !== undefined)
            this._wmPrefs.set_int('num-workspaces', this._savedNum);
        if (this._savedOnlyPrimary !== undefined)
            this._mutter.set_boolean('workspaces-only-on-primary', this._savedOnlyPrimary);

        this._onChanged = null;
    }

    // ---- public API for the indicator --------------------------------------

    connectChanged(cb) { this._onChanged = cb; }

    // [{monitor, active, count}] for the current layout.
    state() {
        const out = [];
        for (const [m, count] of this._count)
            out.push({monitor: m, active: this._active.get(m) ?? 0, count});
        return out.sort((a, b) => a.monitor - b.monitor);
    }

    _emit() { this._onChanged?.(this.state()); }

    // ---- window bookkeeping -------------------------------------------------

    _manageable(win) {
        return !!win &&
            win.get_window_type() === Meta.WindowType.NORMAL &&
            !win.is_skip_taskbar() &&
            !win.is_on_all_workspaces();
    }

    _allManaged() {
        return global.get_window_actors()
            .map(a => a.get_meta_window())
            .filter(w => this._manageable(w));
    }

    _track(win, vws) {
        if (this._windows.has(win))
            return;
        this._windows.set(win, vws);
        win.connectObject('unmanaged', () => this._untrack(win), this);
    }

    _untrack(win) {
        win?.disconnectObject?.(this);
        this._windows.delete(win);
    }

    _onWindowCreated(win) {
        const id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idles = this._idles.filter(x => x !== id);
            if (this._manageable(win) && !this._windows.has(win)) {
                const mon = win.get_monitor();
                const vws = this._active.get(mon) ?? 0;
                this._track(win, vws);
                this._moveTo(win, this._stage); // opened on the active desktop => visible
            }
            return GLib.SOURCE_REMOVE;
        });
        this._idles.push(id);
    }

    // ---- show / hide via stage & park --------------------------------------

    _moveTo(win, wsIndex) {
        const ws = win.get_workspace?.();
        if (ws && ws.index() !== wsIndex)
            win.change_workspace_by_index(wsIndex, false);
    }

    _pinStage() {
        if (this._guard)
            return;
        const wsm = global.workspace_manager;
        if (wsm.get_active_workspace_index() !== this._stage) {
            this._guard = true;
            wsm.get_workspace_by_index(this._stage)?.activate(global.get_current_time());
            this._guard = false;
        }
    }

    // ---- switching ----------------------------------------------------------

    switchMonitor(mon, vws) {
        const count = this._count.get(mon) ?? 1;
        const k = Math.max(0, Math.min(count - 1, vws));
        this._active.set(mon, k);

        let firstVisible = null;
        for (const [win, wvws] of this._windows) {
            if (!win || win.get_monitor() !== mon)
                continue;
            if (wvws === k) {
                this._moveTo(win, this._stage);
                firstVisible ??= win;
            } else {
                this._moveTo(win, this._park);
            }
        }
        if (firstVisible)
            firstVisible.activate(global.get_current_time());

        this._emit();
    }

    _activeMonitor() {
        return global.display.get_current_monitor();
    }

    _switchActive(vws) {
        this.switchMonitor(this._activeMonitor(), vws);
    }

    _step(delta) {
        const mon = this._activeMonitor();
        const count = this._count.get(mon) ?? 1;
        const cur = this._active.get(mon) ?? 0;
        this.switchMonitor(mon, (cur + delta + count) % count);
    }

    // Add a fresh empty desktop on a given monitor and jump to it.
    newDesktopOn(mon) {
        const count = this._count.get(mon) ?? 1;
        this._count.set(mon, count + 1);
        this.switchMonitor(mon, count); // the new (empty) index
    }

    // Add a desktop on the monitor under the pointer (keybinding entry point).
    newDesktop() {
        this.newDesktopOn(this._activeMonitor());
    }

    // ---- keybindings --------------------------------------------------------

    _bindKeys() {
        const flags = Meta.KeyBindingFlags.NONE;
        const modes = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;
        const add = (name, handler) => {
            Main.wm.addKeybinding(name, this._settings, flags, modes, handler);
            this._keys.push(name);
        };
        for (let i = 1; i <= 4; i++)
            add(`switch-${i}`, () => this._switchActive(i - 1));
        add('ws-next', () => this._step(+1));
        add('ws-prev', () => this._step(-1));
        add('ws-new', () => this.newDesktop());
    }
}
