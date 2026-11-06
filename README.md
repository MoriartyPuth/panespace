# Panespace

Independent per-monitor workspaces ("desktops") for GNOME Shell.

Each monitor keeps its **own** set of desktops that you switch and grow
independently — switching on one screen leaves the others untouched. The
macOS-style "separate Spaces per display" behaviour GNOME lacks.

## Why it's "simulated"

Mutter has a single global workspace list shared by every monitor; there is no
native per-monitor workspace primitive (still only a draft Mutter MR). Panespace
commandeers two real workspaces — a **stage** (visible) and a **park** (hidden
holding pen) — pins the shell to the stage, and tags every window with a
per-monitor virtual-desktop index. Switching a monitor moves only *that
monitor's* windows between stage and park, which reads as independent desktops.

Because of this, Panespace shows its desktops through its **own top-bar
indicator**, not GNOME's Activities overview (which is hardwired to the single
global list).

## Usage

Keyboard shortcuts act on the monitor your **pointer** is over:

| Shortcut | Action |
|----------|--------|
| `Super+Alt+1..4` | Jump that monitor to desktop 1–4 |
| `Super+Ctrl+Right` | Next desktop on that monitor |
| `Super+Ctrl+Left` | Previous desktop on that monitor |
| `Super+Ctrl+Up` | **Add** a new desktop on that monitor |

(`Super+Ctrl+1..9` is avoided — GNOME binds it to "open new window of app N".)

Or use the **top-bar indicator**: it shows each monitor's `current/total`
(● = primary, ○ = others). Click it to jump to any desktop or add a new one on a
specific screen.

## Known limitations (v0.2)

- Desktops show in Panespace's own indicator/menu, **not** GNOME's Activities
  overview — that can't be made per-monitor.
- Panespace takes over the workspace model while enabled (2 static real
  workspaces); your previous `dynamic-workspaces` / `num-workspaces` are saved
  and restored on disable.
- Moving a window between monitors re-homes it to that monitor's active desktop
  on the next switch.

### Roadmap
- Remember per-monitor desktop counts across sessions.
- Optional click-drag thumbnails / gesture switching.

## Build / install

```sh
make install     # pack + install
# then log out / log back in (Wayland), and enable Panespace
```

## License

GPL-2.0-or-later
