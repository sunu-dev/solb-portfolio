"use client";
import { useMemo, useSyncExternalStore } from "react";
import { DISCOVERY_PREFIX, parseDiscovery } from "@/lib/stockDiscovery";
const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener("joobi-discovery-updated", notify);
  window.addEventListener("solb-user-storage-clearing", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("joobi-discovery-updated", notify);
    window.removeEventListener("solb-user-storage-clearing", notify);
  };
};
export function useDiscoveryHistory(owner: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(DISCOVERY_PREFIX + owner) ?? "{}";
      } catch {
        return "{}";
      }
    },
    () => null,
  );
  return {
    ready: raw !== null,
    history: useMemo(() => parseDiscovery(raw), [raw]),
  };
}
