// Profile signals
export {
  baseGold,
  baseDust,
  currentWave,
  baseLevel,
  baseXp,
  baseTotalXp,
  baseXpToNextLevel,
  displayName,
  playerDescription,
  descriptionUpdating,
  userRole,
  isAdmin,
  xpProgress,
  getXpProgressWithSegment,
  onboardingCompleted,
  defaultLoadout,
  buildPresets,
  activePresetId,
  showOnboardingModal,
  resetProfileState,
  gameConfig,
  type DefaultLoadout,
  type GameConfig,
} from './profile.signals.js';

// Guest mode signals
export {
  isGuestMode,
  showGuestRegistrationPrompt,
  guestAutoTransitionCountdown,
  setGuestMode,
  clearGuestMode,
  promptGuestRegistration,
  dismissGuestRegistrationPrompt,
} from './guest.signals.js';

// Experiments / A/B testing signals
export {
  experiments,
  experimentsLoaded,
  EXPERIMENT_DIRECTED_WAVE_1,
  setExperiments,
  getExperiment,
  isInTreatment,
  isInControl,
  isDirectedWave1Enabled,
  assignExperimentLocally,
  clearExperiments,
} from './experiments.signals.js';

// Game signals
export {
  gamePhase,
  rendererReady,
  forceResetToHub,
  gameSpeed,
  gameState,
  fortressHp,
  fortressMaxHp,
  fortressHpPercent,
  currentScore,
  displayGold,
  displayDust,
  waveProgress,
  wavesUntilBoss,
  isBossWave,
  nextBossWave,
  currentPillar,
  currentPillarInfo,
  PILLAR_INFO,
  unifiedLevel,
  unifiedXpProgress,
  lastSkillTargetPositions,
  isFirstSession,
  FIRST_SESSION_WAVE_THRESHOLD,
  type GameStateSnapshot,
  type GameSpeed,
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
  showStatisticsDashboard,
  openStatisticsDashboard,
  closeStatisticsDashboard,
  lastSessionAnalytics,
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
  // Build presets modal
  buildPresetsModalVisible,
  openBuildPresetsModal,
  closeBuildPresetsModal,
  // Error toasts
  errorToasts,
  showErrorToast,
  dismissErrorToast,
  // Synergy toasts
  activeSynergyToast,
  showSynergyToast,
  resetShownSynergies,
  type SynergyToastData,
  // Targeted fortress skill
  selectedTargetedSkill,
  selectSkillForTargeting,
  clearSelectedSkill,
  // Unlock notifications
  unlockNotifications,
  queueUnlockNotifications,
  dismissUnlockNotification,
  clearUnlockNotifications,
  // Level-up notifications
  levelUpNotifications,
  queueLevelUpNotification,
  dismissLevelUpNotification,
  clearLevelUpNotifications,
  // Pillar unlock modal
  pillarUnlockModalVisible,
  showPillarUnlockModal,
  closePillarUnlockModal,
  resetUIState,
  type ToastData,
  type SyncStatus,
  type ErrorToastData,
  type UnlockNotification,
  type LevelUpNotification,
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
  resetAllState,
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
  purchasedHeroSlots,
  purchasedTurretSlots,
  nextHeroSlotInfo,
  nextTurretSlotInfo,
  DEFAULT_TURRET_SLOTS,
  turretSlots,
  activeTurrets,
  selectedTurretSlot,
  turretPanelVisible,
  turretPlacementModalVisible,
  turretPlacementSlotIndex,
  heroRecruitmentModalVisible,
  heroPlacementModalVisible,
  heroPlacementSlotIndex,
  activeSynergies,
  upgradeTarget,
  upgradePanelVisible,
  // Hub state
  hubHeroes,
  hubTurrets,
  hubInitialized,
  // Optimized computed signals for panels
  heroPanelData,
  turretPanelData,
  type SynergyBonus,
  type UpgradeTarget,
} from './fortress.signals.js';

// Synergy Tags signals (live synergies with tooltips)
export {
  // Signals
  activePerks,
  allTagSynergies,
  activeTagSynergies,
  almostActiveSynergies,
  totalSynergyBonuses,
  dpsBreakdown,
  liveSynergyPanelExpanded,
  hoveredSynergyId,
  totalDamageBonus,
  totalAttackSpeedBonus,
  totalCritBonus,
  activeSynergyCount,
  showSynergies,
  // Showcase mode
  synergyShowcaseMode,
  showcaseStartTime,
  enableSynergyShowcase,
  disableSynergyShowcase,
  // Functions
  toggleLiveSynergyPanel,
  setHoveredSynergy,
  getHeroTagsWithDefs,
  getTurretTagsWithDefs,
  resetSynergyTagsState,
  // Types
  type DPSBreakdownEntry,
} from './synergy-tags.signals.js';

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
  resetMaterialsState,
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
  resetArtifactsState,
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
  resetIdleState,
} from './idle.signals.js';

