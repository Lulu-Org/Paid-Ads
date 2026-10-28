"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type State<T> = { data: T | undefined; error: unknown; loading: boolean };

// Loads data from `api` and reloads when `deps` change. Answers to old requests are ignored,
// so typing fast in a search box never shows stale rows.
export function useApi<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: true });
  const request = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    const id = ++request.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    loadRef.current().then(
      (data) => id === request.current && setState({ data, error: null, loading: false }),
      (error) => id === request.current && setState((s) => ({ ...s, error, loading: false })),
    );
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, deps);

  return { ...state, reload };
}

export function useDebounced<T>(value: T, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
