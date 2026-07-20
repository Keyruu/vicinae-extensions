import { useEffect, useState, useCallback } from "react";
import { List, ActionPanel, Action, Icon, Toast, showToast, Color, Keyboard } from "@vicinae/api";
import { exec, deleteItem, selector, LIST_LINE_RE } from "./nb";
import { NoteDetail } from "./note-detail";
import { useNbList } from "./useNbList";
import { showError } from "./errors";
import { PinAction, EditAction } from "./actions";

interface Todo {
  id: string;
  title: string;
  done: boolean;
  raw: string;
}

function parseTodoLine(line: string): Todo | null {
  const m = LIST_LINE_RE.exec(line);
  if (!m) return null;
  const id = m[1]!;
  const rest = m[2]!;
  const done = rest.includes("✅") || rest.includes("[x]");
  // Extract title: strip emoji indicators and checkbox
  const title = rest
    .replace(/✅|✔️/g, "")
    .replace(/\[[ x]\]/g, "")
    .replace(/"([^"]+)"/, "$1")
    .trim();
  return { id, title, done, raw: rest };
}

async function listTodos(filter: string, notebook?: string): Promise<Todo[]> {
  const args = ["todos"];
  if (notebook) args.unshift(`${notebook}:`);
  if (filter === "open") args.push("open");
  else if (filter === "closed") args.push("closed");
  args.push("--no-color", "--no-header", "--no-footer");

  let out: string;
  try {
    out = await exec(args);
  } catch {
    return [];
  }
  if (!out) return [];
  return out.split("\n").map(parseTodoLine).filter((x): x is Todo => x !== null);
}

export default function ListTodos() {
  const [filter, setFilter] = useState<string>("open");

  const fetch = useCallback((nb?: string) => listTodos(filter, nb), [filter]);

  const { items: todos, notebooks, notebook, setNotebook, isLoading, reload, contentCache } =
    useNbList(fetch, "Failed to list todos");

  useEffect(() => {
    if (notebook) reload(notebook);
  }, [notebook, filter, reload]);

  const toggleDone = async (todo: Todo) => {
    try {
      await exec([todo.done ? "undo" : "do", selector(todo.id, notebook || undefined)]);
      await showToast({ style: Toast.Style.Success, title: todo.done ? "Marked undone" : "Marked done" });
      reload(notebook || undefined);
    } catch (e) {
      await showError("Failed", e);
    }
  };

  const handleDelete = async (todo: Todo) => {
    try {
      await deleteItem(todo.id, notebook || undefined);
      await showToast({ style: Toast.Style.Success, title: "Deleted" });
      reload(notebook || undefined);
    } catch (e) {
      await showError("Delete failed", e);
    }
  };

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter todos..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={filter} onChange={(val) => {
          if (val.startsWith("nb:")) setNotebook(val.slice(3));
          else setFilter(val);
        }}>
          <List.Dropdown.Section title="Status">
            <List.Dropdown.Item title="Open" value="open" icon={Icon.Circle} />
            <List.Dropdown.Item title="Closed" value="closed" icon={Icon.CheckCircle} />
            <List.Dropdown.Item title="All" value="all" icon={Icon.List} />
          </List.Dropdown.Section>
          {notebooks.length > 1 && (
            <List.Dropdown.Section title="Notebook">
              {notebooks.map((nb) => (
                <List.Dropdown.Item key={nb} title={nb} value={`nb:${nb}`} icon={Icon.Book} />
              ))}
            </List.Dropdown.Section>
          )}
        </List.Dropdown>
      }
    >
      {todos.length === 0 && !isLoading ? (
        <List.EmptyView
          title={filter === "closed" ? "No closed todos" : filter === "open" ? "No open todos" : "No todos found"}
          description="Add a todo with the Add Todo command."
        />
      ) : (
        todos.map((todo) => (
          <List.Item
            key={todo.id}
            id={todo.id}
            title={todo.title}
            icon={todo.done
              ? { source: Icon.CheckCircle, tintColor: Color.Green }
              : { source: Icon.Circle, tintColor: Color.SecondaryText }
            }
            accessories={[{ text: `#${todo.id}` }]}
            detail={<NoteDetail itemId={todo.id} notebook={notebook || undefined} contentCache={contentCache} />}
            actions={
              <ActionPanel>
                <Action
                  title={todo.done ? "Mark Undone" : "Mark Done"}
                  icon={todo.done ? Icon.Circle : Icon.CheckCircle}
                  onAction={() => toggleDone(todo)}
                />
                <EditAction id={todo.id} notebook={notebook || undefined} />
                <PinAction id={todo.id} raw={todo.raw} notebook={notebook || undefined} onChange={() => reload(notebook || undefined)} />
                <Action.CopyToClipboard title="Copy Title" content={todo.title} />
                <Action.CopyToClipboard title="Copy ID" content={todo.id} shortcut={Keyboard.Shortcut.Common.Copy} />
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={Keyboard.Shortcut.Common.Remove}
                  onAction={() => handleDelete(todo)}
                />
                <Action title="Refresh" icon={Icon.RotateAntiClockwise} shortcut={Keyboard.Shortcut.Common.Refresh} onAction={() => reload(notebook || undefined)} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
