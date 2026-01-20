import { useState } from "preact/hooks";
import {
  settingsMenuVisible,
  closeSettingsMenu,
  isAdmin,
  openLegalModal,
} from "../../state/index.js";
import { openSupportPage } from "../../state/support.signals.js";
import {
  audioSettings,
  graphicsSettings,
  // gameSettings,
  updateAudioSettings,
  updateGraphicsSettings,
  // updateGameSettings,
} from "../../state/settings.signals.js";
import {
  openAdminBroadcastPanel,
  openAdminModerationPanel,
} from "../admin/index.js";
import { useTranslation } from "../../i18n/useTranslation.js";
import { Modal } from "../shared/Modal.js";
import { LanguageSwitcher } from "../shared/LanguageSwitcher.js";
import styles from "./SettingsMenu.module.css";

interface SettingsMenuProps {
  onLogout: () => Promise<void> | void;
}

type SettingsTab = "audio" | "graphics" | "game" | "account" | "admin";

export function SettingsMenu({ onLogout }: SettingsMenuProps) {
  const { t } = useTranslation("modals");
  const isVisible = settingsMenuVisible.value;
  const [activeTab, setActiveTab] = useState<SettingsTab>("audio");

  const handleLogout = () => {
    closeSettingsMenu();
    void onLogout();
  };

  const renderAudioSettings = () => {
    const s = audioSettings.value;
    return (
      <div class={styles.settingsGroup}>
        <div class={styles.settingRow}>
          <label>{t("settings.audio.muteAll")}</label>
          <input
            type="checkbox"
            checked={s.muted}
            onChange={(e) =>
              updateAudioSettings({ muted: e.currentTarget.checked })
            }
          />
        </div>
        <div class={styles.settingRow}>
          <label>{t("settings.audio.masterVolume")}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={s.masterVolume}
            disabled={s.muted}
            onInput={(e) =>
              updateAudioSettings({
                masterVolume: parseFloat(e.currentTarget.value),
              })
            }
          />
          <span>{Math.round(s.masterVolume * 100)}%</span>
        </div>
        <div class={styles.settingRow}>
          <label>{t("settings.audio.musicVolume")}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={s.musicVolume}
            disabled={s.muted}
            onInput={(e) =>
              updateAudioSettings({
                musicVolume: parseFloat(e.currentTarget.value),
              })
            }
          />
          <span>{Math.round(s.musicVolume * 100)}%</span>
        </div>
        <div class={styles.settingRow}>
          <label>{t("settings.audio.sfxVolume")}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={s.sfxVolume}
            disabled={s.muted}
            onInput={(e) =>
              updateAudioSettings({
                sfxVolume: parseFloat(e.currentTarget.value),
              })
            }
          />
          <span>{Math.round(s.sfxVolume * 100)}%</span>
        </div>
      </div>
    );
  };

  const renderGraphicsSettings = () => {
    const s = graphicsSettings.value;
    return (
      <div class={styles.settingsGroup}>
        <div class={styles.settingRow}>
          <label>{t("settings.graphics.particlesQuality")}</label>
          <select
            value={s.particles.toString()}
            onChange={(e) =>
              updateGraphicsSettings({
                particles: parseFloat(e.currentTarget.value),
              })
            }
          >
            <option value="0.5">{t("settings.graphics.qualityLow")}</option>
            <option value="1.0">{t("settings.graphics.qualityMedium")}</option>
            <option value="1.5">{t("settings.graphics.qualityHigh")}</option>
          </select>
        </div>
        <div class={styles.settingRow}>
          <label>{t("settings.graphics.resolutionScale")}</label>
          <select
            value={s.resolutionScale.toString()}
            onChange={(e) =>
              updateGraphicsSettings({
                resolutionScale: parseFloat(e.currentTarget.value),
              })
            }
          >
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1.0">100%</option>
          </select>
        </div>
        <div class={styles.settingRow}>
          <label>{t("settings.graphics.damageNumbers")}</label>
          <input
            type="checkbox"
            checked={s.damageNumbers}
            onChange={(e) =>
              updateGraphicsSettings({ damageNumbers: e.currentTarget.checked })
            }
          />
        </div>
      </div>
    );
  };

  return (
    <Modal
      visible={isVisible}
      title={t("settings.title")}
      onClose={closeSettingsMenu}
      class={styles.menu}
      ariaLabel={t("settings.ariaLabel")}
    >
      <div class={styles.tabs}>
        <button
          class={`${styles.tabBtn} ${activeTab === "audio" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("audio")}
        >
          {t("settings.tabs.audio")}
        </button>
        <button
          class={`${styles.tabBtn} ${activeTab === "graphics" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("graphics")}
        >
          {t("settings.tabs.graphics")}
        </button>
        <button
          class={`${styles.tabBtn} ${activeTab === "account" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("account")}
        >
          {t("settings.tabs.account")}
        </button>
        {isAdmin.value && (
          <button
            class={`${styles.tabBtn} ${styles.adminTab} ${activeTab === "admin" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("admin")}
          >
            {t("settings.tabs.admin")}
          </button>
        )}
      </div>

      <div class={styles.content}>
        {activeTab === "audio" && renderAudioSettings()}
        {activeTab === "graphics" && renderGraphicsSettings()}
        {activeTab === "account" && (
          <div class={styles.settingsGroup}>
            <div class={styles.settingRow}>
              <label>{t("settings.account.language")}</label>
              <LanguageSwitcher />
            </div>
            <button
              class={styles.menuItem}
              onClick={() => {
                closeSettingsMenu();
                openSupportPage();
              }}
            >
              <span class={styles.menuIcon}>🎫</span>
              <span class={styles.menuLabel}>
                {t("settings.account.support")}
              </span>
            </button>
            <button class={styles.menuItem} onClick={handleLogout}>
              <span class={styles.menuIcon}>🚪</span>
              <span class={styles.menuLabel}>
                {t("settings.account.logout")}
              </span>
            </button>
          </div>
        )}
        {activeTab === "admin" && isAdmin.value && (
          <div class={styles.settingsGroup}>
            <button
              class={styles.menuItem}
              onClick={() => {
                closeSettingsMenu();
                openAdminBroadcastPanel();
              }}
            >
              <span class={styles.menuIcon}>📢</span>
              <span class={styles.menuLabel}>
                {t("settings.admin.broadcast")}
              </span>
            </button>
            <button
              class={styles.menuItem}
              onClick={() => {
                closeSettingsMenu();
                openAdminModerationPanel();
              }}
            >
              <span class={styles.menuIcon}>🛡️</span>
              <span class={styles.menuLabel}>
                {t("settings.admin.moderation")}
              </span>
            </button>
          </div>
        )}
      </div>

      <div class={styles.footer}>
        <div class={styles.legalLinks}>
          <button
            type="button"
            class={styles.legalLink}
            onClick={() => {
              closeSettingsMenu();
              openLegalModal("terms");
            }}
          >
            {t("settings.legal.terms")}
          </button>
          <span class={styles.linkSeparator}>•</span>
          <button
            type="button"
            class={styles.legalLink}
            onClick={() => {
              closeSettingsMenu();
              openLegalModal("privacy");
            }}
          >
            {t("settings.legal.privacy")}
          </button>
          <span class={styles.linkSeparator}>•</span>
          <button
            type="button"
            class={styles.legalLink}
            onClick={() => {
              closeSettingsMenu();
              openLegalModal("cookies");
            }}
          >
            {t("settings.legal.cookies")}
          </button>
        </div>
        <span class={styles.version}>Grow Fortress v0.1</span>
      </div>
    </Modal>
  );
}
