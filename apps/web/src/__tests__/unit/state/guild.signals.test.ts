/**
 * Guild signals tests
 *
 * Tests for guild state signals and computed values.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockGuildWithMembers,
  createMockGuildMember,
  createMockGuildTreasury,
} from '../../mocks/data.js';

// Import signals
import {
  showGuildPanel,
  guildPanelTab,
  showGuildSearch,
  showGuildCreate,
  playerGuild,
  playerMembership,
  guildBonuses,
  guildStructures,
  structuresLoading,
  isInGuild,
  isGuildLeader,
  isGuildOfficer,
  guildMembers,
  guildLeader,
  guildOfficers,
  memberCount,
  guildTreasury,
  treasuryLogs,
  canWithdraw,
  nextWithdrawAt,
} from '../../../state/guild.signals.js';

describe('Guild Signals', () => {
  beforeEach(() => {
    // Reset signals to defaults
    showGuildPanel.value = false;
    guildPanelTab.value = 'info';
    showGuildSearch.value = false;
    showGuildCreate.value = false;
    playerGuild.value = null;
    playerMembership.value = null;
    guildBonuses.value = null;
    guildStructures.value = null;
    structuresLoading.value = false;
    guildTreasury.value = null;
    treasuryLogs.value = [];
    canWithdraw.value = false;
    nextWithdrawAt.value = null;
  });

  // ==========================================================================
  // PANEL STATE
  // ==========================================================================

  describe('panel state signals', () => {
    it('should default showGuildPanel to false', () => {
      expect(showGuildPanel.value).toBe(false);
    });

    it('should toggle guild panel', () => {
      showGuildPanel.value = true;
      expect(showGuildPanel.value).toBe(true);
    });

    it('should default guildPanelTab to info', () => {
      expect(guildPanelTab.value).toBe('info');
    });

    it('should change panel tab', () => {
      guildPanelTab.value = 'members';
      expect(guildPanelTab.value).toBe('members');

      guildPanelTab.value = 'treasury';
      expect(guildPanelTab.value).toBe('treasury');

      guildPanelTab.value = 'battles';
      expect(guildPanelTab.value).toBe('battles');
    });

    it('should toggle search and create modals', () => {
      showGuildSearch.value = true;
      expect(showGuildSearch.value).toBe(true);

      showGuildCreate.value = true;
      expect(showGuildCreate.value).toBe(true);
    });
  });

  // ==========================================================================
  // PLAYER GUILD DATA
  // ==========================================================================

  describe('player guild signals', () => {
    it('should default playerGuild to null', () => {
      expect(playerGuild.value).toBeNull();
    });

    it('should store guild with members', () => {
      const mockGuild = createMockGuildWithMembers() as any;
      playerGuild.value = mockGuild;

      expect(playerGuild.value).not.toBeNull();
      expect(playerGuild.value?.name).toBe('Test Guild');
    });

    it('should default playerMembership to null', () => {
      expect(playerMembership.value).toBeNull();
    });

    it('should store membership details', () => {
      const mockMember = createMockGuildMember({ role: 'OFFICER' }) as any;
      playerMembership.value = mockMember;

      expect(playerMembership.value?.role).toBe('OFFICER');
    });

    it('should store guild bonuses', () => {
      guildBonuses.value = { goldBoost: 0.1, statBoost: 0.05, xpBoost: 0.15 };

      expect(guildBonuses.value?.goldBoost).toBe(0.1);
      expect(guildBonuses.value?.statBoost).toBe(0.05);
      expect(guildBonuses.value?.xpBoost).toBe(0.15);
    });
  });

  // ==========================================================================
  // COMPUTED SIGNALS
  // ==========================================================================

  describe('isInGuild (computed)', () => {
    it('should be false when not in guild', () => {
      playerGuild.value = null;
      expect(isInGuild.value).toBe(false);
    });

    it('should be true when in guild', () => {
      playerGuild.value = createMockGuildWithMembers() as any;
      expect(isInGuild.value).toBe(true);
    });
  });

  describe('isGuildLeader (computed)', () => {
    it('should be false when not leader', () => {
      playerMembership.value = createMockGuildMember({ role: 'MEMBER' }) as any;
      expect(isGuildLeader.value).toBe(false);
    });

    it('should be true when leader', () => {
      playerMembership.value = createMockGuildMember({ role: 'LEADER' }) as any;
      expect(isGuildLeader.value).toBe(true);
    });

    it('should be false when not in guild', () => {
      playerMembership.value = null;
      expect(isGuildLeader.value).toBe(false);
    });
  });

  describe('isGuildOfficer (computed)', () => {
    it('should be false for member', () => {
      playerMembership.value = createMockGuildMember({ role: 'MEMBER' }) as any;
      expect(isGuildOfficer.value).toBe(false);
    });

    it('should be true for officer', () => {
      playerMembership.value = createMockGuildMember({ role: 'OFFICER' }) as any;
      expect(isGuildOfficer.value).toBe(true);
    });

    it('should be true for leader', () => {
      playerMembership.value = createMockGuildMember({ role: 'LEADER' }) as any;
      expect(isGuildOfficer.value).toBe(true);
    });
  });

  describe('guildMembers (computed)', () => {
    it('should return empty array when no guild', () => {
      playerGuild.value = null;
      expect(guildMembers.value).toEqual([]);
    });

    it('should return members from guild', () => {
      const mockGuild = createMockGuildWithMembers() as any;
      playerGuild.value = mockGuild;

      expect(guildMembers.value.length).toBe(3);
    });
  });

  describe('guildLeader (computed)', () => {
    it('should find guild leader', () => {
      const mockGuild = createMockGuildWithMembers() as any;
      playerGuild.value = mockGuild;

      expect(guildLeader.value?.role).toBe('LEADER');
    });

    it('should return undefined when no guild', () => {
      playerGuild.value = null;
      expect(guildLeader.value).toBeUndefined();
    });
  });

  describe('guildOfficers (computed)', () => {
    it('should find all officers', () => {
      const mockGuild = createMockGuildWithMembers() as any;
      playerGuild.value = mockGuild;

      const officers = guildOfficers.value;
      expect(officers.every(o => o.role === 'OFFICER')).toBe(true);
    });
  });

  describe('memberCount (computed)', () => {
    it('should return 0 when no guild', () => {
      playerGuild.value = null;
      expect(memberCount.value).toBe(0);
    });

    it('should return correct member count', () => {
      const mockGuild = createMockGuildWithMembers() as any;
      playerGuild.value = mockGuild;

      expect(memberCount.value).toBe(3);
    });
  });

  // ==========================================================================
  // TREASURY
  // ==========================================================================

  describe('treasury signals', () => {
    it('should default treasury to null', () => {
      expect(guildTreasury.value).toBeNull();
    });

    it('should store treasury data', () => {
      guildTreasury.value = createMockGuildTreasury() as any;

      expect(guildTreasury.value?.gold).toBe(50000);
      expect(guildTreasury.value?.dust).toBe(2000);
    });

    it('should default treasuryLogs to empty array', () => {
      expect(treasuryLogs.value).toEqual([]);
    });

    it('should store treasury logs', () => {
      treasuryLogs.value = [
        { id: '1', type: 'DEPOSIT', amount: 1000 },
        { id: '2', type: 'WITHDRAW', amount: 500 },
      ];

      expect(treasuryLogs.value.length).toBe(2);
    });

    it('should track withdrawal permissions', () => {
      canWithdraw.value = true;
      expect(canWithdraw.value).toBe(true);

      nextWithdrawAt.value = '2026-01-25T00:00:00Z';
      expect(nextWithdrawAt.value).toBe('2026-01-25T00:00:00Z');
    });
  });

  // ==========================================================================
  // STRUCTURES
  // ==========================================================================

  describe('structures signals', () => {
    it('should default structures to null', () => {
      expect(guildStructures.value).toBeNull();
    });

    it('should store structures', () => {
      guildStructures.value = [
        { type: 'BARRACKS', level: 3, bonus: 0.15 } as any,
        { type: 'TREASURY', level: 5, bonus: 0.25 } as any,
      ];

      expect(guildStructures.value?.length).toBe(2);
    });

    it('should track loading state', () => {
      structuresLoading.value = true;
      expect(structuresLoading.value).toBe(true);

      structuresLoading.value = false;
      expect(structuresLoading.value).toBe(false);
    });
  });
});
