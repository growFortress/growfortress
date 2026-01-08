import { describe, it, expect } from 'vitest';
import {
  Vec2,
  PhysicsBody,
  MovementModifier,
  DEFAULT_PHYSICS_CONFIG,
  HERO_PHYSICS,
  ENEMY_PHYSICS,
  integratePosition,
  applyAcceleration,
  applyFriction,
  clampVelocity,
  clampToField,
  detectCircleCollision,
  resolveCollision,
  applySeparationForce,
  calculateEffectiveSpeed,
  cleanupExpiredModifiers,
  steerTowards,
  steerAway,
  getLaneY,
  getRandomLane,
} from '../../physics.js';
import { FP } from '../../fixed.js';

// Helper to create a physics body with defaults
function createBody(overrides: Partial<PhysicsBody> = {}): PhysicsBody {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: FP.fromFloat(1.0),
    mass: FP.ONE,
    ...overrides,
  };
}

// Helper to compare fixed-point values with tolerance
function expectFPClose(actual: number, expected: number, tolerance = 256) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('Vec2', () => {
  describe('zero', () => {
    it('returns a zero vector', () => {
      const v = Vec2.zero();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });
  });

  describe('create', () => {
    it('creates a vector from fixed-point values', () => {
      const v = Vec2.create(FP.ONE, FP.fromInt(2));
      expect(v.x).toBe(FP.ONE);
      expect(v.y).toBe(FP.fromInt(2));
    });
  });

  describe('fromFloat', () => {
    it('creates a vector from float values', () => {
      const v = Vec2.fromFloat(1.5, 2.5);
      expect(v.x).toBe(FP.fromFloat(1.5));
      expect(v.y).toBe(FP.fromFloat(2.5));
    });
  });

  describe('add', () => {
    it('adds two vectors', () => {
      const a = Vec2.fromFloat(1, 2);
      const b = Vec2.fromFloat(3, 4);
      const result = Vec2.add(a, b);
      expect(result.x).toBe(FP.fromFloat(4));
      expect(result.y).toBe(FP.fromFloat(6));
    });

    it('handles negative values', () => {
      const a = Vec2.fromFloat(-1, 2);
      const b = Vec2.fromFloat(3, -4);
      const result = Vec2.add(a, b);
      expect(result.x).toBe(FP.fromFloat(2));
      expect(result.y).toBe(FP.fromFloat(-2));
    });
  });

  describe('sub', () => {
    it('subtracts two vectors', () => {
      const a = Vec2.fromFloat(5, 7);
      const b = Vec2.fromFloat(2, 3);
      const result = Vec2.sub(a, b);
      expect(result.x).toBe(FP.fromFloat(3));
      expect(result.y).toBe(FP.fromFloat(4));
    });
  });

  describe('scale', () => {
    it('scales a vector by a scalar', () => {
      const v = Vec2.fromFloat(2, 3);
      const result = Vec2.scale(v, FP.fromInt(2));
      expect(result.x).toBe(FP.fromFloat(4));
      expect(result.y).toBe(FP.fromFloat(6));
    });

    it('handles fractional scaling', () => {
      const v = Vec2.fromFloat(4, 6);
      const result = Vec2.scale(v, FP.HALF);
      expectFPClose(result.x, FP.fromFloat(2));
      expectFPClose(result.y, FP.fromFloat(3));
    });
  });

  describe('dot', () => {
    it('calculates dot product', () => {
      const a = Vec2.fromFloat(1, 2);
      const b = Vec2.fromFloat(3, 4);
      // 1*3 + 2*4 = 11
      const result = Vec2.dot(a, b);
      expectFPClose(result, FP.fromFloat(11));
    });

    it('returns zero for perpendicular vectors', () => {
      const a = Vec2.fromFloat(1, 0);
      const b = Vec2.fromFloat(0, 1);
      const result = Vec2.dot(a, b);
      expect(result).toBe(0);
    });
  });

  describe('lengthSq', () => {
    it('calculates squared length', () => {
      const v = Vec2.fromFloat(3, 4);
      // 3^2 + 4^2 = 25
      const result = Vec2.lengthSq(v);
      expectFPClose(result, FP.fromFloat(25));
    });
  });

  describe('length', () => {
    it('calculates vector length', () => {
      const v = Vec2.fromFloat(3, 4);
      // sqrt(25) = 5
      const result = Vec2.length(v);
      expectFPClose(result, FP.fromFloat(5), 512);
    });

    it('returns zero for zero vector', () => {
      const v = Vec2.zero();
      const result = Vec2.length(v);
      expect(result).toBe(0);
    });
  });

  describe('distance', () => {
    it('calculates distance between two points', () => {
      const a = Vec2.fromFloat(0, 0);
      const b = Vec2.fromFloat(3, 4);
      const result = Vec2.distance(a, b);
      expectFPClose(result, FP.fromFloat(5), 512);
    });
  });

  describe('distanceSq', () => {
    it('calculates squared distance between two points', () => {
      const a = Vec2.fromFloat(0, 0);
      const b = Vec2.fromFloat(3, 4);
      const result = Vec2.distanceSq(a, b);
      expectFPClose(result, FP.fromFloat(25));
    });
  });

  describe('normalize', () => {
    it('normalizes a vector to unit length', () => {
      const v = Vec2.fromFloat(3, 4);
      const result = Vec2.normalize(v);
      // 3/5 = 0.6, 4/5 = 0.8
      expectFPClose(result.x, FP.fromFloat(0.6), 512);
      expectFPClose(result.y, FP.fromFloat(0.8), 512);
    });

    it('returns zero vector for zero input', () => {
      const v = Vec2.zero();
      const result = Vec2.normalize(v);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('lerp', () => {
    it('interpolates between two vectors', () => {
      const a = Vec2.fromFloat(0, 0);
      const b = Vec2.fromFloat(10, 20);
      const result = Vec2.lerp(a, b, FP.HALF);
      expectFPClose(result.x, FP.fromFloat(5));
      expectFPClose(result.y, FP.fromFloat(10));
    });

    it('returns first vector at t=0', () => {
      const a = Vec2.fromFloat(1, 2);
      const b = Vec2.fromFloat(10, 20);
      const result = Vec2.lerp(a, b, 0);
      expect(result.x).toBe(a.x);
      expect(result.y).toBe(a.y);
    });

    it('returns second vector at t=1', () => {
      const a = Vec2.fromFloat(1, 2);
      const b = Vec2.fromFloat(10, 20);
      const result = Vec2.lerp(a, b, FP.ONE);
      expectFPClose(result.x, b.x);
      expectFPClose(result.y, b.y);
    });
  });

  describe('clamp', () => {
    it('clamps values within bounds', () => {
      const v = Vec2.fromFloat(5, 15);
      const result = Vec2.clamp(
        v,
        FP.fromFloat(0),
        FP.fromFloat(10),
        FP.fromFloat(0),
        FP.fromFloat(10)
      );
      expect(result.x).toBe(FP.fromFloat(5));
      expect(result.y).toBe(FP.fromFloat(10));
    });

    it('handles negative clamping', () => {
      const v = Vec2.fromFloat(-5, -15);
      const result = Vec2.clamp(
        v,
        FP.fromFloat(-10),
        FP.fromFloat(10),
        FP.fromFloat(-10),
        FP.fromFloat(10)
      );
      expect(result.x).toBe(FP.fromFloat(-5));
      expect(result.y).toBe(FP.fromFloat(-10));
    });
  });
});

describe('Physics Functions', () => {
  describe('integratePosition', () => {
    it('updates position based on velocity', () => {
      const body = createBody({
        x: FP.fromFloat(10),
        y: FP.fromFloat(5),
        vx: FP.fromFloat(2),
        vy: FP.fromFloat(-1),
      });

      integratePosition(body);

      expect(body.x).toBe(FP.fromFloat(12));
      expect(body.y).toBe(FP.fromFloat(4));
    });

    it('handles zero velocity', () => {
      const body = createBody({
        x: FP.fromFloat(10),
        y: FP.fromFloat(5),
      });

      integratePosition(body);

      expect(body.x).toBe(FP.fromFloat(10));
      expect(body.y).toBe(FP.fromFloat(5));
    });
  });

  describe('applyAcceleration', () => {
    it('adds acceleration to velocity', () => {
      const body = createBody({
        vx: FP.fromFloat(1),
        vy: FP.fromFloat(2),
      });

      applyAcceleration(body, FP.fromFloat(0.5), FP.fromFloat(-0.5));

      expectFPClose(body.vx, FP.fromFloat(1.5));
      expectFPClose(body.vy, FP.fromFloat(1.5));
    });
  });

  describe('applyFriction', () => {
    it('reduces velocity by friction factor', () => {
      const body = createBody({
        vx: FP.fromFloat(10),
        vy: FP.fromFloat(10),
      });

      applyFriction(body, FP.HALF);

      expectFPClose(body.vx, FP.fromFloat(5));
      expectFPClose(body.vy, FP.fromFloat(5));
    });

    it('handles zero velocity', () => {
      const body = createBody();
      applyFriction(body, FP.HALF);
      expect(body.vx).toBe(0);
      expect(body.vy).toBe(0);
    });
  });

  describe('clampVelocity', () => {
    it('clamps velocity to max speed', () => {
      const body = createBody({
        vx: FP.fromFloat(3),
        vy: FP.fromFloat(4),
      });

      clampVelocity(body, FP.fromFloat(2.5));

      // Original speed was 5, should be clamped to 2.5
      const speedSq = FP.add(FP.mul(body.vx, body.vx), FP.mul(body.vy, body.vy));
      const speed = FP.sqrt(speedSq);
      expectFPClose(speed, FP.fromFloat(2.5), 1024);
    });

    it('does not modify velocity under max speed', () => {
      const body = createBody({
        vx: FP.fromFloat(1),
        vy: FP.fromFloat(1),
      });

      const originalVx = body.vx;
      const originalVy = body.vy;

      clampVelocity(body, FP.fromFloat(10));

      expect(body.vx).toBe(originalVx);
      expect(body.vy).toBe(originalVy);
    });
  });

  describe('clampToField', () => {
    const config = DEFAULT_PHYSICS_CONFIG;

    it('clamps position to field boundaries', () => {
      const body = createBody({
        x: FP.fromFloat(-10),
        y: FP.fromFloat(100),
        radius: FP.fromFloat(1),
      });

      clampToField(body, config);

      // Should be clamped to min + radius on X
      expect(body.x).toBe(FP.add(config.fieldMinX, body.radius));
      // Should be clamped to max - radius on Y
      expect(body.y).toBe(FP.sub(config.fieldMaxY, body.radius));
    });

    it('zeroes velocity when hitting boundary', () => {
      const body = createBody({
        x: FP.fromFloat(-10),
        y: FP.fromFloat(100),
        vx: FP.fromFloat(-5),
        vy: FP.fromFloat(5),
        radius: FP.fromFloat(1),
      });

      clampToField(body, config);

      expect(body.vx).toBe(0);
      expect(body.vy).toBe(0);
    });
  });

  describe('detectCircleCollision', () => {
    it('returns null for non-overlapping circles', () => {
      const a = createBody({
        x: FP.fromFloat(0),
        y: FP.fromFloat(0),
        radius: FP.fromFloat(1),
      });
      const b = createBody({
        x: FP.fromFloat(5),
        y: FP.fromFloat(0),
        radius: FP.fromFloat(1),
      });

      const result = detectCircleCollision(a, b);
      expect(result).toBeNull();
    });

    it('detects overlapping circles', () => {
      const a = createBody({
        x: FP.fromFloat(0),
        y: FP.fromFloat(0),
        radius: FP.fromFloat(1),
      });
      const b = createBody({
        x: FP.fromFloat(1.5),
        y: FP.fromFloat(0),
        radius: FP.fromFloat(1),
      });

      const result = detectCircleCollision(a, b);
      expect(result).not.toBeNull();
      expect(result!.overlap).toBeGreaterThan(0);
    });

    it('handles exactly touching circles', () => {
      const a = createBody({
        x: FP.fromFloat(0),
        y: FP.fromFloat(0),
        radius: FP.fromFloat(1),
      });
      const b = createBody({
        x: FP.fromFloat(2),
        y: FP.fromFloat(0),
        radius: FP.fromFloat(1),
      });

      const result = detectCircleCollision(a, b);
      expect(result).toBeNull();
    });

    it('handles overlapping circles at same position', () => {
      const a = createBody({
        x: FP.fromFloat(5),
        y: FP.fromFloat(5),
        radius: FP.fromFloat(1),
      });
      const b = createBody({
        x: FP.fromFloat(5),
        y: FP.fromFloat(5),
        radius: FP.fromFloat(1),
      });

      const result = detectCircleCollision(a, b);
      expect(result).not.toBeNull();
      expect(result!.normalX).toBe(FP.ONE);
      expect(result!.normalY).toBe(0);
    });
  });

  describe('resolveCollision', () => {
    it('pushes overlapping bodies apart', () => {
      const a = createBody({
        x: FP.fromFloat(0),
        y: FP.fromFloat(0),
        radius: FP.fromFloat(1),
        mass: FP.ONE,
      });
      const b = createBody({
        x: FP.fromFloat(1),
        y: FP.fromFloat(0),
        radius: FP.fromFloat(1),
        mass: FP.ONE,
      });

      const collision = detectCircleCollision(a, b);
      expect(collision).not.toBeNull();

      const aXBefore = a.x;
      const bXBefore = b.x;

      resolveCollision(a, b, collision!);

      // A should move left (negative X)
      expect(a.x).toBeLessThan(aXBefore);
      // B should move right (positive X)
      expect(b.x).toBeGreaterThan(bXBefore);
    });

    it('respects mass ratio when resolving', () => {
      const a = createBody({
        x: FP.fromFloat(0),
        y: FP.fromFloat(0),
        radius: FP.fromFloat(1),
        mass: FP.fromInt(2), // Heavier
      });
      const b = createBody({
        x: FP.fromFloat(1),
        y: FP.fromFloat(0),
        radius: FP.fromFloat(1),
        mass: FP.ONE, // Lighter
      });

      const collision = detectCircleCollision(a, b);
      expect(collision).not.toBeNull();

      const aXBefore = a.x;
      const bXBefore = b.x;

      resolveCollision(a, b, collision!);

      // B should move more than A due to lower mass
      const aDelta = Math.abs(a.x - aXBefore);
      const bDelta = Math.abs(b.x - bXBefore);
      expect(bDelta).toBeGreaterThan(aDelta);
    });
  });

  describe('applySeparationForce', () => {
    it('pushes nearby bodies apart', () => {
      const bodies = [
        createBody({
          x: FP.fromFloat(0),
          y: FP.fromFloat(0),
          mass: FP.ONE,
        }),
        createBody({
          x: FP.fromFloat(1),
          y: FP.fromFloat(0),
          mass: FP.ONE,
        }),
      ];

      applySeparationForce(
        bodies,
        FP.fromFloat(2.0),
        FP.fromFloat(0.5)
      );

      // First body should have negative vx (pushed left)
      expect(bodies[0].vx).toBeLessThan(0);
      // Second body should have positive vx (pushed right)
      expect(bodies[1].vx).toBeGreaterThan(0);
    });

    it('does not affect bodies outside separation radius', () => {
      const bodies = [
        createBody({
          x: FP.fromFloat(0),
          y: FP.fromFloat(0),
        }),
        createBody({
          x: FP.fromFloat(10),
          y: FP.fromFloat(0),
        }),
      ];

      applySeparationForce(
        bodies,
        FP.fromFloat(2.0),
        FP.fromFloat(0.5)
      );

      expect(bodies[0].vx).toBe(0);
      expect(bodies[1].vx).toBe(0);
    });
  });

  describe('calculateEffectiveSpeed', () => {
    it('returns base speed with no modifiers', () => {
      const baseSpeed = FP.fromFloat(5);
      const result = calculateEffectiveSpeed(baseSpeed, [], 0);
      expect(result).toBe(baseSpeed);
    });

    it('applies speed multipliers', () => {
      const baseSpeed = FP.fromFloat(10);
      const modifiers: MovementModifier[] = [
        { id: 'slow', multiplier: FP.HALF, expirationTick: 100 },
      ];

      const result = calculateEffectiveSpeed(baseSpeed, modifiers, 0);
      expectFPClose(result, FP.fromFloat(5));
    });

    it('ignores expired modifiers', () => {
      const baseSpeed = FP.fromFloat(10);
      const modifiers: MovementModifier[] = [
        { id: 'slow', multiplier: FP.HALF, expirationTick: 50 },
      ];

      const result = calculateEffectiveSpeed(baseSpeed, modifiers, 100);
      expect(result).toBe(baseSpeed);
    });

    it('stacks multiple modifiers', () => {
      const baseSpeed = FP.fromFloat(100);
      const modifiers: MovementModifier[] = [
        { id: 'slow1', multiplier: FP.HALF, expirationTick: 100 },
        { id: 'slow2', multiplier: FP.HALF, expirationTick: 100 },
      ];

      const result = calculateEffectiveSpeed(baseSpeed, modifiers, 0);
      // 100 * 0.5 * 0.5 = 25
      expectFPClose(result, FP.fromFloat(25));
    });
  });

  describe('cleanupExpiredModifiers', () => {
    it('removes expired modifiers', () => {
      const modifiers: MovementModifier[] = [
        { id: 'active', multiplier: FP.ONE, expirationTick: 100 },
        { id: 'expired', multiplier: FP.ONE, expirationTick: 50 },
      ];

      const result = cleanupExpiredModifiers(modifiers, 75);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('active');
    });

    it('keeps all modifiers when none expired', () => {
      const modifiers: MovementModifier[] = [
        { id: 'a', multiplier: FP.ONE, expirationTick: 100 },
        { id: 'b', multiplier: FP.ONE, expirationTick: 200 },
      ];

      const result = cleanupExpiredModifiers(modifiers, 50);

      expect(result).toHaveLength(2);
    });

    it('returns empty array when all expired', () => {
      const modifiers: MovementModifier[] = [
        { id: 'a', multiplier: FP.ONE, expirationTick: 10 },
        { id: 'b', multiplier: FP.ONE, expirationTick: 20 },
      ];

      const result = cleanupExpiredModifiers(modifiers, 100);

      expect(result).toHaveLength(0);
    });
  });

  describe('steerTowards', () => {
    it('steers body towards target', () => {
      const body = createBody({
        x: FP.fromFloat(0),
        y: FP.fromFloat(0),
      });

      const steering = steerTowards(
        body,
        FP.fromFloat(10),
        FP.fromFloat(0),
        FP.fromFloat(1),
        FP.fromFloat(2)
      );

      // Should steer in positive X direction
      expect(steering.ax).toBeGreaterThan(0);
    });

    it('returns zero steering when at target', () => {
      const body = createBody({
        x: FP.fromFloat(5),
        y: FP.fromFloat(5),
      });

      const steering = steerTowards(
        body,
        FP.fromFloat(5),
        FP.fromFloat(5),
        FP.fromFloat(1),
        FP.fromFloat(2)
      );

      expect(steering.ax).toBe(0);
      expect(steering.ay).toBe(0);
    });
  });

  describe('steerAway', () => {
    it('steers body away from threat', () => {
      const body = createBody({
        x: FP.fromFloat(5),
        y: FP.fromFloat(0),
      });

      const steering = steerAway(
        body,
        FP.fromFloat(0),
        FP.fromFloat(0),
        FP.fromFloat(1),
        FP.fromFloat(10)
      );

      // Should steer away (positive X since threat is at origin)
      expect(steering.ax).toBeGreaterThan(0);
    });

    it('returns zero steering when outside flee radius', () => {
      const body = createBody({
        x: FP.fromFloat(100),
        y: FP.fromFloat(0),
      });

      const steering = steerAway(
        body,
        FP.fromFloat(0),
        FP.fromFloat(0),
        FP.fromFloat(1),
        FP.fromFloat(10)
      );

      expect(steering.ax).toBe(0);
      expect(steering.ay).toBe(0);
    });

    it('handles body exactly on threat', () => {
      const body = createBody({
        x: FP.fromFloat(0),
        y: FP.fromFloat(0),
      });

      const steering = steerAway(
        body,
        FP.fromFloat(0),
        FP.fromFloat(0),
        FP.fromFloat(1),
        FP.fromFloat(10)
      );

      // Should return some acceleration in arbitrary direction
      expect(steering.ax).toBe(HERO_PHYSICS.acceleration);
      expect(steering.ay).toBe(0);
    });
  });

  describe('getLaneY', () => {
    it('returns correct Y position for lane 0', () => {
      const y = getLaneY(0, DEFAULT_PHYSICS_CONFIG);
      // Field height is 15, 3 lanes, so lane height is 5
      // Lane 0 center is at 0 + 5 * 0.5 = 2.5
      expectFPClose(y, FP.fromFloat(2.5), 512);
    });

    it('returns correct Y position for lane 1', () => {
      const y = getLaneY(1, DEFAULT_PHYSICS_CONFIG);
      // Lane 1 center is at 0 + 5 * 1.5 = 7.5
      expectFPClose(y, FP.fromFloat(7.5), 512);
    });

    it('returns correct Y position for lane 2', () => {
      const y = getLaneY(2, DEFAULT_PHYSICS_CONFIG);
      // Lane 2 center is at 0 + 5 * 2.5 = 12.5
      expectFPClose(y, FP.fromFloat(12.5), 512);
    });
  });

  describe('getRandomLane', () => {
    it('returns valid lane index', () => {
      const mockRng = () => 0.5;
      const lane = getRandomLane(mockRng);
      expect(lane).toBeGreaterThanOrEqual(0);
      expect(lane).toBeLessThan(ENEMY_PHYSICS.numLanes);
    });

    it('returns 0 for rng=0', () => {
      const mockRng = () => 0;
      const lane = getRandomLane(mockRng);
      expect(lane).toBe(0);
    });

    it('returns max lane for rng close to 1', () => {
      const mockRng = () => 0.99;
      const lane = getRandomLane(mockRng);
      expect(lane).toBe(ENEMY_PHYSICS.numLanes - 1);
    });
  });
});

describe('Physics Constants', () => {
  describe('DEFAULT_PHYSICS_CONFIG', () => {
    it('has valid field boundaries', () => {
      expect(DEFAULT_PHYSICS_CONFIG.fieldMinX).toBe(FP.fromInt(0));
      expect(DEFAULT_PHYSICS_CONFIG.fieldMaxX).toBe(FP.fromInt(40));
      expect(DEFAULT_PHYSICS_CONFIG.fieldMinY).toBe(FP.fromInt(0));
      expect(DEFAULT_PHYSICS_CONFIG.fieldMaxY).toBe(FP.fromInt(15));
    });

    it('has reasonable friction value', () => {
      const friction = FP.toFloat(DEFAULT_PHYSICS_CONFIG.defaultFriction);
      expect(friction).toBeGreaterThan(0);
      expect(friction).toBeLessThan(1);
    });
  });

  describe('HERO_PHYSICS', () => {
    it('has positive acceleration', () => {
      expect(HERO_PHYSICS.acceleration).toBeGreaterThan(0);
    });

    it('has friction less than 1', () => {
      const friction = FP.toFloat(HERO_PHYSICS.friction);
      expect(friction).toBeLessThan(1);
    });
  });

  describe('ENEMY_PHYSICS', () => {
    it('has valid lane configuration', () => {
      expect(ENEMY_PHYSICS.numLanes).toBeGreaterThan(0);
      expect(ENEMY_PHYSICS.laneHeight).toBeGreaterThan(0);
    });
  });
});
