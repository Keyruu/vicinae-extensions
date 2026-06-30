import { exec } from "./nb";

export interface ItemMeta {
  filename: string;
  type: string;
  added: string;
  updated: string;
}

export interface ParsedContent {
  body: string;
  tags: string[];
  due: string;
  description: string;
  tasks: { title: string; done: boolean }[];
  related: string[];
}

export async function getItemMeta(id: string, notebook?: string): Promise<ItemMeta> {
  const selector = notebook ? `${notebook}:${id}` : id;
  const [filename, type, added, updated] = await Promise.all([
    exec(["show", selector, "--filename", "--no-color"]).catch(() => ""),
    exec(["show", selector, "--type", "--no-color"]).catch(() => ""),
    exec(["show", selector, "--added", "--no-color"]).catch(() => ""),
    exec(["show", selector, "--updated", "--no-color"]).catch(() => ""),
  ]);
  return { filename, type, added, updated };
}

export function parseContent(raw: string): ParsedContent {
  const tags: string[] = [];
  const tasks: { title: string; done: boolean }[] = [];
  const related: string[] = [];
  let due = "";
  let description = "";

  // Extract h2 sections
  const sections = new Map<string, string>();
  const lines = raw.split("\n");
  let currentSection = "";
  const bodyLines: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      currentSection = h2[1]!.trim().toLowerCase();
      inSection = true;
      continue;
    }
    if (inSection) {
      const existing = sections.get(currentSection) ?? "";
      sections.set(currentSection, existing ? `${existing}\n${line}` : line);
    } else {
      bodyLines.push(line);
    }
  }

  // Tags
  const tagsSection = sections.get("tags")?.trim() ?? "";
  if (tagsSection) {
    for (const m of tagsSection.matchAll(/#(\w[\w-]*)/g)) {
      tags.push(m[1]!);
    }
  }

  // Due
  due = sections.get("due")?.trim() ?? "";

  // Description
  description = sections.get("description")?.trim() ?? "";

  // Tasks
  const tasksSection = sections.get("tasks")?.trim() ?? "";
  if (tasksSection) {
    for (const line of tasksSection.split("\n")) {
      const taskMatch = /^- \[([ x])\] (.+)$/.exec(line.trim());
      if (taskMatch) {
        tasks.push({ title: taskMatch[2]!, done: taskMatch[1] === "x" });
      }
    }
  }

  // Related
  const relatedSection = sections.get("related")?.trim() ?? "";
  if (relatedSection) {
    for (const line of relatedSection.split("\n")) {
      const urlMatch = /<([^>]+)>/.exec(line);
      const linkMatch = /\[\[([^\]]+)\]\]/.exec(line);
      if (urlMatch) related.push(urlMatch[1]!);
      else if (linkMatch) related.push(linkMatch[1]!);
    }
  }

  return { body: bodyLines.join("\n"), tags, due, description, tasks, related };
}
