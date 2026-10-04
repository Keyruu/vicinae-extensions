# Tab Reaper

Close browser tabs you haven't looked at in a while.

A no-view command runs in the background every 10 minutes and closes
tabs whose last access time is older than the configured max age.
Tabs that are currently active, pinned, or playing audio are never
closed. Closed tabs can still be restored from the browser's
recently-closed history.

## Requirements

- Vicinae with the [browser extension](https://github.com/vicinaehq/vicinae/tree/main/src/browser-extension) installed and connected
- Vicinae 0.25 or newer (`lastAccessed` / `pinned` / `audible` on
  `BrowserExtension.getTabs()`)

## Preferences

| Preference | Type | Default | Description |
|------------|------|---------|-------------|
| Max Age (minutes) | text field | `60` | Tabs last used longer ago than this are closed |

## Command

| Command | Title | Description |
|---------|-------|-------------|
| `reap-stale-tabs` | Reap Stale Tabs | Runs every 10 minutes in the background; when invoked manually it closes stale tabs and shows a HUD summary |

Run it manually from root search to close stale tabs on demand.
