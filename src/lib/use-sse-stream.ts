import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from './config';
import { apiClient } from './api-client';

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15000;

interface UseSSEStreamOptions<T> {
  /** API endpoint path, e.g. `/services/status/stream` */
  endpoint: string;
  /** Called when a `snapshot` (or `message`) event arrives */
  onSnapshot: (data: T) => void;
  /** Called when a `deleted` event arrives (optional) */
  onDeleted?: (data: unknown) => void;
  /** Called when a parse/connection error occurs (optional) */
  onError?: (message: string) => void;
  /** Set to `false` to suspend the connection (e.g. when ID is missing) */
  enabled?: boolean;
}

interface UseSSEStreamResult {
  isConnected: boolean;
}

/**
 * Generic hook that connects to an SSE endpoint, parses frames,
 * and dispatches snapshot/deleted events. Handles reconnection
 * with exponential backoff automatically.
 */
export function useSSEStream<T = unknown>(options: UseSSEStreamOptions<T>): UseSSEStreamResult {
  const { endpoint, onSnapshot, onDeleted, onError, enabled = true } = options;

  const [isConnected, setIsConnected] = useState(false);

  const onSnapshotRef = useRef(onSnapshot);
  const onDeletedRef = useRef(onDeleted);
  const onErrorRef = useRef(onError);
  onSnapshotRef.current = onSnapshot;
  onDeletedRef.current = onDeleted;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    let cancelled = false;
    let abortController: AbortController | null = null;
    let reconnectTimer: number | null = null;
    let retryCount = 0;

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
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
      const dataLines: string[] = [];

      for (const line of lines) {
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
        if (eventName === 'snapshot' || eventName === 'message') {
          onSnapshotRef.current(payload as T);
          return;
        }
        if (eventName === 'deleted') {
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
        const headers = new Headers({ Accept: 'text/event-stream' });
        const token = apiClient.getToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
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
        onErrorRef.current?.('Live sync disconnected. Retrying...');
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      cancelled = true;
      setIsConnected(false);
      clearReconnect();
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    };
  }, [endpoint, enabled]);

  return { isConnected };
}