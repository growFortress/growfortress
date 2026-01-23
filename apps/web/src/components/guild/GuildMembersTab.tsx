/**
 * Guild Members Tab - Shows member list with management options
 *
 * Includes Battle Hero selection for Arena 5v5 guild battles.
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { GuildMember, BattleHero } from '@arcade/protocol';
import { getHeroById } from '@arcade/sim-core';
import {
  guildMembers,
  playerMembership,
  isGuildOfficer,
  playerGuild,
} from '../../state/guild.signals.js';
import { openHubPreview } from '../../state/hubPreview.signals.js';
import { unlockedHeroIds } from '../../state/fortress.signals.js';
import {
  kickMember,
  updateMemberRole,
  transferLeadership,
  sendInvitation,
  getBattleHero,
  setBattleHero,
  clearBattleHero,
} from '../../api/guild.js';
import { showSuccessToast } from '../../state/ui.signals.js';
import { Button } from '../shared/Button.js';
import { OnlineStatusIndicator } from '../shared/OnlineStatusIndicator.js';
import styles from './GuildPanel.module.css';

interface GuildMembersTabProps {
  onRefresh: () => void;
}

export function GuildMembersTab({ onRefresh }: GuildMembersTabProps) {
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Battle Hero state
  const [myBattleHero, setMyBattleHero] = useState<BattleHero | null>(null);
  const [battleHeroLoading, setBattleHeroLoading] = useState(false);
  const [selectedHeroId, setSelectedHeroId] = useState<string>('');
  const [battleHeroError, setBattleHeroError] = useState<string | null>(null);

  const guild = playerGuild.value;
  const members = guildMembers.value;
  const currentMembership = playerMembership.value;
  const unlockedHeroes = unlockedHeroIds.value;

  // Load current Battle Hero on mount
  useEffect(() => {
    if (guild) {
      loadBattleHero();
    }
  }, [guild?.id]);

  const loadBattleHero = useCallback(async () => {
    if (!guild) return;
    try {
      const data = await getBattleHero(guild.id);
      setMyBattleHero(data.battleHero);
      setSelectedHeroId(data.battleHero?.heroId || '');
    } catch (error) {
      console.error('Failed to load Battle Hero:', error);
    }
  }, [guild?.id]);

  const handleSetBattleHero = async () => {
    if (!guild || !selectedHeroId) return;

    setBattleHeroLoading(true);
    setBattleHeroError(null);

    try {
      const result = await setBattleHero(guild.id, selectedHeroId);
      setMyBattleHero(result.battleHero);
      const hero = getHeroById(selectedHeroId);
      showSuccessToast(`Battle Hero: ${hero?.name || selectedHeroId}`);
    } catch (error: any) {
      setBattleHeroError(error.message || 'Nie udalo sie ustawic Battle Hero');
    } finally {
      setBattleHeroLoading(false);
    }
  };

  const handleClearBattleHero = async () => {
    if (!guild) return;

    setBattleHeroLoading(true);
    setBattleHeroError(null);

    try {
      await clearBattleHero(guild.id);
      setMyBattleHero(null);
      setSelectedHeroId('');
      showSuccessToast('Usunieto Battle Hero');
    } catch (error: any) {
      setBattleHeroError(error.message || 'Nie udalo sie usunac Battle Hero');
    } finally {
      setBattleHeroLoading(false);
    }
  };

  if (!guild) return null;

  // Sort members: Leader first, then Officers, then Members
  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = { LEADER: 0, OFFICER: 1, MEMBER: 2 };
    return (roleOrder[a.role as keyof typeof roleOrder] || 2) - (roleOrder[b.role as keyof typeof roleOrder] || 2);
  });

  const handleInvite = async () => {
    if (!inviteUsername.trim()) return;

    setInviting(true);
    setInviteError(null);

    try {
      // Note: The API expects userId, but we're using username here
      // In a real implementation, we'd need to look up the user first
      await sendInvitation(guild.id, { userId: inviteUsername.trim() });
      showSuccessToast(`Zaproszenie wyslane do ${inviteUsername.trim()}`);
      setInviteUsername('');
      onRefresh();
    } catch (error: any) {
      setInviteError(error.message || 'Nie udalo sie wyslac zaproszenia');
    } finally {
      setInviting(false);
    }
  };

  // Get hero options for dropdown
  const heroOptions = unlockedHeroes.map((heroId) => {
    const hero = getHeroById(heroId);
    return {
      id: heroId,
      name: hero?.name || heroId,
    };
  });

  return (
    <div class={styles.infoSection}>
      {/* Battle Hero Section - select your hero for guild battles */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Twoj Battle Hero</span>
        <span class={styles.sectionBadge} title="Bohater do bitew Arena 5v5">
          Arena 5v5
        </span>
      </div>
      <div class={styles.battleHeroSection}>
        {myBattleHero ? (
          <div class={styles.currentBattleHero}>
            <div class={styles.battleHeroInfo}>
              <span class={styles.battleHeroName}>
                {getHeroById(myBattleHero.heroId)?.name || myBattleHero.heroId}
              </span>
              <span class={styles.battleHeroStats}>
                Tier {myBattleHero.tier} | Power: {myBattleHero.power.toLocaleString()}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearBattleHero}
              disabled={battleHeroLoading}
            >
              Zmien
            </Button>
          </div>
        ) : (
          <div class={styles.selectBattleHero}>
            <select
              class={styles.heroSelect}
              value={selectedHeroId}
              onChange={(e) => setSelectedHeroId((e.target as HTMLSelectElement).value)}
              disabled={battleHeroLoading || heroOptions.length === 0}
            >
              <option value="">-- Wybierz bohatera --</option>
              {heroOptions.map((hero) => (
                <option key={hero.id} value={hero.id}>
                  {hero.name}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSetBattleHero}
              disabled={battleHeroLoading || !selectedHeroId}
            >
              {battleHeroLoading ? 'Zapisywanie...' : 'Ustaw'}
            </Button>
          </div>
        )}
        {battleHeroError && (
          <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {battleHeroError}
          </div>
        )}
        {heroOptions.length === 0 && (
          <div style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Odblokuj bohaterow, aby moc wybrac Battle Hero.
          </div>
        )}
        <p class={styles.battleHeroHint}>
          Battle Hero to bohater, ktorego uzywasz w bitwach Arena 5v5.
          Leader wybiera 5 graczy z ustawionym Battle Hero do ataku.
        </p>
      </div>

      {/* Invite Section (for officers and leaders) */}
      {isGuildOfficer.value && (
        <>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Zapros gracza</span>
          </div>
          <div class={styles.depositForm}>
            <div class={styles.depositInput}>
              <input
                type="text"
                placeholder="Nazwa uzytkownika"
                value={inviteUsername}
                onInput={(e) => setInviteUsername((e.target as HTMLInputElement).value)}
                onKeyPress={(e) => e.key === 'Enter' && handleInvite()}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleInvite}
                disabled={inviting || !inviteUsername.trim()}
                loading={inviting}
              >
                Zapros
              </Button>
            </div>
            {inviteError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>
                {inviteError}
              </div>
            )}
          </div>
        </>
      )}

      {/* Members List */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>
          Czlonkowie ({members.length})
        </span>
      </div>
      <div class={styles.membersList}>
        {sortedMembers.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            currentMembership={currentMembership}
            guildId={guild.id}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}

interface MemberCardProps {
  member: GuildMember & { user?: { displayName: string } };
  currentMembership: GuildMember | null;
  guildId: string;
  onRefresh: () => void;
}

function MemberCard({ member, currentMembership, guildId, onRefresh }: MemberCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmKick, setConfirmKick] = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  const isCurrentUser = currentMembership?.userId === member.userId;
  const canManage =
    !isCurrentUser &&
    currentMembership &&
    (currentMembership.role === 'LEADER' ||
      (currentMembership.role === 'OFFICER' && member.role === 'MEMBER'));

  const isLeader = currentMembership?.role === 'LEADER';

  const handleKick = async () => {
    if (!confirmKick) {
      setConfirmKick(true);
      return;
    }

    setActionLoading(true);
    try {
      await kickMember(guildId, member.userId);
      showSuccessToast(`Wyrzucono ${member.user?.displayName || 'gracza'}`);
      onRefresh();
    } catch (error) {
      console.error('Failed to kick member:', error);
    } finally {
      setActionLoading(false);
      setConfirmKick(false);
    }
  };

  const handleRoleChange = async (newRole: 'OFFICER' | 'MEMBER') => {
    setActionLoading(true);
    try {
      await updateMemberRole(guildId, member.userId, { role: newRole });
      const roleLabel = newRole === 'OFFICER' ? 'Oficer' : 'Czlonek';
      showSuccessToast(`${member.user?.displayName || 'Gracz'} jest teraz ${roleLabel}`);
      onRefresh();
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferLeadership = async () => {
    if (!confirmTransfer) {
      setConfirmTransfer(true);
      return;
    }

    setActionLoading(true);
    try {
      await transferLeadership(guildId, { newLeaderId: member.userId });
      showSuccessToast(`Liderstwo przekazane do ${member.user?.displayName || 'gracza'}`);
      onRefresh();
    } catch (error) {
      console.error('Failed to transfer leadership:', error);
    } finally {
      setActionLoading(false);
      setConfirmTransfer(false);
    }
  };

  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'LEADER':
        return styles.roleLeader;
      case 'OFFICER':
        return styles.roleOfficer;
      default:
        return styles.roleMember;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'LEADER':
        return 'Lider';
      case 'OFFICER':
        return 'Oficer';
      default:
        return 'Czlonek';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'LEADER':
        return '👑';
      case 'OFFICER':
        return '⚔️';
      default:
        return '🛡️';
    }
  };

  const getCardClass = (role: string) => {
    switch (role) {
      case 'LEADER':
        return `${styles.memberCard} ${styles.memberCardLeader}`;
      case 'OFFICER':
        return `${styles.memberCard} ${styles.memberCardOfficer}`;
      default:
        return styles.memberCard;
    }
  };

  const handleViewHub = () => {
    if (!isCurrentUser) {
      openHubPreview(member.userId);
    }
  };

  return (
    <div class={getCardClass(member.role)}>
      <div
        class={styles.memberInfo}
        onClick={handleViewHub}
        style={{ cursor: isCurrentUser ? 'default' : 'pointer' }}
        role={isCurrentUser ? undefined : 'button'}
        tabIndex={isCurrentUser ? undefined : 0}
        onKeyDown={isCurrentUser ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') handleViewHub(); }}
      >
        <div class={styles.memberAvatar}>{getRoleIcon(member.role)}</div>
        <div class={styles.memberDetails}>
          <span class={styles.memberName}>
            {member.user?.displayName || 'Unknown'}
            {isCurrentUser && ' (Ty)'}
            <OnlineStatusIndicator isOnline={member.isOnline} />
          </span>
          <span class={`${styles.memberRole} ${getRoleStyle(member.role)}`}>
            {getRoleLabel(member.role)}
          </span>
        </div>
      </div>
      <div class={styles.memberStats}>
        <span title="Bitwy wygrane/rozegrane">
          {member.battlesWon}/{member.battlesParticipated}
        </span>
        <span title="Gold donated">
          {member.totalGoldDonated.toLocaleString()}g
        </span>
      </div>
      {canManage && (
        <div class={styles.memberActions}>
          {showActions ? (
            <>
              {isLeader && member.role !== 'OFFICER' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRoleChange('OFFICER')}
                  disabled={actionLoading}
                >
                  Awansuj
                </Button>
              )}
              {isLeader && member.role === 'OFFICER' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRoleChange('MEMBER')}
                  disabled={actionLoading}
                >
                  Degraduj
                </Button>
              )}
              {isLeader && (
                <Button
                  variant={confirmTransfer ? 'danger' : 'secondary'}
                  size="sm"
                  onClick={handleTransferLeadership}
                  disabled={actionLoading}
                >
                  {confirmTransfer ? 'Potwierdz' : 'Przekaz liderstwo'}
                </Button>
              )}
              <Button
                variant={confirmKick ? 'danger' : 'secondary'}
                size="sm"
                onClick={handleKick}
                disabled={actionLoading}
              >
                {confirmKick ? 'Potwierdz' : 'Wyrzuc'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowActions(false);
                  setConfirmKick(false);
                  setConfirmTransfer(false);
                }}
              >
                Anuluj
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActions(true)}
            >
              ...
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
