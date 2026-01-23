/**
 * Physics System
 * 2D physics with fixed-point math for deterministic simulation
 */

import { FP } from './fixed';
import type { FP as FPType } from './types';

// ============================================================================
// SPATIAL HASH - Optimized O(n) collision detection
// ============================================================================

/**
 * Spatial hash grid for efficient neighbor queries.
 * Instead of O(n²) pairwise checks, we only check bodies in nearby cells.
 */
export class SpatialHash<T extends { x: FPType; y: FPType }> {
  private cellSize: number;
  private cells: Map<number, T[]> = new Map();
  private cellsPerRow: number;

  constructor(cellSize: number = 4, fieldWidth: number = 40, _fieldHeight: number = 15) {
    this.cellSize = cellSize;
    this.cellsPerRow = Math.ceil(fieldWidth / cellSize);
  }

  /**
   * Clear all cells
   */
  clear(): void {
    this.cells.clear();
  }

  /**
   * Get cell key from position
   */
  private getCellKey(x: number, y: number): number {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return cellY * this.cellsPerRow + cellX;
  }

  /**
   * Insert a body into the spatial hash
   */
  insert(body: T): void {
    const x = FP.toFloat(body.x);
    const y = FP.toFloat(body.y);
    const key = this.getCellKey(x, y);

    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(body);
  }

  /**
   * Insert multiple bodies
   */
  insertAll(bodies: T[]): void {
    for (const body of bodies) {
      this.insert(body);
    }
  }

  /**
   * Get all potential neighbors of a body (bodies in same and adjacent cells)
   */
  getNearby(body: T): T[] {
    const x = FP.toFloat(body.x);
    const y = FP.toFloat(body.y);
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);

    const nearby: T[] = [];

    // Check 3x3 grid of cells around the body
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cellX + dx;
        const ny = cellY + dy;

        // Bounds check
        if (nx < 0 || ny < 0 || nx >= this.cellsPerRow) continue;

