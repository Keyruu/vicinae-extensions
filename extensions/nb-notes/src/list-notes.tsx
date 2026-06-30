import { useEffect, useState, useCallback, useRef } from "react";
import { List, ActionPanel, Action, Icon, showToast, Toast, runInTerminal, getPreferenceValues, Keyboard } from "@vicinae/api";
import { listItems, listNotebooks, deleteItem, pinItem, unpinItem, archiveNotebook, unarchiveNotebook, type NbItem } from "./nb";
import { NoteDetail, prefetchItem, type CachedItem } from "./note-detail";

export default function ListNotes() {
  const [items, setItems] = useState<NbItem[]>([]);
  const [notebooks, setNotebooks] = useState<string[]>([]);
  const [notebook, setNotebook] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("notes");
  const contentCache = useRef<Record<string, CachedItem>>({});

  const load = useCallback(async (nb?: string, f?: string) => {
    setIsLoading(true);
    contentCache.current = {};
    try {
      const all = await listItems(nb || undefined);
      const isTodo = (item: NbItem) => item.raw.includes("\u2714\ufe0f") || item.raw.includes("\u2705");
      const isBookmark = (item: NbItem) => item.filename.includes(".bookmark.");
      const result = f === "notes" ? all.filter((i) => !isTodo(i) && !isBookmark(i))
        : f === "todos" ? all.filter(isTodo)
        : f === "bookmarks" ? all.filter(isBookmark)
        : all;
      if (result.length > 0) {
        const first = result[0]!;
        contentCache.current[first.id] = await prefetchItem(first.id, nb || undefined);
      }
      setItems(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Failed to list notes", message: msg });
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
    if (notebook) load(notebook, filter);
  }, [notebook, filter, load]);

  const handleDelete = async (item: NbItem) => {
    try {
      await deleteItem(item.id, notebook || undefined);
      await showToast({ style: Toast.Style.Success, title: "Deleted" });
      load(notebook || undefined, filter);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await showToast({ style: Toast.Style.Failure, title: "Delete failed", message: msg });
    }
  };

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter notes..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={filter} onChange={(val) => {
          if (val.startsWith("nb:")) setNotebook(val.slice(3));
          else setFilter(val);
        }}>
          <List.Dropdown.Section title="Type">
            <List.Dropdown.Item title="Notes" value="notes" icon={Icon.Document} />
            <List.Dropdown.Item title="Todos" value="todos" icon={Icon.CheckCircle} />
            <List.Dropdown.Item title="Bookmarks" value="bookmarks" icon={Icon.Bookmark} />
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
      {items.length === 0 && !isLoading ? (
        <List.EmptyView title="No notes found" description="Add a note with the Add Note command." />
      ) : (
        items.map((item) => (
          <List.Item
            key={item.id}
            id={item.id}
            title={item.title}
            accessories={[{ text: `#${item.id}` }]}
            detail={<NoteDetail itemId={item.id} notebook={notebook || undefined} contentCache={contentCache} />}
            actions={
              <ActionPanel>
                <Action
                  title="Edit"
                  icon={Icon.Pencil}
                  onAction={async () => {
                    const selector = notebook ? `${notebook}:${item.id}` : item.id;
                    const { terminalAppId } = getPreferenceValues<{ terminalAppId?: string }>();
                    await runInTerminal(["nb", "edit", selector], { hold: false, ...(terminalAppId ? { appId: terminalAppId } : {}) });
                  }}
                />
                <Action
                  title={item.raw.includes("📌") ? "Unpin" : "Pin"}
                  icon={Icon.Pin}
                  onAction={async () => {
                    try {
                      if (item.raw.includes("📌")) {
                        await unpinItem(item.id, notebook || undefined);
                      } else {
                        await pinItem(item.id, notebook || undefined);
                      }
                      await showToast({ style: Toast.Style.Success, title: item.raw.includes("📌") ? "Unpinned" : "Pinned" });
                      load(notebook || undefined, filter);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Unknown error";
                      await showToast({ style: Toast.Style.Failure, title: "Failed", message: msg });
                    }
                  }}
                />
                <Action.CopyToClipboard title="Copy Title" content={item.title} shortcut={Keyboard.Shortcut.Common.Copy} />
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={Keyboard.Shortcut.Common.Remove}
                  onAction={() => handleDelete(item)}
                />
                <Action title="Refresh" icon={Icon.RotateAntiClockwise} shortcut={Keyboard.Shortcut.Common.Refresh} onAction={() => load(notebook || undefined, filter)} />
                {notebook && (
                  <Action
                    title={notebook.includes("(archived)") ? "Unarchive Notebook" : "Archive Notebook"}
                    icon={Icon.Box}
                    style={Action.Style.Destructive}
                    onAction={async () => {
                      try {
                        const name = notebook.replace(" (archived)", "");
                        if (notebook.includes("(archived)")) {
                          await unarchiveNotebook(name);
                        } else {
                          await archiveNotebook(name);
                        }
                        await showToast({ style: Toast.Style.Success, title: notebook.includes("(archived)") ? "Unarchived" : "Archived" });
                        const nbs = await listNotebooks();
                        setNotebooks(nbs);
                        setNotebook(nbs[0] ?? "");
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : "Unknown error";
                        await showToast({ style: Toast.Style.Failure, title: "Failed", message: msg });
                      }
                    }}
                  />
                )}
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
