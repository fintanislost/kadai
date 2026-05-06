import { useEffect, useState } from 'react';
import { getTransitions, setItemStatus } from '../api';
import type { Status } from '../types';

interface Props {
  itemId: string;
  currentStatus: Status;
  onStatusChange: (newStatus: Status) => void;
}

export function StatusPanel({ itemId, currentStatus, onStatusChange }: Props) {
  const [allowed, setAllowed] = useState<Status[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getTransitions(itemId).then(t => setAllowed(t?.allowed ?? []));
  }, [itemId, currentStatus]);

  async function move(target: Status) {
    setPending(true);
    setError(null);
    const previous = currentStatus;
    onStatusChange(target);
    try {
      await setItemStatus(itemId, target);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onStatusChange(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-panel rounded p-3 space-y-2">
      <div className="text-xs font-bold uppercase tracking-wider text-muted">Status</div>
      <div className="text-sm">{currentStatus}</div>
      {allowed.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-zinc-800">
          <div className="text-[10px] text-muted uppercase">Move to</div>
          {allowed.map(s => (
            <button
              key={s}
              disabled={pending}
              onClick={() => move(s)}
              className="block w-full text-left text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="text-xs text-red-400 pt-2 border-t border-zinc-800">{error}</div>
      )}
    </div>
  );
}
