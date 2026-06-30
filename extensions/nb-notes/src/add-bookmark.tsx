import { useEffect, useState } from "react";
import { Form, ActionPanel, Action, showToast, Toast, useNavigation } from "@vicinae/api";
import { exec, listNotebooks } from "./nb";

export default function AddBookmark() {
  const { pop } = useNavigation();
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
      await showToast({ style: Toast.Style.Success, title: "Bookmark added" });
      pop();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Failed to add bookmark", message: msg });
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
