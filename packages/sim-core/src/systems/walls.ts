/**
 * Wall System
 *
 * Handles wall placement, collision detection, and enemy interaction.
 */

import { FP } from '../fixed.js';
import type { GameState, SimConfig, Wall, WallType, Enemy } from '../types.js';
import { getWallDefinition } from '../data/walls.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const WALL_DAMAGE_INTERVAL = 30; // Enemies damage walls every second (30 ticks)

// ============================================================================
// WALL PLACEMENT
// ============================================================================

/**
 * Place a new wall at the specified position
 * Returns the created wall or null if placement failed
 */
export function placeWall(
  state: GameState,
  type: WallType,
  x: number,
  y: number
): Wall | null {
  const def = getWallDefinition(type);

  // Check gold
  if (state.gold < def.goldCost) {
    return null;
  }

  // Check for overlapping walls
  const newWallLeft = x;
  const newWallRight = FP.add(x, FP.fromFloat(def.width));
  const newWallTop = y;
  const newWallBottom = FP.add(y, FP.fromFloat(def.height));

  for (const wall of state.walls) {
    const wallLeft = wall.x;
    const wallRight = FP.add(wall.x, wall.width);
    const wallTop = wall.y;
    const wallBottom = FP.add(wall.y, wall.height);

    // AABB collision check
    if (
      newWallLeft < wallRight &&
      newWallRight > wallLeft &&
      newWallTop < wallBottom &&
      newWallBottom > wallTop
    ) {
      return null; // Overlapping with existing wall
    }
  }

  // Deduct gold
  state.gold -= def.goldCost;

  // Create wall
  const wall: Wall = {
    id: state.nextWallId++,
    type,
    x: x as any,
    y: y as any,
    width: FP.fromFloat(def.width) as any,
    height: FP.fromFloat(def.height) as any,
    currentHp: def.baseHp,
    maxHp: def.baseHp,
    isGate: def.allowsFriendlies,
    slowPercent: def.slowPercent,
    placedTick: state.tick,
    lastDamagedTick: 0,
  };

  state.walls.push(wall);
  return wall;
}

/**
 * Remove a wall by ID
 */
export function removeWall(state: GameState, wallId: number): boolean {
  const index = state.walls.findIndex(w => w.id === wallId);
  if (index === -1) return false;

  state.walls.splice(index, 1);
  return true;
}

// ============================================================================
// WALL COLLISION DETECTION
// ============================================================================

/**
 * Check if an enemy is colliding with a wall
 */
export function checkEnemyWallCollision(
  enemy: Enemy,
  wall: Wall
): boolean {
  // Simple AABB collision with enemy as circle approximated to box
  const enemyLeft = FP.sub(enemy.x, enemy.radius);
  const enemyRight = FP.add(enemy.x, enemy.radius);
  const enemyTop = FP.sub(enemy.y, enemy.radius);
  const enemyBottom = FP.add(enemy.y, enemy.radius);

  const wallLeft = wall.x;
  const wallRight = FP.add(wall.x, wall.width);
  const wallTop = wall.y;
  const wallBottom = FP.add(wall.y, wall.height);

  return (
    enemyLeft < wallRight &&
    enemyRight > wallLeft &&
    enemyTop < wallBottom &&
    enemyBottom > wallTop
  );
}

/**
 * Get wall that enemy is colliding with (if any)
 */
export function getCollidingWall(
  enemy: Enemy,
  walls: Wall[]
): Wall | null {
  for (const wall of walls) {
    if (checkEnemyWallCollision(enemy, wall)) {
      return wall;
    }
  }
  return null;
}

// ============================================================================
// WALL UPDATE SYSTEM
// ============================================================================

/**
 * Update all walls - handle collisions and damage
 */
export function updateWalls(
  state: GameState,
  _config: SimConfig
): void {
  // Skip if no walls
  if (state.walls.length === 0) return;

  // Track walls to remove
  const wallsToRemove: number[] = [];

  // Check each enemy against walls
  for (const enemy of state.enemies) {
    const wall = getCollidingWall(enemy, state.walls);

    if (wall) {
      // Apply slow effect to enemy
      if (wall.slowPercent > 0) {
        // Calculate slowed speed
        const slowedSpeed = FP.mul(
          enemy.baseSpeed,
          FP.fromFloat(1 - wall.slowPercent)
        );
        // Don't slow below current speed if already slower
        if (slowedSpeed < enemy.speed) {
          enemy.speed = slowedSpeed;
        }
      }

      // Enemy attacks wall periodically
      if (state.tick - wall.lastDamagedTick >= WALL_DAMAGE_INTERVAL) {
        wall.currentHp -= enemy.damage;
        wall.lastDamagedTick = state.tick;

        // Check if wall is destroyed
        if (wall.currentHp <= 0) {
          wallsToRemove.push(wall.id);
        }
      }

      // Stop enemy movement while attacking wall (unless it's a gate for enemies)
      if (!wall.isGate) {
        enemy.vx = 0;
      }
    } else {
      // Enemy not colliding with wall - restore speed if slowed by wall
      // Speed will be recalculated by status effect system if other effects apply
    }
  }

  // Remove destroyed walls
  for (const wallId of wallsToRemove) {
    removeWall(state, wallId);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all walls in a given area
 */
export function getWallsInArea(
  walls: Wall[],
  x: number,
  y: number,
  radius: number
): Wall[] {
  const radiusSq = FP.mul(FP.fromFloat(radius), FP.fromFloat(radius));

  return walls.filter(wall => {
    // Check center of wall
    const wallCenterX = FP.add(wall.x, FP.div(wall.width, FP.fromFloat(2)));
    const wallCenterY = FP.add(wall.y, FP.div(wall.height, FP.fromFloat(2)));
    const distSq = FP.distSq(x, y, wallCenterX, wallCenterY);
    return distSq <= radiusSq;
  });
}

/**
 * Get total wall HP in an area (for fortress defense calculations)
 */
export function getTotalWallHpInArea(
  walls: Wall[],
  x: number,
  y: number,
  radius: number
): number {
  const wallsInArea = getWallsInArea(walls, x, y, radius);
  return wallsInArea.reduce((sum, wall) => sum + wall.currentHp, 0);
}

/**
 * Check if a position is valid for wall placement
 */
export function isValidWallPosition(
  state: GameState,
  config: SimConfig,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  // Convert to FP
  const fpX = FP.fromFloat(x);
  const fpY = FP.fromFloat(y);
  const fpWidth = FP.fromFloat(width);
  const fpHeight = FP.fromFloat(height);

  // Check bounds
  if (fpX < 0 || fpY < 0) return false;
  if (FP.add(fpX, fpWidth) > config.fieldWidth) return false;
  if (FP.add(fpY, fpHeight) > config.fieldHeight) return false;

  // Check not overlapping fortress
  const fortressBuffer = FP.fromFloat(3);
  if (fpX < FP.add(config.fortressX, fortressBuffer)) return false;

  // Check not overlapping existing walls
  for (const wall of state.walls) {
    if (
      fpX < FP.add(wall.x, wall.width) &&
      FP.add(fpX, fpWidth) > wall.x &&
      fpY < FP.add(wall.y, wall.height) &&
      FP.add(fpY, fpHeight) > wall.y
    ) {
      return false;
    }
  }

  return true;
}
