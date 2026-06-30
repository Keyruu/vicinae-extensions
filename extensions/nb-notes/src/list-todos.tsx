import { useEffect, useState, useCallback, useRef } from "react";
import { List, ActionPanel, Action, Icon, showToast, Toast, runInTerminal, Color, getPreferenceValues, Keyboard } from "@vicinae/api";
import { exec, deleteItem, listNotebooks, pinItem, unpinItem } from "./nb";
import { NoteDetail, prefetchItem, type CachedItem } from "./note-detail";

interface Todo {
  id: string;
  title: string;
  done: boolean;
  raw: string;
}

const TODO_LINE_RE = /^\[(\d+)\]\s+(.+)$/;

function parseTodoLine(line: string): Todo | null {
  const m = TODO_LINE_RE.exec(line);
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
  const [todos, setTodos] = useState<Todo[]>([]);
  const [notebooks, setNotebooks] = useState<string[]>([]);
  const [notebook, setNotebook] = useState<string>("");
  const [filter, setFilter] = useState<string>("open");
  const [isLoading, setIsLoading] = useState(true);
  const contentCache = useRef<Record<string, CachedItem>>({});

  const load = useCallback(async (f: string, nb?: string) => {
    setIsLoading(true);
    contentCache.current = {};
    try {
      const result = await listTodos(f, nb || undefined);
      if (result.length > 0) {
        const first = result[0]!;
        contentCache.current[first.id] = await prefetchItem(first.id, nb || undefined);
      }
      setTodos(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Failed to list todos", message: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    listNotebooks().then((nbs) => {
      setNotebooks(nbs);
      const current = nbs.find((n) => !n.includes("(archived)")) ?? nbs[0] ?? "";
      setNotebook(current);
    });
  }, []);

  useEffect(() => {
    if (notebook) load(filter, notebook);
  }, [notebook, filter, load]);

  const toggleDone = async (todo: Todo) => {
    try {
      const selector = notebook ? `${notebook}:${todo.id}` : todo.id;
      await exec([todo.done ? "undo" : "do", selector]);
      await showToast({ style: Toast.Style.Success, title: todo.done ? "Marked undone" : "Marked done" });
      contentCache.current = {};
      load(filter, notebook || undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Failed", message: msg });
    }
  };

  const handleDelete = async (todo: Todo) => {
    try {
      await deleteItem(todo.id, notebook || undefined);
      await showToast({ style: Toast.Style.Success, title: "Deleted" });
      load(filter, notebook || undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Delete failed", message: msg });
    }
  };

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter todos..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={filter} onChange={setFilter}>
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
                <Action
                  title="Edit"
                  icon={Icon.Pencil}
                  onAction={async () => {
                    const selector = notebook ? `${notebook}:${todo.id}` : todo.id;
                    const { terminalAppId } = getPreferenceValues<{ terminalAppId?: string }>();
                    await runInTerminal(["nb", "edit", selector], { hold: false, ...(terminalAppId ? { appId: terminalAppId } : {}) });
                  }}
                />
                <Action
                  title={todo.raw.includes("📌") ? "Unpin" : "Pin"}
                  icon={Icon.Pin}
                  shortcut={Keyboard.Shortcut.Common.Pin}
                  onAction={async () => {
                    try {
                      if (todo.raw.includes("📌")) {
                        await unpinItem(todo.id, notebook || undefined);
                      } else {
                        await pinItem(todo.id, notebook || undefined);
                      }
                      await showToast({ style: Toast.Style.Success, title: todo.raw.includes("📌") ? "Unpinned" : "Pinned" });
                      load(filter, notebook || undefined);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Unknown error";
                      await showToast({ style: Toast.Style.Failure, title: "Failed", message: msg });
                    }
                  }}
                />
                <Action.CopyToClipboard title="Copy Title" content={todo.title} shortcut={Keyboard.Shortcut.Common.Copy} />
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={Keyboard.Shortcut.Common.Remove}
                  onAction={() => handleDelete(todo)}
                />
                <Action title="Refresh" icon={Icon.RotateAntiClockwise} shortcut={Keyboard.Shortcut.Common.Refresh} onAction={() => load(filter, notebook || undefined)} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
