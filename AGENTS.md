# Guide: Creating Vicinae Extensions

Vicinae extensions are Raycast-compatible extensions using React and TypeScript.
This guide covers gotchas, patterns, and the full API surface based on building
extensions in this repo.

---

## Project Structure

```
extensions/my-extension/
├── assets/
│   └── extension_icon.svg   # or .png — 1:1 aspect ratio, 512x512+ recommended
├── src/
│   └── command-name.tsx      # one file per command, filename must match manifest
├── package.json              # manifest + dependencies
├── tsconfig.json             # standard config
└── package-lock.json         # required — use npm, not bun
```

## Manifest (package.json)

```json
{
  "$schema": "https://raw.githubusercontent.com/vicinaehq/vicinae/refs/heads/main/extra/schemas/extension.json",
  "name": "my-extension",
  "title": "My Extension",
  "description": "What it does",
  "categories": ["Productivity"],
  "license": "MIT",
  "author": "you",
  "icon": "extension_icon.svg",
  "commands": [
    {
      "name": "my-command",
      "title": "My Command",
      "description": "What this command does",
      "mode": "view"
    }
  ],
  "preferences": [
    {
      "name": "somePref",
      "type": "textfield",
      "title": "Some Preference",
      "description": "Explain what this configures",
      "default": "",
      "required": false
    }
  ],
  "scripts": {
    "build": "vici build",
    "dev": "vici develop",
    "lint": "vici lint"
  },
  "dependencies": {
    "@vicinae/api": "^0.16.11"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

### Gotchas — Manifest

- **`name` must be ≥3 characters.** Single/two-letter names like `nb` will fail validation.
- **`name` must match the directory name.** If name is `nb-notes`, directory must be `extensions/nb-notes/`.
- **Each command's `name` must match a source file.** Command `"name": "list-notes"` expects `src/list-notes.tsx`.
- **Use `@vicinae/api`, not `@raycast/api`.** The latter works but is discouraged.
- **Generate `package-lock.json` with npm.** Even if you develop with bun/pnpm.
- **Command modes:** `"view"` (renders UI), `"no-view"` (runs silently), `"menu-bar"` (menu bar item).
- **Preference types:** `textfield`, `password`, `checkbox`, `dropdown`, `appPicker`, `file`.

---

## Build & Install

```bash
cd extensions/my-extension
npm install
npx vici build    # builds and installs to ~/.local/share/vicinae/extensions/
npx vici lint     # validates manifest
npx vici develop  # dev mode with hot reload
```

After building, restart Vicinae if new commands don't appear.

---

## Available Components

All imports come from `@vicinae/api`.

### List (most common)

The primary component. Renders a searchable list with built-in fuzzy filtering.

```tsx
import { List } from "@vicinae/api";

export default function Command() {
  return (
    <List searchBarPlaceholder="Search...">
      <List.Item title="Item 1" subtitle="details" />
    </List>
  );
}
```

**Key props on `List`:**
- `isLoading` — shows loading indicator
- `isShowingDetail` — enables split view (list left, detail right)
- `searchBarPlaceholder` — placeholder text
- `searchBarAccessory` — render a `List.Dropdown` for filters
- `filtering` — built-in fuzzy search (on by default unless `onSearchTextChange` is set)
- `throttle` — debounce search text changes (use with `onSearchTextChange`)
- `onSearchTextChange` — custom search handler (disables built-in filtering)
- `onSelectionChange` — fires when selected item changes (receives item `id`)
- `actions` — fallback action panel when no items match

**Key props on `List.Item`:**
- `id` — unique identifier (used by `onSelectionChange`)
- `title`, `subtitle` — displayed text
- `icon` — left icon (`Icon.Document`, or `{ source: Icon.X, tintColor: Color.Red }`)
- `accessories` — right-side badges: `[{ text: "tag" }, { icon: Icon.Star }]`
- `keywords` — extra search terms for built-in filtering
- `detail` — renders `List.Item.Detail` in split view
- `actions` — `ActionPanel` for this item

### List.Item.Detail (Split View)

Renders markdown + optional metadata sidebar when `isShowingDetail` is true.

```tsx
<List.Item
  detail={
    <List.Item.Detail
      isLoading={false}
      markdown="# Hello\nSome content"
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Type" text="note" icon={Icon.Document} />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.TagList title="Tags">
            <List.Item.Detail.Metadata.TagList.Item text="tag1" color={Color.Blue} />
          </List.Item.Detail.Metadata.TagList>
          <List.Item.Detail.Metadata.Link title="URL" text="example.com" target="https://example.com" />
        </List.Item.Detail.Metadata>
      }
    />
  }
