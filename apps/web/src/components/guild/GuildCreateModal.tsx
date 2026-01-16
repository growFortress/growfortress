/**
 * Guild Create Modal - Form for creating a new guild
 */
import { useState } from 'preact/hooks';
import type { GuildAccessMode } from '@arcade/protocol';
import { useTranslation } from '../../i18n/useTranslation.js';
import { showGuildCreate, closeGuildCreate, openGuildPanel, setGuildData, closeGuildSearch } from '../../state/guild.signals.js';
import { createGuild, getMyGuild } from '../../api/guild.js';
import { Button } from '../shared/Button.js';
import { Modal } from '../shared/Modal.js';
import styles from './GuildCreateModal.module.css';

const ACCESS_MODES: { value: GuildAccessMode; label: string; description: string }[] = [
  { value: 'INVITE_ONLY', label: 'Tylko zaproszenia', description: 'Domyslne - nowi gracze musza zostac zaproszeni' },
  { value: 'OPEN', label: 'Otwarta', description: 'Kazdy moze dolaczyc bez zaproszenia' },
  { value: 'APPLY', label: 'Podania', description: 'Gracze wysylaja podania do rozpatrzenia' },
  { value: 'CLOSED', label: 'Zamknieta', description: 'Nie przyjmuje nowych czlonkow' },
];

interface GuildCreateModalProps {
  onSuccess?: () => void;
}

export function GuildCreateModal({ onSuccess }: GuildCreateModalProps) {
  const { t } = useTranslation('common');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [accessMode, setAccessMode] = useState<GuildAccessMode>('INVITE_ONLY');
  const [minLevel, setMinLevel] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!showGuildCreate.value) {
    return null;
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = t('guild.validation.nameRequired');
    } else if (name.length < 3) {
      errors.name = t('guild.validation.nameMinLength');
    } else if (name.length > 30) {
      errors.name = t('guild.validation.nameMaxLength');
    }

    if (!tag.trim()) {
      errors.tag = t('guild.validation.tagRequired');
    } else if (!/^[A-Z0-9]{2,5}$/.test(tag)) {
      errors.tag = t('guild.validation.tagFormat');
    }

    if (description.length > 500) {
      errors.description = t('guild.validation.descMaxLength');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createGuild({
        name: name.trim(),
        tag: tag.trim().toUpperCase(),
        description: description.trim() || undefined,
        settings: {
          accessMode,
          minLevel,
        },
      });

      // Fetch the newly created guild data
      const myGuildData = await getMyGuild();
      setGuildData({
        guild: myGuildData.guild,
        membership: myGuildData.membership,
        bonuses: myGuildData.bonuses,
      });

      // Reset form
      setName('');
      setTag('');
      setDescription('');
      setAccessMode('INVITE_ONLY');
      setMinLevel(1);

      // Close modals and open guild panel
      closeGuildCreate();
      closeGuildSearch();
      openGuildPanel('info');

      // Callback to refresh guild data
      onSuccess?.();
    } catch (err: any) {
      if (err.code === 'GUILD_NAME_TAKEN') {
        setFieldErrors({ name: t('guild.validation.nameTaken') });
      } else if (err.code === 'GUILD_TAG_TAKEN') {
        setFieldErrors({ tag: t('guild.validation.tagTaken') });
      } else {
        setError(err.message || t('guild.createError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTagInput = (value: string) => {
    // Auto uppercase and filter invalid chars
    setTag(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5));
  };

  return (
    <Modal
      isOpen={showGuildCreate.value}
      onClose={closeGuildCreate}
      title={t('guild.createTitle')}
    >
      <form onSubmit={handleSubmit} class={styles.form}>
        {/* Name field */}
        <div class={styles.field}>
          <label class={styles.label} htmlFor="guild-name">
            {t('guild.guildName')}
          </label>
          <input
            id="guild-name"
            type="text"
            class={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder={t('guild.guildNamePlaceholder')}
            maxLength={30}
            disabled={loading}
          />
          {fieldErrors.name && (
            <span class={styles.fieldError}>{fieldErrors.name}</span>
          )}
          <span class={styles.fieldHint}>{name.length}/30 {t('guild.characters')}</span>
        </div>

        {/* Tag field */}
        <div class={styles.field}>
          <label class={styles.label} htmlFor="guild-tag">
            {t('guild.guildTag')}
          </label>
          <input
            id="guild-tag"
            type="text"
            class={`${styles.input} ${styles.inputTag} ${fieldErrors.tag ? styles.inputError : ''}`}
            value={tag}
            onInput={(e) => handleTagInput((e.target as HTMLInputElement).value)}
            placeholder={t('guild.guildTagPlaceholder')}
            maxLength={5}
            disabled={loading}
          />
          {fieldErrors.tag && (
            <span class={styles.fieldError}>{fieldErrors.tag}</span>
          )}
          <span class={styles.fieldHint}>{t('guild.tagHint')}</span>
        </div>

        {/* Description field */}
        <div class={styles.field}>
          <label class={styles.label} htmlFor="guild-description">
            {t('guild.descriptionOptional')}
          </label>
          <textarea
            id="guild-description"
            class={`${styles.input} ${styles.textarea} ${fieldErrors.description ? styles.inputError : ''}`}
            value={description}
            onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            placeholder={t('guild.descriptionPlaceholder')}
            maxLength={500}
            rows={3}
            disabled={loading}
          />
          {fieldErrors.description && (
            <span class={styles.fieldError}>{fieldErrors.description}</span>
          )}
          <span class={styles.fieldHint}>{description.length}/500 {t('guild.characters')}</span>
        </div>

        {/* Access Mode field */}
        <div class={styles.field}>
          <label class={styles.label} htmlFor="guild-access-mode">
            Tryb dostepu
          </label>
          <select
            id="guild-access-mode"
            class={styles.select}
            value={accessMode}
            onChange={(e) => setAccessMode((e.target as HTMLSelectElement).value as GuildAccessMode)}
            disabled={loading}
          >
            {ACCESS_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
          <span class={styles.fieldHint}>
            {ACCESS_MODES.find(m => m.value === accessMode)?.description}
          </span>
        </div>

        {/* Min Level field - only show for OPEN and APPLY modes */}
        {(accessMode === 'OPEN' || accessMode === 'APPLY') && (
          <div class={styles.field}>
            <label class={styles.label} htmlFor="guild-min-level">
              Minimalny poziom (fala)
            </label>
            <input
              id="guild-min-level"
              type="number"
              class={`${styles.input} ${styles.inputSmall}`}
              value={minLevel}
              onInput={(e) => setMinLevel(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1))}
              min={1}
              max={1000}
              disabled={loading}
            />
            <span class={styles.fieldHint}>
              Gracz musi miec conajmniej tyle fal aby dolaczyc (zaproszenia omijaja to wymaganie)
            </span>
          </div>
        )}

        {/* Cost info */}
        <div class={styles.costInfo}>
          <span class={styles.costIcon}>💰</span>
          <span>{t('guild.createFree')}</span>
        </div>

        {/* Error message */}
        {error && (
          <div class={styles.error}>{error}</div>
        )}

        {/* Actions */}
        <div class={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            onClick={closeGuildCreate}
            disabled={loading}
          >
            {t('guild.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !name.trim() || !tag.trim()}
          >
            {loading ? t('guild.creating') : t('guild.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
