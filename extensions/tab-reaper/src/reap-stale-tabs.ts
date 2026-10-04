import {
  BrowserExtension,
  LaunchType,
  getPreferenceValues,
  showHUD,
  type LaunchProps,
} from "@vicinae/api";

const DEFAULT_MAX_AGE_MINUTES = 60;

export default async function ReapStaleTabs(props: LaunchProps) {
  const prefs = getPreferenceValues<{ maxAgeMinutes?: string }>();
  const maxAgeMinutes =
    Number.parseInt(prefs.maxAgeMinutes ?? "", 10) || DEFAULT_MAX_AGE_MINUTES;
  const cutoff = Date.now() - maxAgeMinutes * 60_000;

  let closed = 0;
  for (const tab of await BrowserExtension.getTabs()) {
    // 0 = the browser didn't report a last access time; never reap those.
    if (tab.active || tab.pinned || tab.audible || !tab.lastAccessed || tab.lastAccessed >= cutoff) {
      continue;
    }
    tab.close();
    closed++;
  }

  if (props.launchType !== LaunchType.Background && closed > 0) {
    await showHUD(`Closed ${closed} stale tab${closed === 1 ? "" : "s"}`);
  }
}