        const key = ny * this.cellsPerRow + nx;
        const cell = this.cells.get(key);
        if (cell) {
          for (const other of cell) {
            if (other !== body) {
              nearby.push(other);
            }
          }
        }
      }
    }

    return nearby;
  }

  /**
   * Iterate over all unique pairs of nearby bodies.
   * This is the optimized replacement for O(n²) nested loops.
   */
  forEachNearbyPair(callback: (a: T, b: T) => void): void {
    // Track which pairs we've already processed
    const processed = new Set<string>();

    for (const [_key, cell] of this.cells) {
      for (const body of cell) {
        const nearby = this.getNearby(body);
        for (const other of nearby) {
          // Create a unique pair ID (order-independent)
          const pairId = body < other
            ? `${(body as any).id ?? body}-${(other as any).id ?? other}`
            : `${(other as any).id ?? other}-${(body as any).id ?? body}`;

          if (!processed.has(pairId)) {
            processed.add(pairId);
            callback(body, other);
          }
        }
      }
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * 2D Vector in fixed-point format
 */
export interface Vec2FP {
  x: FPType;
  y: FPType;
}

/**
 * Movement speed modifier from buffs/debuffs
 */
export interface MovementModifier {
  id: string;
  multiplier: FPType; // FP format: FP.ONE = 100%, FP.HALF = 50%
  expirationTick: number;
}

/**
 * Physics body for any movable entity
 */
export interface PhysicsBody {
  x: FPType;
  y: FPType;
  vx: FPType;
  vy: FPType;
  radius: FPType;
  mass: FPType;
}

/**
 * Collision detection result
 */
export interface CollisionResult {
  overlap: FPType;
  normalX: FPType;
  normalY: FPType;
}

/**
 * Physics configuration constants
 */
export interface PhysicsConfig {
  defaultFriction: FPType;
  separationForce: FPType;
  separationRadius: FPType;
  fieldMinX: FPType;
  fieldMaxX: FPType;
  fieldMinY: FPType;
  fieldMaxY: FPType;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default physics configuration */
export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  defaultFriction: FP.fromFloat(0.85),        // 85% velocity retained per tick
  separationForce: FP.fromFloat(0.5),         // Push-apart force
  separationRadius: FP.fromFloat(2.0),        // Distance at which separation activates
  fieldMinX: FP.fromInt(0),
  fieldMaxX: FP.fromInt(40),
  fieldMinY: FP.fromInt(0),
  fieldMaxY: FP.fromInt(15),
};

/** Hero physics constants */
export const HERO_PHYSICS = {
  acceleration: FP.fromFloat(0.02),           // Units per tick^2
  friction: FP.fromFloat(0.9),                // Friction coefficient
  defaultRadius: FP.fromFloat(1.0),           // Collision radius
  defaultMass: FP.fromFloat(1.0),             // Mass
  separationForce: FP.fromFloat(0.3),         // How strongly heroes push apart
};

/** Enemy physics constants */
export const ENEMY_PHYSICS = {
  friction: FP.fromFloat(0.95),               // Less friction than heroes
  defaultRadius: FP.fromFloat(0.8),           // Smaller collision radius
  defaultMass: FP.fromFloat(1.0),             // Mass
  laneHeight: FP.fromFloat(3.0),              // Height of each lane
  numLanes: 3,                                // Number of movement lanes
};

// ============================================================================
// VECTOR OPERATIONS
// ============================================================================

export const Vec2 = {
  /**
   * Create a zero vector
   */
  zero(): Vec2FP {
    return { x: 0, y: 0 };
  },

  /**
   * Create a vector from fixed-point values
   */
  create(x: FPType, y: FPType): Vec2FP {
    return { x, y };
  },

  /**
   * Create a vector from float values
   */
  fromFloat(x: number, y: number): Vec2FP {
    return { x: FP.fromFloat(x), y: FP.fromFloat(y) };
  },

  /**
   * Add two vectors
   */
  add(a: Vec2FP, b: Vec2FP): Vec2FP {
    return { x: FP.add(a.x, b.x), y: FP.add(a.y, b.y) };
  },

  /**
   * Subtract vectors (a - b)
   */
  sub(a: Vec2FP, b: Vec2FP): Vec2FP {
    return { x: FP.sub(a.x, b.x), y: FP.sub(a.y, b.y) };
  },

  /**
   * Scale vector by scalar
   */
  scale(v: Vec2FP, s: FPType): Vec2FP {
    return { x: FP.mul(v.x, s), y: FP.mul(v.y, s) };
  },

  /**
   * Dot product
   */
  dot(a: Vec2FP, b: Vec2FP): FPType {
    return FP.add(FP.mul(a.x, b.x), FP.mul(a.y, b.y));
  },

  /**
   * Length squared (avoids sqrt)
   */
  lengthSq(v: Vec2FP): FPType {
    return FP.add(FP.mul(v.x, v.x), FP.mul(v.y, v.y));
  },

  /**
   * Length
   */
  length(v: Vec2FP): FPType {
    return FP.sqrt(Vec2.lengthSq(v));
  },

  /**
   * Distance between two points
   */
  distance(a: Vec2FP, b: Vec2FP): FPType {
    return Vec2.length(Vec2.sub(b, a));
  },

  /**
   * Distance squared between two points
   */
  distanceSq(a: Vec2FP, b: Vec2FP): FPType {
    return Vec2.lengthSq(Vec2.sub(b, a));
  },

  /**
   * Normalize vector (returns unit vector)
   * 
   * For very small distances (<= EPSILON), returns deterministic (1, 0) to prevent desync
   * from division by near-zero values and micro-differences in sqrt precision.
   */
  normalize(v: Vec2FP): Vec2FP {
    const lenSq = Vec2.lengthSq(v);
    if (lenSq === 0) return { x: 0, y: 0 };
    
    // Check if distance is very small (below epsilon threshold)
    // Use squared comparison to avoid sqrt for the check
    const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
    if (lenSq <= epsilonSq) {
      // Deterministic fallback: return (1, 0) for very small distances
      // This prevents desync from micro-differences in sqrt precision
      return { x: FP.ONE, y: 0 };
    }
    
    const len = Vec2.length(v);
    return { x: FP.div(v.x, len), y: FP.div(v.y, len) };
  },

  /**
   * Linear interpolation between two vectors
   */
  lerp(a: Vec2FP, b: Vec2FP, t: FPType): Vec2FP {
    return {
      x: FP.lerp(a.x, b.x, t),
      y: FP.lerp(a.y, b.y, t),
    };
  },

  /**
   * Clamp vector components
   */
  clamp(v: Vec2FP, minX: FPType, maxX: FPType, minY: FPType, maxY: FPType): Vec2FP {
    return {
      x: FP.clamp(v.x, minX, maxX),
      y: FP.clamp(v.y, minY, maxY),
    };
  },
};

// ============================================================================
// PHYSICS FUNCTIONS
// ============================================================================

/**
 * Apply velocity to position (integrate position)
 * position += velocity * dt
 */
export function integratePosition(body: PhysicsBody): void {
  body.x = FP.add(body.x, body.vx);
  body.y = FP.add(body.y, body.vy);
}

/**
 * Apply acceleration to velocity
 * velocity += acceleration
 */
export function applyAcceleration(
  body: PhysicsBody,
  ax: FPType,
  ay: FPType
): void {
  body.vx = FP.add(body.vx, ax);
  body.vy = FP.add(body.vy, ay);
}

/**
 * Apply friction to velocity
 * velocity *= friction
 */
export function applyFriction(body: PhysicsBody, friction: FPType): void {
  body.vx = FP.mul(body.vx, friction);
  body.vy = FP.mul(body.vy, friction);
}

/**
 * Clamp velocity to maximum speed
 */
export function clampVelocity(body: PhysicsBody, maxSpeed: FPType): void {
  const speedSq = FP.add(FP.mul(body.vx, body.vx), FP.mul(body.vy, body.vy));
  const maxSpeedSq = FP.mul(maxSpeed, maxSpeed);

  if (speedSq > maxSpeedSq) {
    // Check if speed is very small (below epsilon threshold)
    const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
    if (speedSq <= epsilonSq) {
      // Very small speed, set to zero to prevent desync
      body.vx = 0;
      body.vy = 0;
      return;
    }
    const speed = FP.sqrt(speedSq);
    const scale = FP.div(maxSpeed, speed);
    body.vx = FP.mul(body.vx, scale);
    body.vy = FP.mul(body.vy, scale);
  }
}

/**
 * Clamp position to field boundaries
 */
export function clampToField(body: PhysicsBody, config: PhysicsConfig): void {
  // Clamp X with radius consideration
  const minX = FP.add(config.fieldMinX, body.radius);
  const maxX = FP.sub(config.fieldMaxX, body.radius);
  body.x = FP.clamp(body.x, minX, maxX);

  // Clamp Y with radius consideration
  const minY = FP.add(config.fieldMinY, body.radius);
  const maxY = FP.sub(config.fieldMaxY, body.radius);
  body.y = FP.clamp(body.y, minY, maxY);

  // Zero out velocity if hitting boundary
  if (body.x === minX || body.x === maxX) {
    body.vx = 0;
  }
  if (body.y === minY || body.y === maxY) {
    body.vy = 0;
  }
}

/**
 * Detect circle-circle collision
 * Returns collision info if overlapping, null otherwise
 */
export function detectCircleCollision(
  a: PhysicsBody,
  b: PhysicsBody
): CollisionResult | null {
  const dx = FP.sub(b.x, a.x);
  const dy = FP.sub(b.y, a.y);
  const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

  const minDist = FP.add(a.radius, b.radius);
  const minDistSq = FP.mul(minDist, minDist);

  if (distSq >= minDistSq) {
    return null; // No collision
  }

  // Check if distance is very small (below epsilon threshold)
  // Use squared comparison to avoid sqrt for the check
  const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
  if (distSq <= epsilonSq) {
    // Objects are very close or overlapping
    // Deterministic fallback: push in X direction and distribute overlap deterministically
    return {
      overlap: minDist,
      normalX: FP.ONE,
      normalY: 0,
    };
  }

  const dist = FP.sqrt(distSq);
  const overlap = FP.sub(minDist, dist);
  const normalX = FP.div(dx, dist);
  const normalY = FP.div(dy, dist);

  return { overlap, normalX, normalY };
}

/**
 * Resolve collision between two physics bodies
 * Pushes bodies apart based on their masses
 */
export function resolveCollision(
  a: PhysicsBody,
  b: PhysicsBody,
  collision: CollisionResult
): void {
  const totalMass = FP.add(a.mass, b.mass);
  if (totalMass === 0) return;

  // Calculate how much each body should move (inverse mass ratio)
  const ratioA = FP.div(b.mass, totalMass);
  const ratioB = FP.div(a.mass, totalMass);

  // Push bodies apart
  const pushX = FP.mul(collision.normalX, collision.overlap);
  const pushY = FP.mul(collision.normalY, collision.overlap);

  // Move A in negative normal direction
  a.x = FP.sub(a.x, FP.mul(pushX, ratioA));
  a.y = FP.sub(a.y, FP.mul(pushY, ratioA));

  // Move B in positive normal direction
  b.x = FP.add(b.x, FP.mul(pushX, ratioB));
  b.y = FP.add(b.y, FP.mul(pushY, ratioB));

  // Optional: Apply bounce/velocity exchange
  // For now, just zero out velocity component in collision direction
  const vDotN_A = FP.add(FP.mul(a.vx, collision.normalX), FP.mul(a.vy, collision.normalY));
  const vDotN_B = FP.add(FP.mul(b.vx, collision.normalX), FP.mul(b.vy, collision.normalY));

  // Remove velocity component in collision direction (dampen collision)
  if (vDotN_A > 0) {
    a.vx = FP.sub(a.vx, FP.mul(collision.normalX, vDotN_A));
    a.vy = FP.sub(a.vy, FP.mul(collision.normalY, vDotN_A));
  }
  if (vDotN_B < 0) {
    b.vx = FP.sub(b.vx, FP.mul(collision.normalX, vDotN_B));
    b.vy = FP.sub(b.vy, FP.mul(collision.normalY, vDotN_B));
  }
}

/**
 * Apply separation force between nearby bodies
 * Prevents stacking by gently pushing apart
 *
 * NOTE: This is the O(n²) version, kept for compatibility.
 * For better performance with many bodies, use applySeparationForceOptimized.
 */
export function applySeparationForce(
  bodies: PhysicsBody[],
  separationRadius: FPType,
  separationForce: FPType
): void {
  // For small arrays, the overhead of spatial hashing isn't worth it
  if (bodies.length <= 20) {
    applySeparationForceSimple(bodies, separationRadius, separationForce);
  } else {
    applySeparationForceOptimized(bodies, separationRadius, separationForce);
  }
}

/**
 * Simple O(n²) separation force - used for small numbers of bodies
 */
function applySeparationForceSimple(
  bodies: PhysicsBody[],
  separationRadius: FPType,
  separationForce: FPType
): void {
  const sepRadiusSq = FP.mul(separationRadius, separationRadius);

  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];

    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];

      const dx = FP.sub(b.x, a.x);
      const dy = FP.sub(b.y, a.y);
      const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

      // Check if distance is very small (below epsilon threshold)
      const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
      if (distSq > epsilonSq && distSq < sepRadiusSq) {
        const dist = FP.sqrt(distSq);

        // Force decreases with distance (stronger when closer)
        const strength = FP.mul(separationForce, FP.sub(FP.ONE, FP.div(dist, separationRadius)));

        const nx = FP.div(dx, dist);
        const ny = FP.div(dy, dist);

        // Apply force in opposite directions
        const forceX = FP.mul(nx, strength);
        const forceY = FP.mul(ny, strength);

        // Apply to velocities (mass-weighted)
        const totalMass = FP.add(a.mass, b.mass);
        const ratioA = FP.div(b.mass, totalMass);
        const ratioB = FP.div(a.mass, totalMass);

        a.vx = FP.sub(a.vx, FP.mul(forceX, ratioA));
        a.vy = FP.sub(a.vy, FP.mul(forceY, ratioA));
        b.vx = FP.add(b.vx, FP.mul(forceX, ratioB));
        b.vy = FP.add(b.vy, FP.mul(forceY, ratioB));
      }
    }
  }
}

