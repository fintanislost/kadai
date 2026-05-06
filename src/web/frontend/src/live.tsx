import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const LiveKeyContext = createContext<number>(0);

interface ProviderProps {
  children: ReactNode;
}

export function LiveUpdatesProvider({ children }: ProviderProps) {
  const [liveKey, setLiveKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const es = new EventSource('/api/events');

    es.onmessage = (ev) => {
      if (cancelled) return;
      try {
        const parsed = JSON.parse(ev.data) as { scope?: string };
        if (parsed.scope === 'spine') {
          setLiveKey(k => k + 1);
        }
      } catch {
        // ignore malformed payloads
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do.
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  return (
    <LiveKeyContext.Provider value={liveKey}>{children}</LiveKeyContext.Provider>
  );
}

export function useLiveKey(): number {
  return useContext(LiveKeyContext);
}
