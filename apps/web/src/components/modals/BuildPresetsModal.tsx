import { useEffect, useState } from "preact/hooks";
import type { BuildPreset } from "@arcade/protocol";
import {
  FORTRESS_CLASSES,
  getClassById,
  getHeroById,
  getTurretById,
  type FortressClass,
} from "@arcade/sim-core";
import { useTranslation } from "../../i18n/useTranslation.js";
import { updateBuildPresets } from "../../api/client.js";
import {
  buildPresetsModalVisible,
  closeBuildPresetsModal,
  showErrorToast,
  buildPresets,
  activePresetId,
  selectedFortressClass,
  unlockedHeroIds,
  unlockedTurretIds,
  maxHeroSlots,
  purchasedTurretSlots,
} from "../../state/index.js";
import { Modal } from "../shared/Modal.js";
import styles from "./BuildPresetsModal.module.css";

const MAX_PRESETS = 5;

function createPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BuildPresetsModal() {
  const { t } = useTranslation("modals");
  const isVisible = buildPresetsModalVisible.value;

  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftClass, setDraftClass] = useState<FortressClass>("natural");
  const [draftHeroes, setDraftHeroes] = useState<string[]>([]);
  const [draftTurrets, setDraftTurrets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const heroLimit = Math.max(1, maxHeroSlots.value);
  const turretLimit = Math.max(1, purchasedTurretSlots.value);

  useEffect(() => {
    if (!isVisible) {
      setDraftId(null);
      setDraftName("");
      setDraftClass("natural");
      setDraftHeroes([]);
      setDraftTurrets([]);
      setSaving(false);
    }
  }, [isVisible]);

  const presets = buildPresets.value;
  const activeId = activePresetId.value;

  const heroOptions = unlockedHeroIds.value
    .map((id) => ({
      id,
      label: getHeroById(id)?.name ?? id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const turretOptions = unlockedTurretIds.value
    .map((id) => ({
      id,
      label: getTurretById(id)?.name ?? id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const handleEdit = (preset: BuildPreset) => {
    setDraftId(preset.id);
    setDraftName(preset.name);
    setDraftClass(preset.fortressClass as FortressClass);
    setDraftHeroes(preset.startingHeroes || []);
    setDraftTurrets(preset.startingTurrets || []);
  };

  const handleCreate = () => {
    setDraftId(createPresetId());
    setDraftName("");
    setDraftClass((selectedFortressClass.value ?? "natural") as FortressClass);
    setDraftHeroes([]);
    setDraftTurrets([]);
  };

  const handleCancelEdit = () => {
    setDraftId(null);
    setDraftName("");
    setDraftHeroes([]);
    setDraftTurrets([]);
  };

  const toggleHero = (id: string) => {
    setDraftHeroes((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= heroLimit) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const toggleTurret = (id: string) => {
    setDraftTurrets((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= turretLimit) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const applyResponse = (response: {
    buildPresets: BuildPreset[];
    activePresetId: string | null;
  }) => {
    buildPresets.value = response.buildPresets;
    activePresetId.value = response.activePresetId;
    if (response.activePresetId) {
      const activePreset = response.buildPresets.find(
        (preset) => preset.id === response.activePresetId,
      );
      if (activePreset?.fortressClass) {
        selectedFortressClass.value = activePreset.fortressClass as FortressClass;
      }
    }
  };

  const handleSave = async () => {
    if (!draftId || !draftName.trim()) return;
    setSaving(true);
    try {
      const nextPreset: BuildPreset = {
        id: draftId,
        name: draftName.trim(),
        fortressClass: draftClass,
        startingHeroes: [...draftHeroes],
        startingTurrets: [...draftTurrets],
      };
      const nextPresets =
        presets.find((preset) => preset.id === draftId) !== undefined
          ? presets.map((preset) => (preset.id === draftId ? nextPreset : preset))
          : [...presets, nextPreset];
      const response = await updateBuildPresets({
        buildPresets: nextPresets,
        activePresetId: activeId && nextPresets.some((p) => p.id === activeId)
          ? activeId
          : null,
      });
      applyResponse(response);
      handleCancelEdit();
    } catch (error) {
      console.error("Failed to save build presets:", error);
      showErrorToast(t("buildPresets.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (presetId: string) => {
    setSaving(true);
    try {
      const nextPresets = presets.filter((preset) => preset.id !== presetId);
      const response = await updateBuildPresets({
        buildPresets: nextPresets,
        activePresetId: activeId === presetId ? null : activeId,
      });
      applyResponse(response);
      if (draftId === presetId) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error("Failed to delete build preset:", error);
      showErrorToast(t("buildPresets.errors.deleteFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (presetId: string) => {
    setSaving(true);
    try {
      const response = await updateBuildPresets({
        buildPresets: presets,
        activePresetId: presetId,
      });
      applyResponse(response);
    } catch (error) {
      console.error("Failed to activate build preset:", error);
      showErrorToast(t("buildPresets.errors.activateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const canCreate = presets.length < MAX_PRESETS;
  const canSave = !!draftId && draftName.trim().length > 0;

  return (
    <Modal
      visible={isVisible}
      title={t("buildPresets.title")}
      onClose={closeBuildPresetsModal}
      class={styles.modal}
      ariaLabel={t("buildPresets.ariaLabel")}
    >
      <div class={styles.container}>
        <p class={styles.description}>{t("buildPresets.description")}</p>

        <div class={styles.listHeader}>
          <span class={styles.listTitle}>{t("buildPresets.listTitle")}</span>
          <button
            type="button"
            class={styles.primaryButton}
            onClick={handleCreate}
            disabled={!canCreate || saving}
          >
            {t("buildPresets.create")}
          </button>
        </div>
        {!canCreate && (
          <p class={styles.limitNote}>{t("buildPresets.maxReached")}</p>
        )}

        {presets.length === 0 ? (
          <div class={styles.emptyState}>{t("buildPresets.empty")}</div>
        ) : (
          <div class={styles.presetList}>
            {presets.map((preset) => (
              <div key={preset.id} class={styles.presetItem}>
                <div class={styles.presetInfo}>
                  <div class={styles.presetNameRow}>
                    <span class={styles.presetName}>{preset.name}</span>
                    {preset.id === activeId && (
                      <span class={styles.activeBadge}>
                        {t("buildPresets.active")}
                      </span>
                    )}
                  </div>
                  <span class={styles.presetMeta}>
                    {getClassById(preset.fortressClass)?.name ??
                      preset.fortressClass}
                    {" • "}
                    {preset.startingHeroes.length} {t("buildPresets.heroesShort")}
                    {" • "}
                    {preset.startingTurrets.length} {t("buildPresets.turretsShort")}
                  </span>
                </div>
                <div class={styles.presetActions}>
                  <button
                    type="button"
                    class={styles.secondaryButton}
                    onClick={() => handleActivate(preset.id)}
                    disabled={saving || preset.id === activeId}
                  >
                    {t("buildPresets.setActive")}
                  </button>
                  <button
                    type="button"
                    class={styles.secondaryButton}
                    onClick={() => handleEdit(preset)}
                    disabled={saving}
                  >
                    {t("buildPresets.edit")}
                  </button>
                  <button
                    type="button"
                    class={styles.dangerButton}
                    onClick={() => handleDelete(preset.id)}
                    disabled={saving}
                  >
                    {t("buildPresets.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {draftId && (
          <div class={styles.editor}>
            <div class={styles.editorTitle}>
              {t("buildPresets.editorTitle")}
            </div>
            <div class={styles.formRow}>
              <label class={styles.label}>{t("buildPresets.nameLabel")}</label>
              <input
                type="text"
                class={styles.input}
                value={draftName}
                onInput={(event) =>
                  setDraftName((event.target as HTMLInputElement).value)
                }
                placeholder={t("buildPresets.namePlaceholder")}
                disabled={saving}
                maxLength={30}
              />
            </div>

            <div class={styles.formRow}>
              <label class={styles.label}>{t("buildPresets.classLabel")}</label>
              <select
                class={styles.select}
                value={draftClass}
                onChange={(event) =>
                  setDraftClass((event.target as HTMLSelectElement).value as FortressClass)
                }
                disabled={saving}
              >
                {FORTRESS_CLASSES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div class={styles.formRow}>
              <div class={styles.sectionHeader}>
                <span>{t("buildPresets.heroesLabel")}</span>
                <span class={styles.limitHint}>
                  {t("buildPresets.slotsInfo", { count: heroLimit })}
                </span>
              </div>
              <div class={styles.optionsGrid}>
                {heroOptions.map((hero) => {
                  const checked = draftHeroes.includes(hero.id);
                  const disabled =
                    !checked && draftHeroes.length >= heroLimit;
                  return (
                    <label key={hero.id} class={styles.optionItem}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled || saving}
                        onChange={() => toggleHero(hero.id)}
                      />
                      <span>{hero.label}</span>
                    </label>
                  );
                })}
                {heroOptions.length === 0 && (
                  <div class={styles.emptyOptions}>
                    {t("buildPresets.noHeroes")}
                  </div>
                )}
              </div>
            </div>

            <div class={styles.formRow}>
              <div class={styles.sectionHeader}>
                <span>{t("buildPresets.turretsLabel")}</span>
                <span class={styles.limitHint}>
                  {t("buildPresets.slotsInfo", { count: turretLimit })}
                </span>
              </div>
              <div class={styles.optionsGrid}>
                {turretOptions.map((turret) => {
                  const checked = draftTurrets.includes(turret.id);
                  const disabled =
                    !checked && draftTurrets.length >= turretLimit;
                  return (
                    <label key={turret.id} class={styles.optionItem}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled || saving}
                        onChange={() => toggleTurret(turret.id)}
                      />
                      <span>{turret.label}</span>
                    </label>
                  );
                })}
                {turretOptions.length === 0 && (
                  <div class={styles.emptyOptions}>
                    {t("buildPresets.noTurrets")}
                  </div>
                )}
              </div>
            </div>

            <div class={styles.editorActions}>
              <button
                type="button"
                class={styles.secondaryButton}
                onClick={handleCancelEdit}
                disabled={saving}
              >
                {t("buildPresets.cancel")}
              </button>
              <button
                type="button"
                class={styles.primaryButton}
                onClick={handleSave}
                disabled={!canSave || saving}
              >
                {saving ? t("buildPresets.saving") : t("buildPresets.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
