import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Independent per-monitor workspaces ("desktops"), simulated.
//
// Mutter has ONE global active workspace shared by every monitor, so real
// workspaces can never be independent per screen (moving a window between them
// drags the global active workspace — and thus every monitor — along). The only
// mechanism that is strictly per-window and never global is minimise. So:
//   * every managed window carries a per-monitor virtual-desktop index;
//   * switching a monitor unminimises the windows on THAT monitor whose index
//     matches, and minimises the rest — leaving every other monitor untouched.
// We only ever touch windows we ourselves minimised, so user-minimised windows
// are respected. Each monitor's desktop count is dynamic.
export class PanespaceManager {
    constructor(settings) {
        this._settings = settings;
        this._count = new Map();    // monitor -> number of desktops
        this._active = new Map();   // monitor -> current desktop index
        this._windows = new Map();  // Meta.Window -> desktop index
        this._hidden = new Set();   // windows WE minimised
        this._idles = [];
        this._keys = [];
        this._onChanged = null;
    }

    enable() {
        const initial = Math.max(1, this._settings.get_int('num-virtual'));
        const nMon = Main.layoutManager.monitors.length;
        for (let m = 0; m < nMon; m++) {
            this._count.set(m, initial);
            this._active.set(m, 0);
        }
        for (const win of this._allManaged())
            this._track(win, 0);

        global.display.connectObject(
            'window-created', (_d, win) => this._onWindowCreated(win), this);

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

        for (const win of this._hidden) {
            if (win && typeof win.unminimize === 'function')
                win.unminimize();
        }
        this._hidden.clear();

        for (const win of this._windows.keys())
            win?.disconnectObject?.(this);
        this._windows.clear();
        this._count.clear();
        this._active.clear();
        this._onChanged = null;
    }

    // ---- indicator API ------------------------------------------------------

    connectChanged(cb) { this._onChanged = cb; }

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
        this._hidden.delete(win);
    }

    _onWindowCreated(win) {
        const id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idles = this._idles.filter(x => x !== id);
            if (this._manageable(win) && !this._windows.has(win)) {
                const mon = win.get_monitor();
                this._track(win, this._active.get(mon) ?? 0);
            }
            return GLib.SOURCE_REMOVE;
        });
        this._idles.push(id);
    }

    // ---- show / hide (per-window minimise only) -----------------------------

    _show(win) {
        if (this._hidden.has(win)) {
            win.unminimize();
            this._hidden.delete(win);
        }
    }

    _hide(win) {
        if (!this._hidden.has(win) && !win.minimized) {
            win.minimize();
            this._hidden.add(win);
        }
    }

    // ---- switching ----------------------------------------------------------

    switchMonitor(mon, vws) {
        const count = this._count.get(mon) ?? 1;
        const k = Math.max(0, Math.min(count - 1, vws));
        this._active.set(mon, k);

        // Show matches first so focus can land on a visible window; then hide.
        const toHide = [];
        let firstVisible = null;
        for (const [win, wvws] of this._windows) {
            if (!win || win.get_monitor() !== mon)
                continue;
            if (wvws === k) {
                this._show(win);
                firstVisible ??= win;
            } else {
                toHide.push(win);
            }
        }
        if (firstVisible)
            firstVisible.activate(global.get_current_time());
        for (const win of toHide)
            this._hide(win);

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

    newDesktopOn(mon) {
        const count = this._count.get(mon) ?? 1;
        this._count.set(mon, count + 1);
        this.switchMonitor(mon, count);
    }

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