/>
```

**Metadata components:**
- `Label` — key/value with optional icon: `{ title, text, icon? }`
- `Separator` — horizontal divider
- `TagList` with `TagList.Item` — colored tag pills: `{ text, color }`
- `Link` — clickable link: `{ title, text, target }`

### List.Dropdown (Filter Accessory)

Rendered via `searchBarAccessory`. Supports sections.

```tsx
<List
  searchBarAccessory={
    <List.Dropdown tooltip="Filter" value={filter} onChange={setFilter}>
      <List.Dropdown.Section title="Type">
        <List.Dropdown.Item title="All" value="all" icon={Icon.List} />
        <List.Dropdown.Item title="Notes" value="notes" icon={Icon.Document} />
      </List.Dropdown.Section>
    </List.Dropdown>
  }
>
```

### Detail (Standalone)

Full-page markdown view with optional metadata and actions.

```tsx
import { Detail } from "@vicinae/api";

export default function Command() {
  return <Detail markdown="# Hello" actions={<ActionPanel>...</ActionPanel>} />;
}
```

### Form

Input forms. Each field needs a unique `id`. Submit via `Action.SubmitForm`.

```tsx
import { Form, ActionPanel, Action } from "@vicinae/api";

export default function Command() {
  return (
    <Form actions={<ActionPanel><Action.SubmitForm onSubmit={handleSubmit} /></ActionPanel>}>
      <Form.TextField id="title" title="Title" placeholder="Enter title" />
      <Form.TextArea id="content" title="Content" />
      <Form.Dropdown id="category" title="Category" defaultValue="general">
        <Form.Dropdown.Item value="general" title="General" />
      </Form.Dropdown>
      <Form.Checkbox id="pinned" label="Pin this item" defaultValue={false} />
      <Form.DatePicker id="due" title="Due Date" />
      <Form.TagPicker id="tags" title="Tags">
        <Form.TagPicker.Item value="work" title="Work" />
      </Form.TagPicker>
      <Form.FilePicker id="attachment" title="Attachment" />
      <Form.PasswordField id="secret" title="Secret" />
      <Form.Separator />
      <Form.Description title="Help" text="Some help text" />
    </Form>
  );
}
```

`onSubmit` receives `Form.Values` — a `Record<string, Form.Value>` where values are `string | number | boolean | string[] | number[] | Date | null`. Cast as needed.

### Grid

Image/icon grid layout. Similar to List but for visual content.

```tsx
import { Grid } from "@vicinae/api";

export default function Command() {
  return (
    <Grid columns={4} aspectRatio="1">
      <Grid.Item content={{ color: Color.Red }} title="Red" />
      <Grid.Item content="https://example.com/image.png" title="Image" />
    </Grid>
  );
}
```

Props: `columns`, `aspectRatio` (`"1"`, `"16/9"`, `"3/2"`, etc.), `fit` (`Grid.Fit.Contain` / `Fill`), `inset`.

### MenuBarExtra

System tray / menu bar commands (mode: `"menu-bar"`).

```tsx
import { MenuBarExtra } from "@vicinae/api";

