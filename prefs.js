import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PanespacePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        const behaviour = new Adw.PreferencesGroup({title: 'Behaviour'});
        page.add(behaviour);

        const spin = new Adw.SpinRow({
            title: 'Virtual workspaces per monitor',
            subtitle: 'How many independent workspaces each screen cycles through',
            adjustment: new Gtk.Adjustment({lower: 2, upper: 9, step_increment: 1}),
        });
        settings.bind('num-virtual', spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        behaviour.add(spin);

        const shortcuts = new Adw.PreferencesGroup({
            title: 'Shortcuts',
            description: 'Switching affects only the monitor your pointer is on. ' +
                'Set custom keys with dconf-editor under ' +
                '/org/gnome/shell/extensions/panespace/.',
        });
        page.add(shortcuts);

        const show = (title, keyName) => {
            const combos = settings.get_strv(keyName);
            shortcuts.add(new Adw.ActionRow({
                title,
                subtitle: combos.length ? combos.join(', ') : '(unset)',
            }));
        };
        show('Workspace 1', 'switch-1');
        show('Workspace 2', 'switch-2');
        show('Workspace 3', 'switch-3');
        show('Workspace 4', 'switch-4');
        show('Next workspace', 'ws-next');
        show('Previous workspace', 'ws-prev');

        const notes = new Adw.PreferencesGroup({title: 'Notes (v0.1)'});
        page.add(notes);
        notes.add(new Adw.ActionRow({
            title: 'Early version',
            subtitle: 'Windows are hidden by minimising, so they still appear in ' +
                'the Overview. Works best with a single real workspace.',
        }));
    }
}
