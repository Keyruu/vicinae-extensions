# Notifications

Browse active desktop notifications grouped by app in Vicinae. Run their actions, dismiss one, clear an app, or clear all. Currently supported: Dux Shell (DMS). Noctalia is not integrated yet.

## Setup

DMS does not expose active notifications through its built-in IPC. Install the bundled local bridge plugin, then enable it:

```sh
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/dms/plugins/vicinaeNotifications"
cp dms-plugin/plugin.json dms-plugin/NotificationsBridge.qml "${XDG_CONFIG_HOME:-$HOME/.config}/dms/plugins/vicinaeNotifications/"
dms ipc call plugin-scan scan
dms ipc call plugins enable vicinaeNotifications
# Verify: should print [] (or a JSON list of your active notifications)
dms ipc call vicinaeNotifications list
```

Run the setup commands from `extensions/notifications`. If `plugins enable` reports that the plugin is unknown, open DMS Settings → Plugins and enable **Vicinae Notifications Bridge** after discovery. The plugin must be enabled whenever you use the extension. Install the Vicinae command with `npm install && npm run build` from the same directory.

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Run the notification's own action (first one) | Enter |
| Show/hide the detail pane | Shift+Tab |
| Copy the notification text | Ctrl+Shift+C |
| Dismiss the selected notification | Ctrl+X |
| Clear all notifications of the selected app | Ctrl+Alt+Backspace |
| Clear all notifications (asks for confirmation) | Ctrl+Shift+X |
| Refresh the list | Ctrl+R |

The copy, dismiss, clear-all, and refresh shortcuts are Vicinae's shared action shortcuts, so they follow the user's own keybinding preferences.

The bridge exposes notification titles, bodies and actions to other processes in your local desktop session over Quickshell IPC. Do not enable it if that is unsuitable for your environment. It only lists active notifications; it does not read or erase DMS notification history. Invoking an action does not automatically dismiss the notification.

## Development

`npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` check the extension. Live action and dismissal behavior requires an enabled DMS bridge; there is no automatic plugin installation.
