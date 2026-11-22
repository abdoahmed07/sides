import { useSyncExternalStore } from "react";
import { getLang, subscribe, type Lang } from "./index";

/** Re-renders the component when the language changes; returns it. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => "en");
}
