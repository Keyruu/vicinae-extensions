import { useCallback, useEffect, useState } from "react";
import { Action, ActionPanel, Icon, List, showToast, Toast } from "@vicinae/api";
import {
  clearAll,
  clearApp,
  dismiss,
  groupNotifications,
  invoke,
  listNotifications,
  type Notification,
} from "./backend";

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setNotifications(await listNotifications());
      setError("");
    } catch (cause) {
      setNotifications([]);
      setError(cause instanceof Error ? cause.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function perform(action: () => Promise<void>) {
    try {
      await action();
      await refresh();
    } catch (cause) {
      await showToast(Toast.Style.Failure, cause instanceof Error ? cause.message : "Notification action failed");
      await refresh();
    }
  }

  const groups = groupNotifications(notifications);

  return (
    <List isLoading={loading} searchBarPlaceholder="Search notifications...">
      {groups.length === 0 && (
        <List.EmptyView
          title={error || "No notifications"}
          description={error ? "Install and enable the Dux Shell bridge, then refresh." : "You're all caught up."}
          actions={<ActionPanel><Action title="Refresh" icon={Icon.ArrowClockwise} onAction={() => void refresh()} /></ActionPanel>}
        />
      )}
      {groups.map((group) => (
        <List.Section key={group.appName} title={group.appName} subtitle={`${group.notifications.length}`}>
          {group.notifications.map((notification) => (
            <List.Item
              key={`${notification.id}:${notification.timestamp}`}
              title={notification.summary || "Notification"}
              subtitle={notification.body}
              icon={Icon.Bell}
              accessories={[{ text: new Date(Number(notification.timestamp)).toLocaleTimeString() }]}
              actions={
                <ActionPanel>
                  {notification.actions.length > 0 && (
                    <ActionPanel.Section title="Actions">
                      {notification.actions.map((action) => (
                        <Action key={`${action.index}:${action.id}`} title={action.title} onAction={() => void perform(() => invoke(notification, action))} />
                      ))}
                    </ActionPanel.Section>
                  )}
                  <ActionPanel.Section title="Manage">
                    <Action title="Dismiss Notification" icon={Icon.Trash} onAction={() => void perform(() => dismiss(notification))} />
                    <Action title={`Clear ${group.appName}`} icon={Icon.Trash} onAction={() => void perform(() => clearApp(notification.appName))} />
                    <Action title="Clear All Notifications" icon={Icon.Trash} onAction={() => void perform(clearAll)} />
                    <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={() => void refresh()} />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
