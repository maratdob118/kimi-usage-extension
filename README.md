# Codex Usage GNOME Extension

Display OpenAI Codex usage in the GNOME Shell top panel.

> Forked from [claude-usage-extension](https://github.com/Haletran/claude-usage-extension) by Haletran. Now maintained by [kevinpita](https://github.com/kevinpita).

## What It Shows

- Shows current 5-hour usage in the top panel
- Displays 5-hour and weekly usage in the dropdown menu
- Shows reset countdowns and last refresh time
- Supports text, progress bar, or both
- Can show used or remaining percentages
- Includes configurable refresh interval, icon style, and optional HTTP proxy

## Requirements

- GNOME Shell 46, 47, 48, 49, or 50
- Codex CLI installed and authenticated so `~/.codex/auth.json` exists

## Installation

### Quick Deploy

From the repository root:

```bash
./update
```

The script copies this repo to:

```text
~/.local/share/gnome-shell/extensions/codex-usage@kevinpita.dev
```

It then recompiles the GSettings schema and ends the current GNOME session with `gnome-session-quit --no-prompt`, so save your work first.

After logging back in, enable the extension if needed:

```bash
gnome-extensions enable codex-usage@kevinpita.dev
```

### Manual Installation

From the repository root:

```bash
install_dir="$HOME/.local/share/gnome-shell/extensions/codex-usage@kevinpita.dev"

rm -rf "$install_dir"
mkdir -p "$(dirname "$install_dir")"
cp -rT "$PWD" "$install_dir"
glib-compile-schemas "$install_dir/schemas"
gnome-extensions enable codex-usage@kevinpita.dev
```

Reload GNOME Shell after installation:

- X11: press `Alt+F2`, type `r`, then press Enter
- Wayland: log out and log back in

## Notes

The extension reads authentication from `~/.codex/auth.json` or `$CODEX_HOME/auth.json`, then requests usage from `https://chatgpt.com/backend-api/wham/usage`.

## Disclaimer

This extension is not affiliated with, funded by, or associated with OpenAI.
