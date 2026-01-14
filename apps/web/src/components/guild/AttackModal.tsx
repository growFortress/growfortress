/**
 * Attack Modal - 3-step flow for initiating guild attacks (Arena 5v5)
 *
 * Step 1: Select target guild
 * Step 2: Select 5 members for the attack
 * Step 3: Confirm and execute attack
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { BattleRosterMember } from '@arcade/protocol';
import {
  searchGuilds,
  getBattleRoster,
  instantAttack,
  getShieldStatus,
  type InstantAttackResponse,
} from '../../api/guild.js';
import { Button } from '../shared/Button.js';
import { Spinner } from '../shared/Spinner.js';
import styles from './GuildPanel.module.css';

interface AttackModalProps {
  guildId: string;
  onClose: () => void;
  onAttackComplete: (result: InstantAttackResponse) => void;
}

type Step = 'target' | 'members' | 'confirm';

interface TargetGuild {
  id: string;
  name: string;
  tag: string;
  honor: number;
  hasShield?: boolean;
}

export function AttackModal({ guildId, onClose, onAttackComplete }: AttackModalProps) {
  const [step, setStep] = useState<Step>('target');
  const [targetGuild, setTargetGuild] = useState<TargetGuild | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TargetGuild[]>([]);
  const [roster, setRoster] = useState<BattleRosterMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [attacking, setAttacking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load battle roster when modal opens
  useEffect(() => {
    loadRoster();
  }, [guildId]);

  const loadRoster = async () => {
    try {
      const data = await getBattleRoster(guildId);
      // Filter only members with battle hero
      setRoster(data.roster.filter(m => m.battleHero));
    } catch (err: any) {
      console.error('Failed to load roster:', err);
    }
  };

  // Search for target guilds
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const result = await searchGuilds({ search: query, limit: 10, offset: 0 });
      // Filter out own guild and map to TargetGuild format
      const targets: TargetGuild[] = [];

      for (const guild of result.guilds) {
        if (guild.id === guildId) continue; // Skip own guild

        // Check shield status for each guild
        try {
          const shieldData = await getShieldStatus(guild.id);
          targets.push({
            id: guild.id,
            name: guild.name,
            tag: guild.tag,
            honor: guild.honor,
            hasShield: shieldData.isActive,
          });
        } catch {
          // If we can't get shield status, assume no shield
          targets.push({
            id: guild.id,
            name: guild.name,
            tag: guild.tag,
            honor: guild.honor,
            hasShield: false,
          });
        }
      }

      setSearchResults(targets);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.message || 'Blad wyszukiwania');
    } finally {
      setSearching(false);
    }
  }, [guildId]);

  // Handle target selection
  const handleSelectTarget = (target: TargetGuild) => {
    if (target.hasShield) return; // Can't attack shielded guilds
    setTargetGuild(target);
    setError(null);
  };

  // Handle member toggle
  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      if (prev.length >= 5) {
        return prev; // Max 5 members
      }
      return [...prev, userId];
    });
  };

  // Execute attack
  const handleAttack = async () => {
    if (!targetGuild || selectedMemberIds.length !== 5) return;

    setAttacking(true);
    setError(null);

    try {
      const result = await instantAttack(guildId, {
        defenderGuildId: targetGuild.id,
        selectedMemberIds,
      });
      onAttackComplete(result);
      onClose();
    } catch (err: any) {
      console.error('Attack failed:', err);
      setError(err.message || 'Atak nie powiodl sie');
      setAttacking(false);
    }
  };

  // Calculate team power
  const teamPower = selectedMemberIds.reduce((sum, memberId) => {
    const member = roster.find(m => m.userId === memberId);
    return sum + (member?.battleHero?.power || 0);
  }, 0);

  // Get selected members for confirmation
  const selectedMembers = selectedMemberIds
    .map(userId => roster.find(m => m.userId === userId))
    .filter((m): m is BattleRosterMember => m !== undefined);

  // Step navigation
  const canProceedFromTarget = targetGuild !== null;
  const canProceedFromMembers = selectedMemberIds.length === 5;

  const handleNext = () => {
    if (step === 'target' && canProceedFromTarget) {
      setStep('members');
    } else if (step === 'members' && canProceedFromMembers) {
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'members') {
      setStep('target');
    } else if (step === 'confirm') {
      setStep('members');
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'target':
        return 'Wybierz cel ataku';
      case 'members':
        return 'Wybierz 5 czlonkow';
      case 'confirm':
        return 'Potwierdz atak';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'target':
        return 'Wyszukaj gildie do zaatakowania';
      case 'members':
        return `Cel: ${targetGuild?.name} [${targetGuild?.tag}]`;
      case 'confirm':
        return 'Sprawdz szczegoly przed atakiem';
    }
  };

  return (
    <div
      class={styles.attackModalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !attacking) onClose();
      }}
    >
      <div class={styles.attackModal}>
        {/* Header */}
        <div class={styles.attackModalHeader}>
          <div>
            <h3 class={styles.attackModalTitle}>{getStepTitle()}</h3>
            <p class={styles.attackModalSubtitle}>{getStepSubtitle()}</p>
          </div>
          <button
            class={styles.attackModalClose}
            onClick={onClose}
            disabled={attacking}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div class={styles.attackModalContent}>
          {error && <div class={styles.attackModalError}>{error}</div>}

          {/* Step 1: Target Selection */}
          {step === 'target' && (
            <>
              <div class={styles.targetSearch}>
                <input
                  type="text"
                  class={styles.targetSearchInput}
                  placeholder="Szukaj gildii..."
                  value={searchQuery}
                  onInput={(e) => handleSearch((e.target as HTMLInputElement).value)}
                />
              </div>

              {searching ? (
                <div class={styles.attackModalLoading}>
                  <Spinner />
                </div>
              ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
                <div class={styles.targetEmpty}>
                  Nie znaleziono gildii
                </div>
              ) : (
                <div class={styles.targetList}>
                  {searchResults.map(guild => (
                    <div
                      key={guild.id}
                      class={`${styles.targetCard} ${
                        targetGuild?.id === guild.id ? styles.targetCardSelected : ''
                      } ${guild.hasShield ? styles.targetCardShielded : ''}`}
                      onClick={() => handleSelectTarget(guild)}
                    >
                      <div class={styles.targetCardInfo}>
                        <span class={styles.targetCardName}>{guild.name}</span>
                        <span class={styles.targetCardTag}>[{guild.tag}]</span>
                      </div>
                      <div>
                        {guild.hasShield ? (
                          <span class={styles.targetCardShieldBadge}>Tarcza aktywna</span>
                        ) : (
                          <span class={styles.targetCardHonor}>{guild.honor} Honor</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step 2: Member Selection */}
          {step === 'members' && (
            <>
              <div class={styles.memberSelectHeader}>
                <span class={styles.memberSelectCount}>
                  Wybrano: <span class={styles.memberSelectCountValue}>{selectedMemberIds.length}/5</span>
                </span>
              </div>

              {roster.length === 0 ? (
                <div class={styles.targetEmpty}>
                  Brak czlonkow z ustawionym Battle Hero
                </div>
              ) : (
                <div class={styles.memberSelectList}>
                  {roster.map(member => {
                    const isSelected = selectedMemberIds.includes(member.userId);
                    const isDisabled = !isSelected && selectedMemberIds.length >= 5;

                    return (
                      <div
                        key={member.userId}
                        class={`${styles.memberSelectRow} ${
                          isSelected ? styles.memberSelectRowSelected : ''
                        } ${isDisabled ? styles.memberSelectRowDisabled : ''}`}
                        onClick={() => !isDisabled && handleToggleMember(member.userId)}
                      >
                        <input
                          type="checkbox"
                          class={styles.memberSelectCheckbox}
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => {}}
                        />
                        <div class={styles.memberSelectInfo}>
                          <span class={styles.memberSelectName}>{member.displayName}</span>
                          {member.battleHero && (
                            <span class={styles.memberSelectHero}>
                              {member.battleHero.heroId} T{member.battleHero.tier}
                            </span>
                          )}
                        </div>
                        <span class={styles.memberSelectPower}>
                          {member.battleHero?.power.toLocaleString() || 0}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div class={styles.selectionSummary}>
                <span class={styles.selectionSummaryLabel}>Laczna moc druzyny:</span>
                <span class={styles.teamPower}>{teamPower.toLocaleString()}</span>
              </div>
            </>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirm' && targetGuild && (
            <div class={styles.confirmSection}>
              <div class={styles.confirmTarget}>
                <div class={styles.confirmTargetLabel}>Atakujesz:</div>
                <div class={styles.confirmTargetName}>
                  {targetGuild.name} [{targetGuild.tag}]
                </div>
                <div class={styles.confirmTargetHonor}>
                  Honor przeciwnika: {targetGuild.honor}
                </div>
              </div>

              <div class={styles.confirmTeam}>
                <div class={styles.confirmTeamTitle}>Twoja druzyna (5):</div>
                <div class={styles.confirmTeamList}>
                  {selectedMembers.map(member => (
                    <div key={member.userId} class={styles.confirmTeamMember}>
                      <span class={styles.confirmTeamMemberName}>{member.displayName}</span>
                      <span class={styles.confirmTeamMemberHero}>
                        {member.battleHero?.heroId} T{member.battleHero?.tier}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div class={styles.honorWarning}>
                <div class={styles.honorWarningTitle}>Stawka Honor:</div>
                <div class={styles.honorWarningRow}>
                  <span>Wygrana:</span>
                  <span class={styles.honorWin}>+30 Honor</span>
                </div>
                <div class={styles.honorWarningRow}>
                  <span>Przegrana:</span>
                  <span class={styles.honorLose}>-20 Honor</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div class={styles.attackModalFooter}>
          {step !== 'target' && (
            <Button variant="ghost" onClick={handleBack} disabled={attacking}>
              Wstecz
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={attacking}>
            Anuluj
          </Button>
          {step === 'confirm' ? (
            <Button
              variant="primary"
              onClick={handleAttack}
              disabled={attacking}
            >
              {attacking ? 'Atakuje...' : 'Atakuj!'}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={
                (step === 'target' && !canProceedFromTarget) ||
                (step === 'members' && !canProceedFromMembers)
              }
            >
              Dalej
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