// Power signals
export {
  powerState,
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
  getFortressStatLevel,
  getHeroStatLevel,
  getTurretStatLevel,
  getItemTierLevel,
  resetPowerState,
  type PowerState,
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
  // Roguelike mode state
  bossRushRelicOptions,
  bossRushRelicChosen,
  bossRushCollectedRelics,
  bossRushRerollsUsed,
  bossRushGoldSpent,
  bossRushShopStatBoosts,
  bossRushShopPurchases,
  bossRushSynergiesActivated,
  bossRushSynergyDamage,
  bossRushBestSingleHit,
  bossRushTotalHealing,
  showBossRushShop,
  bossRushAvailableGold,
  // Roguelike mode actions
  setBossRushRelicOptions,
  chooseBossRushRelic,
  rerollBossRushRelics,
  purchaseBossRushShopItem,
  updateBossRushSynergyStats,
  updateBossRushBestHit,
  openBossRushShop,
  closeBossRushShop,
  // Types
  type BossRushDamageEntry,
  type BossRushResult,
  type BossRushLeaderboardEntry,
} from './boss-rush.signals.js';

// Command system signals (tactical orders during waves)
export {
  commandSelectedHeroId,
  commandTargetPosition,
  manualControlHeroId,
  manualMoveInput,
  selectHeroForCommand,
  setCommandTarget,
  cancelCommand,
  clearCommandForHero,
  setManualControlHero,
  setManualMoveInput,
} from './command.signals.js';

// Arena Battle Scene signals (live PvP visualization)
export {
  arenaBattleActive,
  arenaBattleData,
  arenaBattlePhase,
  arenaBattleSpeed,
  arenaBattlePaused,
  startArenaBattle,
  setArenaBattlePhase,
  setArenaBattleSpeed,
  toggleArenaBattlePause,
  endArenaBattle,
  resetArenaBattleState,
  type ArenaBattleData,
  type ArenaBattlePhase,
} from './arenaBattle.signals.js';

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
  pvpBattleRewards,
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
  addReceivedChallenge,
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

// Guild signals
export {
  // Panel state
  showGuildPanel,
  guildPanelTab,
  showGuildSearch,
  showGuildCreate,
  // Player guild data
  playerGuild,
  playerMembership,
  guildBonuses,
  guildStructures,
  structuresLoading,
  isInGuild,
  isGuildLeader,
  isGuildOfficer,
  // Members
  guildMembers,
  guildLeader,
  guildOfficers,
  memberCount,
  // Treasury
  guildTreasury,
  treasuryLogs,
  canWithdraw,
  nextWithdrawAt,
  // Battles
  guildBattles,
  battleHistory,
  attacksCount,
  defensesCount,
  // Invitations
  receivedInvitations,
  hasNewInvitations,
  invitationCount,
  // Search
  guildSearchQuery,
  guildSearchResults,
  guildSearchTotal,
  // Leaderboard
  guildLeaderboard,
  myGuildRank,
  // Loading states
  guildLoading,
  treasuryLoading,
  battlesLoading,
  invitationsLoading,
  searchLoading,
  leaderboardLoading as guildLeaderboardLoading,
  // Error states
  guildError,
  treasuryError,
  battlesError,
  // Actions
  openGuildPanel,
  closeGuildPanel,
  openGuildSearch,
  closeGuildSearch,
  openGuildCreate,
  closeGuildCreate,
  resetGuildState,
  setGuildData,
  setTreasuryData,
} from './guild.signals.js';

// Settings signals
export {
  audioSettings,
  graphicsSettings,
  gameSettings,
  updateAudioSettings,
  updateGraphicsSettings,
  updateGameSettings,
  FIRST_SESSION_VFX_BOOST,
  FIRST_SESSION_SHAKE_THRESHOLD,
  type AudioSettings,
  type GraphicsSettings,
  type GameSettings,
} from './settings.signals.js';

// Time control signals (slow motion effects)
export {
  timeScale,
  slowMotionActive,
  slowMotionEndTick,
  slowMotionDuration,
  slowMotionStartTick,
  slowMotionProgress,
  triggerSlowMotion,
  endSlowMotion,
  updateSlowMotion,
  resetTimeControl,
  getEasedTimeScale,
} from './time.signals.js';

