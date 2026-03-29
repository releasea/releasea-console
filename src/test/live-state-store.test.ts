import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearAllLiveStateEntries,
  clearLiveStateEntry,
  readLiveStateEntry,
  writeLiveStateEntry,
} from '@/lib/live-state-store';

describe('live-state-store', () => {
  beforeEach(() => {
    clearAllLiveStateEntries();
  });

  it('stores and restores shared live-state snapshots', () => {
    writeLiveStateEntry('services-status', { services: [{ id: 'svc-1' }] }, 'cursor-1');

    const entry = readLiveStateEntry<{ services: Array<{ id: string }> }>('services-status');
    expect(entry).not.toBeNull();
    expect(entry?.eventId).toBe('cursor-1');
    expect(entry?.snapshot.services[0]?.id).toBe('svc-1');
  });

  it('clears entries explicitly', () => {
    writeLiveStateEntry('service:svc-1', { id: 'svc-1' }, 'cursor-2');
    clearLiveStateEntry('service:svc-1');
    expect(readLiveStateEntry('service:svc-1')).toBeNull();
  });
});
