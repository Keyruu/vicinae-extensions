import { Action, Icon, Keyboard, Toast, showToast, runInTerminal, getPreferenceValues } from "@vicinae/api";
import { isPinned, pinItem, unpinItem, selector } from "./nb";
import { showError } from "./errors";

// Both list commands expose the same pin toggle and "edit in terminal" action.
// Sharing them keeps the emoji/selector logic in one place.

export function PinAction({ id, raw, notebook, onChange }: {
  id: string;
  raw: string;
  notebook?: string;
  onChange: () => void;
}) {
  const pinned = isPinned(raw);
  return (
    <Action
      title={pinned ? "Unpin" : "Pin"}
      icon={Icon.Pin}
      shortcut={Keyboard.Shortcut.Common.Pin}
      onAction={async () => {
        try {
          await (pinned ? unpinItem : pinItem)(id, notebook);
          await showToast({ style: Toast.Style.Success, title: pinned ? "Unpinned" : "Pinned" });
          onChange();
        } catch (e) {
          await showError("Failed", e);
        }
      }}
    />
  );
}

export function EditAction({ id, notebook }: { id: string; notebook?: string }) {
  return (
    <Action
      title="Edit"
      icon={Icon.Pencil}
      onAction={async () => {
        const { terminalAppId } = getPreferenceValues<{ terminalAppId?: string }>();
        await runInTerminal(["nb", "edit", selector(id, notebook)], {
          hold: false,
          ...(terminalAppId ? { appId: terminalAppId } : {}),
        });
      }}
    />
  );
}
