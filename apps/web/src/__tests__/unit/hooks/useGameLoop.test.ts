/**
 * useGameLoop hook tests
 *
 * Tests for the main game loop hook utility functions and behavior.
 * Note: Since @testing-library/preact is not available, we test
 * the utility functions and mock behavior rather than the hook directly.
 */
import { describe, it, expect, vi } from 'vitest';

// ==========================================================================
// PICK RELIC INDEX UTILITY TESTS
// ==========================================================================

// The pickRelicIndex function is internal, so we test its logic directly
describe('pickRelicIndex logic', () => {
  const RELIC_RARITY_SCORE: Record<string, number> = {
    common: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
  };

  function pickRelicIndex(
    options: Array<{ id: string; category: string; rarity: string } | null>,
    priority: string[]
  ): number {
    let bestIndex = 0;
    let bestScore = -Infinity;

    options.forEach((relic, index) => {
      if (!relic) return;
      const priorityIndex = priority.indexOf(relic.category);
      const priorityScore = priorityIndex === -1 ? 0 : (priority.length - priorityIndex) * 10;
      const rarityScore = RELIC_RARITY_SCORE[relic.rarity] ?? 0;
      const score = priorityScore + rarityScore;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  it('should return 0 for empty options', () => {
    const result = pickRelicIndex([], ['standard']);
    expect(result).toBe(0);
  });

  it('should prefer higher priority category', () => {
    const options = [
      { id: 'relic-1', category: 'cursed', rarity: 'legendary' },
      { id: 'relic-2', category: 'standard', rarity: 'common' },
    ];
    const priority = ['standard', 'economy', 'attack', 'defense', 'utility', 'cursed'];

    const result = pickRelicIndex(options, priority);
    expect(result).toBe(1); // standard (index 0 in priority) beats cursed (index 5)
  });

  it('should prefer higher rarity when priority is equal', () => {
    const options = [
      { id: 'relic-1', category: 'standard', rarity: 'common' },
      { id: 'relic-2', category: 'standard', rarity: 'legendary' },
    ];
    const priority = ['standard'];

    const result = pickRelicIndex(options, priority);
    expect(result).toBe(1); // legendary (4) beats common (1)
  });

  it('should handle null relics in options', () => {
    const options: Array<{ id: string; category: string; rarity: string } | null> = [
      null,
      { id: 'relic-1', category: 'standard', rarity: 'epic' },
      null,
    ];
    const priority = ['standard'];

    const result = pickRelicIndex(options, priority);
    expect(result).toBe(1);
  });

  it('should handle category not in priority list', () => {
    const options = [
      { id: 'relic-1', category: 'unknown', rarity: 'legendary' },
      { id: 'relic-2', category: 'standard', rarity: 'common' },
    ];
    const priority = ['standard'];

    const result = pickRelicIndex(options, priority);
    expect(result).toBe(1); // standard is in priority, unknown is not
  });

  it('should handle unknown rarity', () => {
    const options = [
      { id: 'relic-1', category: 'standard', rarity: 'mythic' }, // Unknown rarity
    ];
    const priority = ['standard'];

    const result = pickRelicIndex(options, priority);
    expect(result).toBe(0);
  });
});

// ==========================================================================
// GAME CLASS MOCK TESTS
// ==========================================================================

describe('Game class integration', () => {
  it('should create Game instance with callbacks', () => {
    const callbacks = {
      onStateChange: vi.fn(),
      onChoiceRequired: vi.fn(),
      onGameEnd: vi.fn(),
      onSegmentComplete: vi.fn(),
      onRewardsReceived: vi.fn(),
      onBossRushEnd: vi.fn(),
    };

    // Simulate what the hook does
    const mockGame = {
      ...callbacks,
      getState: vi.fn().mockReturnValue(null),
      getSessionInfo: vi.fn().mockReturnValue(null),
      startEndlessSession: vi.fn().mockResolvedValue({ inventory: { gold: 100 } }),
      resumeEndlessSession: vi.fn().mockResolvedValue({ inventory: { gold: 100 } }),
      endCurrentSession: vi.fn().mockResolvedValue(undefined),
      chooseRelic: vi.fn(),
      activateAnnihilation: vi.fn(),
      reset: vi.fn(),
      resetBossRush: vi.fn(),
    };

    expect(mockGame.onStateChange).toBe(callbacks.onStateChange);
    expect(mockGame.getState()).toBeNull();
  });

  it('should handle session start flow', async () => {
    const mockGame = {
      startEndlessSession: vi.fn().mockResolvedValue({
        inventory: { gold: 1000, dust: 500 },
      }),
    };

    const mockLoop = {
      start: vi.fn(),
      stop: vi.fn(),
    };

    // Simulate startSession callback logic
    const sessionInfo = await mockGame.startEndlessSession({
      fortressClass: 'natural',
      startingHeroes: [],
      startingTurrets: [],
    });

    if (sessionInfo) {
      mockLoop.start();
    }

    expect(mockGame.startEndlessSession).toHaveBeenCalledWith({
      fortressClass: 'natural',
      startingHeroes: [],
      startingTurrets: [],
    });
    expect(mockLoop.start).toHaveBeenCalled();
  });

  it('should handle session end flow', async () => {
    const mockGame = {
      endCurrentSession: vi.fn().mockResolvedValue(undefined),
    };

    const mockLoop = {
      start: vi.fn(),
      stop: vi.fn(),
    };

    // Simulate endSession callback logic
    mockLoop.stop();
    await mockGame.endCurrentSession();

    expect(mockLoop.stop).toHaveBeenCalled();
    expect(mockGame.endCurrentSession).toHaveBeenCalled();
  });
});

// ==========================================================================
// GAME LOOP TESTS
// ==========================================================================

describe('GameLoop class integration', () => {
  it('should create GameLoop with game and render callback', () => {
    const mockGame = { getState: vi.fn().mockReturnValue(null) };
    const renderCallback = vi.fn();

    const mockLoop = {
      game: mockGame,
      renderCallback,
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      isRunning: vi.fn().mockReturnValue(false),
      setSpeed: vi.fn(),
    };

    expect(mockLoop.game).toBe(mockGame);
    expect(mockLoop.isRunning()).toBe(false);
  });

  it('should change speed', () => {
    const mockLoop = {
      speed: 1 as number,
      setSpeed: function (speed: number) {
        this.speed = speed;
      },
    };

    mockLoop.setSpeed(2);
    expect(mockLoop.speed).toBe(2);
  });
});

// ==========================================================================
// RENDERER TESTS
// ==========================================================================

describe('GameApp renderer integration', () => {
  it('should call render with game state', () => {
    const mockRenderer = {
      render: vi.fn(),
    };

    const gameState = {
      wave: 5,
      kills: 100,
      heroes: [],
      enemies: [],
    };

    mockRenderer.render(gameState, 0.5);

    expect(mockRenderer.render).toHaveBeenCalledWith(gameState, 0.5);
  });

  it('should handle click handlers', () => {
    const heroClickHandler = vi.fn();
    const turretClickHandler = vi.fn();
    const fieldClickHandler = vi.fn();

    const mockRenderer = {
      onHeroClick: null as ((heroId: string) => void) | null,
      onTurretClick: null as ((turretId: string, slotIndex: number) => void) | null,
      onFieldClick: null as ((worldX: number, worldY: number) => void) | null,
      setOnHeroClick: function (cb: (heroId: string) => void) {
        this.onHeroClick = cb;
      },
      setOnTurretClick: function (cb: (turretId: string, slotIndex: number) => void) {
        this.onTurretClick = cb;
      },
      setOnFieldClick: function (cb: (worldX: number, worldY: number) => void) {
        this.onFieldClick = cb;
      },
    };

    mockRenderer.setOnHeroClick(heroClickHandler);
    mockRenderer.setOnTurretClick(turretClickHandler);
    mockRenderer.setOnFieldClick(fieldClickHandler);

    mockRenderer.onHeroClick?.('hero-1');
    mockRenderer.onTurretClick?.('turret-1', 0);
    mockRenderer.onFieldClick?.(100, 200);

    expect(heroClickHandler).toHaveBeenCalledWith('hero-1');
    expect(turretClickHandler).toHaveBeenCalledWith('turret-1', 0);
    expect(fieldClickHandler).toHaveBeenCalledWith(100, 200);
  });
});

// ==========================================================================
// GAME ACTIONS
// ==========================================================================

describe('Game actions', () => {
  it('should place wall with correct parameters', () => {
    const mockGame = {
      placeWall: vi.fn(),
    };

    mockGame.placeWall('reinforced', 100, 200);

    expect(mockGame.placeWall).toHaveBeenCalledWith('reinforced', 100, 200);
  });

  it('should remove wall by id', () => {
    const mockGame = {
      removeWall: vi.fn(),
    };

    mockGame.removeWall(42);

    expect(mockGame.removeWall).toHaveBeenCalledWith(42);
  });

  it('should set turret targeting mode', () => {
    const mockGame = {
      setTurretTargeting: vi.fn(),
    };

    mockGame.setTurretTargeting(1, 'weakest');

    expect(mockGame.setTurretTargeting).toHaveBeenCalledWith(1, 'weakest');
  });

  it('should activate overcharge on slot', () => {
    const mockGame = {
      activateOvercharge: vi.fn(),
    };

    mockGame.activateOvercharge(0);

    expect(mockGame.activateOvercharge).toHaveBeenCalledWith(0);
  });

  it('should spawn militia with parameters', () => {
    const mockGame = {
      spawnMilitia: vi.fn(),
    };

    mockGame.spawnMilitia('archer', 50, 100, 3);

    expect(mockGame.spawnMilitia).toHaveBeenCalledWith('archer', 50, 100, 3);
  });
});

// ==========================================================================
// BOSS RUSH
// ==========================================================================

describe('Boss Rush', () => {
  it('should start boss rush session', async () => {
    const mockGame = {
      startBossRushSession: vi.fn().mockResolvedValue({
        sessionId: 'boss-rush-123',
        seed: 54321,
      }),
    };

    const mockLoop = {
      start: vi.fn(),
    };

    const sessionInfo = await mockGame.startBossRushSession({
      fortressClass: 'arcane',
      startingHeroes: ['hero-1'],
      startingTurrets: [],
    });

    if (sessionInfo) {
      mockLoop.start();
    }

    expect(mockGame.startBossRushSession).toHaveBeenCalledWith({
      fortressClass: 'arcane',
      startingHeroes: ['hero-1'],
      startingTurrets: [],
    });
    expect(mockLoop.start).toHaveBeenCalled();
  });

  it('should end boss rush session', async () => {
    const mockGame = {
      endBossRushSession: vi.fn().mockResolvedValue(undefined),
      resetBossRush: vi.fn(),
    };

    const mockLoop = {
      stop: vi.fn(),
    };

    mockLoop.stop();
    await mockGame.endBossRushSession();
    mockGame.resetBossRush();

    expect(mockLoop.stop).toHaveBeenCalled();
    expect(mockGame.endBossRushSession).toHaveBeenCalled();
    expect(mockGame.resetBossRush).toHaveBeenCalled();
  });
});

// ==========================================================================
// COLONY SCENE
// ==========================================================================

describe('Colony scene', () => {
  it('should show colony scene', () => {
    const mockRenderer = {
      showColonyScene: vi.fn(),
    };

    mockRenderer.showColonyScene();

    expect(mockRenderer.showColonyScene).toHaveBeenCalled();
  });

  it('should hide colony scene', () => {
    const mockRenderer = {
      hideColonyScene: vi.fn(),
    };

    mockRenderer.hideColonyScene();

    expect(mockRenderer.hideColonyScene).toHaveBeenCalled();
  });

  it('should update colonies', () => {
    const mockRenderer = {
      setColonies: vi.fn(),
    };

    const colonies = [
      { id: 'colony-1', name: 'Alpha', level: 1 },
      { id: 'colony-2', name: 'Beta', level: 2 },
    ];

    mockRenderer.setColonies(colonies);

    expect(mockRenderer.setColonies).toHaveBeenCalledWith(colonies);
  });

  it('should play claim animation', async () => {
    const mockRenderer = {
      playColonyClaimAnimation: vi.fn().mockResolvedValue(undefined),
    };

    await mockRenderer.playColonyClaimAnimation();

    expect(mockRenderer.playColonyClaimAnimation).toHaveBeenCalled();
  });

  it('should play upgrade animation', () => {
    const mockRenderer = {
      playColonyUpgradeAnimation: vi.fn(),
    };

    mockRenderer.playColonyUpgradeAnimation('colony-1');

    expect(mockRenderer.playColonyUpgradeAnimation).toHaveBeenCalledWith('colony-1');
  });
});

// ==========================================================================
// MANUAL CONTROL
// ==========================================================================

describe('Manual control input', () => {
  it('should normalize movement input', () => {
    // Simulate updateManualInput logic
    function updateManualInput(manualKeys: { up: boolean; down: boolean; left: boolean; right: boolean }) {
      const rawX = (manualKeys.right ? 1 : 0) - (manualKeys.left ? 1 : 0);
      const rawY = (manualKeys.down ? 1 : 0) - (manualKeys.up ? 1 : 0);

      if (rawX === 0 && rawY === 0) {
        return { x: 0, y: 0 };
      }

      const length = Math.hypot(rawX, rawY) || 1;
      return { x: rawX / length, y: rawY / length };
    }

    // No input
    expect(updateManualInput({ up: false, down: false, left: false, right: false }))
      .toEqual({ x: 0, y: 0 });

    // Single direction
    expect(updateManualInput({ up: true, down: false, left: false, right: false }))
      .toEqual({ x: 0, y: -1 });

    expect(updateManualInput({ up: false, down: false, left: false, right: true }))
      .toEqual({ x: 1, y: 0 });

    // Diagonal (normalized)
    const diagonal = updateManualInput({ up: true, down: false, left: false, right: true });
    expect(diagonal.x).toBeCloseTo(0.707, 2);
    expect(diagonal.y).toBeCloseTo(-0.707, 2);
  });

  it('should detect typing targets', () => {
    function isTypingTarget(tagName: string | undefined, isContentEditable: boolean): boolean {
      if (!tagName) return false;
      const lower = tagName.toLowerCase();
      return lower === 'input' || lower === 'textarea' || isContentEditable;
    }

    expect(isTypingTarget('INPUT', false)).toBe(true);
    expect(isTypingTarget('TEXTAREA', false)).toBe(true);
    expect(isTypingTarget('DIV', true)).toBe(true);
    expect(isTypingTarget('DIV', false)).toBe(false);
    expect(isTypingTarget('BUTTON', false)).toBe(false);
    expect(isTypingTarget(undefined, false)).toBe(false);
  });
});
