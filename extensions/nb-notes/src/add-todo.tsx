import { useEffect, useState } from "react";
import { Form, ActionPanel, Action, showToast, Toast, useNavigation } from "@vicinae/api";
import { exec, listNotebooks } from "./nb";

export default function AddTodo() {
  const { pop } = useNavigation();
  const [notebooks, setNotebooks] = useState<string[]>([]);

  useEffect(() => {
    listNotebooks().then(setNotebooks);
  }, []);

  const handleSubmit = async (values: Form.Values) => {
    const title = (values.title as string)?.trim();
    if (!title) {
      await showToast({ style: Toast.Style.Failure, title: "Title required" });
      return;
    }

    try {
      const args = ["todo", "add"];
      if (values.notebook) args.push(`${values.notebook}:`);
      args.push(title);
      if (values.description) args.push("--description", values.description as string);
      if (values.due) args.push("--due", values.due as string);
      if (values.tags) args.push("--tags", values.tags as string);

      await exec(args);
      await showToast({ style: Toast.Style.Success, title: "Todo added" });
      pop();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Failed to add todo", message: msg });
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Todo" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Title" placeholder="Todo title" />
      <Form.TextField id="description" title="Description" placeholder="Optional description" />
      <Form.TextField id="due" title="Due Date" placeholder="e.g. 2025-12-31" />
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
