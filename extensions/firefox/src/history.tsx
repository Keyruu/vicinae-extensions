import { Icon, List } from "@vicinae/api";
import { useEffect, useState } from "react";

import { loadHistory, type HistoryItem } from "./places";
import {
  createCommonActions,
  getFirefoxProfiles,
  getStoredFirefoxProfile,
  initDatabase,
  Profile,
  showErrorToast,
  setStoredFirefoxProfile,
} from "./utils";

export default function Command() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const { profiles, defaultProfile } = await getFirefoxProfiles();
        const storedProfile = await getStoredFirefoxProfile();
        const selectedProfile =
          profiles.find((profile) => profile.path === storedProfile)?.path ??
          defaultProfile;
        if (profiles.length === 0) {
          await showErrorToast(
            "No Firefox profiles found",
            "No Firefox profiles detected on this system."
          );
        }
        setProfiles(profiles);
        setCurrentProfile(selectedProfile);
        void setStoredFirefoxProfile(selectedProfile);
      } catch (error) {
        await showErrorToast("Error loading profiles", String(error));
        setProfiles([]);
        setCurrentProfile("");
      }
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!currentProfile) return;
    (async () => {
      setIsLoading(true);
      try {

        const db = await initDatabase(currentProfile);

        const history = loadHistory(db);
        setHistory(history);
      } catch (error) {
        await showErrorToast("Error loading history", String(error));
        setHistory([]);
      }
      setIsLoading(false);
    })();
  }, [currentProfile]);

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return "";
    const date = new Date(timestamp / 1000); // Firefox stores microseconds, but actually it's microseconds since 1970-01-01
    return date.toLocaleDateString();
  };

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search Firefox history"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Profile"
          value={currentProfile}
          onChange={(value) => {
            setCurrentProfile(value);
            void setStoredFirefoxProfile(value);
          }}
        >
          {profiles.map((profile) => (
            <List.Dropdown.Item
              key={profile.path}
              icon={Icon.Person}
              title={profile.name || profile.path}
              value={profile.path}
            />
          ))}
        </List.Dropdown>
      }
    >
      {history.map((item) => (
        <List.Item
          key={item.id}
          icon={Icon.Globe01}
          title={item.title}
          subtitle={item.url}
          accessories={[{ text: formatDate(item.lastVisitDate) }]}
          actions={createCommonActions(item.url)}
        />
      ))}
      <List.EmptyView
        title="No Firefox history found"
        description="No browsing history available in Firefox."
        icon={Icon.Globe01}
      />
    </List>
  );
}
