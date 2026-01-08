// Profile signals
export {
  baseGold,
  baseDust,
  currentWave,
  baseLevel,
  baseXp,
  baseXpToNextLevel,
  displayName,
  xpProgress,
  getXpProgressWithSegment,
  onboardingCompleted,
  defaultLoadout,
  showOnboardingModal,
  type DefaultLoadout,
} from './profile.signals.js';

// Game signals
export {
  gamePhase,
  gameState,
  fortressHp,
  fortressMaxHp,
  fortressHpPercent,
  currentScore,
  displayGold,
  displayDust,
  waveProgress,
  currentPillar,
  currentPillarInfo,
  PILLAR_INFO,
  unifiedLevel,
  unifiedXpProgress,
  type GameStateSnapshot,
} from './game.signals.js';

// Auth signals
export {
  isAuthenticated,
  authLoading,
  authError,
  authScreen,
} from './auth.signals.js';

// UI signals
export {
  toastMessage,
  syncStatus,
  showChoiceModal,
  choiceOptions,
  showEndScreen,
  endScreenWon,
  endGameStats,
  leaderboardEntries,
  leaderboardLoading,
  leaderboardError,
  showSessionRecoveryModal,
  pendingSessionSnapshot,
  showEndSessionConfirm,
  // Settings menu
  settingsMenuVisible,
  openSettingsMenu,
  closeSettingsMenu,
  // Error toasts
  errorToasts,
  showErrorToast,
  dismissErrorToast,
  // Unlock notifications
  unlockNotifications,
  queueUnlockNotifications,
  dismissUnlockNotification,
  clearUnlockNotifications,
  type ToastData,
  type SyncStatus,
  type ErrorToastData,
  type UnlockNotification,
} from './ui.signals.js';

// Actions
export {
  updateFromProfile,
  updateFromSegment,
  updateFromSessionStart,
  syncGameState,
  showRewardsToast,
  hideRewardsToast,
  showChoice,
  hideChoice,
  showEndScreenWithStats,
  hideEndScreen,
  updateLeaderboard,
  setLeaderboardError,
  resetGameState,
  resetFortressSelection,
  initializeHubFromLoadout,
  updateProfileFromServer,
} from './actions.js';

// Fortress signals (class, heroes, turrets, synergies)
export {
  selectedFortressClass,
  classSelectionVisible,
  activeHeroes,
  unlockedHeroIds,
  unlockedTurretIds,
  selectedHeroId,
  heroPanelVisible,
  maxHeroSlots,
  DEFAULT_TURRET_SLOTS,
  turretSlots,
  activeTurrets,
  selectedTurretSlot,
  turretPanelVisible,
  turretPlacementModalVisible,
  turretPlacementSlotIndex,
  heroRecruitmentModalVisible,
  activeSynergies,
  upgradeTarget,
  upgradePanelVisible,
  // Hub state
  hubHeroes,
  hubTurrets,
  hubInitialized,
  type SynergyBonus,
  type UpgradeTarget,
} from './fortress.signals.js';

// Materials signals
export {
  playerMaterials,
  recentDrops,
  materialsModalVisible,
  uniqueMaterialsCount,
  addMaterialDrop,
  updatePlayerMaterials,
  addMaterials,
  removeMaterials,
  hasMaterials,
  showMaterialsModal,
  hideMaterialsModal,
  type MaterialDrop,
  type MaterialInfo,
} from './materials.signals.js';

// Artifacts signals
export {
  playerArtifacts,
  playerItems,
  artifactsModalVisible,
  craftingModalVisible,
  selectedArtifactId,
  artifactsLoading,
  artifactsError,
  artifactsWithDefs,
  itemsWithDefs,
  equippedArtifactsByHero,
  unequippedArtifacts,
  totalArtifacts,
  totalItems,
  updateArtifacts,
  updateItems,
  addArtifact,
  updateArtifact,
  updateItemAmount,
  showArtifactsModal,
  hideArtifactsModal,
  showCraftingModal,
  hideCraftingModal,
  selectArtifact,
  getArtifactForHero,
  hasArtifact,
  getItemAmount,
} from './artifacts.signals.js';

// Idle rewards signals
export {
  idleRewardsState,
  idleRewardsLoading,
  idleRewardsError,
  idleRewardsModalVisible,
  claimingRewards,
  hasPendingRewards,
  totalPendingMaterials,
  checkIdleRewards,
  claimIdleRewards,
  showIdleRewardsModal,
  hideIdleRewardsModal,
  formatIdleTime,
} from './idle.signals.js';

