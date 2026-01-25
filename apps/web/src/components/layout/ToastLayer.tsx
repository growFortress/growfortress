import { SyncStatus } from "../toasts/SyncStatus.js";
import { RewardsToast } from "../toasts/RewardsToast.js";
import { ErrorToast } from "../toasts/ErrorToast.js";
import { SynergyToast } from "../toasts/SynergyToast.js";
import { LevelUpToast } from "../toasts/LevelUpToast.js";
import { UnlockNotificationQueue } from "../game/UnlockNotification.js";
import {
  unlockNotifications,
  dismissUnlockNotification,
} from "../../state/index.js";
import { useTranslation } from "../../i18n/useTranslation.js";

/**
 * Renders all toast notifications for the application.
 * Centralizes toast management and reduces App.tsx size.
 */
export function ToastLayer() {
  const { t } = useTranslation(["common"]);

  return (
    <div
      role="region"
      aria-label={t("common:app.notificationsAriaLabel")}
      aria-live="polite"
    >
      <SyncStatus />
      <RewardsToast />
      <ErrorToast />
      <LevelUpToast />
      <SynergyToast />
      <UnlockNotificationQueue
        notifications={unlockNotifications.value}
        onDismiss={dismissUnlockNotification}
      />
    </div>
  );
}
