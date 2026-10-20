import { Icon, List } from "@vicinae/api";
import { useEffect, useMemo, useState } from "react";

import { getFavicons } from "./favicons";
import { loadBookmarks, loadFolders, type Bookmark, type Folder } from "./places";
import {
  createCommonActions,
  getFirefoxProfiles,
  getStoredFirefoxProfile,
  initDatabase,
  Profile,
  showErrorToast,
  setStoredFirefoxProfile,
} from "./utils";

const ALL_FOLDERS_VALUE = "folder:";
const PROFILE_VALUE_PREFIX = "profile:";
const FOLDER_VALUE_PREFIX = "folder:";

export default function Command() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState("");
  const [selectedDropdownValue, setSelectedDropdownValue] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [favicons, setFavicons] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const { profiles, defaultProfile } = await getFirefoxProfiles();
        const storedProfile = await getStoredFirefoxProfile();
        const selectedProfile =
          profiles.find((profile) => profile.path === storedProfile)?.path ??
          defaultProfile;
        const dropdownValue = selectedProfile
          ? `${PROFILE_VALUE_PREFIX}${selectedProfile}`
          : ALL_FOLDERS_VALUE;
        if (profiles.length === 0) {
          await showErrorToast(
            "No Firefox profiles found",
            "No Firefox profiles detected on this system.",
          );
        }
        setProfiles(profiles);
        setCurrentProfile(selectedProfile);
        setSelectedDropdownValue(dropdownValue);
        void setStoredFirefoxProfile(selectedProfile);
      } catch (error) {
        await showErrorToast("Error loading profiles", String(error));
        setProfiles([]);
        setCurrentProfile("");
        setSelectedDropdownValue(ALL_FOLDERS_VALUE);
      }
      setIsLoading(false);
    })();
  }, []);

  const handleDropdownChange = (value: string) => {
    setSelectedDropdownValue(value);

    if (value.startsWith(PROFILE_VALUE_PREFIX)) {
      const nextProfile = value.slice(PROFILE_VALUE_PREFIX.length);
      if (nextProfile !== currentProfile) {
        setCurrentProfile(nextProfile);
        setSelectedFolderId("");
        void setStoredFirefoxProfile(nextProfile);
      }
      return;
    }

    if (value.startsWith(FOLDER_VALUE_PREFIX)) {
      setSelectedFolderId(value.slice(FOLDER_VALUE_PREFIX.length));
    }
  };

  useEffect(() => {
    if (!currentProfile) return;
    (async () => {
      setIsLoading(true);
      try {

        const db = await initDatabase(currentProfile);

        const folders = loadFolders(db);
        setFolders(folders);

        const bookmarks = loadBookmarks(db, folders);
        setBookmarks(bookmarks);

        try {
          setFavicons(
            await getFavicons(
              currentProfile,
              bookmarks.map((bookmark) => bookmark.domain),
            ),
          );
        } catch (error) {
          setFavicons(new Map());
        }
      } catch (error) {
        await showErrorToast("Error loading bookmarks", String(error));
        setFolders([]);
        setBookmarks([]);
      }
      setIsLoading(false);
    })();
  }, [currentProfile]);

  const folderBookmarks = useMemo(() => {
    return bookmarks.filter((item) => {
      if (selectedFolderId === "") return true;
      const folder = folders.find((folder) => folder.id === selectedFolderId);
      if (!folder) return true;
      return item.folder.includes(folder.title);
    });
  }, [bookmarks, selectedFolderId, folders]);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search Firefox bookmarks"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filters"
          value={selectedDropdownValue}
          onChange={handleDropdownChange}
        >
          <List.Dropdown.Section title="Profile">
            {profiles.map((profile) => (
              <List.Dropdown.Item
                key={profile.path}
                icon={Icon.Person}
                title={profile.name || profile.path}
                value={`${PROFILE_VALUE_PREFIX}${profile.path}`}
              />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Folder">
            <List.Dropdown.Item icon={Icon.Globe01} title="All" value={ALL_FOLDERS_VALUE} />
            {folders.map((folder) => (
              <List.Dropdown.Item
                key={folder.id}
                icon={folder.icon}
                title={folder.title}
                value={`${FOLDER_VALUE_PREFIX}${folder.id}`}
              />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {folderBookmarks.map((item) => (
        <List.Item
          key={item.id}
          icon={favicons.get(item.domain) ?? Icon.Bookmark}
          title={item.title}
          subtitle={item.url}
          accessories={
            item.folder ? [{ icon: Icon.Folder, tag: item.folder }] : []
          }
          actions={createCommonActions(item.url)}
        />
      ))}
      <List.EmptyView
        title="No Firefox bookmarks found"
        description="No bookmarks available in Firefox."
        icon={Icon.Bookmark}
      />
    </List>
  );
}