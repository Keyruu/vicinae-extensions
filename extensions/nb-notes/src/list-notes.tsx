import { useEffect, useState, useCallback } from "react";
import { List, ActionPanel, Action, Icon, Toast, showToast, Keyboard } from "@vicinae/api";
import { listItems, deleteItem, listNotebooks, archiveNotebook, unarchiveNotebook, type NbItem } from "./nb";
import { NoteDetail } from "./note-detail";
import { useNbList } from "./useNbList";
import { showError } from "./errors";
import { PinAction, EditAction } from "./actions";

const isTodo = (item: NbItem) => item.raw.includes("\u2714\ufe0f") || item.raw.includes("\u2705");
const isBookmark = (item: NbItem) => item.filename.includes(".bookmark.");

export default function ListNotes() {
  const [filter, setFilter] = useState<string>("notes");

  const fetch = useCallback(async (nb?: string): Promise<NbItem[]> => {
    const all = await listItems(nb);
    return filter === "notes" ? all.filter((i) => !isTodo(i) && !isBookmark(i))
      : filter === "todos" ? all.filter(isTodo)
      : filter === "bookmarks" ? all.filter(isBookmark)
      : all;
  }, [filter]);

  const { items, notebooks, notebook, setNotebook, isLoading, reload, refreshNotebooks, contentCache } =
    useNbList(fetch, "Failed to list notes");

  useEffect(() => {
    if (notebook) reload(notebook);
  }, [notebook, filter, reload]);

  const handleDelete = async (item: NbItem) => {
    try {
      await deleteItem(item.id, notebook || undefined);
      await showToast({ style: Toast.Style.Success, title: "Deleted" });
      reload(notebook || undefined);
    } catch (e) {
      await showError("Delete failed", e);
    }
  };

  const handleArchiveToggle = async () => {
    try {
      const archived = notebook.includes("(archived)");
      const name = notebook.replace(" (archived)", "");
      await (archived ? unarchiveNotebook : archiveNotebook)(name);
      await showToast({ style: Toast.Style.Success, title: archived ? "Unarchived" : "Archived" });
      await refreshNotebooks();
    } catch (e) {
      await showError("Failed", e);
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
                <EditAction id={item.id} notebook={notebook || undefined} />
                <PinAction id={item.id} raw={item.raw} notebook={notebook || undefined} onChange={() => reload(notebook || undefined)} />
                <Action.CopyToClipboard title="Copy Title" content={item.title} shortcut={Keyboard.Shortcut.Common.Copy} />
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={Keyboard.Shortcut.Common.Remove}
                  onAction={() => handleDelete(item)}
                />
                <Action title="Refresh" icon={Icon.RotateAntiClockwise} shortcut={Keyboard.Shortcut.Common.Refresh} onAction={() => reload(notebook || undefined)} />
                {notebook && (
                  <Action
                    title={notebook.includes("(archived)") ? "Unarchive Notebook" : "Archive Notebook"}
                    icon={Icon.Box}
                    style={Action.Style.Destructive}
                    onAction={handleArchiveToggle}
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
