import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type NotificationAction = { index: number; id: string; title: string };
export type Notification = {
  id: string;
  timestamp: string;
  appName: string;
  summary: string;
  body: string;
  urgency: number;
  actions: NotificationAction[];
};

export type NotificationGroup = {
  appName: string;
  notifications: Notification[];
};

/**
 * Turns the markup senders put into notification bodies into plain text, so
 * the detail view does not show raw HTML tags.
 */
export function toPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const URGENCY_LABELS = ["Low", "Normal", "Critical"];

export function urgencyLabel(urgency: number): string {
  return URGENCY_LABELS[urgency] ?? "Normal";
}

export function parseNotifications(output: string): Notification[] {
  const value: unknown = JSON.parse(output);
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.timestamp === "string" &&
        typeof item.appName === "string" &&
        typeof item.summary === "string" &&
        typeof item.body === "string" &&
        typeof item.urgency === "number" &&
        Array.isArray(item.actions) &&
        item.actions.every(
          (action: unknown) =>
            action &&
            typeof action === "object" &&
            typeof (action as NotificationAction).index === "number" &&
            typeof (action as NotificationAction).id === "string" &&
            typeof (action as NotificationAction).title === "string",
        ),
    )
  ) {
    throw new Error("Dux Shell returned invalid notification data");
  }
  return value as Notification[];
}

async function call(functionName: string, ...args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "dms",
      ["ipc", "call", "vicinaeNotifications", functionName, ...args],
      {
        timeout: 5000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    return stdout.trim();
  } catch {
    throw new Error(
      "Cannot reach the Dux Shell notifications bridge. See the extension README for setup.",
    );
  }
}

export async function listNotifications(): Promise<Notification[]> {
  return parseNotifications(await call("list"));
}

/**
 * Groups notifications per app the way the DMS notification center does:
 * newest first inside a group, groups ordered by highest urgency and then by
 * the most recent notification.
 */
export function groupNotifications(
  notifications: Notification[],
): NotificationGroup[] {
  const groups = new Map<string, Notification[]>();
  for (const notification of notifications) {
    const app = notification.appName || "Unknown app";
    groups.set(app, [...(groups.get(app) ?? []), notification]);
  }

  return [...groups.entries()]
    .map(([appName, items]) => ({
      appName,
      notifications: items.sort(
        (a, b) => Number(b.timestamp) - Number(a.timestamp),
      ),
    }))
    .sort((a, b) => {
      const urgency = b.notifications[0].urgency - a.notifications[0].urgency;
      if (urgency !== 0) {
        return urgency;
      }
      return (
        Number(b.notifications[0].timestamp) -
        Number(a.notifications[0].timestamp)
      );
    });
}

export async function dismiss(notification: Notification): Promise<void> {
  await expectOk("dismiss", notification.id, notification.timestamp);
}

export async function invoke(
  notification: Notification,
  action: NotificationAction,
): Promise<void> {
  await expectOk(
    "invoke",
    notification.id,
    notification.timestamp,
    String(action.index),
    action.id,
  );
}

export async function clearApp(appName: string): Promise<void> {
  await expectOk("clearApp", appName);
}

export async function clearAll(): Promise<void> {
  await expectOk("clearAll");
}

async function expectOk(
  functionName: string,
  ...args: string[]
): Promise<void> {
  if ((await call(functionName, ...args)) !== "OK") {
    throw new Error(
      "Notification changed or is no longer available. Refresh the list.",
    );
  }
}
