import {
  Action,
  ActionPanel,
  BrowserExtension,
  closeMainWindow,
  Icon,
  List,
  open,
  type ImageLike,
} from "@vicinae/api";
import { useEffect, useState } from "react";

import { getFavicons } from "./favicons";
import { loadBookmarks, loadFolders, loadHistory, type Bookmark, type HistoryItem } from "./places";
import { getFirefoxProfiles, getStoredFirefoxProfile, initDatabase } from "./utils";

const SEARCH_URL = "https://duckduckgo.com/?q=";

type Tab = Awaited<ReturnType<typeof BrowserExtension.getTabs>>[number];

function isURL(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(" ")) return false;
  return /^(?:https?|ftp):\/\/\S+$/i.test(trimmed) || /^(?:\w+\.)+\w{2,}(?:[/?#]\S*)?$/.test(trimmed);
}

function normalizeURL(url: string): string {
  const trimmed = url.trim();
  return /^\S+?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function searchTarget(query: string): string {
  return isURL(query) ? normalizeURL(query) : `${SEARCH_URL}${encodeURIComponent(query)}`;
}

function SearchAction({ query }: { query: string }) {
  return (
    <Action
      title={`Search for "${query}"`}
      icon={Icon.MagnifyingGlass}
      shortcut={{ key: "enter", modifiers: ["shift"] }}
      onAction={async () => {
        await closeMainWindow();
        await open(searchTarget(query));
      }}
    />
  );
}

/**
 * Fallback panel used when no list item matches the current query,
 * so Enter searches the web instead of doing nothing.
 */
function SearchFallbackPanel({ query }: { query: string }) {
  return (
    <ActionPanel>
      <SearchAction query={query} />
    </ActionPanel>
  );
}

function OpenUrlActions({ url, query }: { url: string; query: string }) {
  return (
    <ActionPanel>
      <Action
        title="Open in Browser"
        icon={Icon.Globe01}
        onAction={async () => {
          await closeMainWindow();
          await open(url);
        }}
      />
      {query ? <SearchAction query={query} /> : null}
      <Action.CopyToClipboard title="Copy URL" content={url} />
    </ActionPanel>
  );
}

export default function Command() {
  const [query, setQuery] = useState("");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favicons, setFavicons] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const { profiles, defaultProfile } = await getFirefoxProfiles();
        const stored = await getStoredFirefoxProfile();
        const profile = profiles.find((p) => p.path === stored)?.path ?? defaultProfile;
        if (profile) {
          const db = await initDatabase(profile);
          const folders = loadFolders(db);
          const bookmarks = loadBookmarks(db, folders);
          setBookmarks(bookmarks);
          setHistory(loadHistory(db));
          try {
            // Favicons are cosmetic; failures (e.g. locked favicons.sqlite) are non-fatal.
            setFavicons(await getFavicons(profile, bookmarks.map((b) => b.domain)));
          } catch {
            setFavicons(new Map());
          }
        }
      } catch {
        // No readable profile: tabs and web search still work.
      }
      try {
        setTabs(await BrowserExtension.getTabs());
      } catch {
        setTabs([]);
      }
      setIsLoading(false);
    })();
  }, []);

  const trimmed = query.trim();
  const iconFor = (url: string, fallback: ImageLike) => {
    try {
      return favicons.get(new URL(url).hostname) ?? fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <List
      // Explicitly keep builtin fuzzy filtering while tracking the query
      // for the search fallback.
      filtering={true}
      isLoading={isLoading}
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Search tabs, bookmarks, history, or the web"
      actions={trimmed ? <SearchFallbackPanel query={trimmed} /> : undefined}
    >
      {trimmed && isURL(trimmed) ? (
        <List.Item
          key="open-url"
          icon={Icon.Link}
          title={`Open ${normalizeURL(trimmed)}`}
          subtitle="URL"
          actions={
            <ActionPanel>
              <Action
                title="Open URL"
                icon={Icon.Link}
                onAction={async () => {
                  await closeMainWindow();
                  await open(normalizeURL(trimmed));
                }}
              />
              <Action.CopyToClipboard title="Copy URL" content={normalizeURL(trimmed)} />
            </ActionPanel>
          }
        />
      ) : null}

      <List.Section title={`Open Tabs (${tabs.length})`}>
        {tabs.map((tab) => (
          <List.Item
            key={`tab-${tab.id}-${tab.url}`}
            icon={iconFor(tab.url, Icon.AppWindow)}
            title={tab.title ?? tab.url}
            subtitle={tab.url}
            actions={
              <ActionPanel>
                <Action
                  title="Switch to Tab"
                  icon={Icon.ArrowRight}
                  onAction={async () => {
                    await closeMainWindow();
                    tab.focus();
                  }}
                />
                {trimmed ? <SearchAction query={trimmed} /> : null}
                <Action.CopyToClipboard title="Copy URL" content={tab.url} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      <List.Section title={`Bookmarks (${bookmarks.length})`}>
        {bookmarks.map((b) => (
          <List.Item
            key={`bookmark-${b.id}`}
            icon={iconFor(b.url, Icon.Bookmark)}
            title={b.title}
            subtitle={b.url}
            accessories={b.folder ? [{ icon: Icon.Folder, tag: b.folder }] : []}
            actions={<OpenUrlActions url={b.url} query={trimmed} />}
          />
        ))}
      </List.Section>

      <List.Section title={`History (${history.length})`}>
        {history.map((item) => (
          <List.Item
            key={`history-${item.id}`}
            icon={iconFor(item.url, Icon.Globe01)}
            title={item.title}
            subtitle={item.url}
            actions={<OpenUrlActions url={item.url} query={trimmed} />}
          />
        ))}
      </List.Section>

      <List.EmptyView
        title="Nothing to search yet"
        description="Open tabs, bookmarks, and history appear here once Firefox is set up."
        icon={Icon.MagnifyingGlass}
      />
    </List>
  );
}
