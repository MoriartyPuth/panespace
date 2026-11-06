import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// Top-bar indicator: shows each monitor's current/total desktops and a menu to
// jump between them or add new ones. Our own UI, since GNOME's Activities
// overview can't show per-monitor desktops.
export const PanespaceIndicator = GObject.registerClass(
class PanespaceIndicator extends PanelMenu.Button {
    _init(manager) {
        super._init(0.5, 'Panespace');
        this._manager = manager;

        this._label = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'panespace-indicator',
        });
        this.add_child(this._label);

        manager.connectChanged(state => this._update(state));
        this._update(manager.state());
    }

    _monitorName(index, primary) {
        return index === primary ? 'Primary monitor' : `Monitor ${index + 1}`;
    }

    _update(state) {
        const primary = global.display.get_primary_monitor();

        this._label.text = state.map(s => {
            const dot = s.monitor === primary ? '●' : '○'; // ● / ○
            return `${dot} ${s.active + 1}/${s.count}`;
        }).join('  ');

        this.menu.removeAll();
        state.forEach((s, idx) => {
            const header = new PopupMenu.PopupMenuItem(
                this._monitorName(s.monitor, primary), {reactive: false});
            header.add_style_class_name('panespace-header');
            this.menu.addMenuItem(header);

            for (let i = 0; i < s.count; i++) {
                const item = new PopupMenu.PopupMenuItem(`Desktop ${i + 1}`);
                if (i === s.active)
                    item.setOrnament(PopupMenu.Ornament.DOT);
                item.connect('activate', () => this._manager.switchMonitor(s.monitor, i));
                this.menu.addMenuItem(item);
            }

            const add = new PopupMenu.PopupMenuItem('+ New desktop');
            add.connect('activate', () => this._manager.newDesktopOn(s.monitor));
            this.menu.addMenuItem(add);

            if (idx < state.length - 1)
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        });
    }
});