// Reusable spatial hash instance to avoid allocations
const separationSpatialHash = new SpatialHash<PhysicsBody>(4, 40, 15);

/**
 * Optimized O(n) separation force using spatial hashing
 * Much faster for large numbers of bodies (50+)
 */
export function applySeparationForceOptimized(
  bodies: PhysicsBody[],
  separationRadius: FPType,
  separationForce: FPType
): void {
  const sepRadiusSq = FP.mul(separationRadius, separationRadius);

  // Build spatial hash
  separationSpatialHash.clear();
  separationSpatialHash.insertAll(bodies);

  // Track processed pairs to avoid duplicates
  const processed = new Set<string>();

  for (const a of bodies) {
    const nearby = separationSpatialHash.getNearby(a);

    for (const b of nearby) {
      // Skip if we've already processed this pair
      const aId = (a as any).id ?? bodies.indexOf(a);
      const bId = (b as any).id ?? bodies.indexOf(b);
      const pairKey = aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;

      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const dx = FP.sub(b.x, a.x);
      const dy = FP.sub(b.y, a.y);
      const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

      // Check if distance is very small (below epsilon threshold)
      const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
      if (distSq > epsilonSq && distSq < sepRadiusSq) {
        const dist = FP.sqrt(distSq);

        // Force decreases with distance (stronger when closer)
        const strength = FP.mul(separationForce, FP.sub(FP.ONE, FP.div(dist, separationRadius)));

        const nx = FP.div(dx, dist);
        const ny = FP.div(dy, dist);

        // Apply force in opposite directions
        const forceX = FP.mul(nx, strength);
        const forceY = FP.mul(ny, strength);

        // Apply to velocities (mass-weighted)
        const totalMass = FP.add(a.mass, b.mass);
        const ratioA = FP.div(b.mass, totalMass);
        const ratioB = FP.div(a.mass, totalMass);

        a.vx = FP.sub(a.vx, FP.mul(forceX, ratioA));
        a.vy = FP.sub(a.vy, FP.mul(forceY, ratioA));
        b.vx = FP.add(b.vx, FP.mul(forceX, ratioB));
        b.vy = FP.add(b.vy, FP.mul(forceY, ratioB));
      }
    }
  }
}

