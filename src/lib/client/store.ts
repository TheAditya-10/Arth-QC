"use client";

/**
 * Client-side cache of the server state (GET /api/state).
 *
 * Screens read slices with `useStore(selector)` exactly as in Phase 1; the data
 * now comes from the database via the API. Mutations call route handlers and then
 * `refresh()` so every screen re-renders from authoritative server data.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { AppState } from "@/types/app-state";
import { api } from "./api";

export type DemoDB = AppState; // kept for backwards compatibility with Phase 1 components
export type { AppState };

const ACTIVE_STUDENT_KEY = "arthqc.activeStudent";

let state: AppState | null = null;
let error: Error | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
/** Celebrations dismissed in this tab (guards against a refresh racing the "celebrated" POST). */
export const dismissedCelebrations = new Set<string>();
const emit = () => listeners.forEach((l) => l());

function activeStudentParam() {
  try {
    const id = window.localStorage.getItem(ACTIVE_STUDENT_KEY);
    return id ? `?studentId=${encodeURIComponent(id)}` : "";
  } catch {
    return "";
  }
}

/** Fetch fresh state from the server (deduplicated). */
export function refresh(): Promise<void> {
  if (inflight) return inflight;
  inflight = api<AppState>("GET", `/api/state${activeStudentParam()}`)
    .then((s) => {
      state = { ...s, celebrations: s.celebrations.filter((c) => !dismissedCelebrations.has(c)) };
      error = null;
    })
    .catch((e) => {
      error = e instanceof Error ? e : new Error(String(e));
      // A stale/foreign student id: fall back to the default student.
      try {
        window.localStorage.removeItem(ACTIVE_STUDENT_KEY);
      } catch {}
    })
    .finally(() => {
      inflight = null;
      emit();
    });
  return inflight;
}

export function getDB(): AppState {
  if (!state) throw new Error("State not loaded yet");
  return state;
}

export function peekState(): AppState | null {
  return state;
}

/** Optimistic local update (e.g. chat bubbles) — the next refresh() replaces it. */
export function setDB(updater: (db: AppState) => AppState) {
  if (!state) return;
  state = updater(state);
  emit();
}

export function setActiveStudent(id: string) {
  try {
    window.localStorage.setItem(ACTIVE_STUDENT_KEY, id);
  } catch {}
  state = null;
  emit();
  return refresh();
}

/** Clear cached data (on sign-out). */
export function resetStore() {
  state = null;
  error = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!state && !inflight) void refresh();
  const onFocus = () => {
    if (document.visibilityState === "visible") void refresh();
  };
  document.addEventListener("visibilitychange", onFocus);
  return () => {
    listeners.delete(listener);
    document.removeEventListener("visibilitychange", onFocus);
  };
}

/**
 * Subscribe to a slice of server state. Returns `undefined` while loading so pages
 * show skeletons. The selector must return a reference stored in the state.
 */
export function useStore<T>(selector: (db: AppState) => T): T | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (state ? selector(state) : undefined),
    () => undefined,
  );
}

export function useStoreError(): Error | null {
  return useSyncExternalStore(subscribe, () => error, () => null);
}

/** Refetch on mount (e.g. when a page needs the latest data). */
export function useRefreshOnMount() {
  useEffect(() => {
    void refresh();
  }, []);
}
