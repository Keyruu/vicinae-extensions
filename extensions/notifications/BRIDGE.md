# Dux Shell notification bridge investigation

## Finding

A small Dux Shell **daemon plugin** can expose the live notification objects through Quickshell IPC without modifying Dux Shell itself. The Vicinae extension would call that plugin through `dms ipc call vicinaeNotifications …`. The bundled implementation was verified against a live DMS 2.0.0 shell on 2026-11-02.

DMS currently exposes `clearAll`, `dismiss` (last popup), and `invokeLast`, but no API to list active notifications or invoke an arbitrary action ([notification IPC handler](https://github.com/duxlabs-dev/dux-shell/blob/40630184/quickshell/Modals/NotificationModal.qml#L178-L200)). Its optional history file records text and metadata, **not actions**, so reading that file cannot implement the requested UI ([history persistence](https://github.com/duxlabs-dev/dux-shell/blob/40630184/quickshell/Services/NotificationService.qml#L120-L181)).

## Implementation

1. Ship `plugin.json` with `type: "daemon"` and a single QML `component`, plus a QML `Item` importing `Quickshell.Io` and `qs.Services`. DMS discovers plugins under `~/.config/dms/plugins/`; a daemon runs once when enabled, and can register `IpcHandler` ([plugin docs](https://github.com/duxlabs-dev/dux-shell/blob/40630184/quickshell/PLUGINS/README.md#L41-L108), [daemon contract](https://github.com/duxlabs-dev/dux-shell/blob/40630184/quickshell/PLUGINS/README.md#L2073-L2097), [working IPC daemon example](https://github.com/duxlabs-dev/dux-shell/blob/40630184/quickshell/PLUGINS/ExampleCompositePlugin/CompositeDaemon.qml#L58-L72)). Document installation and enabling; do not install or enable it as part of building the extension.
2. Expose `list(): string` as JSON with only `{id, timestamp, appName, summary, body, actions: [{id, title}]}` for **active** `NotificationService.notifications`. The wrappers have `notification.id`, `time`, `appName`, `summary`, `body`, and live `actions` with labels and `invoke()` ([notification wrapper](https://github.com/duxlabs-dev/dux-shell/blob/40630184/quickshell/Services/NotificationService.qml#L923-L1005)). Do not expose the history file or write a second notification store.
3. Expose `dismiss(id, timestamp)`, `invoke(id, timestamp, actionId)`, `clearApp(appName)`, and `clearAll()`. Look up the notification afresh and reject stale IDs/timestamps or missing action identifiers; call `NotificationService.dismissNotification(wrapper)` or `action.invoke()` ([dismiss implementation](https://github.com/duxlabs-dev/dux-shell/blob/40630184/quickshell/Services/NotificationService.qml#L1161-L1167), [notification-center action behavior](https://github.com/duxlabs-dev/dux-shell/blob/40630184/quickshell/Modules/Notifications/Center/NotificationCard.qml#L49-L55)). **Do not automatically dismiss after invoking an action**: the notification center does not do that; the sender may close it itself. Use explicit success/error return values so Vicinae never removes an item on failure.
4. The Vicinae command fetches on opening and after actions, groups by `appName` into list sections, and offers per-item actions/dismiss, clear-app, and clear-all. Keep transport behind one DMS-specific module; only introduce a second source adapter when Noctalia's integration is actually built. Call the CLI with argv (`execFile`), never shell-interpolate notification content. DMS forwards arbitrary IPC target/function names to Quickshell ([CLI implementation](https://github.com/duxlabs-dev/dux-shell/blob/40630184/core/cmd/dms/shell.go#L140-L179)); plugin targets need not be upstream-registered.

## Limits / checks before implementation

- This requires a DMS plugin installed **and enabled** by the user; the extension must show a clear missing-bridge error.
- IPC is accessible to local processes in the session; listing notifications exposes private notification text. Export only fields the UI needs, never images, hints, or history; document this trust boundary.

## Verified behavior

Against a live DMS 2.0.0 shell with the plugin installed and enabled:

- `list` returned 116 active notifications grouped by app (Slack, Gotify, kitty, notify-send), including real action lists such as `{index: 0, id: "default", title: "View"}`.
- `invoke` on a self-sent notification with a custom action ran that action; `invoke` with a wrong action identifier and `dismiss` with a wrong id/timestamp pair both returned `NOT_FOUND` instead of acting on the wrong notification.
- `clearApp` removed every notification of one app; `clearAll` cleared the list.
- The Vicinae command launched and loaded without errors, and the built TypeScript adapter parsed the live payload and dismissed a notification through the bridge.

Still unverified: a notification that the sender closes itself, action lists that change between listing and invocation, and behavior when DMS or the plugin is absent (the extension shows a setup error instead).
- Relevant upstream issues [#3675](https://github.com/duxlabs-dev/dux-shell/issues/3675) / [#1598](https://github.com/duxlabs-dev/dux-shell/issues/1598) concern `invokeLast`, and [#56](https://github.com/duxlabs-dev/dux-shell/issues/56) concerns `clearAll`; none supplies a list/arbitrary-action API.