/**
 * Calculate effective movement speed considering modifiers
 */
export function calculateEffectiveSpeed(
  baseSpeed: FPType,
  modifiers: MovementModifier[],
  currentTick: number
): FPType {
  let totalMultiplier = FP.ONE;

  for (const mod of modifiers) {
    if (mod.expirationTick > currentTick) {
      totalMultiplier = FP.mul(totalMultiplier, mod.multiplier);
    }
  }

  return FP.mul(baseSpeed, totalMultiplier);
}

/**
 * Remove expired movement modifiers
 */
export function cleanupExpiredModifiers(
  modifiers: MovementModifier[],
  currentTick: number
): MovementModifier[] {
  return modifiers.filter(mod => mod.expirationTick > currentTick);
}

/**
 * Calculate steering force towards a target position
 * Uses "arrive" behavior - slows down when approaching target
 */
export function steerTowards(
  body: PhysicsBody,
  targetX: FPType,
  targetY: FPType,
  maxSpeed: FPType,
  arrivalRadius: FPType
): { ax: FPType; ay: FPType } {
  const dx = FP.sub(targetX, body.x);
  const dy = FP.sub(targetY, body.y);
  const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

  if (distSq === 0) {
    return { ax: 0, ay: 0 };
  }

  // Check if distance is very small (below epsilon threshold)
  const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
  if (distSq <= epsilonSq) {
    return { ax: 0, ay: 0 };
  }

  const dist = FP.sqrt(distSq);
  const normalized = FP.normalize2D(dx, dy);

  // Desired velocity (towards target)
  let desiredSpeed = maxSpeed;

  // Slow down when within arrival radius
  const arrivalRadiusSq = FP.mul(arrivalRadius, arrivalRadius);
  if (distSq < arrivalRadiusSq) {
    desiredSpeed = FP.mul(maxSpeed, FP.div(dist, arrivalRadius));
  }

  const desiredVx = FP.mul(normalized.x, desiredSpeed);
  const desiredVy = FP.mul(normalized.y, desiredSpeed);

  // Steering = desired - current
  const steerX = FP.sub(desiredVx, body.vx);
  const steerY = FP.sub(desiredVy, body.vy);

  // Limit steering force
  const steerMagSq = FP.add(FP.mul(steerX, steerX), FP.mul(steerY, steerY));
  const maxSteer = HERO_PHYSICS.acceleration;
  const maxSteerSq = FP.mul(maxSteer, maxSteer);

  if (steerMagSq > maxSteerSq) {
    const steerMag = FP.sqrt(steerMagSq);
    // Check if steering magnitude is very small (below epsilon threshold)
    const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
    if (steerMagSq <= epsilonSq) {
      return { ax: 0, ay: 0 };
    }
    const scale = FP.div(maxSteer, steerMag);
    return {
      ax: FP.mul(steerX, scale),
      ay: FP.mul(steerY, scale),
    };
  }

  return { ax: steerX, ay: steerY };
}

