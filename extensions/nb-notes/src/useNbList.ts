import { useCallback, useEffect, useRef, useState } from "react";
import { listNotebooks, currentNotebook } from "./nb";
import { prefetchItem, type CachedItem } from "./note-detail";
import { showError } from "./errors";

// list-notes and list-todos share identical notebook/loading/detail-cache
// plumbing; only the fetcher and the failure title differ. This hook owns that
// shared shell so each command is just its fetcher plus its own filter UI.
export function useNbList<T extends { id: string }>(
  fetch: (notebook?: string) => Promise<T[]>,
  failTitle: string,
) {
  const [items, setItems] = useState<T[]>([]);
  const [notebooks, setNotebooks] = useState<string[]>([]);
  const [notebook, setNotebook] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const contentCache = useRef<Record<string, CachedItem>>({});

  // fetch closes over the caller's current filter and changes every render;
  // keep it in a ref so reload can stay stable without going stale.
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;

  const reload = useCallback(async (nb?: string) => {
    setIsLoading(true);
    contentCache.current = {};
    try {
      const result = await fetchRef.current(nb || undefined);
      if (result.length > 0) {
        const first = result[0]!;
        contentCache.current[first.id] = await prefetchItem(first.id, nb || undefined);
      }
      setItems(result);
    } catch (e) {
      await showError(failTitle, e);
    } finally {
      setIsLoading(false);
    }
  }, [failTitle]);

  const refreshNotebooks = useCallback(async () => {
    const [nbs, cur] = await Promise.all([listNotebooks(), currentNotebook()]);
    setNotebooks(nbs);
    // cur is nb's actual active notebook; only fall back to first non-archived
    // if it's somehow absent from the list.
    const current = nbs.includes(cur) ? cur : nbs.find((n) => !n.includes("(archived)")) ?? nbs[0] ?? "";
    setNotebook(current);
    return current;
  }, []);

  useEffect(() => {
    refreshNotebooks();
  }, [refreshNotebooks]);

  return {
    items,
    notebooks,
    notebook,
    setNotebook,
    isLoading,
    reload,
    refreshNotebooks,
    contentCache,
  };
}
