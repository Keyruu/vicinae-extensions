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
import {
  getFirefoxProfiles,
  getStoredFirefoxProfile,
  initDatabase,
  Profile,
  setStoredFirefoxProfile,
} from "./utils";

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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favicons, setFavicons] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Tabs come from the browser bridge, independent of the selected profile.
  // There is no push event for tab changes, so poll; skip state updates when
  // nothing changed to avoid re-render churn.
  useEffect(() => {
    const load = async () => {
      try {
        const next = await BrowserExtension.getTabs();
        setTabs((prev) =>
          prev.length === next.length &&
          prev.every(
            (t, i) =>
              t.id === next[i].id &&
              t.browserId === next[i].browserId &&
              t.url === next[i].url &&
              t.title === next[i].title &&
              t.active === next[i].active &&
              t.pinned === next[i].pinned &&
              t.audible === next[i].audible,
          )
            ? prev
            : next
        );
      } catch {
        // bridge unavailable; keep the last known tabs
      }
    };
    void load();
    const id = setInterval(() => void load(), 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      const { profiles, defaultProfile } = await getFirefoxProfiles();
      const stored = await getStoredFirefoxProfile();
      const selected = profiles.find((p) => p.path === stored)?.path ?? defaultProfile;
      setProfiles(profiles);
      setCurrentProfile(selected);
    })();
  }, []);

  useEffect(() => {
    if (!currentProfile) return;
    (async () => {
      setIsLoading(true);
      try {
        const db = await initDatabase(currentProfile);
        const folders = loadFolders(db);
        const bookmarks = loadBookmarks(db, folders);
        setBookmarks(bookmarks);
        setHistory(loadHistory(db));
        try {
          // Favicons are cosmetic; failures (e.g. locked favicons.sqlite) are non-fatal.
          setFavicons(await getFavicons(currentProfile, bookmarks.map((b) => b.domain)));
        } catch {
          setFavicons(new Map());
        }
      } catch {
        // No readable profile: tabs and web search still work.
      }
      setIsLoading(false);
    })();
  }, [currentProfile]);

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
      searchBarAccessory={
        <List.Dropdown
          tooltip="Profile"
          value={currentProfile}
          onChange={(value) => {
            setCurrentProfile(value);
            void setStoredFirefoxProfile(value);
          }}
        >
          {profiles.map((profile) => (
            <List.Dropdown.Item
              key={profile.path}
              icon={Icon.Person}
              title={profile.name || profile.path}
              value={profile.path}
            />
          ))}
        </List.Dropdown>
      }
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
            key={`tab-${tab.browserId}-${tab.id}`}
            icon={iconFor(tab.url, Icon.AppWindow)}
            title={tab.title ?? tab.url}
            subtitle={tab.url}
            accessories={[
              ...(tab.pinned ? [{ icon: Icon.Pin, tooltip: "Pinned tab" }] : []),
              ...(tab.audible ? [{ icon: Icon.Speaker, tooltip: "Playing audio" }] : []),
              ...(tab.active ? [{ icon: Icon.CheckCircle, tooltip: "Active tab" }] : []),
            ]}
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
                <Action
                  title="Close Tab"
                  icon={Icon.MinusCircle}
                  onAction={() => {
                    tab.close();
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