/**
 * Calculate flee force (opposite of steer towards)
 */
export function steerAway(
  body: PhysicsBody,
  threatX: FPType,
  threatY: FPType,
  maxSpeed: FPType,
  fleeRadius: FPType
): { ax: FPType; ay: FPType } {
  const dx = FP.sub(body.x, threatX);
  const dy = FP.sub(body.y, threatY);
  const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

  const fleeRadiusSq = FP.mul(fleeRadius, fleeRadius);
  if (distSq > fleeRadiusSq) {
    return { ax: 0, ay: 0 }; // Too far, don't flee
  }

  // Check if distance is very small (below epsilon threshold)
  const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
  if (distSq <= epsilonSq) {
    // Very close to threat, flee in deterministic direction (X axis)
    return { ax: HERO_PHYSICS.acceleration, ay: 0 };
  }

  const dist = FP.sqrt(distSq);
  const normalized = FP.normalize2D(dx, dy);

  // Flee strength increases when closer
  const strength = FP.mul(maxSpeed, FP.sub(FP.ONE, FP.div(dist, fleeRadius)));

  const desiredVx = FP.mul(normalized.x, strength);
  const desiredVy = FP.mul(normalized.y, strength);

  const steerX = FP.sub(desiredVx, body.vx);
  const steerY = FP.sub(desiredVy, body.vy);

  return { ax: steerX, ay: steerY };
}