export default function Command() {
  return (
    <MenuBarExtra icon={Icon.Star} title="My Menu">
      <MenuBarExtra.Item title="Action" onAction={() => {}} />
      <MenuBarExtra.Section title="Group">
        <MenuBarExtra.Item title="Sub-action" />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
```

---

## Actions & Keyboard Shortcuts

```tsx
import { ActionPanel, Action, Keyboard, Icon } from "@vicinae/api";

<ActionPanel>
  {/* First action = Enter, second = Shift+Enter — don't add explicit shortcuts to these */}
  <Action title="Primary" onAction={() => {}} />
  <Action title="Secondary" onAction={() => {}} />

  {/* Remaining actions get explicit shortcuts */}
  <Action title="Copy" shortcut={Keyboard.Shortcut.Common.Copy} onAction={() => {}} />
  <Action title="Delete" shortcut={Keyboard.Shortcut.Common.Remove} style={Action.Style.Destructive} onAction={() => {}} />
  <Action title="Refresh" shortcut={Keyboard.Shortcut.Common.Refresh} onAction={() => {}} />
  <Action title="Pin" shortcut={Keyboard.Shortcut.Common.Pin} onAction={() => {}} />

  {/* Custom shortcut */}
  <Action title="Mark Done" shortcut={{ modifiers: ["cmd"], key: "d" }} onAction={() => {}} />
</ActionPanel>
```

**Built-in Action variants:**
- `Action.CopyToClipboard` — `{ content, concealed?, onCopy? }`
- `Action.Paste` — `{ content }`
- `Action.Push` — `{ target: <Component /> }` — push a new view
- `Action.Open` — `{ target: "path-or-url" }`
- `Action.OpenInBrowser` — `{ url }`
- `Action.ShowInFinder` — `{ path }`
- `Action.SubmitForm` — `{ onSubmit }`

**Common shortcut names:**
`Copy`, `CopyDeeplink`, `CopyName`, `CopyPath`, `Save`, `Duplicate`, `Edit`,
`MoveDown`, `MoveUp`, `New`, `Open`, `OpenWith`, `Pin`, `Refresh`, `Remove`, `RemoveAll`

**Gotcha:** The first two actions in an `ActionPanel` are automatically bound to
Enter and Shift+Enter. Do NOT add explicit `shortcut` props to them — it will
conflict.

---

## System Utilities

### runInTerminal

Opens a command in the user's terminal emulator.

```tsx
import { runInTerminal } from "@vicinae/api";

await runInTerminal(["nb", "edit", "1"], {
  hold: false,      // keep terminal open after command exits
  appId: "com.app", // optional: target specific terminal
});
```

**Gotcha:** `runInTerminal` returns `Promise<void>` that resolves on
acknowledgment, NOT when the process exits. There is no way to detect when the
terminal command finishes. If you need to refresh after editing, provide a manual
Refresh action.

### Other utilities

```tsx
import { open, showToast, Toast, Clipboard, confirmAlert, getPreferenceValues, environment, showInFileBrowser } from "@vicinae/api";

// Open URL or file
await open("https://example.com");
await open("/path/to/file");

// Toast notifications
await showToast({ style: Toast.Style.Success, title: "Done" });
await showToast({ style: Toast.Style.Failure, title: "Error", message: "Details" });
await showToast({ style: Toast.Style.Animated, title: "Loading..." });

// Clipboard
await Clipboard.copy("text");
await Clipboard.paste("text");
const { text } = await Clipboard.read();

// Confirm dialog
const confirmed = await confirmAlert({
  title: "Delete item?",
  message: "This cannot be undone",
  primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
});

// Preferences (from manifest)
const { myPref } = getPreferenceValues<{ myPref: string }>();

// Environment info
console.log(environment.extensionName);
console.log(environment.supportPath); // writable directory for extension data
console.log(environment.assetsPath);  // read-only assets directory

// Show file in system file manager
await showInFileBrowser("/path/to/file");
```

### Cache (Synchronous, Disk-Based)

LRU cache stored on disk. Survives restarts. Not encrypted.

```tsx
import { Cache } from "@vicinae/api";

const cache = new Cache({ namespace: "my-data", capacity: 5 * 1024 * 1024 });
cache.set("key", JSON.stringify(data));
const raw = cache.get("key");
if (raw) { const data = JSON.parse(raw); }
cache.has("key");
cache.remove("key");
cache.clear();
```

### LocalStorage (Async, Persistent)

Simple async key-value store.

```tsx
import { LocalStorage } from "@vicinae/api";

await LocalStorage.setItem("key", "value");
const val = await LocalStorage.getItem<string>("key");
await LocalStorage.removeItem("key");
const all = await LocalStorage.allItems();
await LocalStorage.clear();
```

### Navigation

```tsx
import { useNavigation } from "@vicinae/api";

const { push, pop } = useNavigation();
push(<DetailView />);  // push a new view
pop();                  // go back
```

---

## CLI Tool Extensions Pattern

When wrapping a CLI tool, use this pattern:

```tsx
// src/my-cli.ts — shared helper
import { execFile } from "child_process";

export function exec(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("mycli", args, {
      env: { ...process.env, NO_COLOR: "1" }  // disable color codes
    }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout.trim());
    });
  });
}
```

**Tips:**
- Always disable color output (`--no-color`, `NO_COLOR=1`, etc.) — ANSI codes break display
- Parse output client-side with regex; CLI output formats are more stable than you'd think
- Handle non-zero exit codes gracefully — some CLIs exit non-zero for "no results"
- Check if the CLI exists on startup and show a helpful error if missing

---

## Critical Gotchas

### 1. Split View First Item Not Rendering

**The #1 gotcha.** When using `isShowingDetail` with async-loaded detail content,
the first item's detail panel will be blank on initial load.

**Root cause:** `setItems(results)` triggers a render. The first `List.Item.Detail`
component mounts and its `useEffect` starts an async fetch. But by the time the
fetch completes, React may not re-render the detail properly.

**Fix:** Pre-fetch the first item's content BEFORE calling `setItems`:

```tsx
const contentCache = useRef<Record<string, CachedData>>({});

