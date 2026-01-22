/**
 * Guild Info Tab - Shows guild details, structures, and bonuses
 */
import { useState, useEffect } from 'preact/hooks';
import type { GuildAccessMode, GuildStructureType } from '@arcade/protocol';
import {
  playerGuild,
  guildBonuses,
  guildStructures,
  structuresLoading,
  isGuildLeader,
  isGuildOfficer,
} from '../../state/guild.signals.js';
import {
  updateGuild,
  updateGuildDescription,
  updateGuildNotes,
  getGuildNotes,
  updateGuildEmblem,
  leaveGuild,
  disbandGuild,
  getStructures,
  upgradeStructure,
} from '../../api/guild.js';
import { resizeImageToBase64 } from '../../utils/image.js';
import { Button } from '../shared/Button.js';
import styles from './GuildPanel.module.css';

const ACCESS_MODES: { value: GuildAccessMode; label: string; description: string }[] = [
  { value: 'OPEN', label: 'Otwarta', description: 'Kazdy moze dolaczyc' },
  { value: 'APPLY', label: 'Podania', description: 'Gracze wysylaja podania' },
  { value: 'INVITE_ONLY', label: 'Tylko zaproszenia', description: 'Tylko przez zaproszenia' },
  { value: 'CLOSED', label: 'Zamknieta', description: 'Nie przyjmuje nowych czlonkow' },
];

interface GuildInfoTabProps {
  onRefresh: () => void;
}

// Structure display info
const STRUCTURE_INFO: Record<GuildStructureType, { name: string; icon: string; bonusLabel: string }> = {
  kwatera: { name: 'Kwatera', icon: '🏠', bonusLabel: 'Pojemność' },
  skarbiec: { name: 'Skarbiec', icon: '💰', bonusLabel: 'Gold Boost' },
  akademia: { name: 'Akademia', icon: '📚', bonusLabel: 'XP Boost' },
  zbrojownia: { name: 'Zbrojownia', icon: '⚔️', bonusLabel: 'Stat Boost' },
};

