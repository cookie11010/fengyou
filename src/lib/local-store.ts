"use client";

// A tiny JSON store in localStorage, for the "demo" features that work before
// Supabase is connected (likes, saves and comments on the example stories).
//
// Read it with useLocalStore(store): it uses useSyncExternalStore, so the
// server (which has no localStorage) renders the empty value and the browser
// fills in its saved value right after, without a hydration mismatch. Every
// component using the same store re-renders when any of them writes to it.
import { useMemo, useSyncExternalStore } from "react";

export type LocalStore<T> = {
  subscribe: (listener: () => void) => () => void;
  read: () => string;
  parse: (raw: string) => T;
  write: (value: T) => void;
};

export function createLocalStore<T>(key: string, parse: (value: unknown) => T): LocalStore<T> {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read() {
      try {
        return window.localStorage.getItem(key) ?? "";
      } catch {
        return ""; // private mode or blocked storage: behave as if empty
      }
    },
    parse(raw) {
      try {
        return parse(raw ? JSON.parse(raw) : null);
      } catch {
        return parse(null);
      }
    },
    write(value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore: the change still shows for this page view */
      }
      listeners.forEach((l) => l());
    },
  };
}

export function useLocalStore<T>(store: LocalStore<T>): T {
  const raw = useSyncExternalStore(store.subscribe, store.read, () => "");
  return useMemo(() => store.parse(raw), [store, raw]);
}
