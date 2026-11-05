import { useLayoutEffect, useMemo, useRef } from 'react';

// `any` stays in this constraint: it has to accept every action's own signature.
// Wraps each action so its identity never changes while it still calls the latest version,
// which reads the latest state.
export function useStableActions<T extends Record<string, (...args: any[]) => any>>(latest: T): T {
  const ref = useRef(latest);
  useLayoutEffect(() => {
    ref.current = latest;
  });
  return useMemo(() => {
    const stable = {} as T;
    for (const key of Object.keys(ref.current) as (keyof T)[]) {
      stable[key] = ((...args: any[]) => ref.current[key](...args)) as T[keyof T];
    }
    return stable;
  }, []);
}
