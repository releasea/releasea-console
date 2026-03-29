export interface LiveStateStoreEntry<T = unknown> {
  snapshot: T;
  eventId: string;
  updatedAt: number;
}

const store = new Map<string, LiveStateStoreEntry<unknown>>();

export function readLiveStateEntry<T>(key: string): LiveStateStoreEntry<T> | null {
  const normalizedKey = key.trim();
  if (!normalizedKey) return null;
  const entry = store.get(normalizedKey);
  if (!entry) return null;
  return entry as LiveStateStoreEntry<T>;
}

export function writeLiveStateEntry<T>(key: string, snapshot: T, eventId = ''): void {
  const normalizedKey = key.trim();
  if (!normalizedKey) return;
  store.set(normalizedKey, {
    snapshot,
    eventId,
    updatedAt: Date.now(),
  });
}

export function clearLiveStateEntry(key: string): void {
  const normalizedKey = key.trim();
  if (!normalizedKey) return;
  store.delete(normalizedKey);
}

export function clearAllLiveStateEntries(): void {
  store.clear();
}
