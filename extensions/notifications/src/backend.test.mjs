import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bridgeSetupError,
  groupNotifications,
  parseNotifications,
  toPlainText,
  urgencyLabel,
} from "./backend.ts";

test("identifies a missing or disabled DMS bridge plugin", () => {
  assert.match(
    bridgeSetupError("PLUGIN_NOT_FOUND: vicinaeNotifications"),
    /not installed/,
  );
  assert.match(bridgeSetupError("disabled"), /installed but disabled/);
  assert.equal(bridgeSetupError("enabled"), undefined);
});

function notification(overrides) {
  return {
    id: "17",
    timestamp: "123456789",
    appName: "Mail",
    summary: "Subject",
    body: "Body",
    urgency: 1,
    icon: "",
    actions: [],
    ...overrides,
  };
}

test("parses notification content and actions without altering their text", () => {
  const item = notification({
    summary: 'Say "hello"',
    body: "line 1\nline 2",
    actions: [{ index: 0, id: "reply", title: "Reply" }],
  });
  assert.deepEqual(parseNotifications(JSON.stringify([item])), [item]);
});

test("rejects malformed bridge responses", () => {
  assert.throws(
    () => parseNotifications('{"id":"1"}'),
    /invalid notification data/,
  );
  assert.throws(
    () => parseNotifications('[{"id":"1","actions":null}]'),
    /invalid notification data/,
  );
  assert.throws(
    () =>
      parseNotifications(
        '[{"id":"1","actions":[{"id":"reply","title":"Reply"}]}]',
      ),
    /invalid notification data/,
  );
});

test("strips notification markup for the detail view", () => {
  assert.equal(
    toPlainText("• 12:00 <i>Lunch</i> () &amp; more"),
    "• 12:00 Lunch () & more",
  );
  assert.equal(
    toPlainText("line1<br/>line2</p><p>para2"),
    "line1\nline2\npara2",
  );
});

test("labels known urgencies and falls back to normal", () => {
  assert.equal(urgencyLabel(0), "Low");
  assert.equal(urgencyLabel(2), "Critical");
  assert.equal(urgencyLabel(9), "Normal");
});

test("orders notifications newest first inside a group", () => {
  const groups = groupNotifications([
    notification({ id: "1", timestamp: "100" }),
    notification({ id: "2", timestamp: "300" }),
    notification({ id: "3", timestamp: "200" }),
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].notifications.map((n) => n.id),
    ["2", "3", "1"],
  );
});

test("orders groups by urgency and then by recency", () => {
  const groups = groupNotifications([
    notification({ id: "1", appName: "Mail", timestamp: "300" }),
    notification({ id: "2", appName: "Chat", timestamp: "100" }),
    notification({ id: "3", appName: "Chat", timestamp: "400", urgency: 2 }),
    notification({ id: "4", appName: "News", timestamp: "500" }),
  ]);
  // Chat leads with a critical newest notification; News and Mail follow by recency.
  assert.deepEqual(
    groups.map((group) => group.appName),
    ["Chat", "News", "Mail"],
  );
});
