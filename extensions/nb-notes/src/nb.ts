import { execFile } from "child_process";

export function exec(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("nb", args, { env: { ...process.env, NB_COLOR_ENABLED: "0" } }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr.trim() || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
    // nb falls back to `cat` as its pager, which blocks reading stdin when stdout
    // isn't a TTY. Closing stdin gives it EOF so the child exits and the callback fires.
    child.stdin?.end();
  });
}

export interface NbItem {
  id: string;
  filename: string;
  title: string;
  raw: string;
}

// nb addresses items as `id` or `notebook:id` depending on whether a notebook
// is targeted. Every command needs the same string, so build it in one place.
export function selector(id: string, notebook?: string): string {
  return notebook ? `${notebook}:${id}` : id;
}

// nb marks pinned items with a pin emoji in its list output.
export function isPinned(raw: string): boolean {
  return raw.includes("\ud83d\udccc");
}

// parses lines like: [1] 20260623182332.md · "test"
// or: [3] ✔️  [ ] todo title
// shared by parseListLine here and the todo parser in list-todos.tsx
export const LIST_LINE_RE = /^\[(\d+)\]\s+(.+)$/;

export function parseListLine(line: string): NbItem | null {
  const m = LIST_LINE_RE.exec(line);
  if (!m) return null;
  const id = m[1]!;
  const rest = m[2]!;

  // try to split on " · " for filename · "title" format
  const sepIdx = rest.indexOf(" · ");
  if (sepIdx !== -1) {
    const filename = rest.slice(0, sepIdx).trim();
    const title = rest.slice(sepIdx + 3).replace(/^"|"$/g, "").trim();
    return { id, filename, title: title || filename, raw: rest };
  }

  return { id, filename: "", title: rest.trim(), raw: rest };
}

export async function listItems(notebook?: string): Promise<NbItem[]> {
  const args = notebook ? [`${notebook}:`, "--no-color", "--no-footer", "--no-header", "-s"] : ["--no-color", "--no-footer", "--no-header", "-s"];
  const out = await exec(args);
  if (!out) return [];
  return out.split("\n").map(parseListLine).filter((x): x is NbItem => x !== null);
}

export async function showItem(id: string, notebook?: string): Promise<string> {
  return exec(["show", selector(id, notebook), "--print", "--no-color"]);
}

export async function deleteItem(id: string, notebook?: string): Promise<void> {
  await exec(["delete", selector(id, notebook), "--force"]);
}

export async function listNotebooks(): Promise<string[]> {
  const out = await exec(["notebooks", "--no-color"]);
  if (!out) return [];
  return out.split("\n").map((l) => l.trim()).filter(Boolean);
}

export async function pinItem(id: string, notebook?: string): Promise<void> {
  await exec(["pin", selector(id, notebook)]);
}

export async function unpinItem(id: string, notebook?: string): Promise<void> {
  await exec(["unpin", selector(id, notebook)]);
}

export async function archiveNotebook(notebook: string): Promise<void> {
  await exec(["archive", notebook]);
}

export async function unarchiveNotebook(notebook: string): Promise<void> {
  await exec(["unarchive", notebook]);
}

export async function searchItems(query: string, notebook?: string): Promise<{ id: string; filename: string; matches: string[] }[]> {
  const args = ["search", query, "--no-color"];
  if (notebook) args.push(`--notebook=${notebook}`);
  let out: string;
  try {
    out = await exec(args);
  } catch {
    // nb search exits non-zero when no results
    return [];
  }
  if (!out) return [];

  const results: { id: string; filename: string; matches: string[] }[] = [];
  let current: { id: string; filename: string; matches: string[] } | null = null;

  for (const line of out.split("\n")) {
    // result header lines look like: [notebook:folder/]filename
    // or [id] filename
    const headerMatch = /^\[?(\d+)\]?\s+(.+)$/.exec(line);
    if (headerMatch && !line.startsWith(" ") && !line.startsWith("\t")) {
      if (current) results.push(current);
      current = { id: headerMatch[1]!, filename: headerMatch[2]!, matches: [] };
    } else if (current && line.trim()) {
      current.matches.push(line.trim());
    }
  }
  if (current) results.push(current);
  return results;
}
