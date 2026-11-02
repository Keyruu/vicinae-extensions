import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type NotificationAction = { id: string; title: string };
export type Notification = {
  id: string;
  timestamp: string;
  appName: string;
  summary: string;
  body: string;
  actions: NotificationAction[];
};

export function parseNotifications(output: string): Notification[] {
  const value: unknown = JSON.parse(output);
  if (!Array.isArray(value) || !value.every((item) =>
    item && typeof item === "object" &&
    typeof item.id === "string" && typeof item.timestamp === "string" &&
    typeof item.appName === "string" && typeof item.summary === "string" &&
    typeof item.body === "string" && Array.isArray(item.actions) &&
    item.actions.every((action: unknown) => action && typeof action === "object" &&
      typeof (action as NotificationAction).id === "string" &&
      typeof (action as NotificationAction).title === "string"))) {
    throw new Error("Dux Shell returned invalid notification data");
  }
  return value as Notification[];
}

async function call(functionName: string, ...args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("dms", ["ipc", "call", "vicinaeNotifications", functionName, ...args], {
      timeout: 5000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    throw new Error("Cannot reach the Dux Shell notifications bridge. See the extension README for setup.");
  }
}

export async function listNotifications(): Promise<Notification[]> {
  return parseNotifications(await call("list"));
}

export async function dismiss(notification: Notification): Promise<void> {
  await expectOk("dismiss", notification.id, notification.timestamp);
}

export async function invoke(notification: Notification, actionId: string): Promise<void> {
  await expectOk("invoke", notification.id, notification.timestamp, actionId);
}

export async function clearApp(appName: string): Promise<void> {
  await expectOk("clearApp", appName);
}

export async function clearAll(): Promise<void> {
  await expectOk("clearAll");
}

async function expectOk(functionName: string, ...args: string[]): Promise<void> {
  if (await call(functionName, ...args) !== "OK") {
    throw new Error("Notification changed or is no longer available. Refresh the list.");
  }
}
