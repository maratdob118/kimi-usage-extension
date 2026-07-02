# Kimi Usage Extension

A GNOME Shell extension that displays your Kimi Code API usage percentage in the top panel.

> Forked from [codepro-usage-extension](https://github.com/kevinpita/codex-usage-extension) by kevinpita, modified for Kimi Code usage tracking.

## What It Shows

- Shows current 5-hour rate limit usage in the top panel
- Displays 5-hour rate limit and weekly quota in the dropdown menu
- Shows reset times and last refresh time
- Supports progress bars and text display
- Color-coded warnings: green (≤70%), orange (70-90%), red (≥90%)
- Configurable refresh interval, icon style, and optional HTTP proxy

## Requirements

- GNOME Shell 48 or later
- Kimi Code installed and authenticated so `~/.kimi/credentials/kimi-code.json` exists
- Kimi membership (free trials not supported)

## Installation

### Quick Deploy

From the repository root:

```bash
./update
```

The script copies this repo to:

```text
~/.local/share/gnome-shell/extensions/kimi-usage@maratdob118.github.com
```

It then recompiles the GSettings schema and ends the current GNOME session with `gnome-session-quit --no-prompt`, so save your work first.

After logging back in, enable the extension if needed:

```bash
gnome-extensions enable kimi-usage@maratdob118.github.com
```

### Manual Installation

From the repository root:

```bash
install_dir="$HOME/.local/share/gnome-shell/extensions/kimi-usage@maratdob118.github.com"

rm -rf "$install_dir"
mkdir -p "$(dirname "$install_dir")"
cp -rT "$PWD" "$install_dir"
glib-compile-schemas "$install_dir/schemas"
gnome-extensions enable kimi-usage@maratdob118.github.com
```

Reload GNOME Shell after installation:

- X11: press `Alt+F2`, type `r`, then press Enter
- Wayland: log out and log back in

## Notes

The extension reads authentication from `~/.kimi/credentials/kimi-code.json`, then requests usage from `https://api.kimi.com/coding/v1/usages`.

## FAQ

**Why should I use this instead of the built-in `/usage` command in Kimi Code?**

While the `/usage` command in Kimi Code provides similar information, this GNOME Shell extension makes it **always visible** in your top bar—anytime you need to check your usage without opening Kimi Code.

**Does it work with the pay-as-you-go API key instead of the Kimi subscription?**

Not yet — it tracks subscription limits (Kimi membership plans). API key tracking is on the roadmap.

**Can I configure it?**

Yes! Check the settings menu in the extension dropdown for:

- Refresh interval
- Display format (progress bar only / text only / both)
- HTTP proxy (if you need to use a proxy)

**Is this an official Kimi project?**

No. It's an independent open-source tool that uses your own Kimi OAuth credentials, locally.