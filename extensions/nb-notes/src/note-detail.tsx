import { useEffect, useState } from "react";
import { List, Icon, Color } from "@vicinae/api";
import { showItem } from "./nb";
import { getItemMeta, parseContent, type ItemMeta } from "./metadata";

export interface CachedItem {
  content: string;
  meta: ItemMeta | null;
}

export type ContentCache = React.MutableRefObject<Record<string, CachedItem>>;

export async function prefetchItem(id: string, notebook?: string): Promise<CachedItem> {
  const [content, meta] = await Promise.all([
    showItem(id, notebook).catch(() => "*Failed to load content*"),
    getItemMeta(id, notebook).catch(() => null),
  ]);
  return { content, meta };
}

export function NoteDetail({ itemId, notebook, contentCache }: {
  itemId: string;
  notebook?: string;
  contentCache: ContentCache;
}) {
  const cached = contentCache.current[itemId];
  const [raw, setRaw] = useState<string>(cached?.content ?? "");
  const [meta, setMeta] = useState<ItemMeta | null>(cached?.meta ?? null);
  const [isLoading, setIsLoading] = useState(!cached);

  useEffect(() => {
    if (contentCache.current[itemId]) {
      const c = contentCache.current[itemId]!;
      setRaw(c.content);
      setMeta(c.meta);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    prefetchItem(itemId, notebook).then((item) => {
      if (cancelled) return;
      contentCache.current[itemId] = item;
      setRaw(item.content);
      setMeta(item.meta);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [itemId, notebook]);

  const parsed = parseContent(raw);
  const hasMeta = parsed.tags.length > 0 || parsed.due || parsed.tasks.length > 0 || parsed.related.length > 0 || meta;

  return (
    <List.Item.Detail
      isLoading={isLoading}
      markdown={raw}
      metadata={hasMeta ? (
        <List.Item.Detail.Metadata>
          {meta?.type && (
            <List.Item.Detail.Metadata.Label title="Type" text={meta.type} icon={Icon.Document} />
          )}
          {meta?.filename && (
            <List.Item.Detail.Metadata.Label title="File" text={meta.filename} />
          )}
          {meta?.added && (
            <List.Item.Detail.Metadata.Label title="Added" text={meta.added} icon={Icon.Calendar} />
          )}
          {meta?.updated && meta.updated !== meta.added && (
            <List.Item.Detail.Metadata.Label title="Updated" text={meta.updated} icon={Icon.Clock} />
          )}
          {parsed.due && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="Due" text={parsed.due} icon={{ source: Icon.Alarm, tintColor: Color.Orange }} />
            </>
          )}
          {parsed.tasks.length > 0 && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="Tasks"
                text={`${parsed.tasks.filter((t) => t.done).length}/${parsed.tasks.length} done`}
              />
              {parsed.tasks.map((task, i) => (
                <List.Item.Detail.Metadata.Label
                  key={i}
                  title=""
                  text={task.title}
                  icon={task.done
                    ? { source: Icon.CheckCircle, tintColor: Color.Green }
                    : { source: Icon.Circle, tintColor: Color.SecondaryText }
                  }
                />
              ))}
            </>
          )}
          {parsed.tags.length > 0 && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.TagList title="Tags">
                {parsed.tags.map((tag) => (
                  <List.Item.Detail.Metadata.TagList.Item key={tag} text={tag} color={Color.Blue} />
                ))}
              </List.Item.Detail.Metadata.TagList>
            </>
          )}
          {parsed.related.length > 0 && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="Related" text="" />
              {parsed.related.map((r, i) => (
                <List.Item.Detail.Metadata.Link key={i} title="" text={r} target={r.startsWith("http") ? r : ""} />
              ))}
            </>
          )}
        </List.Item.Detail.Metadata>
      ) : undefined}
    />
  );
}
