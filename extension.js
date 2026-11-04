import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {PanespaceManager} from './lib/manager.js';

export default class PanespaceExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._manager = new PanespaceManager(this._settings);
        this._manager.enable();
    }

    disable() {
        this._manager?.disable();
        this._manager = null;
        this._settings = null;
    }
}
