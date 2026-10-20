import { Database } from "sql.js";

const folderNames = {
  menu: "Bookmark Menu",
  mobile: "Mobile Bookmarks",
  tags: "Tags",
  toolbar: "Toolbar",
  unfiled: "Other Bookmarks",
};

export type Bookmark = {
  id: string;
  title: string;
  url: string;
  folder: string;
  domain: string;
  dateAdded: number;
};

export type HistoryItem = {
  id: string;
  title: string;
  url: string;
  domain: string;
  lastVisitDate: number;
};

export type Folder = { id: string; icon: string; title: string };

function domainOf(url: string): string {
  try {
    if (url) return new URL(url).hostname;
  } catch {
    // Ignore invalid URLs
  }
  return "";
}

function getFirefoxFolders(db: Database) {
  const folders = [];
  const statement = db.prepare(
    `SELECT moz_bookmarks.id AS id, moz_bookmarks.parent AS parentId, moz_bookmarks.title AS title, moz_bookmarks.guid AS guid FROM moz_bookmarks WHERE moz_bookmarks.type = 2 AND moz_bookmarks.title IS NOT NULL AND moz_bookmarks.title <> '' AND moz_bookmarks.fk IS NULL;`,
  );
  while (statement.step()) {
    const row = statement.getAsObject();
    folders.push(row);
  }
  statement.free();
  return folders;
}

function getFirefoxBookmarks(db: Database) {
  const bookmarks = [];
  const statement = db.prepare(
    `SELECT substr(moz_places.url, 1, CASE WHEN instr(moz_places.url, '?') > 0 AND instr(moz_places.url, '#') > 0 THEN min(instr(moz_places.url, '?'), instr(moz_places.url, '#')) - 1 WHEN instr(moz_places.url, '?') > 0 THEN instr(moz_places.url, '?') - 1 WHEN instr(moz_places.url, '#') > 0 THEN instr(moz_places.url, '#') - 1 ELSE length(moz_places.url) END) AS normalizedUrl, moz_places.url AS urlString, moz_bookmarks.title AS title, MAX(moz_bookmarks.dateAdded) AS dateAdded, GROUP_CONCAT(moz_bookmarks.parent) AS parentIds FROM moz_bookmarks LEFT JOIN moz_places ON moz_bookmarks.fk = moz_places.id WHERE moz_bookmarks.type = 1 AND moz_bookmarks.title IS NOT NULL AND moz_places.url IS NOT NULL GROUP BY normalizedUrl;`,
  );
  while (statement.step()) {
    const row = statement.getAsObject();
    bookmarks.push(row);
  }
  statement.free();
  return bookmarks;
}

export function loadFolders(db: Database): Folder[] {
  const rawFolders = getFirefoxFolders(db);
  return rawFolders.map((folder) => {
    const hierarchy = [
      folder.parentId === 1 &&
      typeof folder.title === "string" &&
      Object.hasOwn(folderNames, folder.title)
        ? folderNames[folder.title as keyof typeof folderNames]
        : typeof folder.title === "string"
        ? folder.title
        : "",
    ];
    let parentId = folder.parentId;
    while (parentId !== 1) {
      const parent = rawFolders.find((f) => f.id === parentId);
      if (parent) {
        hierarchy.push(
          parent.parentId === 1 &&
            typeof parent.title === "string" &&
            Object.hasOwn(folderNames, parent.title)
            ? folderNames[parent.title as keyof typeof folderNames]
            : typeof parent.title === "string"
              ? parent.title
              : "",
        );
        parentId = parent.parentId;
      } else {
        break;
      }
    }
    return {
      ...folder,
      id: `${folder.id}`,
      title: hierarchy.reverse().join("/"),
      icon: "firefox.png",
    };
  });
}

export function loadBookmarks(db: Database, folders: Folder[]): Bookmark[] {
  const rawBookmarks = getFirefoxBookmarks(db);

  const bookmarks = rawBookmarks.map((bookmark) => {
    const url = typeof bookmark.urlString === "string" ? bookmark.urlString : "";

    // Handle multiple parent IDs (comma-separated)
    const parentIds = typeof bookmark.parentIds === "string"
      ? bookmark.parentIds.split(",")
      : [];

    const bookmarkFolders = parentIds
      .map(parentId => folders.find(folder => folder.id === parentId))
      .filter((f): f is Folder => Boolean(f));

    return {
      id: url, // Use URL as unique ID since we're grouping by URL
      title: typeof bookmark.title === "string" ? bookmark.title : "",
      url,
      folder: bookmarkFolders.map(folder => folder.title).join(", "),
      domain: domainOf(url),
      dateAdded: typeof bookmark.dateAdded === "number" ? bookmark.dateAdded : 0,
    };
  });
  // Sort by dateAdded descending (most recent first)
  bookmarks.sort((a, b) => b.dateAdded - a.dateAdded);
  return bookmarks;
}

export function loadHistory(db: Database): HistoryItem[] {
  const statement = db.prepare(
    `SELECT DISTINCT substr(moz_places.url, 1, CASE WHEN instr(moz_places.url, '?') > 0 AND instr(moz_places.url, '#') > 0 THEN min(instr(moz_places.url, '?'), instr(moz_places.url, '#')) - 1 WHEN instr(moz_places.url, '?') > 0 THEN instr(moz_places.url, '?') - 1 WHEN instr(moz_places.url, '#') > 0 THEN instr(moz_places.url, '#') - 1 ELSE length(moz_places.url) END) AS normalizedUrl, moz_places.url AS urlString, moz_places.title AS title, MAX(moz_historyvisits.visit_date) AS lastVisitDate FROM moz_places LEFT JOIN moz_historyvisits ON moz_places.id = moz_historyvisits.place_id WHERE moz_places.url IS NOT NULL AND moz_places.hidden = 0 AND moz_historyvisits.visit_date >= ((julianday('now', 'start of month', '-1 month') - 2440587.5) * 86400000000) GROUP BY normalizedUrl ORDER BY lastVisitDate DESC;`
  );
  const items: HistoryItem[] = [];
  while (statement.step()) {
    const row = statement.getAsObject();
    const url = typeof row.urlString === "string" ? row.urlString : "";
    items.push({
      id: url,
      title:
        typeof row.title === "string" && row.title
          ? row.title
          : url || "Untitled",
      url,
      domain: domainOf(url),
      lastVisitDate: typeof row.lastVisitDate === "number" ? row.lastVisitDate : 0,
    });
  }
  statement.free();
  return items;
}
