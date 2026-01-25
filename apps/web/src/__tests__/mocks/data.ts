/**
 * Mock data factories for web application tests
 */

// ============================================================================
// USER & AUTH
// ============================================================================

export function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-123',
    username: 'testuser',
    displayName: 'Test User',
    email: 'test@example.com',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockAuthResponse(overrides: Record<string, unknown> = {}) {
  return {
    accessToken: 'mock-access-token',
    displayName: 'Test User',
    ...overrides,
  };
}

export function createMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-123',
    displayName: 'Test User',
    level: 10,
    xp: 5000,
    xpToNextLevel: 10000,
    power: 1500,
    preferredCurrency: 'gold',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// INVENTORY & MATERIALS
// ============================================================================

export function createMockInventory(overrides: Record<string, unknown> = {}) {
  return {
    gold: 10000,
    dust: 500,
    gems: 100,
    ...overrides,
  };
}

export function createMockMaterials(overrides: Record<string, unknown> = {}) {
  return {
    materials: [
      { id: 'iron', quantity: 100 },
      { id: 'wood', quantity: 50 },
      { id: 'stone', quantity: 75 },
    ],
    ...overrides,
  };
}

// ============================================================================
// SESSION
// ============================================================================

export function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-123',
    sessionToken: 'session-token-abc',
    seed: 12345,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockActiveSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-123',
    sessionToken: 'session-token-abc',
    wave: 5,
    score: 1000,
    startedAt: new Date().toISOString(),
    snapshot: null,
    ...overrides,
  };
}

// ============================================================================
// GUILD
// ============================================================================

export function createMockGuild(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guild-123',
    name: 'Test Guild',
    tag: 'TEST',
    description: 'A test guild',
    level: 5,
    memberCount: 10,
    maxMembers: 30,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockGuildMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-123',
    guildId: 'guild-123',
    userId: 'user-123',
    role: 'MEMBER',
    joinedAt: new Date().toISOString(),
    user: createMockUser(),
    ...overrides,
  };
}

export function createMockGuildWithMembers(overrides: Record<string, unknown> = {}) {
  return {
    ...createMockGuild(),
    members: [
      createMockGuildMember({ role: 'LEADER' }),
      createMockGuildMember({ userId: 'user-456', role: 'OFFICER' }),
      createMockGuildMember({ userId: 'user-789', role: 'MEMBER' }),
    ],
    ...overrides,
  };
}

export function createMockGuildTreasury(overrides: Record<string, unknown> = {}) {
  return {
    guildId: 'guild-123',
    gold: 50000,
    dust: 2000,
    medals: 10,
    ...overrides,
  };
}

export function createMockGuildBattle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'battle-123',
    attackerGuildId: 'guild-123',
    defenderGuildId: 'guild-456',
    status: 'PENDING',
    attackerScore: 0,
    defenderScore: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockGuildInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invite-123',
    guildId: 'guild-123',
    inviterId: 'user-123',
    inviteeId: 'user-456',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockGuildApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-123',
    guildId: 'guild-123',
    applicantId: 'user-789',
    message: 'I want to join!',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// BOSS RUSH
// ============================================================================

export function createMockBossRushSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'boss-rush-123',
    sessionToken: 'boss-token-abc',
    seed: 54321,
    bossIndex: 0,
    totalDamage: 0,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockBossRushResult(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'boss-rush-123',
    bossesKilled: 5,
    totalDamage: 150000,
    duration: 300,
    rewards: {
      gold: 5000,
      dust: 100,
    },
    ...overrides,
  };
}

// ============================================================================
// GAME STATE
// ============================================================================

type PillarId = 'streets' | 'science' | 'mutants' | 'cosmos' | 'magic' | 'gods';

export function createMockGameState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base = {
    tick: 0,
    wave: 1,
    wavesCleared: 0,
    kills: 0,
    eliteKills: 0,
    killStreak: 0,
    goldEarned: 0,
    dustEarned: 0,
    segmentXpEarned: 0,
    waveSpawnedEnemies: 0,
    waveTotalEnemies: 10,
    enemyCount: 0,
    relics: [] as { id: string }[],
    skillCooldown: 0,
    ended: false,
    currentPillar: 'streets' as PillarId,
    commanderLevel: 1,
    sessionXpEarned: 0,
    xpAtSessionStart: 0,
    collectedStones: [] as string[],
    infinityStoneFragments: [] as string[],
    gauntletState: null,
    fortressActiveSkills: [] as string[],
    fortressSkillCooldowns: {} as Record<string, number>,
    militiaCount: 0,
    maxMilitiaCount: 10,
    militiaSpawnCooldowns: {} as Record<string, number>,
    heroes: [] as unknown[],
    enemies: [] as unknown[],
  };
  return { ...base, ...overrides };
}

// ============================================================================
// SETTINGS
// ============================================================================

export function createMockAudioSettings(overrides: Record<string, unknown> = {}) {
  return {
    masterVolume: 1.0,
    musicVolume: 0.7,
    sfxVolume: 0.8,
    muted: false,
    ...overrides,
  };
}

export function createMockGraphicsSettings(overrides: Record<string, unknown> = {}) {
  return {
    quality: 'high',
    particles: 1.0,
    resolutionScale: 1.0,
    damageNumbers: true,
    ...overrides,
  };
}

export function createMockGameSettings(overrides: Record<string, unknown> = {}) {
  return {
    language: 'en',
    autoSaveInterval: 60000,
    showTutorials: true,
    autoPickRelics: false,
    relicPriority: ['damage', 'defense', 'utility'],
    ...overrides,
  };
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export function createMockLeaderboardEntry(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    userId: 'user-123',
    displayName: 'Test User',
    score: 10000,
    wave: 50,
    ...overrides,
  };
}
