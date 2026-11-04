import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Independent per-monitor workspaces, simulated.
//
// GNOME/Mutter has a single global active workspace shared by every monitor, so
// there is no native "per-monitor workspace". We fake it: every managed window
// is tagged with a virtual-workspace index, and each monitor remembers which
// virtual index it is currently showing. Switching a monitor only minimises /
// unminimises the windows that live on THAT monitor, leaving other monitors
// untouched — which is the independence we want.
export class PanespaceManager {
    constructor(settings) {
        this._settings = settings;
        this._numVirtual = settings.get_int('num-virtual');

        this._active = new Map();   // monitorIndex -> current virtual workspace
        this._windows = new Map();  // Meta.Window -> virtual workspace index
        this._hidden = new Set();   // windows WE minimised (so we don't touch user-minimised ones)
        this._idles = [];
        this._keys = [];
    }

    enable() {
        // All monitors start on virtual workspace 0.
        const nMon = Main.layoutManager.monitors.length;
        for (let m = 0; m < nMon; m++)
            this._active.set(m, 0);

        // Adopt every currently-open window onto workspace 0 (all visible).
        for (const win of this._allManaged())
            this._track(win, 0);

        // New windows join the active virtual workspace of the monitor they open on.
        global.display.connectObject(
            'window-created', (_d, win) => this._onWindowCreated(win), this);

        this._bindKeys();
    }

    disable() {
        for (const id of this._idles)
            GLib.Source.remove(id);
        this._idles = [];

        for (const name of this._keys)
            Main.wm.removeKeybinding(name);
        this._keys = [];

        global.display.disconnectObject(this);

        // Restore: unminimise anything we hid, and stop tracking.
        for (const win of this._hidden) {
            if (win && typeof win.unminimize === 'function')
                win.unminimize();
        }
        this._hidden.clear();

        for (const win of this._windows.keys())
            win?.disconnectObject?.(this);
        this._windows.clear();
        this._active.clear();
    }

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
        // Let the window settle (get a monitor, an actor) before we classify it.
        const id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idles = this._idles.filter(x => x !== id);
            if (this._manageable(win) && !this._windows.has(win)) {
                const mon = win.get_monitor();
                const vws = this._active.get(mon) ?? 0;
                this._track(win, vws);
                // It opened on the visible workspace of its monitor, so it is
                // already correctly shown; nothing to hide.
            }
            return GLib.SOURCE_REMOVE;
        });
        this._idles.push(id);
    }

    // ---- show / hide --------------------------------------------------------

    _hide(win) {
        if (!this._hidden.has(win) && !win.minimized) {
            win.minimize();
            this._hidden.add(win);
        }
    }

    _show(win) {
        if (this._hidden.has(win)) {
            win.unminimize();
            this._hidden.delete(win);
        }
    }

    // ---- switching ----------------------------------------------------------

    switchMonitor(mon, vws) {
        const k = Math.max(0, Math.min(this._numVirtual - 1, vws));
        this._active.set(mon, k);

        let firstVisible = null;
        for (const [win, wvws] of this._windows) {
            if (!win || win.get_monitor() !== mon)
                continue;
            if (wvws === k) {
                this._show(win);
                firstVisible ??= win;
            } else {
                this._hide(win);
            }
        }

        // Keep focus sensible: focus a window that is now visible on this monitor.
        if (firstVisible)
            firstVisible.activate(global.get_current_time());
    }

    _activeMonitor() {
        return global.display.get_current_monitor();
    }

    _switchActive(vws) {
        this.switchMonitor(this._activeMonitor(), vws);
    }

    _step(delta) {
        const mon = this._activeMonitor();
        const cur = this._active.get(mon) ?? 0;
        const next = (cur + delta + this._numVirtual) % this._numVirtual;
        this.switchMonitor(mon, next);
    }

    // ---- keybindings --------------------------------------------------------

    _bindKeys() {
        const flags = Meta.KeyBindingFlags.NONE;
        const modes = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;
        const add = (name, handler) => {
            Main.wm.addKeybinding(name, this._settings, flags, modes, handler);
            this._keys.push(name);
        };

        const direct = Math.min(this._numVirtual, 4);
        for (let i = 1; i <= direct; i++)
            add(`switch-${i}`, () => this._switchActive(i - 1));

        add('ws-next', () => this._step(+1));
        add('ws-prev', () => this._step(-1));
    }
}
