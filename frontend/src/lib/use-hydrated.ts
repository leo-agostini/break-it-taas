import { useEffect, useState } from 'react';

/**
 * False during SSR and on the first client render, true afterwards.
 *
 * Use it to gate output that cannot match between server and client — most
 * often values derived from the current time or the viewer's locale.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
