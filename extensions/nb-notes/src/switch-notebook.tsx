import { useEffect, useState } from "react";
import { List, ActionPanel, Action, Icon, Toast, showToast, showHUD, PopToRootType } from "@vicinae/api";
import { listNotebooks, currentNotebook, useNotebook } from "./nb";
import { showError } from "./errors";

export default function SwitchNotebook() {
  const [notebooks, setNotebooks] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [nbs, cur] = await Promise.all([listNotebooks(), currentNotebook()]);
        setNotebooks(nbs);
        setCurrent(cur);
      } catch (e) {
        await showError("Failed to list notebooks", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSwitch = async (nb: string) => {
    try {
      await useNotebook(nb);
      await showToast({ style: Toast.Style.Success, title: "Switched", message: nb });
      await showHUD(`Switched to ${nb}`, { popToRootType: PopToRootType.Immediate });
    } catch (e) {
      await showError("Failed to switch notebook", e);
    }
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search notebooks...">
      {notebooks.length === 0 && !isLoading ? (
        <List.EmptyView title="No notebooks found" description="Add one with `nb notebooks add`." />
      ) : (
        notebooks.map((nb) => (
          <List.Item
            key={nb}
            title={nb}
            icon={Icon.Book}
            accessories={nb === current ? [{ icon: Icon.CheckCircle }] : undefined}
            actions={
              <ActionPanel>
                <Action title="Set as Current" icon={Icon.Switch} onAction={() => handleSwitch(nb)} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
