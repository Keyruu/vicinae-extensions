import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import yaml from "js-yaml";

export type MenuEntry = {
  keys: string[]; // all accepted key labels; keys[0] is primary
  desc: string;
  cmd?: string;
  submenu?: MenuEntry[];
  keepOpen?: boolean;
};

export function configFilePath(override?: string): string {
  if (override && override.trim()) return override.trim();
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "wlr-which-key", "config.yaml");
}

export function loadMenu(path: string): MenuEntry[] {
  const raw = yaml.load(readFileSync(path, "utf8")) as { menu?: unknown };
  if (!raw || raw.menu == null) throw new Error("Config has no `menu` section");
  return normalize(raw.menu);
}

// New format: menu is an array of { key, desc, cmd|submenu }.
// Old format (<=1.1.0): menu is a map { "k": { desc, cmd|submenu } }.
function normalize(menu: unknown): MenuEntry[] {
  if (Array.isArray(menu)) return menu.map((e) => entry(asKeys(e.key), e));
  if (typeof menu === "object")
    return Object.entries(menu as Record<string, any>).map(([k, e]) => entry([k], e));
  throw new Error("Invalid `menu`: expected list or map");
}

function entry(keys: string[], e: any): MenuEntry {
  return {
    keys,
    desc: String(e?.desc ?? ""),
    cmd: e?.cmd != null ? String(e.cmd) : undefined,
    submenu: e?.submenu != null ? normalize(e.submenu) : undefined,
    keepOpen: e?.keep_open === true,
  };
}

function asKeys(key: unknown): string[] {
  if (Array.isArray(key)) return key.map(String);
  if (key == null) return [];
  return [String(key)];
}
