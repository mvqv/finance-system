/**
 * Shariah Guard — global mode hook
 *
 * Stores the `isShariahModeEnabled` flag in localStorage so it persists
 * across page reloads without requiring a DB column or extra auth round-trip.
 * This is intentionally lightweight — the flag is purely client-side UX.
 *
 * Usage:
 *   const { isShariahModeEnabled, setShariahMode } = useShariahMode();
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "atlantix:shariah-mode";

function readFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeToStorage(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// Module-level listeners so all hook instances stay in sync within the same tab
const listeners = new Set<(v: boolean) => void>();

export function useShariahMode() {
  const [isShariahModeEnabled, setLocal] = useState<boolean>(readFromStorage);

  useEffect(() => {
    const handler = (v: boolean) => setLocal(v);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const setShariahMode = useCallback((value: boolean) => {
    writeToStorage(value);
    // Notify all hook instances in this tab
    listeners.forEach((fn) => fn(value));
  }, []);

  return { isShariahModeEnabled, setShariahMode };
}