/**
 * Get lane Y position for enemy spawning
 */
export function getLaneY(laneIndex: number, config: PhysicsConfig): FPType {
  const fieldHeight = FP.sub(config.fieldMaxY, config.fieldMinY);
  const laneHeight = FP.div(fieldHeight, FP.fromInt(ENEMY_PHYSICS.numLanes));
  const laneCenter = FP.add(
    config.fieldMinY,
    FP.mul(laneHeight, FP.add(FP.fromInt(laneIndex), FP.HALF))
  );
  return laneCenter;
}

/**
 * Get random lane index
 */
export function getRandomLane(rng: () => number): number {
  return Math.floor(rng() * ENEMY_PHYSICS.numLanes);
}

// ============================================================================
// PHYSICS-BASED DEFENSE
// ============================================================================

/**
 * Calculate effective mass with mass bonus
 * Higher mass = harder to push (more inertia)
 * @param baseMass - Base mass in fixed-point
 * @param massBonus - Additive bonus (0.5 = +50% mass)
 */
export function getEffectiveMass(baseMass: FPType, massBonus: number): FPType {
  const multiplier = FP.fromFloat(1 + massBonus);
  return FP.mul(baseMass, multiplier);
}

/**
 * Apply knockback force to a body with resistance
 * @param body - The physics body to knockback
 * @param kbX - Knockback velocity X component (fixed-point)
 * @param kbY - Knockback velocity Y component (fixed-point)
 * @param knockbackResistance - Resistance value 0-0.9 (0.3 = 30% reduction)
 */