const load = useCallback(async () => {
  setIsLoading(true);
  contentCache.current = {};
  const results = await fetchItems();

  // Pre-fetch BEFORE setting state
  if (results.length > 0) {
    const first = results[0];
    contentCache.current[first.id] = await prefetchData(first.id);
  }

  setItems(results); // Now detail component mounts with cache already warm
  setIsLoading(false);
}, []);
```

The detail component reads from cache synchronously on mount:

```tsx
function ItemDetail({ id, cache }) {
  const cached = cache.current[id];
  const [data, setData] = useState(cached?.content ?? "");
  const [isLoading, setIsLoading] = useState(!cached);

  useEffect(() => {
    if (cache.current[id]) {
      setData(cache.current[id].content);
      setIsLoading(false);
      return;
    }
    // Fetch for non-first items
    fetchData(id).then((d) => {
      cache.current[id] = d;
      setData(d.content);
      setIsLoading(false);
    });
  }, [id]);

  return <List.Item.Detail markdown={data} isLoading={isLoading} />;
}
```

**If your detail has multiple async fields (content + metadata), pre-fetch ALL of
them.** Otherwise the same blank-on-first-load bug appears for whichever field
wasn't pre-fetched.

### 2. Dropdown onChange Fires on Mount

`List.Dropdown` fires `onChange` immediately with the default/initial value. Guard
against unnecessary reloads.

### 3. Keyboard Shortcut Conflicts

The first two actions in an `ActionPanel` auto-bind to Enter and Shift+Enter. Adding
explicit `shortcut` props to these creates conflicts and weird behavior.

### 4. React State Batching

Multiple `setState` calls in an async function are NOT batched after an `await`.
Each one triggers a separate render:

```tsx
// These trigger TWO renders:
setItems(results);      // render 1: items visible, still loading
setIsLoading(false);    // render 2: loading done
```

This matters for split view — the detail component mounts on render 1 before
you've had a chance to populate the cache.

### 5. Icons

Use `Icon.*` from the API. For tinted icons: `{ source: Icon.Circle, tintColor: Color.Green }`.
Extension icon must be under `assets/` and referenced in manifest's `icon` field.

### 6. Filtering with Shared Dropdown

If you need both a type filter and a notebook/category selector in one dropdown,
use value prefixes and sections:

```tsx
<List.Dropdown onChange={(val) => {
  if (val.startsWith("nb:")) setNotebook(val.slice(3));
  else setFilter(val);
}}>
  <List.Dropdown.Section title="Type">
    <List.Dropdown.Item title="All" value="all" />
  </List.Dropdown.Section>
  <List.Dropdown.Section title="Notebook">
    <List.Dropdown.Item title="Home" value="nb:home" />
  </List.Dropdown.Section>
</List.Dropdown>
```

---

## Reference Extensions

Study these existing extensions on `main` for real-world patterns:

| Pattern | Extension | Key files |
|---|---|---|
| **CLI wrapper (spawn/exec)** | `skate` | `src/skate.tsx` — single-file, `spawn` calls, Form for input, List with CRUD |
| **Split view + metadata** | `arch-packages` | `src/search-arch-packages.tsx` — `isShowingDetail`, `List.Item.Detail.Metadata` |
| **Dropdown filters** | `arch-packages` | `src/search-arch-packages.tsx` — `List.Dropdown` as `searchBarAccessory` |
| **Preferences** | `pass` | `src/preferences.ts` + `package.json` — `getPreferenceValues`, typed prefs |
| **runInTerminal** | `linuxbrew` | `src/terminal.ts` — `runInTerminal` with `hold` option |
| **Form inputs** | `simple-bookmarks` | `src/simple-bookmarks.tsx` — `Form.TextField`, `Action.SubmitForm` |
| **Grid layout** | `dashboard-icons` | Grid with images, `Grid.Item`, aspect ratios |
| **Calendar/events** | `agenda` | `src/components/EventListItem.tsx` — `isShowingDetail`, shortcuts, sections |
| **Multi-file structure** | `pass` | Separate `services/`, `utils/`, `types.ts`, `storage/` |
| **Sections** | `bluetooth` | `src/devices.tsx` — `List.Section` grouping |

When building a new extension, find the closest match above and read its source first.

---

## Checklist Before Submitting

- [ ] `npx vici lint` passes
- [ ] `npx vici build` succeeds
- [ ] Extension name ≥3 characters, matches directory name
- [ ] Icon exists at `assets/<icon-field-value>`, 1:1 aspect ratio
- [ ] `package-lock.json` generated with npm
- [ ] No `@raycast/api` in dependencies (use `@vicinae/api`)
- [ ] Error handling: missing CLI tools show helpful message
- [ ] No binary downloads from arbitrary URLs
- [ ] All commands have descriptions