// Directed Wave signals (scripted first wave experience)
export {
  directedWaveActive,
  scriptedEventQueue,
  triggeredEventIds,
  lastTriggeredEvent,
  lastEventTriggerTime,
  pendingEventsCount,
  hasPendingEvents,
  initDirectedWave,
  endDirectedWave,
  processScriptedEvents,
  resetDirectedWaveState,
  onVFXBurst,
  onSynergyHighlight,
  onTutorialTip,
  type VFXBurstCallback,
  type SynergyHighlightCallback,
  type TutorialTipCallback,
} from './directed-wave.signals.js';

// Messages signals
export {
  // Modal state
  showMessagesModal,
  messagesActiveTab,
  // Thread list state
  threads,
  threadsLoading,
  threadsTotal,
  // Selected thread state
  selectedThreadId,
  selectedThread,
  selectedThreadLoading,
  // Compose modal state
  showComposeModal,
  composeLoading,
  // Reply state
  replyLoading,
  // Unread counts
  unreadCounts,
  messagesError,
  // Computed
  hasUnreadMessages,
  currentTabUnreadCount,
  // Actions
  openMessagesModal,
  closeMessagesModal,
  setMessagesTab,
  loadThreads,
  loadMoreThreads,
  selectThread,
  sendNewMessage,
  sendReply,
  removeThread,
  refreshUnreadCounts,
  openComposeModal,
  closeComposeModal,
  // WebSocket
  initMessagesWebSocket,
  cleanupMessagesWebSocket,
  resetMessagesState,
} from './messages.signals.js';

// Leaderboard Modal signals (player rankings)
export {
  // Modal state
  showLeaderboardModal,
  activeMainTab,
  activeSubTab,
  selectedWeek,
  // Leaderboard data (renamed to avoid conflict with ui.signals)
  leaderboardEntries as playerLeaderboardEntries,
  leaderboardTotal,
  leaderboardOffset,
  leaderboardLimit,
  leaderboardLoading as playerLeaderboardLoading,
  leaderboardLoadingMore,
  leaderboardError as playerLeaderboardError,
  timeUntilReset,
  availableWeeks,
  currentWeekKey,
  // User ranks
  userRanks,
  userRanksLoading,
  getUserRankForCategory,
  playerPrimaryRank,
  // Rewards
  availableRewards,
  rewardsLoading,
  hasUnclaimedRewards,
  unclaimedRewardsCount,
  // Exclusive items
  exclusiveItems,
  getExclusiveItemById,
  // Computed
  hasMoreEntries,
  hasMoreGuildEntries,
  formattedTimeUntilReset,
  // Search
  leaderboardSearchQuery,
  setLeaderboardSearch,
  // Actions
  openLeaderboardModal,
  closeLeaderboardModal,
  setMainTab,
  setSubTab,
  resetLeaderboardData,
  setSelectedWeek,
  setLeaderboardData,
  setUserRanks,
  setAvailableRewards,
  removeClaimedReward,
  setAvailableWeeks,
  setExclusiveItems,
  type MainTab,
  type SubTab,
} from './leaderboard.signals.js';

// Pillar Challenge signals
export {
  // Modal visibility
  pillarChallengeModalVisible,
  // Session state
  activeSession,
  // Attempts tracking
  dailyAttemptsUsed,
  dailyAttemptsMax,
  paidAttemptsUsed,
  paidAttemptsMax,
  cooldownEndsAt,
  // Crystal progress
  crystalProgress,
  matrixAssembled,
  // Unlocked tiers
  unlockedTiers,
  // Best scores
  bestScores,
  // Last result
  lastResult,
  // Loading states
  isLoading as pillarChallengeLoading,
  challengeError,
  // Computed values
  canStartChallenge,
  cooldownRemaining,
  hasFreeAttempts,
  hasPaidAttempts,
  totalFragments,
  completeCrystals,
  isTierUnlocked,
  // Actions
  showPillarChallengeModal,
  hidePillarChallengeModal,
  updateCrystalProgress,
  setActiveSession,
  updateSessionProgress,
  setChallengeResult,
  clearLastResult,
  unlockTier,
  updateBestScore,
  setLoading as setPillarChallengeLoading,
  setError as setPillarChallengeError,
  resetDailyAttempts,
  initializePillarChallengeState,
  // Types
  type PillarChallengeSession,
  type PillarChallengeResult,
  type PillarChallengeState,
} from './pillar-challenge.signals.js';

