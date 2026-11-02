import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNotifications } from "./backend.ts";

test("parses notification content and actions without altering their text", () => {
  const notification = {
    id: "17",
    timestamp: "123456789",
    appName: "Mail",
    summary: 'Say "hello"',
    body: "line 1\nline 2",
    actions: [{ index: 0, id: "reply", title: "Reply" }],
  };
  assert.deepEqual(parseNotifications(JSON.stringify([notification])), [notification]);
});

test("rejects malformed bridge responses", () => {
  assert.throws(() => parseNotifications('{"id":"1"}'), /invalid notification data/);
  assert.throws(() => parseNotifications('[{"id":"1","actions":null}]'), /invalid notification data/);
  assert.throws(
    () => parseNotifications('[{"id":"1","actions":[{"id":"reply","title":"Reply"}]}]'),
    /invalid notification data/,
  );
});
