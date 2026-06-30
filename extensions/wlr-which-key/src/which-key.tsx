import { useEffect, useState } from "react";
import {
  List,
  ActionPanel,
  Action,
  Icon,
  Keyboard,
  LaunchProps,
  closeMainWindow,
  showToast,
  Toast,
  getPreferenceValues,
} from "@vicinae/api";
import { spawn } from "child_process";
import { configFilePath, loadMenu, MenuEntry } from "./config";

function runCmd(entry: MenuEntry) {
  const cmd = entry.cmd!;
  const child = spawn("sh", ["-c", cmd], { detached: true, stdio: "ignore" });
  child.on("error", (e) =>
    showToast({ style: Toast.Style.Failure, title: "Command failed", message: e.message }),
  );
  child.unref();
  // keep_open mirrors native: window stays open, otherwise dismiss after running.
  if (!entry.keepOpen) closeMainWindow();
}

// Single lowercase alpha/digit keys get a Ctrl shortcut for instant nav.
// Multi-char xkb labels (Return, Left, ...) only work via fuzzy search + Enter.
function shortcutFor(key: string): Keyboard.Shortcut | undefined {
  return /^[a-z0-9]$/.test(key) ? { modifiers: ["ctrl"], key: key as Keyboard.KeyEquivalent } : undefined;
}

// Walk a space-separated key path (native --initial-keys). Returns the target
// submenu to render, a leaf cmd to run, or null on a miss.
type Resolved = { menu: MenuEntry[]; title: string } | { run: MenuEntry } | null;
function resolvePath(entries: MenuEntry[], keys: string[]): Resolved {
  let level = entries;
  let title = "Which Key";
  for (let i = 0; i < keys.length; i++) {
    const match = level.find((e) => e.keys.includes(keys[i]));
    if (!match) return null;
    title = match.desc || keys[i];
    if (match.submenu) {
      level = match.submenu;
    } else if (match.cmd != null) {
      return i === keys.length - 1 ? { run: match } : null; // path past a leaf
    }
  }
  return { menu: level, title };
}

function Menu({ entries, title }: { entries: MenuEntry[]; title?: string }) {
  return (
    <List navigationTitle={title} searchBarPlaceholder="Type a key or description…">
      {entries.map((e, i) => {
        const key = e.keys[0] ?? "";
        const isSub = e.submenu != null;
        const action = isSub ? (
          <Action.Push
            title={`Open ${e.desc}`}
            icon={Icon.ChevronRight}
            shortcut={shortcutFor(key)}
            target={<Menu entries={e.submenu!} title={e.desc} />}
          />
        ) : e.cmd != null ? (
          <Action
            title={`Run ${e.desc}`}
            icon={Icon.Terminal}
            shortcut={shortcutFor(key)}
            onAction={() => runCmd(e)}
          />
        ) : undefined;

        return (
          <List.Item
            key={`${i}-${key}`}
            title={e.desc || key}
            keywords={e.keys}
            icon={isSub ? Icon.Folder : Icon.Terminal}
            accessories={[{ tag: e.keys.join("/") }, ...(isSub ? [{ icon: Icon.ChevronRight }] : [])]}
            actions={action ? <ActionPanel>{action}</ActionPanel> : undefined}
          />
        );
      })}
    </List>
  );
}

export default function Command(props: LaunchProps<{ arguments: { keys?: string } }>) {
  const [entries, setEntries] = useState<MenuEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prefs = getPreferenceValues<{ configPath?: string; defaultKeys?: string }>();
  const keys = [prefs.defaultKeys, props.arguments?.keys]
    .flatMap((s) => (s ?? "").split(/\s+/))
    .filter(Boolean);

  useEffect(() => {
    try {
      setEntries(loadMenu(configFilePath(prefs.configPath)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const resolved = entries && keys.length ? resolvePath(entries, keys) : null;

  useEffect(() => {
    if (resolved && "run" in resolved) runCmd(resolved.run);
  }, [resolved]);

  if (error)
    return (
      <List>
        <List.EmptyView icon={Icon.ExclamationMark} title="Could not load config" description={error} />
      </List>
    );

  if (!entries) return <List isLoading />;

  if (keys.length) {
    if (!resolved)
      return (
        <List>
          <List.EmptyView
            icon={Icon.ExclamationMark}
            title="No match"
            description={`Key path "${keys.join(" ")}" not found in menu`}
          />
        </List>
      );
    if ("run" in resolved) return <List isLoading />; // cmd fired in effect
    return <Menu entries={resolved.menu} title={resolved.title} />;
  }

  return <Menu entries={entries} title="Which Key" />;
}
