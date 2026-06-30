import { useEffect, useState } from "react";
import { Form, ActionPanel, Action, showToast, Toast, useNavigation } from "@vicinae/api";
import { exec, listNotebooks } from "./nb";

export default function AddNote() {
  const { pop } = useNavigation();
  const [notebooks, setNotebooks] = useState<string[]>([]);

  useEffect(() => {
    listNotebooks().then(setNotebooks);
  }, []);

  const handleSubmit = async (values: Form.Values) => {
    const title = (values.title as string)?.trim();
    const content = (values.content as string)?.trim();
    const notebook = values.notebook as string;

    if (!title && !content) {
      await showToast({ style: Toast.Style.Failure, title: "Title or content required" });
      return;
    }

    try {
      const args = ["add"];
      if (notebook) args[0] = `${notebook}:add`;
      if (title) args.push("--title", title);
      if (content) args.push("--content", content);

      await exec(args);
      await showToast({ style: Toast.Style.Success, title: "Note added" });
      pop();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Failed to add note", message: msg });
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Note" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Title" placeholder="Note title" />
      <Form.TextArea id="content" title="Content" placeholder="Note content (Markdown)" />
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
