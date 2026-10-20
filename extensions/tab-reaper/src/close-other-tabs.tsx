import {
  Action,
  ActionPanel,
  BrowserExtension,
  Icon,
  List,
  closeMainWindow,
  environment,
  showHUD,
} from "@vicinae/api";
import { useEffect, useState } from "react";

type Browser = {
  id: string;
  /**
   * The tab the user is looking at in this browser. browserId is an opaque
   * uuid, so this tab is the only thing that tells the user which browser it is.
   */
  focused: BrowserExtension.Tab | undefined;
  closable: BrowserExtension.Tab[];
  kept: number;
};

function newest(tabs: BrowserExtension.Tab[]): BrowserExtension.Tab | undefined {
  let best: BrowserExtension.Tab | undefined;
  for (const tab of tabs) {
    if (!best || tab.lastAccessed > best.lastAccessed) {
      best = tab;
    }
  }
  return best;
}

function groupTabs(tabs: BrowserExtension.Tab[]): Browser[] {
  const byBrowser = new Map<string, BrowserExtension.Tab[]>();

  for (const tab of tabs) {
    const list = byBrowser.get(tab.browserId);
    if (list) {
      list.push(tab);
    } else {
      byBrowser.set(tab.browserId, [tab]);
    }
  }

  const groups: Browser[] = [];

  for (const [id, list] of byBrowser) {
    const closable = list.filter((tab) => !tab.active && !tab.pinned && !tab.audible);
    if (closable.length === 0) {
      continue;
    }
    groups.push({
      id,
      focused: newest(list.filter((tab) => tab.active)) ?? newest(list),
      closable,
      kept: list.length - closable.length,
    });
  }

  return groups;
}

function hostname(url?: string): string {
  if (!url) {
    return "";
  }
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

function browserTitle(browser: Browser): string {
  return browser.focused?.title?.trim() || hostname(browser.focused?.url) || "Unknown browser";
}

function closeOthers(browser: Browser): void {
  for (const tab of browser.closable) {
    tab.close();
  }
}

function plural(count: number): string {
  return count === 1 ? "tab" : "tabs";
}

export default function Command() {
  const [browsers, setBrowsers] = useState<Browser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!environment.canAccess(BrowserExtension)) {
      setError("The browser extension is not connected.");
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const groups = groupTabs(await BrowserExtension.getTabs());

        if (groups.length === 0) {
          await showHUD("No tabs to close");
          closeMainWindow();
          return;
        }

        // One browser left to reap: no ambiguity, do it without asking.
        if (groups.length === 1) {
          const [only] = groups;
          closeOthers(only);
          await showHUD(`Closed ${only.closable.length} other ${plural(only.closable.length)}`);
          closeMainWindow();
          return;
        }

        setBrowsers(groups);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (error) {
    return (
      <List navigationTitle="Close Other Tabs" isLoading={false}>
        <List.EmptyView
          icon={Icon.Warning}
          title="Browser not available"
          description={`${error} Install and connect the Vicinae browser extension, then open at least one window per browser.`}
        />
      </List>
    );
  }

  return (
    <List navigationTitle="Close Other Tabs" isLoading={isLoading}>
      {browsers.map((browser) => (
        <List.Item
          key={browser.id}
          id={browser.id}
          icon={Icon.AppWindow}
          title={browserTitle(browser)}
          subtitle={browser.focused?.url}
          keywords={[browser.id]}
          accessories={[
            { text: `Close ${browser.closable.length}, keep ${browser.kept}` },
            { tag: browser.id.slice(0, 8), tooltip: browser.id },
          ]}
          actions={
            <ActionPanel>
              <Action
                title={`Close ${browser.closable.length} other ${plural(browser.closable.length)}`}
                icon={Icon.Trash}
                onAction={async () => {
                  closeOthers(browser);
                  await showHUD(
                    `Closed ${browser.closable.length} other ${plural(browser.closable.length)} in ${browserTitle(browser)}`,
                  );
                  closeMainWindow();
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