// Mastery signals
export {
  // State
  masteryState,
  masteryModalVisible,
  selectedMasteryClass,
  hoveredMasteryNode,
  // Computed
  availableMasteryPoints,
  totalMasteryPointsEarned,
  currentClassProgress,
  currentTreeDefinition,
  isNodeUnlocked,
  totalPointsSpent,
  // Actions
  openMasteryModal,
  closeMasteryModal,
  selectMasteryClass,
  setMasteryLoading,
  setMasteryError,
  updateMasteryProgress,
  updateMasteryTrees,
  updateMasterySummaries,
  resetMasteryState,
  // Types
  type MasteryState,
} from './mastery.signals.js';

// Hub Preview signals
export {
  hubPreviewData,
  hubPreviewLoading,
  hubPreviewError,
  hubPreviewModalOpen,
  hubPreviewUserId,
  isHubPreviewVisible,
  isHubPreviewReady,
  openHubPreview,
  closeHubPreview,
} from './hubPreview.signals.js';

// Guild Preview signals
export {
  guildPreviewData,
  guildPreviewLoading,
  guildPreviewError,
  guildPreviewModalOpen,
  guildPreviewGuildId,
  isGuildPreviewVisible,
  isGuildPreviewReady,
  openGuildPreview,
  closeGuildPreview,
} from './guildPreview.signals.js';

// Shop signals
export {
  // State
  shopData,
  activeBoosters,
  purchaseHistory,
  isLoadingShop,
  isProcessingPurchase,
  shopModalVisible,
  selectedCategory,
  checkoutSessionId,
  checkoutStatus,
  shopError,
  // Computed
  currentCategoryProducts,
  starterPackAvailable,
  hasActiveXpBoost,
  hasActiveGoldBoost,
  // Functions
  hasFirstPurchaseBonus,
  getActiveBooster,
  // Actions
  loadShop,
  loadActiveBoosters,
  loadPurchaseHistory,
  startCheckout,
  handleCheckoutReturn,
  buyWithDust,
  showShopModal,
  hideShopModal,
  selectCategory,
  resetCheckoutStatus,
  updateBoosterTimers,
  resetShopState,
} from './shop.signals.js';

// Legal signals
export {
  legalModalVisible,
  activeLegalTab,
  openLegalModal,
  closeLegalModal,
  setLegalTab,
  resetLegalState,
  type LegalTab,
} from './legal.signals.js';

// Energy signals
export {
  // State
  energyState,
  energyLoading,
  energyError,
  refilling,
  // Computed
  currentEnergy,
  maxEnergy,
  energyPercent,
  hasEnergy,
  isEnergyFull,
  canRefill,
  nextRegenIn,
  timeToFullRegen,
  refillCost,
  // Actions
  fetchEnergy,
  refillEnergyAction,
  consumeEnergyLocal,
  resetEnergyState,
} from './energy.signals.js';

// Pillar Unlocks signals
export {
  // State
  pillarUnlocksState,
  pillarUnlocksLoading,
  pillarUnlocksError,
  // Computed
  unlockedPillarSet,
  unlockedPillars,
  allPillars,
  unlockedCount,
  totalPillars,
  unlockProgress,
  currentFortressLevel,
  // Helpers
  isPillarUnlocked,
  getPillarInfo,
  // Actions
  fetchPillarUnlocks,
  selectPillar,
  resetPillarUnlocksState,
} from './pillarUnlocks.signals.js';

// Battle Pass signals
export {
  // State
  battlepassData,
  battlepassLoading,
  battlepassError,
  battlepassModalVisible,
  claimingTier,
  claimingAll as claimingAllBP,
  purchasingTiers,
  upgradingPremium,
  // Computed
  currentTier,
  currentPoints,
  isPremium,
  tierProgress,
  timeRemainingFormatted,
  unclaimedFreeRewards,
  unclaimedPremiumRewards,
  totalUnclaimedCount,
  hasUnclaimedRewards as hasUnclaimedBPRewards,
  maxTier,
  tierPurchaseCost,
  isMaxTier,
  seasonName,
  seasonDescription,
  // Actions
  fetchBattlePass,
  claimReward as claimBPReward,
  claimAllRewards as claimAllBPRewards,
  purchaseTier,
  startPremiumUpgrade,
  resetBattlePassState,
  isFreeTierClaimed,
  isPremiumTierClaimed,
  isTierClaimable,
} from './battlepass.signals.js';

// Game actions (for UI components to call game methods)
export {
  setTurretTargeting,
  activateOvercharge,
  placeWall,
  removeWall,
  spawnMilitia,
} from './gameActions.signals.js';

