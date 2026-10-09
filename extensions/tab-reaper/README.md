# Tab Reaper

Close browser tabs you haven't looked at in a while.

A no-view command runs in the background every 10 minutes and closes
tabs whose last access time is older than the configured max age.
Tabs that are currently active, pinned, or playing audio are never
closed. Closed tabs can still be restored from the browser's
recently-closed history.

## Requirements

- Vicinae with the [browser extension](https://github.com/vicinaehq/vicinae/tree/main/src/browser-extension) installed and connected
- Vicinae with the tab fields used by this extension (`lastAccessed` /
  `pinned` / `audible` / `browserId` on `BrowserExtension.getTabs()`)

## Preferences

| Preference | Type | Default | Description |
|------------|------|---------|-------------|
| Max Age (minutes) | text field | `60` | Tabs last used longer ago than this are closed |

## Command

| Command | Title | Mode | Description |
|---------|-------|------|-------------|
| `reap-stale-tabs` | Reap Stale Tabs | no-view | Runs every 10 minutes in the background; when invoked manually it closes stale tabs and shows a HUD summary |
| `close-other-tabs` | Close Other Tabs | view | Closes every tab except the active, pinned and audio playing ones |

Run `reap-stale-tabs` manually from root search to close stale tabs on demand.

### Close Other Tabs

Tabs are grouped per connected browser. A browser with nothing left to close is
skipped, and when only one browser is affected the command closes the tabs
straight away and shows a HUD.

When more than one browser has closable tabs the command lists them first, so
you pick the victim: each row shows that browser's active tab title and URL
(the browser only exposes a random uuid, so the active tab is what identifies
it) plus how many tabs will be closed / kept, and a tag with the truncated
browser id (full id in the tooltip, and searchable).