export function applyKnockbackWithResistance(
  body: PhysicsBody,
  kbX: FPType,
  kbY: FPType,
  knockbackResistance: number
): void {
  // Clamp resistance to valid range
  const resistance = Math.min(Math.max(knockbackResistance, 0), 0.9);
  const effectiveMultiplier = FP.fromFloat(1 - resistance);

  // Apply reduced knockback
  body.vx = FP.add(body.vx, FP.mul(kbX, effectiveMultiplier));
  body.vy = FP.add(body.vy, FP.mul(kbY, effectiveMultiplier));
}

/**
 * Calculate effective CC (crowd control) duration with resistance
 * @param baseDuration - Base duration in ticks
 * @param ccResistance - Resistance value 0-0.9 (0.4 = 40% shorter CC)
 * @returns Reduced duration in ticks
 */
export function calculateCCDuration(baseDuration: number, ccResistance: number): number {
  // Clamp resistance to valid range
  const resistance = Math.min(Math.max(ccResistance, 0), 0.9);
  return Math.floor(baseDuration * (1 - resistance));
}

/**
 * Resolve collision with mass bonuses
 * Extends resolveCollision to support massBonus modifiers
 * @param a - First body
 * @param b - Second body
 * @param collision - Collision result
 * @param massBonusA - Mass bonus for body A (0 = no bonus)
 * @param massBonusB - Mass bonus for body B (0 = no bonus)
 */
export function resolveCollisionWithMass(
  a: PhysicsBody,
  b: PhysicsBody,
  collision: CollisionResult,
  massBonusA: number = 0,
  massBonusB: number = 0
): void {
  const effectiveMassA = getEffectiveMass(a.mass, massBonusA);
  const effectiveMassB = getEffectiveMass(b.mass, massBonusB);

  const totalMass = FP.add(effectiveMassA, effectiveMassB);
  if (totalMass === 0) return;

  // Calculate how much each body should move (inverse mass ratio)
  // Higher mass = less movement
  const ratioA = FP.div(effectiveMassB, totalMass);
  const ratioB = FP.div(effectiveMassA, totalMass);

  // Push bodies apart
  const pushX = FP.mul(collision.normalX, collision.overlap);
  const pushY = FP.mul(collision.normalY, collision.overlap);

  // Move A in negative normal direction (less if heavier)
  a.x = FP.sub(a.x, FP.mul(pushX, ratioA));
  a.y = FP.sub(a.y, FP.mul(pushY, ratioA));

  // Move B in positive normal direction (less if heavier)
  b.x = FP.add(b.x, FP.mul(pushX, ratioB));
  b.y = FP.add(b.y, FP.mul(pushY, ratioB));

  // Velocity exchange based on mass
  const vDotN_A = FP.add(FP.mul(a.vx, collision.normalX), FP.mul(a.vy, collision.normalY));
  const vDotN_B = FP.add(FP.mul(b.vx, collision.normalX), FP.mul(b.vy, collision.normalY));

  // Remove velocity component in collision direction (dampen collision)
  // Heavier objects lose less velocity
  if (vDotN_A > 0) {
    a.vx = FP.sub(a.vx, FP.mul(FP.mul(collision.normalX, vDotN_A), ratioA));
    a.vy = FP.sub(a.vy, FP.mul(FP.mul(collision.normalY, vDotN_A), ratioA));
  }
  if (vDotN_B < 0) {
    b.vx = FP.sub(b.vx, FP.mul(FP.mul(collision.normalX, vDotN_B), ratioB));
    b.vy = FP.sub(b.vy, FP.mul(FP.mul(collision.normalY, vDotN_B), ratioB));
  }
}

/**
 * Apply separation force with mass bonuses
 * Extends applySeparationForce to support massBonus modifiers
 * Automatically uses spatial hashing optimization for large arrays
 */
export function applySeparationForceWithMass(
  bodies: Array<PhysicsBody & { massBonus?: number }>,
  separationRadius: FPType,
  separationForce: FPType
): void {
  // For small arrays, the overhead of spatial hashing isn't worth it
  if (bodies.length <= 20) {
    applySeparationForceWithMassSimple(bodies, separationRadius, separationForce);
  } else {
    applySeparationForceWithMassOptimized(bodies, separationRadius, separationForce);
  }
}

/**
 * Simple O(n²) separation force with mass - used for small numbers of bodies
 */
