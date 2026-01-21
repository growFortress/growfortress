/**
 * WebSocket Client
 *
 * Manages WebSocket connection to the server for real-time updates.
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Token-based authentication
 * - Event handling for different message types
 */

import type { ServerEvent } from "@arcade/protocol";
import { CONFIG } from "../config.js";
import { getAccessToken } from "./auth.js";
import { logger } from "../utils/logger.js";

function resolveWebSocketUrl(
  protocol: string,
  host: string,
  rawUrl: string,
): string {
  if (!rawUrl) {
    return `${protocol}//${host}/api/ws`;
  }

  if (rawUrl.startsWith("ws://") || rawUrl.startsWith("wss://")) {
    return rawUrl;
  }

  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl.replace(/^http/, "ws");
  }

  if (rawUrl.startsWith("/")) {
    return `${protocol}//${host}${rawUrl}`;
  }

  return `${protocol}//${rawUrl}`;
}

// ============================================================================
// TYPES
// ============================================================================

type EventHandler<T = unknown> = (data: T) => void;
type EventType = ServerEvent["type"];

interface PendingMessage {
  type: string;
  data?: unknown;
}

// ============================================================================
// WEBSOCKET CLIENT
// ============================================================================

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private handlers = new Map<EventType, Set<EventHandler>>();
  private pendingMessages: PendingMessage[] = [];
  private isConnecting = false;
  private isManualClose = false;

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      logger.warn("[WebSocket] No access token available, cannot connect");
      return;
    }

    this.isConnecting = true;
    this.isManualClose = false;

    // Construct WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = resolveWebSocketUrl(protocol, host, CONFIG.WS_URL);
    const authProtocol = `access.${token}`;

    try {
      this.ws = new WebSocket(wsUrl, [authProtocol]);

      this.ws.onopen = () => {
        logger.user("[WebSocket] Connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        // Start ping interval
        this.startPingInterval();

        // Send any pending messages
        this.flushPendingMessages();
      };

      this.ws.onclose = (event) => {
        logger.user("[WebSocket] Disconnected:", event.code, event.reason);
        this.cleanup();

        // Attempt to reconnect if not manual close
        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        logger.error("[WebSocket] Error:", error);
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerEvent;
          this.handleMessage(message);
        } catch (error) {
          logger.error("[WebSocket] Failed to parse message:", error);
        }
      };
    } catch (error) {
      logger.error("[WebSocket] Failed to connect:", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isManualClose = true;
    this.cleanup();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
  }

  /**
   * Send a message to the server
   */
  send(type: string, data?: unknown): void {
    const message = { type, data };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.pendingMessages.push(message);
    }
  }

  /**
   * Subscribe to an event type
   */
  on<T = unknown>(type: EventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    this.handlers.get(type)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler as EventHandler);
    };
  }

  /**
   * Remove all handlers for an event type
   */
  off(type: EventType): void {
    this.handlers.delete(type);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private handleMessage(message: ServerEvent): void {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message.data);
        } catch (error) {
          logger.error("[WebSocket] Handler error:", error);
        }
      }
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.send("ping");
    }, 30000); // Every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private cleanup(): void {
    this.isConnecting = false;
    this.stopPingInterval();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn("[WebSocket] Max reconnect attempts reached");
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );

    logger.debug(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`,
    );

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift()!;
      this.send(message.type, message.data);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const wsClient = new WebSocketClient();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Connect to WebSocket server
 */
export function connectWebSocket(): void {
  wsClient.connect();
}

/**
 * Disconnect from WebSocket server
 */
export function disconnectWebSocket(): void {
  wsClient.disconnect();
}

/**
 * Subscribe to WebSocket events
 */
export function onWebSocketEvent<T = unknown>(
  type: EventType,
  handler: EventHandler<T>,
): () => void {
  return wsClient.on(type, handler);
}

/**
 * Check WebSocket connection status
 */
export function isWebSocketConnected(): boolean {
  return wsClient.isConnected();
}