export function GuildInfoTab({ onRefresh }: GuildInfoTabProps) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [editingEmblem, setEditingEmblem] = useState(false);
  const [emblemUrl, setEmblemUrl] = useState('');
  const [uploadingEmblem, setUploadingEmblem] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [disbanding, setDisbanding] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [upgradingStructure, setUpgradingStructure] = useState<GuildStructureType | null>(null);

  // Settings state
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsTag, setSettingsTag] = useState('');
  const [settingsAccessMode, setSettingsAccessMode] = useState<GuildAccessMode>('INVITE_ONLY');
  const [settingsMinLevel, setSettingsMinLevel] = useState(1);
  const [settingsAutoAccept, setSettingsAutoAccept] = useState(false);
  const [settingsBattleCooldown, setSettingsBattleCooldown] = useState(24);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const guild = playerGuild.value;
  const bonuses = guildBonuses.value;
  const structures = guildStructures.value;

  // Load structures and notes when component mounts
  useEffect(() => {
    if (guild) {
      loadStructures();
      loadNotes();
    }
  }, [guild?.id]);

  const loadNotes = async () => {
    if (!guild) return;
    try {
      const data = await getGuildNotes(guild.id);
      setNotes(data.notes || '');
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const loadStructures = async () => {
    if (!guild) return;
    structuresLoading.value = true;
    try {
      const data = await getStructures(guild.id);
      guildStructures.value = data.structures;
    } catch (error) {
      console.error('Failed to load structures:', error);
    } finally {
      structuresLoading.value = false;
    }
  };

  const handleUpgradeStructure = async (structureType: GuildStructureType) => {
    if (!guild) return;
    setUpgradingStructure(structureType);
    try {
      await upgradeStructure(guild.id, structureType);
      await loadStructures();
      onRefresh(); // Refresh treasury
    } catch (error) {
      console.error('Failed to upgrade structure:', error);
    } finally {
      setUpgradingStructure(null);
    }
  };

  if (!guild) return null;

  const handleEditDescription = async () => {
    if (!editing) {
      setDescription(guild.description || '');
      setEditing(true);
      return;
    }

    setActionLoading(true);
    try {
      await updateGuildDescription(guild.id, description || null);
      setEditing(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to update description:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditNotes = async () => {
    if (!editingNotes) {
      setNotes(guild.internalNotes || '');
      setEditingNotes(true);
      return;
    }

    setActionLoading(true);
    try {
      await updateGuildNotes(guild.id, notes || null);
      setEditingNotes(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to update notes:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmblemFileChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      setUploadingEmblem(true);
      // Resize and convert to base64
      const base64 = await resizeImageToBase64(file, 256, 256, 0.9);
      setEmblemUrl(base64);
    } catch (error: any) {
      console.error('Failed to process image:', error);
      alert(error.message || 'Nie udało się przetworzyć obrazu');
    } finally {
      setUploadingEmblem(false);
    }
  };

  const handleSaveEmblem = async () => {
    if (!guild) return;

    setActionLoading(true);
    try {
      await updateGuildEmblem(guild.id, emblemUrl || null);
      setEditingEmblem(false);
      setEmblemUrl('');
      onRefresh();
    } catch (error) {
      console.error('Failed to update emblem:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelEmblem = () => {
    setEditingEmblem(false);
    setEmblemUrl(guild.emblemUrl || '');
  };

  const handleLeaveGuild = async () => {
    if (!leaving) {
      setLeaving(true);
      return;
    }

    setActionLoading(true);
    try {
      await leaveGuild(guild.id);
      onRefresh();
    } catch (error) {
      console.error('Failed to leave guild:', error);
    } finally {
      setActionLoading(false);
      setLeaving(false);
    }
  };

  const handleDisbandGuild = async () => {
    if (!disbanding) {
      setDisbanding(true);
      return;
    }

    setActionLoading(true);
    try {
      await disbandGuild(guild.id);
      onRefresh();
    } catch (error) {
      console.error('Failed to disband guild:', error);
    } finally {
      setActionLoading(false);
      setDisbanding(false);
    }
  };

  const handleEditSettings = () => {
    setSettingsName(guild?.name || '');
    setSettingsTag(guild?.tag || '');
    setSettingsAccessMode((guild as any).accessMode || 'INVITE_ONLY');
    setSettingsMinLevel((guild as any).minLevel || 1);
    setSettingsAutoAccept((guild as any).autoAcceptInvites || false);
    setSettingsBattleCooldown((guild as any).battleCooldownHours || 24);
    setSettingsError(null);
    setEditingSettings(true);
  };

  const handleSaveSettings = async () => {
    if (!guild) return;
    setSettingsLoading(true);
    setSettingsError(null);

    try {
      await updateGuild(guild.id, {
        name: settingsName !== guild.name ? settingsName : undefined,
        tag: settingsTag !== guild.tag ? settingsTag : undefined,
        settings: {
          accessMode: settingsAccessMode,
          minLevel: settingsMinLevel,
          autoAcceptInvites: settingsAutoAccept,
          battleCooldownHours: settingsBattleCooldown,
        },
      });
      setEditingSettings(false);
      onRefresh();
    } catch (err: any) {
      setSettingsError(err.message || 'Nie udalo sie zapisac ustawien');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleCancelSettings = () => {
    setEditingSettings(false);
    setSettingsError(null);
  };

  // Get current access mode info
  const currentAccessMode = ACCESS_MODES.find(m => m.value === ((guild as any).accessMode || 'INVITE_ONLY'));

  return (
    <div class={styles.infoSection}>
      {/* Guild Emblem */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Herb drużyny</span>
        {isGuildOfficer.value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!editingEmblem) {
                setEmblemUrl(guild.emblemUrl || '');
                setEditingEmblem(true);
              } else {
                handleSaveEmblem();
              }
            }}
            disabled={actionLoading || uploadingEmblem}
          >
            {editingEmblem ? 'Zapisz' : 'Edytuj'}
          </Button>
        )}
      </div>
      {editingEmblem ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {emblemUrl && (
            <img
              src={emblemUrl}
              alt="Guild emblem preview"
              style={{ maxWidth: '128px', maxHeight: '128px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleEmblemFileChange}
            disabled={uploadingEmblem}
            style={{ marginBottom: '0.5rem' }}
          />
          <input
            type="text"
            placeholder="Lub wklej URL obrazu"
            value={emblemUrl}
            onInput={(e) => setEmblemUrl((e.target as HTMLInputElement).value)}
            maxLength={500}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEmblem}
              disabled={actionLoading}
            >
              Anuluj
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {guild.emblemUrl ? (
            <img
              src={guild.emblemUrl}
              alt="Guild emblem"
              style={{ width: '64px', height: '64px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            />
          ) : (
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '24px'
            }}>
              🛡️
            </div>
          )}
          <span style={{ color: 'var(--color-text-muted)' }}>
            {guild.emblemUrl ? 'Herb ustawiony' : 'Brak herbu'}
          </span>
        </div>
      )}

      {/* Description */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Opis (publiczny)</span>
        {isGuildOfficer.value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditDescription}
            disabled={actionLoading}
          >
            {editing ? 'Zapisz' : 'Edytuj'}
          </Button>
        )}
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <textarea
            class={styles.guildDescription}
            value={description}
            onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            rows={4}
            maxLength={1000}
            style={{ resize: 'vertical', width: '100%' }}
            placeholder="Opis widoczny dla wszystkich (w rankingach, wyszukiwaniu)"
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDescription(guild.description || '');
              }}
            >
              Anuluj
            </Button>
          </div>
        </div>
      ) : (
        <div class={styles.guildDescription}>
          {guild.description || 'Brak opisu'}
        </div>
      )}

      {/* Internal Notes - Only for members */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Notatki gildii (tylko dla członków)</span>
        {isGuildOfficer.value && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditNotes}
            disabled={actionLoading}
          >
            {editingNotes ? 'Zapisz' : 'Edytuj'}
          </Button>
        )}
      </div>
      {editingNotes ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <textarea
            class={styles.guildDescription}
            value={notes}
            onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
            rows={6}
            maxLength={5000}
            style={{ resize: 'vertical', width: '100%' }}
            placeholder="Prywatne notatki widoczne tylko dla członków gildii"
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingNotes(false);
                setNotes(guild.internalNotes || '');
              }}
            >
              Anuluj
            </Button>
          </div>
        </div>
      ) : (
        <div class={styles.guildDescription} style={{ whiteSpace: 'pre-wrap' }}>
          {guild.internalNotes || 'Brak notatek'}
        </div>
      )}

      {/* Structures */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Struktury</span>
      </div>
      {structuresLoading.value ? (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)' }}>
          Ładowanie struktur...
        </div>
      ) : structures && structures.length > 0 ? (
        <div class={styles.structuresGrid}>
          {structures.map((structure) => {
            const info = STRUCTURE_INFO[structure.type as GuildStructureType];
            const isMaxLevel = structure.level >= structure.maxLevel;
            const isUpgrading = upgradingStructure === structure.type;
            const canUpgrade = isGuildLeader.value && structure.canAfford && !isMaxLevel;

            return (
              <div key={structure.type} class={styles.structureCard}>
                <div class={styles.structureHeader}>
                  <span class={styles.structureIcon}>{info.icon}</span>
                  <span class={styles.structureName}>{info.name}</span>
                  <span class={styles.structureLevel}>Lv.{structure.level}/{structure.maxLevel}</span>
                </div>
                <div class={styles.structureBonus}>
                  <span class={styles.structureBonusLabel}>{info.bonusLabel}:</span>
                  <span class={styles.structureBonusValue}>
                    {structure.type === 'kwatera'
                      ? `${structure.currentBonus} miejsc`
                      : `+${Math.round(structure.currentBonus * 100)}%`
                    }
                  </span>
                </div>
                {!isMaxLevel && structure.upgradeCost && (
                  <div class={styles.structureCost}>
                    <span>Koszt: </span>
                    <span class={styles.goldCost}>{structure.upgradeCost.gold.toLocaleString()} 🪙</span>
                    <span class={styles.dustCost}>{structure.upgradeCost.dust.toLocaleString()} 🌫️</span>
                  </div>
                )}
                {isGuildLeader.value && (
                  <Button
                    variant={canUpgrade ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => handleUpgradeStructure(structure.type as GuildStructureType)}
                    disabled={!canUpgrade || isUpgrading}
                    style={{ marginTop: '0.5rem', width: '100%' }}
                  >
                    {isUpgrading ? 'Ulepszanie...' : isMaxLevel ? 'MAX' : canUpgrade ? 'Ulepsz' : 'Brak środków'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)' }}>
          Nie można załadować struktur
        </div>
      )}

      {/* Bonuses */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Bonusy gildii</span>
      </div>
      <div class={styles.bonusesGrid}>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>Gold Boost</span>
          <span class={styles.bonusValue}>+{Math.round((bonuses?.goldBoost || 0) * 100)}%</span>
        </div>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>Stat Boost</span>
          <span class={styles.bonusValue}>+{Math.round((bonuses?.statBoost || 0) * 100)}%</span>
        </div>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>XP Boost</span>
          <span class={styles.bonusValue}>+{Math.round((bonuses?.xpBoost || 0) * 100)}%</span>
        </div>
      </div>

      {/* Guild Stats */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Statystyki</span>
      </div>
      <div class={styles.bonusesGrid}>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>Honor</span>
          <span class={styles.bonusValue} style={{ color: 'var(--color-gold)' }}>
            {guild.honor.toLocaleString()}
          </span>
        </div>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>Członkowie</span>
          <span class={styles.bonusValue} style={{ color: 'var(--color-text)' }}>
            {guild.members?.length || 0}/{guild.maxMembers || 10}
          </span>
        </div>
        <div class={styles.bonusCard}>
          <span class={styles.bonusLabel}>Trofea</span>
          <span class={styles.bonusValue} style={{ color: 'var(--color-primary)' }}>
            {guild.trophies?.length || 0}
          </span>
        </div>
      </div>

      {/* Settings - Leader only */}
      {isGuildLeader.value && (
        <>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Ustawienia</span>
            {!editingSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditSettings}
              >
                Edytuj
              </Button>
            )}
          </div>

          {editingSettings ? (
            <div class={styles.settingsForm}>
              {/* Guild Name */}
              <div class={styles.settingsRow}>
                <label class={styles.settingsLabel}>Nazwa gildii</label>
                <input
                  type="text"
                  class={styles.settingsInput}
                  value={settingsName}
                  onInput={(e) => setSettingsName((e.target as HTMLInputElement).value)}
                  minLength={3}
                  maxLength={24}
                  style={{ maxWidth: '100%' }}
                />
                <span class={styles.settingsHint}>3-24 znakow</span>
              </div>

              {/* Guild Tag */}
              <div class={styles.settingsRow}>
                <label class={styles.settingsLabel}>Tag gildii</label>
                <input
                  type="text"
                  class={styles.settingsInput}
                  value={settingsTag}
                  onInput={(e) => setSettingsTag((e.target as HTMLInputElement).value.toUpperCase())}
                  minLength={3}
                  maxLength={5}
                  pattern="[A-Z0-9]+"
                  style={{ maxWidth: '120px' }}
                />
                <span class={styles.settingsHint}>3-5 wielkich liter lub cyfr</span>
              </div>

              {/* Access Mode */}
              <div class={styles.settingsRow}>
                <label class={styles.settingsLabel}>Tryb dostepu</label>
                <select
                  class={styles.settingsSelect}
                  value={settingsAccessMode}
                  onChange={(e) => setSettingsAccessMode((e.target as HTMLSelectElement).value as GuildAccessMode)}
                >
                  {ACCESS_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label} - {mode.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Min Level */}
              <div class={styles.settingsRow}>
                <label class={styles.settingsLabel}>Min. poziom (fala)</label>
                <input
                  type="number"
                  class={styles.settingsInput}
                  value={settingsMinLevel}
                  onChange={(e) => setSettingsMinLevel(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1))}
                  min={1}
                  max={1000}
                />
                <span class={styles.settingsHint}>
                  Gracz musi miec conajmniej tyle fal aby dolaczyc (nie dotyczy zaproszen)
                </span>
              </div>

              {/* Auto-accept invites */}
              <div class={styles.settingsRow}>
                <label class={styles.settingsLabel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={settingsAutoAccept}
                    onChange={(e) => setSettingsAutoAccept((e.target as HTMLInputElement).checked)}
                  />
                  Automatycznie akceptuj zaproszenia
                </label>
                <span class={styles.settingsHint}>
                  Zaproszeni gracze automatycznie dolaczaja do gildii
                </span>
              </div>

              {/* Battle Cooldown */}
              <div class={styles.settingsRow}>
                <label class={styles.settingsLabel}>Przerwa miedzy bitwami (godziny)</label>
                <input
                  type="number"
                  class={styles.settingsInput}
                  value={settingsBattleCooldown}
                  onChange={(e) => setSettingsBattleCooldown(
                    Math.min(168, Math.max(1, parseInt((e.target as HTMLInputElement).value) || 24))
                  )}
                  min={1}
                  max={168}
                  style={{ maxWidth: '100px' }}
                />
                <span class={styles.settingsHint}>1-168 godzin (domyslnie 24)</span>
              </div>

              {settingsError && (
                <div class={styles.settingsError}>{settingsError}</div>
              )}

              <div class={styles.settingsActions}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSettings}
                  disabled={settingsLoading}
                >
                  {settingsLoading ? 'Zapisywanie...' : 'Zapisz'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelSettings}
                  disabled={settingsLoading}
                >
                  Anuluj
                </Button>
              </div>
            </div>
          ) : (
            <div class={styles.settingsDisplay}>
              <div class={styles.settingsDisplayItem}>
                <span class={styles.settingsDisplayLabel}>Tryb dostepu:</span>
                <span class={styles.settingsDisplayValue}>
                  {currentAccessMode?.label || 'Tylko zaproszenia'}
                </span>
              </div>
              <div class={styles.settingsDisplayItem}>
                <span class={styles.settingsDisplayLabel}>Min. poziom:</span>
                <span class={styles.settingsDisplayValue}>
                  Fala {(guild as any).minLevel || 1}
                </span>
              </div>
              <div class={styles.settingsDisplayItem}>
                <span class={styles.settingsDisplayLabel}>Auto-akceptacja:</span>
                <span class={styles.settingsDisplayValue}>
                  {(guild as any).autoAcceptInvites ? 'Wlaczona' : 'Wylaczona'}
                </span>
              </div>
              <div class={styles.settingsDisplayItem}>
                <span class={styles.settingsDisplayLabel}>Przerwa miedzy bitwami:</span>
                <span class={styles.settingsDisplayValue}>
                  {(guild as any).battleCooldownHours || 24} godz.
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Akcje</span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {!isGuildLeader.value && (
          <Button
            variant={leaving ? 'danger' : 'secondary'}
            size="sm"
            onClick={handleLeaveGuild}
            disabled={actionLoading}
          >
            {leaving ? 'Potwierdz opuszczenie' : 'Opusc gildie'}
          </Button>
        )}
        {leaving && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLeaving(false)}
          >
            Anuluj
          </Button>
        )}
        {isGuildLeader.value && (
          <>
            <Button
              variant={disbanding ? 'danger' : 'secondary'}
              size="sm"
              onClick={handleDisbandGuild}
              disabled={actionLoading}
            >
              {disbanding ? 'Potwierdz rozwiazanie' : 'Rozwiaz gildie'}
            </Button>
            {disbanding && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDisbanding(false)}
              >
                Anuluj
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