function applySeparationForceWithMassSimple(
  bodies: Array<PhysicsBody & { massBonus?: number }>,
  separationRadius: FPType,
  separationForce: FPType
): void {
  const sepRadiusSq = FP.mul(separationRadius, separationRadius);

  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    const effectiveMassA = getEffectiveMass(a.mass, a.massBonus ?? 0);

    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      const effectiveMassB = getEffectiveMass(b.mass, b.massBonus ?? 0);

      const dx = FP.sub(b.x, a.x);
      const dy = FP.sub(b.y, a.y);
      const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

      // Check if distance is very small (below epsilon threshold)
      const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
      if (distSq > epsilonSq && distSq < sepRadiusSq) {
        const dist = FP.sqrt(distSq);

        // Force decreases with distance (stronger when closer)
        const strength = FP.mul(separationForce, FP.sub(FP.ONE, FP.div(dist, separationRadius)));

        const nx = FP.div(dx, dist);
        const ny = FP.div(dy, dist);

        // Apply force in opposite directions
        const forceX = FP.mul(nx, strength);
        const forceY = FP.mul(ny, strength);

        // Apply to velocities (effective mass-weighted)
        const totalMass = FP.add(effectiveMassA, effectiveMassB);
        const ratioA = FP.div(effectiveMassB, totalMass);
        const ratioB = FP.div(effectiveMassA, totalMass);

        a.vx = FP.sub(a.vx, FP.mul(forceX, ratioA));
        a.vy = FP.sub(a.vy, FP.mul(forceY, ratioA));
        b.vx = FP.add(b.vx, FP.mul(forceX, ratioB));
        b.vy = FP.add(b.vy, FP.mul(forceY, ratioB));
      }
    }
  }
}

// Reusable spatial hash for mass-based separation
const separationWithMassSpatialHash = new SpatialHash<PhysicsBody & { massBonus?: number }>(4, 40, 15);

/**
 * Optimized O(n) separation force with mass using spatial hashing
 */
function applySeparationForceWithMassOptimized(
  bodies: Array<PhysicsBody & { massBonus?: number }>,
  separationRadius: FPType,
  separationForce: FPType
): void {
  const sepRadiusSq = FP.mul(separationRadius, separationRadius);

  // Build spatial hash
  separationWithMassSpatialHash.clear();
  separationWithMassSpatialHash.insertAll(bodies);

  // Track processed pairs to avoid duplicates
  const processed = new Set<string>();

  for (const a of bodies) {
    const effectiveMassA = getEffectiveMass(a.mass, a.massBonus ?? 0);
    const nearby = separationWithMassSpatialHash.getNearby(a);

    for (const b of nearby) {
      // Skip if we've already processed this pair
      const aId = (a as any).id ?? bodies.indexOf(a);
      const bId = (b as any).id ?? bodies.indexOf(b);
      const pairKey = aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;

      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const effectiveMassB = getEffectiveMass(b.mass, b.massBonus ?? 0);

      const dx = FP.sub(b.x, a.x);
      const dy = FP.sub(b.y, a.y);
      const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

      // Check if distance is very small (below epsilon threshold)
      const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
      if (distSq > epsilonSq && distSq < sepRadiusSq) {
        const dist = FP.sqrt(distSq);

        // Force decreases with distance (stronger when closer)
        const strength = FP.mul(separationForce, FP.sub(FP.ONE, FP.div(dist, separationRadius)));

        const nx = FP.div(dx, dist);
        const ny = FP.div(dy, dist);

        // Apply force in opposite directions
        const forceX = FP.mul(nx, strength);
        const forceY = FP.mul(ny, strength);

        // Apply to velocities (effective mass-weighted)
        const totalMass = FP.add(effectiveMassA, effectiveMassB);
        const ratioA = FP.div(effectiveMassB, totalMass);
        const ratioB = FP.div(effectiveMassA, totalMass);

        a.vx = FP.sub(a.vx, FP.mul(forceX, ratioA));
        a.vy = FP.sub(a.vy, FP.mul(forceY, ratioA));
        b.vx = FP.add(b.vx, FP.mul(forceX, ratioB));
        b.vy = FP.add(b.vy, FP.mul(forceY, ratioB));
      }
    }
  }
}
