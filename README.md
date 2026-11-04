# Panespace

Independent per-monitor workspaces for GNOME Shell.

Each monitor keeps its **own** set of virtual workspaces, so switching on one
screen leaves the others untouched — the macOS-style behaviour GNOME lacks.

## Why it's "simulated"

Mutter has a single global active workspace shared by every monitor; there is no
native per-monitor workspace primitive (still only a draft Mutter MR). Panespace
fakes it: every normal window is tagged with a virtual-workspace index, and each
monitor remembers which index it is currently showing. Switching a monitor only
**minimises / unminimises the windows on that monitor**, giving the illusion of
independent workspaces.

## Usage

Switching always targets the monitor your **pointer** is on.

| Shortcut | Action |
|----------|--------|
| `Super+Alt+1..4` | Jump active monitor to workspace 1–4 |
| `Super+Ctrl+Right` | Next workspace on active monitor |
| `Super+Ctrl+Left` | Previous workspace on active monitor |

(`Super+Ctrl+1..9` is avoided — GNOME binds it to "open new window of app N".)

Count of virtual workspaces is configurable in preferences (2–9).

## Known limitations (v0.1)

- Windows are hidden by **minimising**, so they still show in the Overview and
  in a dock's minimised list.
- Works best with a **single real GNOME workspace** (Panespace layers its own
  switching on top; it does not replace native workspace switching).
- Moving a window between monitors re-homes it to that monitor's active
  workspace on the next switch.

### Roadmap
- v0.2: hide via a dedicated "parking" workspace instead of minimise (cleaner
  Overview + alt-tab), optional per-monitor indicator in the panel.

## Build / install

```sh
make install     # pack + install
# then log out / log back in (Wayland), and enable Panespace
```

## License

GPL-2.0-or-later
