import assert from "node:assert/strict";
import { test } from "node:test";
import { groupNotifications, parseNotifications } from "./backend.ts";

function notification(overrides) {
  return {
    id: "17",
    timestamp: "123456789",
    appName: "Mail",
    summary: "Subject",
    body: "Body",
    urgency: 1,
    actions: [],
    ...overrides,
  };
}

test("parses notification content and actions without altering their text", () => {
  const item = notification({ summary: 'Say "hello"', body: "line 1\nline 2", actions: [{ index: 0, id: "reply", title: "Reply" }] });
  assert.deepEqual(parseNotifications(JSON.stringify([item])), [item]);
});

test("rejects malformed bridge responses", () => {
  assert.throws(() => parseNotifications('{"id":"1"}'), /invalid notification data/);
  assert.throws(() => parseNotifications('[{"id":"1","actions":null}]'), /invalid notification data/);
  assert.throws(
    () => parseNotifications('[{"id":"1","actions":[{"id":"reply","title":"Reply"}]}]'),
    /invalid notification data/,
  );
});

test("orders notifications newest first inside a group", () => {
  const groups = groupNotifications([
    notification({ id: "1", timestamp: "100" }),
    notification({ id: "2", timestamp: "300" }),
    notification({ id: "3", timestamp: "200" }),
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].notifications.map((n) => n.id), ["2", "3", "1"]);
});

test("orders groups by urgency and then by recency", () => {
  const groups = groupNotifications([
    notification({ id: "1", appName: "Mail", timestamp: "300" }),
    notification({ id: "2", appName: "Chat", timestamp: "100" }),
    notification({ id: "3", appName: "Chat", timestamp: "400", urgency: 2 }),
    notification({ id: "4", appName: "News", timestamp: "500" }),
  ]);
  // Chat leads with a critical newest notification; News and Mail follow by recency.
  assert.deepEqual(groups.map((group) => group.appName), ["Chat", "News", "Mail"]);
});
