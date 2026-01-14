/**
 * WebSocket Service
 *
 * This service provides helper functions for broadcasting WebSocket events.
 * It's used by other services to send real-time updates to connected clients.
 *
 * Note: The actual WebSocket infrastructure is in the websocket plugin.
 * This service just imports and uses the broadcast functions from the fastify instance.
 */

import type { FastifyInstance } from 'fastify';
import type { ServerEvent } from '@arcade/protocol';

// Reference to the fastify instance (set during app initialization)
let fastifyInstance: FastifyInstance | null = null;

/**
 * Set the fastify instance reference
 * Called during app initialization
 */
export function initWebSocketService(fastify: FastifyInstance): void {
  fastifyInstance = fastify;
}

/**
 * Broadcast an event to a specific user (all their connected devices)
 */
export function broadcastToUser(userId: string, event: ServerEvent): void {
  if (!fastifyInstance) {
    console.warn('WebSocket service not initialized, cannot broadcast');
    return;
  }
  fastifyInstance.wsBroadcastToUser(userId, event);
}

/**
 * Broadcast an event to multiple users
 */
export function broadcastToUsers(userIds: string[], event: ServerEvent): void {
  if (!fastifyInstance) {
    console.warn('WebSocket service not initialized, cannot broadcast');
    return;
  }
  fastifyInstance.wsBroadcastToUsers(userIds, event);
}

/**
 * Broadcast an event to all connected users
 */
export function broadcastToAll(event: ServerEvent): void {
  if (!fastifyInstance) {
    console.warn('WebSocket service not initialized, cannot broadcast');
    return;
  }
  fastifyInstance.wsBroadcastToAll(event);
}

/**
 * Get the number of connected users
 */
export function getConnectedUserCount(): number {
  if (!fastifyInstance) {
    return 0;
  }
  return fastifyInstance.wsConnections.size;
}

/**
 * Check if a user is currently connected
 */
export function isUserConnected(userId: string): boolean {
  if (!fastifyInstance) {
    return false;
  }
  const connections = fastifyInstance.wsConnections.get(userId);
  return connections !== undefined && connections.size > 0;
}
