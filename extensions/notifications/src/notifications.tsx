import { useCallback, useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Clipboard,
  Icon,
  List,
  showToast,
  Toast,
} from "@vicinae/api";
import {
  clearAll,
  clearApp,
  dismiss,
  groupNotifications,
  invoke,
  listNotifications,
  toPlainText,
  urgencyLabel,
  type Notification,
} from "./backend";

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isShowingDetail, setIsShowingDetail] = useState(false);

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

  async function copyText(notification: Notification) {
    const text = [notification.summary, toPlainText(notification.body)]
      .filter(Boolean)
      .join("\n\n");
    await Clipboard.copy(text);
    await showToast(Toast.Style.Success, "Notification copied");
  }

  const groups = groupNotifications(notifications);

  return (
    <List
      isLoading={loading}
      isShowingDetail={isShowingDetail}
      searchBarPlaceholder="Search notifications..."
    >
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
              detail={
                <List.Item.Detail
                  markdown={
                    notification.body
                      ? toPlainText(notification.body)
                      : undefined
                  }
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.Label
                        title="App"
                        text={group.appName}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Received"
                        text={new Date(
                          Number(notification.timestamp),
                        ).toLocaleString()}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Urgency"
                        text={urgencyLabel(notification.urgency)}
                      />
                      {notification.actions.length > 0 && (
                        <List.Item.Detail.Metadata.Label
                          title="Actions"
                          text={notification.actions
                            .map((action) => action.title)
                            .join(", ")}
                        />
                      )}
                    </List.Item.Detail.Metadata>
                  }
                />
              }
              actions={
                <ActionPanel>
                  <Action
                    title={isShowingDetail ? "Hide Details" : "Show Details"}
                    icon={Icon.Eye}
                    shortcut={{ modifiers: ["shift"], key: "tab" }}
                    onAction={() => setIsShowingDetail((shown) => !shown)}
                  />
                  {notification.actions.length > 0 && (
                    <ActionPanel.Section title="Actions">
                      {notification.actions.map((action) => (
                        <Action key={`${action.index}:${action.id}`} title={action.title} onAction={() => void perform(() => invoke(notification, action))} />
                      ))}
                    </ActionPanel.Section>
                  )}
                  <ActionPanel.Section title="Manage">
                    <Action title="Copy Notification Text" icon={Icon.CopyClipboard} onAction={() => void copyText(notification)} />
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