// Achievements System (permanent progression)
export {
  // Signals
  achievementsData,
  achievementsLoading,
  achievementsError,
  achievementsModalVisible,
  claimingAchievement,
  claimingAll as claimingAllAchievements,
  settingTitle,
  selectedCategory as achievementsSelectedCategory,
  // Computed
  totalUnclaimedCount as achievementsUnclaimedCount,
  hasUnclaimedAchievementRewards as hasUnclaimedAchievements,
  unlockedTitles,
  activeTitle,
  lifetimeStats,
  filteredAchievements,
  achievementsWithUnclaimedRewards,
  categoryProgress,
  totalAchievementsCompleted,
  totalAchievementsCount,
  // Actions
  fetchAchievements,
  claimReward as claimAchievementReward,
  claimAllRewards as claimAllAchievementRewards,
  setActiveTitle,
  showAchievementsModal,
  hideAchievementsModal,
  setSelectedCategory,
  resetAchievementsState,
  isTierClaimed as isAchievementTierClaimed,
  isTierClaimable as isAchievementTierClaimable,
  getTierRomanNumeral,
  formatStatNumber,
} from './achievements.signals.js';

// Daily Login Rewards signals
export {
  // State
  dailyStatus,
  dailyLoading,
  dailyError,
  dailyModalVisible,
  claiming as dailyClaiming,
  // Computed
  canClaimDaily,
  currentDay,
  streak,
  streakMultiplier,
  daysUntilNextMilestone,
  nextMilestone,
  rewards as dailyRewards,
  totalDaysClaimed,
  // Actions
  fetchDailyStatus,
  claimDailyReward,
  showDailyModal,
  hideDailyModal,
  resetDailyState,
} from './daily.signals.js';

// Weekly Missions signals
export {
  // State
  missionsData,
  missionsLoading,
  missionsError,
  missionsModalVisible,
  claimingMission,
  claimingAll as claimingAllMissions,
  // Computed
  missions,
  unclaimedCount as missionsUnclaimedCount,
  hasUnclaimedMissionRewards,
  completedCount as missionsCompletedCount,
  claimedCount as missionsClaimedCount,
  weekKey,
  timeUntilReset as missionsTimeUntilReset,
  sortedMissions,
  missionsByDifficulty,
  // Actions
  fetchMissions,
  claimMissionReward,
  claimAllMissions,
  showMissionsModal,
  hideMissionsModal,
  resetMissionsState,
  formatTimeUntilReset,
  isMissionClaimable,
  getMissionProgressText,
} from './missions.signals.js';

// Tutorial signals
export {
  // Types
  type TutorialStepId,
  type TutorialTip,
  type TutorialCompletion,
  type TutorialSignalName,
  // State
  tutorialProgress,
  activeTutorialTip,
  tutorialsEnabled,
  tutorialPauseRequested,
  lastGameAction,
  // Actions
  showTutorialTip,
  dismissCurrentTip,
  markTipCompleted,
  isTipCompleted,
  resetTutorialProgress,
  recordGameAction,
  completeInteractiveTip,
  // Skip functionality
  skipAllTutorials,
  areTutorialsComplete,
  getCompletedTutorialCount,
  getTotalTutorialCount,
} from './tutorial.signals.js';

// Stat Points signals (free points earned from waves/levels)
export {
  // Raw state
  totalStatPointsEarned,
  totalStatPointsSpent,
  fortressStatAllocations,
  heroStatAllocations,
  // Computed
  availableStatPoints,
  hasAvailableStatPoints,
  // Getters
  getHeroAllocations,
  getFortressAllocation,
  getHeroStatAllocation,
  // Actions
  updateStatPointsFromServer,
  optimisticAllocateFortress,
  optimisticAllocateHero,
  resetStatPointsState,
  // Simulation export
  getStatPointDataForSimulation,
} from './stat-points.signals.js';

// Stat Points Modal
export {
  statPointsModalVisible,
  showStatPointsModal,
  hideStatPointsModal,
} from '../components/modals/StatPointsModal.js';

// Re-export types
export type { LeaderboardEntry, GameEndState } from './ui.signals.js';
export type { HubPreviewResponse, GuildPreviewResponse } from '@arcade/protocol';
export type { EnergyStatus } from '@arcade/protocol';
export type { GetPillarUnlocksResponse, PillarUnlockInfo, PillarUnlockId } from '@arcade/protocol';
export type { DailyLoginStatusResponse, ClaimDailyRewardResponse } from '@arcade/protocol';
export type { GetWeeklyMissionsResponse, MissionProgress, MissionType } from '@arcade/protocol';
export type { StatPointsSummaryResponse, FortressStatAllocations, HeroStatAllocations } from '@arcade/protocol';
