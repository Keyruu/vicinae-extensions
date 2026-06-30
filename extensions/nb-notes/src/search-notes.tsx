import { useState, useRef } from "react";
import { List, ActionPanel, Action, Icon, Detail, showToast, Toast, useNavigation } from "@vicinae/api";
import { searchItems, showItem } from "./nb";

function NoteDetail({ id }: { id: string }) {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useState(() => {
    showItem(id)
      .then(setContent)
      .catch(() => setContent("*Failed to load content*"))
      .finally(() => setIsLoading(false));
  });

  return (
    <Detail
      isLoading={isLoading}
      markdown={content}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Content" content={content} />
        </ActionPanel>
      }
    />
  );
}

export default function SearchNotes() {
  const [results, setResults] = useState<{ id: string; filename: string; matches: string[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { push } = useNavigation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!text || text.length < 2) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await searchItems(text);
        setResults(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        await showToast({ style: Toast.Style.Failure, title: "Search failed", message: msg });
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search notes..." onSearchTextChange={handleSearch} throttle>
      {results.length === 0 && !isLoading ? (
        <List.EmptyView title="No results" description="Type at least 2 characters to search." />
      ) : (
        results.map((r) => (
          <List.Item
            key={r.id}
            title={r.filename}
            subtitle={r.matches[0] ?? ""}
            accessories={[{ text: `#${r.id}` }]}
            actions={
              <ActionPanel>
                <Action title="View" icon={Icon.Eye} onAction={() => push(<NoteDetail id={r.id} />)} />
                <Action.CopyToClipboard title="Copy Filename" content={r.filename} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
