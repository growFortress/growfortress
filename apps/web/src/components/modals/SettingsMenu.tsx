import { useState, useEffect } from "preact/hooks";
import {
  settingsMenuVisible,
  closeSettingsMenu,
  isAdmin,
  openLegalModal,
  openBuildPresetsModal,
} from "../../state/index.js";
import { openSupportPage } from "../../state/support.signals.js";
import {
  audioSettings,
  updateAudioSettings,
  gameSettings,
  updateGameSettings,
} from "../../state/settings.signals.js";
import {
  openAdminBroadcastPanel,
  openAdminModerationPanel,
} from "../admin/index.js";
import {
  deleteAccount,
  getEmail,
  updateEmail,
  changePassword,
  redeemBonusCode,
  type BonusCodeRewards,
} from "../../api/client.js";
import { useTranslation } from "../../i18n/useTranslation.js";
import { Modal } from "../shared/Modal.js";
import { LanguageSwitcher } from "../shared/LanguageSwitcher.js";
import styles from "./SettingsMenu.module.css";

interface SettingsMenuProps {
  onLogout: () => Promise<void> | void;
}

type SettingsTab = "audio" | "game" | "account" | "admin";

export function SettingsMenu({ onLogout }: SettingsMenuProps) {
  const { t } = useTranslation("modals");
  const isVisible = settingsMenuVisible.value;
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Email state
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Bonus code state
  const [bonusCode, setBonusCode] = useState("");
  const [bonusCodeLoading, setBonusCodeLoading] = useState(false);
  const [bonusCodeError, setBonusCodeError] = useState("");
  const [bonusCodeSuccess, setBonusCodeSuccess] = useState<BonusCodeRewards | null>(null);

  // Load current email when modal opens
  useEffect(() => {
    if (isVisible) {
      void loadEmail();
    } else {
      // Reset forms when modal closes
      setShowEmailForm(false);
      setShowPasswordForm(false);
      setShowDeleteConfirm(false);
      setNewEmail("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setEmailError("");
      setPasswordError("");
      setEmailSuccess(false);
      setBonusCode("");
      setBonusCodeError("");
      setBonusCodeSuccess(null);
    }
  }, [isVisible]);

  const loadEmail = async () => {
    const email = await getEmail();
    setCurrentEmail(email);
  };

  const handleLogout = () => {
    closeSettingsMenu();
    void onLogout();
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    const success = await deleteAccount();
    setIsDeleting(false);

    if (success) {
      setShowDeleteConfirm(false);
      closeSettingsMenu();
      window.location.reload();
    }
  };

  const handleEmailSubmit = async (e: Event) => {
    e.preventDefault();
    setEmailError("");
    setEmailSuccess(false);

    if (!newEmail || !newEmail.includes("@")) {
      setEmailError(t("settings.account.invalidEmail"));
      return;
    }

    setEmailLoading(true);
    const result = await updateEmail(newEmail);
    setEmailLoading(false);

    if (result.success) {
      setCurrentEmail(newEmail.toLowerCase());
      setShowEmailForm(false);
      setNewEmail("");
      setEmailSuccess(true);
      setTimeout(() => setEmailSuccess(false), 3000);
    } else {
      setEmailError(result.error || t("settings.account.emailUpdateFailed"));
    }
  };

  const handlePasswordSubmit = async (e: Event) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError(t("settings.account.passwordTooShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.account.passwordMismatch"));
      return;
    }

    setPasswordLoading(true);
    const result = await changePassword(currentPassword, newPassword);
    setPasswordLoading(false);

    if (result.success) {
      // Password changed, user will be logged out
      closeSettingsMenu();
      window.location.reload();
    } else {
      setPasswordError(result.error || t("settings.account.passwordChangeFailed"));
    }
  };

  const handleBonusCodeSubmit = async (e: Event) => {
    e.preventDefault();
    setBonusCodeError("");
    setBonusCodeSuccess(null);

    if (!bonusCode.trim()) {
      setBonusCodeError(t("settings.account.codeRequired"));
      return;
    }

    setBonusCodeLoading(true);
    const result = await redeemBonusCode(bonusCode);
    setBonusCodeLoading(false);

    if (result.success && result.rewards) {
      setBonusCodeSuccess(result.rewards);
      setBonusCode("");
    } else {
      setBonusCodeError(result.error || t("settings.account.codeRedeemFailed"));
    }
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

  const renderGameSettings = () => {
    const settings = gameSettings.value;
    const priority = settings.relicPriority;
    const movePriority = (from: number, to: number) => {
      if (to < 0 || to >= priority.length) return;
      const next = [...priority];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      updateGameSettings({ relicPriority: next });
    };

    const getRelicCategoryLabel = (category: string) => {
      return t(`settings.game.relicCategories.${category}`, { defaultValue: category });
    };

    return (
      <div class={styles.settingsGroup}>
        <div class={styles.settingRow}>
          <label>{t("settings.game.autoPickRelics")}</label>
          <input
            type="checkbox"
            checked={settings.autoPickRelics}
            onChange={(e) =>
              updateGameSettings({ autoPickRelics: e.currentTarget.checked })
            }
          />
        </div>

        <div class={styles.prioritySection}>
          <div class={styles.priorityHeader}>
            <span class={styles.priorityTitle}>{t("settings.game.relicPriority")}</span>
            <span class={styles.priorityHint}>{t("settings.game.relicPriorityHint")}</span>
          </div>
          <div class={styles.priorityList}>
            {priority.map((category, index) => (
              <div key={category} class={styles.priorityItem}>
                <span class={styles.priorityLabel}>{getRelicCategoryLabel(category)}</span>
                <div class={styles.priorityButtons}>
                  <button
                    type="button"
                    class={styles.priorityBtn}
                    onClick={() => movePriority(index, index - 1)}
                    disabled={index === 0}
                    aria-label={t("settings.game.moveUp")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class={styles.priorityBtn}
                    onClick={() => movePriority(index, index + 1)}
                    disabled={index === priority.length - 1}
                    aria-label={t("settings.game.moveDown")}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          class={styles.menuItem}
          onClick={() => {
            closeSettingsMenu();
            openBuildPresetsModal();
          }}
        >
          <span class={styles.menuIcon}>🧩</span>
          <span class={styles.menuLabel}>
            {t("settings.game.buildPresets")}
          </span>
        </button>
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
          class={`${styles.tabBtn} ${activeTab === "game" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("game")}
        >
          {t("settings.tabs.game")}
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
        {activeTab === "game" && renderGameSettings()}
        {activeTab === "account" && (
          <div class={styles.settingsGroup}>
            <div class={styles.settingRow}>
              <label>{t("settings.account.language")}</label>
              <LanguageSwitcher />
            </div>

            {/* Email Section */}
            <div class={styles.accountSection}>
              <div class={styles.sectionHeader}>
                <span class={styles.sectionIcon}>📧</span>
                <span class={styles.sectionTitle}>{t("settings.account.email")}</span>
              </div>
              {!showEmailForm ? (
                <div class={styles.sectionContent}>
                  <span class={styles.currentValue}>
                    {currentEmail || t("settings.account.noEmail")}
                  </span>
                  <button
                    class={styles.editBtn}
                    onClick={() => {
                      setShowEmailForm(true);
                      setNewEmail(currentEmail || "");
                    }}
                  >
                    {currentEmail ? t("settings.account.change") : t("settings.account.add")}
                  </button>
                </div>
              ) : (
                <form class={styles.inlineForm} onSubmit={handleEmailSubmit}>
                  <input
                    type="email"
                    class={styles.formInput}
                    value={newEmail}
                    onInput={(e) => setNewEmail((e.target as HTMLInputElement).value)}
                    placeholder={t("settings.account.emailPlaceholder")}
                    disabled={emailLoading}
                  />
                  {emailError && <p class={styles.formError}>{emailError}</p>}
                  <div class={styles.formActions}>
                    <button
                      type="button"
                      class={styles.cancelBtn}
                      onClick={() => {
                        setShowEmailForm(false);
                        setEmailError("");
                      }}
                      disabled={emailLoading}
                    >
                      {t("buttons.cancel")}
                    </button>
                    <button
                      type="submit"
                      class={styles.saveBtn}
                      disabled={emailLoading}
                    >
                      {emailLoading ? t("settings.account.saving") : t("settings.account.save")}
                    </button>
                  </div>
                </form>
              )}
              {emailSuccess && (
                <p class={styles.successMessage}>{t("settings.account.emailUpdated")}</p>
              )}
            </div>

            {/* Password Section */}
            <div class={styles.accountSection}>
              <div class={styles.sectionHeader}>
                <span class={styles.sectionIcon}>🔒</span>
                <span class={styles.sectionTitle}>{t("settings.account.password")}</span>
              </div>
              {!showPasswordForm ? (
                <div class={styles.sectionContent}>
                  <span class={styles.currentValue}>••••••••</span>
                  <button
                    class={styles.editBtn}
                    onClick={() => setShowPasswordForm(true)}
                  >
                    {t("settings.account.change")}
                  </button>
                </div>
              ) : (
                <form class={styles.inlineForm} onSubmit={handlePasswordSubmit}>
                  <input
                    type="password"
                    class={styles.formInput}
                    value={currentPassword}
                    onInput={(e) => setCurrentPassword((e.target as HTMLInputElement).value)}
                    placeholder={t("settings.account.currentPassword")}
                    disabled={passwordLoading}
                  />
                  <input
                    type="password"
                    class={styles.formInput}
                    value={newPassword}
                    onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
                    placeholder={t("settings.account.newPassword")}
                    disabled={passwordLoading}
                  />
                  <input
                    type="password"
                    class={styles.formInput}
                    value={confirmPassword}
                    onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                    placeholder={t("settings.account.confirmPassword")}
                    disabled={passwordLoading}
                  />
                  {passwordError && <p class={styles.formError}>{passwordError}</p>}
                  <p class={styles.formHint}>{t("settings.account.passwordChangeNote")}</p>
                  <div class={styles.formActions}>
                    <button
                      type="button"
                      class={styles.cancelBtn}
                      onClick={() => {
                        setShowPasswordForm(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                        setPasswordError("");
                      }}
                      disabled={passwordLoading}
                    >
                      {t("buttons.cancel")}
                    </button>
                    <button
                      type="submit"
                      class={styles.saveBtn}
                      disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                    >
                      {passwordLoading ? t("settings.account.saving") : t("settings.account.save")}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Bonus Code Section */}
            <div class={styles.accountSection}>
              <div class={styles.sectionHeader}>
                <span class={styles.sectionIcon}>🎁</span>
                <span class={styles.sectionTitle}>{t("settings.account.bonusCode")}</span>
              </div>
              <form class={styles.bonusCodeForm} onSubmit={handleBonusCodeSubmit}>
                <div class={styles.bonusCodeInputRow}>
                  <input
                    type="text"
                    class={styles.formInput}
                    value={bonusCode}
                    onInput={(e) => setBonusCode((e.target as HTMLInputElement).value.toUpperCase())}
                    placeholder={t("settings.account.codePlaceholder")}
                    disabled={bonusCodeLoading}
                    maxLength={20}
                  />
                  <button
                    type="submit"
                    class={styles.redeemBtn}
                    disabled={bonusCodeLoading || !bonusCode.trim()}
                  >
                    {bonusCodeLoading ? "..." : t("settings.account.redeem")}
                  </button>
                </div>
                {bonusCodeError && <p class={styles.formError}>{bonusCodeError}</p>}
                {bonusCodeSuccess && (
                  <div class={styles.rewardSuccess}>
                    <p class={styles.rewardTitle}>{t("settings.account.codeRedeemed")}</p>
                    <div class={styles.rewardList}>
                      {bonusCodeSuccess.gold > 0 && (
                        <span class={styles.rewardItem}>🪙 +{bonusCodeSuccess.gold}</span>
                      )}
                      {bonusCodeSuccess.dust > 0 && (
                        <span class={styles.rewardItem}>💎 +{bonusCodeSuccess.dust}</span>
                      )}
                      {bonusCodeSuccess.energy > 0 && (
                        <span class={styles.rewardItem}>🔋 +{bonusCodeSuccess.energy}</span>
                      )}
                    </div>
                  </div>
                )}
              </form>
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

            <div class={styles.dangerZone}>
              {!showDeleteConfirm ? (
                <button
                  class={`${styles.menuItem} ${styles.dangerItem}`}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <span class={styles.menuIcon}>🗑️</span>
                  <span class={styles.menuLabel}>
                    {t("settings.account.deleteAccount")}
                  </span>
                </button>
              ) : (
                <div class={styles.deleteConfirm}>
                  <p class={styles.deleteWarning}>
                    {t("settings.account.deleteWarning")}
                  </p>
                  <div class={styles.deleteActions}>
                    <button
                      class={styles.cancelBtn}
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                    >
                      {t("buttons.cancel")}
                    </button>
                    <button
                      class={styles.confirmDeleteBtn}
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                    >
                      {isDeleting
                        ? t("settings.account.deleting")
                        : t("settings.account.confirmDelete")}
                    </button>
                  </div>
                </div>
              )}
            </div>
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
