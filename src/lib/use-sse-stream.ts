import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from './config';
import { apiClient } from './api-client';
import type { LiveStateChangeEvent } from '@/types/releasea';
import { clearLiveStateEntry, readLiveStateEntry, writeLiveStateEntry } from './live-state-store';

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15000;

const generateCorrelationId = (): string => {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) {
    return randomUUID();
  }
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

interface UseSSEStreamOptions<T> {
  /** API endpoint path, e.g. `/services/status/stream` */
  endpoint: string;
  /** Called when a `snapshot` (or `message`) event arrives */
  onSnapshot: (data: T) => void;
  /** Called when a `deleted` event arrives (optional) */
  onDeleted?: (data: unknown) => void;
  /** Called when a parse/connection error occurs (optional) */
  onError?: (message: string) => void;
  /** Called for lightweight change events emitted before or alongside snapshots */
  onEvent?: (event: LiveStateChangeEvent) => void;
  /** Called when the server asks the client to re-sync from a full snapshot */
  onResyncRequired?: (event: LiveStateChangeEvent) => void;
  /** Set to `false` to suspend the connection (e.g. when ID is missing) */
  enabled?: boolean;
  /** Shared key for snapshot restoration between remounts and sibling views. */
  storeKey?: string;
  /** Batch bursty snapshot updates before repaint. */
  coalesceMs?: number;
  /** Pause the live stream while the tab is hidden. */
  pauseWhenHidden?: boolean;
}

interface UseSSEStreamResult {
  isConnected: boolean;
  isPaused: boolean;
}

/**
 * Generic hook that connects to an SSE endpoint, parses frames,
 * and dispatches snapshot/deleted events. Handles reconnection
 * with exponential backoff automatically.
 */
export function useSSEStream<T = unknown>(options: UseSSEStreamOptions<T>): UseSSEStreamResult {
  const {
    endpoint,
    onSnapshot,
    onDeleted,
    onError,
    onEvent,
    onResyncRequired,
    enabled = true,
    storeKey,
    coalesceMs = 120,
    pauseWhenHidden = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(
    pauseWhenHidden && typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false,
  );

  const onSnapshotRef = useRef(onSnapshot);
  const onDeletedRef = useRef(onDeleted);
  const onErrorRef = useRef(onError);
  const onEventRef = useRef(onEvent);
  const onResyncRequiredRef = useRef(onResyncRequired);
  const lastEventIdRef = useRef('');
  onSnapshotRef.current = onSnapshot;
  onDeletedRef.current = onDeleted;
  onErrorRef.current = onError;
  onEventRef.current = onEvent;
  onResyncRequiredRef.current = onResyncRequired;

  useEffect(() => {
    if (!pauseWhenHidden || typeof document === 'undefined') {
      setIsPaused(false);
      return;
    }
    const updateVisibility = () => {
      setIsPaused(document.visibilityState === 'hidden');
    };
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, [pauseWhenHidden]);

  useEffect(() => {
    if (!enabled || !endpoint) {
      setIsConnected(false);
      setIsPaused(false);
      return undefined;
    }

    if (pauseWhenHidden && isPaused) {
      setIsConnected(false);
      return undefined;
    }

    let cancelled = false;
    let abortController: AbortController | null = null;
    let reconnectTimer: number | null = null;
    let retryCount = 0;
    let consecutiveFailures = 0;
    let coalesceTimer: number | null = null;
    let pendingSnapshot: T | null = null;
    const resolvedStoreKey = (storeKey ?? endpoint).trim();

    if (resolvedStoreKey) {
      const cached = readLiveStateEntry<T>(resolvedStoreKey);
      if (cached) {
        lastEventIdRef.current = cached.eventId;
        onSnapshotRef.current(cached.snapshot);
      }
    }

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const clearCoalescing = () => {
      if (coalesceTimer !== null) {
        window.clearTimeout(coalesceTimer);
        coalesceTimer = null;
      }
      pendingSnapshot = null;
    };

    const flushSnapshot = () => {
      coalesceTimer = null;
      if (pendingSnapshot === null) return;
      const snapshot = pendingSnapshot;
      pendingSnapshot = null;
      onSnapshotRef.current(snapshot);
    };

    const deliverSnapshot = (payload: T) => {
      if (coalesceMs <= 0) {
        onSnapshotRef.current(payload);
        return;
      }
      pendingSnapshot = payload;
      if (coalesceTimer !== null) {
        return;
      }
      coalesceTimer = window.setTimeout(flushSnapshot, coalesceMs);
    };

    const scheduleReconnect = () => {
      clearReconnect();
      retryCount += 1;
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (retryCount - 1));
      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, delay);
    };

    const handleFrame = (frame: string) => {
      const lines = frame.split(/\r?\n/);
      let eventName = 'message';
      let eventId = '';
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('id:')) {
          eventId = line.slice('id:'.length).trim();
          continue;
        }
        if (line.startsWith('event:')) {
          eventName = line.slice('event:'.length).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trimStart());
        }
      }

      if (dataLines.length === 0) return;

      try {
        const payload = JSON.parse(dataLines.join('\n'));
        if (eventId) {
          lastEventIdRef.current = eventId;
        }
        if (eventName === 'snapshot' || eventName === 'message') {
          if (resolvedStoreKey) {
            writeLiveStateEntry(resolvedStoreKey, payload as T, lastEventIdRef.current);
          }
          deliverSnapshot(payload as T);
          return;
        }
        if (eventName === 'change') {
          onEventRef.current?.(payload as LiveStateChangeEvent);
          return;
        }
        if (eventName === 'resync-required') {
          const event = payload as LiveStateChangeEvent;
          onResyncRequiredRef.current?.(event);
          return;
        }
        if (eventName === 'deleted') {
          if (resolvedStoreKey) {
            clearLiveStateEntry(resolvedStoreKey);
          }
          onDeletedRef.current?.(payload);
        }
      } catch {
        onErrorRef.current?.('Unable to parse live status update.');
      }
    };

    const connect = async () => {
      if (cancelled) return;

      if (abortController) {
        abortController.abort();
      }
      const controller = new AbortController();
      abortController = controller;

      try {
        const headers = new Headers({
          Accept: 'text/event-stream',
          'X-Correlation-ID': generateCorrelationId(),
          'X-Requested-With': 'XMLHttpRequest',
        });
        const token = apiClient.getToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        if (lastEventIdRef.current) {
          headers.set('Last-Event-ID', lastEventIdRef.current);
        }

        const response = await fetch(getApiUrl(endpoint), {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          if (response.status === 404) {
            onErrorRef.current?.('Resource not found.');
            return;
          }
          throw new Error(`Stream failed with status ${response.status}`);
        }

        setIsConnected(true);
        retryCount = 0;
        consecutiveFailures = 0;
        clearReconnect();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled && !controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, '\n');
          let idx = buffer.indexOf('\n\n');
          while (idx !== -1) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            if (frame.trim().length > 0 && !frame.trimStart().startsWith(':')) {
              handleFrame(frame);
            }
            idx = buffer.indexOf('\n\n');
          }
        }

        setIsConnected(false);
        if (!cancelled && !controller.signal.aborted) {
          scheduleReconnect();
        }
      } catch {
        if (cancelled || controller.signal.aborted) return;
        setIsConnected(false);
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) {
          onErrorRef.current?.('Live sync disconnected. Retrying...');
        }
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      cancelled = true;
      setIsConnected(false);
      clearReconnect();
      clearCoalescing();
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    };
  }, [coalesceMs, endpoint, enabled, isPaused, pauseWhenHidden, storeKey]);

  return { isConnected, isPaused };
}
