import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {PanespaceManager} from './lib/manager.js';
import {PanespaceIndicator} from './lib/indicator.js';

export default class PanespaceExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._manager = new PanespaceManager(this._settings);
        this._manager.enable();

        this._indicator = new PanespaceIndicator(this._manager);
        Main.panel.addToStatusArea('panespace', this._indicator, 1, 'right');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._manager?.disable();
        this._manager = null;
        this._settings = null;
    }
}
