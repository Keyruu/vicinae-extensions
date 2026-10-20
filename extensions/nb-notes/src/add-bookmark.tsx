import { useEffect, useState } from "react";
import { Form, ActionPanel, Action, showToast, Toast, showHUD, PopToRootType } from "@vicinae/api";
import { exec, listNotebooks } from "./nb";
import { showError } from "./errors";

export default function AddBookmark() {
  const [notebooks, setNotebooks] = useState<string[]>([]);

  useEffect(() => {
    listNotebooks().then(setNotebooks);
  }, []);

  const handleSubmit = async (values: Form.Values) => {
    const url = (values.url as string)?.trim();
    if (!url) {
      await showToast({ style: Toast.Style.Failure, title: "URL required" });
      return;
    }

    try {
      const args = values.notebook ? [`${values.notebook}:${url}`] : [url];
      if (values.comment) args.push("--comment", values.comment as string);
      if (values.tags) args.push("--tags", values.tags as string);

      await exec(args);
      await showHUD("Bookmark added", { popToRootType: PopToRootType.Immediate });
    } catch (e) {
      await showError("Failed to add bookmark", e);
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Bookmark" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="url" title="URL" placeholder="https://example.com" />
      <Form.TextField id="comment" title="Comment" placeholder="Optional comment" />
      <Form.TextField id="tags" title="Tags" placeholder="tag1,tag2" />
      {notebooks.length > 1 && (
        <Form.Dropdown id="notebook" title="Notebook" defaultValue="">
          <Form.Dropdown.Item value="" title="Default" />
          {notebooks.map((nb) => (
            <Form.Dropdown.Item key={nb} value={nb} title={nb} />
          ))}
        </Form.Dropdown>
      )}
    </Form>
  );
}
