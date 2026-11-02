import QtQuick
import Quickshell.Io
import qs.Services

Item {
    id: root

    property string pluginId: ""
    property var pluginService: null

    function findNotification(id, timestamp) {
        return NotificationService.notifications.find(n => n.notification
            && String(n.notification.id) === id
            && String(n.time.getTime()) === timestamp);
    }

    IpcHandler {
        target: "vicinaeNotifications"

        function list(): string {
            return JSON.stringify(NotificationService.notifications.filter(n => n?.notification).map(n => ({
                id: String(n.notification.id),
                timestamp: String(n.time.getTime()),
                appName: n.appName,
                summary: n.summary,
                body: n.body,
                actions: n.actions.map((a, index) => ({ index: index, id: a.identifier, title: a.text || "Open" }))
            })));
        }

        function dismiss(id: string, timestamp: string): string {
            const notification = root.findNotification(id, timestamp);
            if (!notification)
                return "NOT_FOUND";
            NotificationService.dismissNotification(notification);
            return "OK";
        }

        function invoke(id: string, timestamp: string, actionIndex: string, actionId: string): string {
            const notification = root.findNotification(id, timestamp);
            const action = notification?.actions[parseInt(actionIndex)];
            if (!action || (actionId && action.identifier !== actionId))
                return "NOT_FOUND";
            action.invoke();
            return "OK";
        }

        function clearApp(appName: string): string {
            const matching = NotificationService.notifications.filter(n => n?.notification && n.appName === appName);
            if (!matching.length)
                return "NOT_FOUND";
            for (const notification of matching)
                NotificationService.dismissNotification(notification);
            return "OK";
        }

        function clearAll(): string {
            NotificationService.clearAllNotifications();
            return "OK";
        }
    }
}
