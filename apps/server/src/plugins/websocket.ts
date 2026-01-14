import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import { WebSocket } from "ws";
import { verifyAccessToken } from "../lib/tokens.js";
import { redis } from "../lib/redis.js";
import type { ServerEvent } from "@arcade/protocol";

// Connection storage: userId -> Set of WebSocket connections
const userConnections = new Map<string, Set<WebSocket>>();

const WS_PROTOCOL_PREFIX = "access.";

function extractTokenFromProtocols(
  protocolHeader?: string | string[],
): string | null {
  if (!protocolHeader) {
    return null;
  }

  const headerValue = Array.isArray(protocolHeader)
    ? protocolHeader.join(",")
    : protocolHeader;
  const protocols = headerValue.split(",").map((value) => value.trim());
  const match = protocols.find((value) => value.startsWith(WS_PROTOCOL_PREFIX));

  if (!match) {
    return null;
  }

  return match.slice(WS_PROTOCOL_PREFIX.length);
}

// Redis pub/sub channels
const REDIS_WS_CHANNEL = "ws:broadcast";

declare module "fastify" {
  interface FastifyInstance {
    wsConnections: Map<string, Set<WebSocket>>;
    wsBroadcastToUser: (userId: string, event: ServerEvent) => void;
    wsBroadcastToUsers: (userIds: string[], event: ServerEvent) => void;
    wsBroadcastToAll: (event: ServerEvent) => void;
  }
}

/**
 * Add a connection for a user
 */
function addConnection(userId: string, ws: WebSocket): void {
  let connections = userConnections.get(userId);
  if (!connections) {
    connections = new Set();
    userConnections.set(userId, connections);
  }
  connections.add(ws);
}

/**
 * Remove a connection for a user
 */
function removeConnection(userId: string, ws: WebSocket): void {
  const connections = userConnections.get(userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  }
}

/**
 * Send an event to all connections of a user
 */
function sendToUser(userId: string, event: ServerEvent): void {
  const connections = userConnections.get(userId);
  if (connections) {
    const message = JSON.stringify(event);
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

/**
 * Send an event to multiple users
 */
function sendToUsers(userIds: string[], event: ServerEvent): void {
  const message = JSON.stringify(event);
  for (const userId of userIds) {
    const connections = userConnections.get(userId);
    if (connections) {
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    }
  }
}

/**
 * Send an event to all connected users
 */
function sendToAll(event: ServerEvent): void {
  const message = JSON.stringify(event);
  for (const connections of userConnections.values()) {
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  // Register the websocket plugin
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
      clientTracking: false, // We handle our own tracking
    },
  });

  // Decorate fastify with connection map and broadcast functions
  fastify.decorate("wsConnections", userConnections);

  fastify.decorate(
    "wsBroadcastToUser",
    (userId: string, event: ServerEvent) => {
      // Send locally
      sendToUser(userId, event);

      // Publish to Redis for other instances
      redis
        .publish(
          REDIS_WS_CHANNEL,
          JSON.stringify({
            type: "user",
            userId,
            event,
          }),
        )
        .catch((err) => {
          fastify.log.error(
            { err },
            "Failed to publish WebSocket event to Redis",
          );
        });
    },
  );

  fastify.decorate(
    "wsBroadcastToUsers",
    (userIds: string[], event: ServerEvent) => {
      // Send locally
      sendToUsers(userIds, event);

      // Publish to Redis for other instances
      redis
        .publish(
          REDIS_WS_CHANNEL,
          JSON.stringify({
            type: "users",
            userIds,
            event,
          }),
        )
        .catch((err) => {
          fastify.log.error(
            { err },
            "Failed to publish WebSocket event to Redis",
          );
        });
    },
  );

  fastify.decorate("wsBroadcastToAll", (event: ServerEvent) => {
    // Send locally
    sendToAll(event);

    // Publish to Redis for other instances
    redis
      .publish(
        REDIS_WS_CHANNEL,
        JSON.stringify({
          type: "all",
          event,
        }),
      )
      .catch((err) => {
        fastify.log.error(
          { err },
          "Failed to publish WebSocket event to Redis",
        );
      });
  });

  // Subscribe to Redis for cross-instance messaging
  const subscriber = redis.duplicate();
  await subscriber.subscribe(REDIS_WS_CHANNEL);

  subscriber.on("message", (channel, message) => {
    if (channel !== REDIS_WS_CHANNEL) return;

    try {
      const data = JSON.parse(message);

      if (data.type === "user" && data.userId && data.event) {
        sendToUser(data.userId, data.event);
      } else if (data.type === "users" && data.userIds && data.event) {
        sendToUsers(data.userIds, data.event);
      } else if (data.type === "all" && data.event) {
        sendToAll(data.event);
      }
    } catch (err) {
      fastify.log.error(
        { err, message },
        "Failed to process Redis WebSocket message",
      );
    }
  });

  // Cleanup on close
  fastify.addHook("onClose", async () => {
    await subscriber.unsubscribe(REDIS_WS_CHANNEL);
    await subscriber.quit();

    // Close all connections
    for (const connections of userConnections.values()) {
      for (const ws of connections) {
        ws.close(1001, "Server shutting down");
      }
    }
    userConnections.clear();
  });

  // WebSocket route for client connections
  fastify.get(
    "/ws",
    { websocket: true, config: { public: true } },
    async (socket, request) => {
      const token = extractTokenFromProtocols(
        request.headers["sec-websocket-protocol"],
      );

      if (!token) {
        socket.close(4001, "Missing token");
        return;
      }

      const payload = await verifyAccessToken(token);
      if (!payload) {
        socket.close(4002, "Invalid token");
        return;
      }

      const userId = payload.sub;
      if (!userId) {
        socket.close(4003, "Invalid token payload");
        return;
      }

      // Add connection
      addConnection(userId, socket);
      fastify.log.info({ userId }, "WebSocket connected");

      // Send connected event with initial data
      const { getUnreadCounts } = await import("../services/messages.js");
      const unreadCounts = await getUnreadCounts(userId);

      socket.send(
        JSON.stringify({
          type: "connected",
          data: {
            userId,
            unreadCounts,
          },
        } satisfies ServerEvent),
      );

      // Handle incoming messages
      socket.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === "ping") {
            socket.send(
              JSON.stringify({
                type: "pong",
                data: { timestamp: Date.now() },
              }),
            );
          }
          // Future: handle subscribe/unsubscribe events
        } catch {
          // Ignore invalid messages
        }
      });

      // Handle connection close
      socket.on("close", () => {
        removeConnection(userId, socket);
        fastify.log.info({ userId }, "WebSocket disconnected");
      });

      // Handle errors
      socket.on("error", (err: Error) => {
        fastify.log.error({ err, userId }, "WebSocket error");
        removeConnection(userId, socket);
      });

      // Heartbeat - close connection if no pong received
      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.ping();
        }
      }, 30000); // 30 seconds

      socket.on("close", () => {
        clearInterval(pingInterval);
      });
    },
  );
};

export default fp(websocketPlugin, {
  name: "websocket",
  dependencies: [],
});
