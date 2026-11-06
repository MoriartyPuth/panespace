# Panespace

Independent per-monitor workspaces ("desktops") for GNOME Shell.

Each monitor keeps its **own** set of desktops that you switch and grow
independently — switching on one screen leaves the others untouched. The
macOS-style "separate Spaces per display" behaviour GNOME lacks.

## Why it's "simulated"

Mutter has a single global *active* workspace shared by every monitor; there is
no native per-monitor workspace primitive (still only a draft Mutter MR). Moving
a window between real workspaces drags the global active workspace — and thus
every monitor — along, so real workspaces can never be independent per screen.

The only mechanism that is strictly per-window and never global is **minimise**.
So Panespace tags each window with a per-monitor virtual-desktop index and, when
you switch a monitor, unminimises that desktop's windows and minimises the rest.
Only that monitor's windows are touched; every other monitor is untouched.

Two consequences: desktops show through Panespace's **own top-bar indicator**
(not GNOME's Activities overview, which is hardwired to the global list), and a
"hidden" desktop's windows sit **minimised** (so they appear in a dock's
minimised list).

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

## Known limitations

- Desktops show in Panespace's own indicator/menu, **not** GNOME's Activities
  overview — that can't be made per-monitor.
- Hiding is by **minimise**, so switching looks like windows minimising /
  restoring (not a sliding desktop animation), and hidden windows appear in a
  dock's minimised list. This is the price of true independence on GNOME — it's
  the only per-window hide that doesn't move the global workspace.
- Moving a window between monitors re-homes it to that monitor's active desktop
  on the next switch.

### Roadmap
- Remember per-monitor desktop counts across sessions.
- Explore a slide/fade transition on the minimise to feel more like switching.

## Build / install

```sh
make install     # pack + install
# then log out / log back in (Wayland), and enable Panespace
```

## License

GPL-2.0-or-later