// Power signals
export {
  powerState,
  activeUpgradeCategory,
  selectedEntityId,
  showPowerUpgradeModal,
  totalPowerDisplay,
  isPowerLoaded,
  setPowerSummary,
  setPowerLoading,
  setPowerError,
  updateTotalPower,
  updateFortressStatLevel,
  updateHeroStatLevel,
  updateTurretStatLevel,
  updateItemTier,
  openPowerUpgradeModal,
  closePowerUpgradeModal,
  getFortressStatLevel,
  getHeroStatLevel,
  getTurretStatLevel,
  getItemTierLevel,
  type PowerState,
  type UpgradeCategory,
} from './power.signals.js';

// Boss Rush signals
export {
  // Session state
  bossRushActive,
  bossRushSessionId,
  bossRushSessionToken,
  bossRushSeed,
  bossRushStartTime,
  // Current boss state
  currentBossIndex,
  currentBossType,
  currentBossName,
  currentBossPillar,
  bossHp,
  bossMaxHp,
  currentCycle,
  // Damage tracking
  totalDamageDealt,
  currentBossDamage,
  damagePerSecond,
  damageHistory,
  // Progress & milestones
  bossesKilled,
  bossRushGoldEarned,
  bossRushDustEarned,
  bossRushMaterialsEarned,
  BOSS_RUSH_MILESTONES,
  achievedMilestones,
  // UI state
  showBossRushSetup,
  showBossRushEndScreen,
  bossRushEndResult,
  showBossRushDetails,
  bossRushIntermission,
  intermissionCountdown,
  bossRushLoading,
  bossRushError,
  // Leaderboard
  userBestDamage,
  userBestBossesKilled,
  userBossRushRank,
  bossRushLeaderboard,
  bossRushLeaderboardLoading,
  // Computed
  bossHpPercent,
  currentCycleDisplay,
  bossNumberInCycle,
  totalBossNumber,
  sessionDuration,
  sessionDurationFormatted,
  // Utils
  formatDamage,
  formatDamageCompact,
  // Actions
  resetBossRushState,
  initBossRushSession,
  updateBossState,
  updateDamageDealt,
  recordBossKill,
  recordBossDeath,
  startIntermission,
  endIntermission,
  updateIntermissionCountdown,
  updateBossRushRewards,
  openBossRushSetup,
  closeBossRushSetup,
  showBossRushEnd,
  closeBossRushEndScreen,
  updateBossRushLeaderboard,
  updateUserBestScore,
  // Types
  type BossRushDamageEntry,
  type BossRushResult,
  type BossRushLeaderboardEntry,
} from './boss-rush.signals.js';

// Command system signals (tactical orders during waves)
export {
  commandSelectedHeroId,
  commandTargetPosition,
  selectHeroForCommand,
  setCommandTarget,
  cancelCommand,
  clearCommandForHero,
} from './command.signals.js';

// PvP Arena signals
export {
  // User stats
  pvpWins,
  pvpLosses,
  pvpWinRate,
  pvpTotalBattles,
  pvpPendingChallenges,
  userPower,
  // Opponents
  pvpOpponents,
  pvpOpponentsTotal,
  pvpOpponentsLoading,
  pvpOpponentsError,
  // Challenges
  pvpSentChallenges,
  pvpReceivedChallenges,
  pvpAllChallenges,
  pvpPendingReceivedChallenges,
  pvpChallengesLoading,
  pvpChallengesError,
  // Battle state
  pvpSelectedChallenge,
  pvpBattleData,
  pvpBattleResult,
  pvpBattleInProgress,
  pvpAcceptingChallenge,
  // UI
  showPvpPanel,
  pvpActiveTab,
  showChallengeConfirm,
  pvpChallengeTarget,
  showPvpResultModal,
  showPvpReplay,
  pvpLoading,
  pvpError,
  // Actions
  resetPvpState,
  updatePvpStats,
  setPvpOpponents,
  setPvpChallenges,
  addSentChallenge,
  updateChallengeStatus,
  setPvpBattleData,
  setPvpBattleResult,
  confirmChallenge,
  cancelChallengeConfirm,
  openPvpPanel,
  closePvpPanel,
  setActivePvpTab,
  showBattleResult,
  hideBattleResult,
  openReplayViewer,
  closeReplayViewer,
  // Utils
  formatPower,
  getStatusText,
  getStatusColor,
  // Types
  type PvpBattleData,
} from './pvp.signals.js';

// Re-export types
export type { LeaderboardEntry, GameEndState } from './ui.signals.js';
