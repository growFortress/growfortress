import { OnboardingModal } from "../modals/OnboardingModal.js";
import { SessionRecoveryModal } from "../modals/SessionRecoveryModal.js";
import { RewardsModal } from "../modals/RewardsModal.js";
import { SettingsMenu } from "../modals/SettingsMenu.js";
import { BuildPresetsModal } from "../modals/BuildPresetsModal.js";
import { PvpPanel, PvpBattleResult, PvpReplayViewer } from "../pvp/index.js";
import {
  GuildPanel,
  GuildCreateModal,
  GuildSearchModal,
} from "../guild/index.js";
import { MessagesModal } from "../messages/MessagesModal.js";
import { LeaderboardModal } from "../modals/LeaderboardModal.js";
import { StatisticsDashboardModal } from "../modals/StatisticsDashboardModal.js";
import { HubPreviewModal } from "../modals/HubPreviewModal.js";
import { GuildPreviewModal } from "../modals/GuildPreviewModal.js";
import { ShopModal } from "../modals/ShopModal.js";
import { ArtifactsModal } from "../modals/ArtifactsModal.js";
import { IdleRewardsModal } from "../modals/IdleRewardsModal.js";
import { AchievementsModal } from "../modals/AchievementsModal.js";
import { PillarUnlockModal } from "../modals/PillarUnlockModal.js";
import { GuestRegistrationModal } from "../modals/GuestRegistrationModal.js";
import { StatPointsModal } from "../modals/StatPointsModal.js";
import { AdminBroadcastPanel, AdminModerationPanel } from "../admin/index.js";
import {
  pillarUnlockModalVisible,
  closePillarUnlockModal,
} from "../../state/index.js";

export interface ModalLayerProps {
  onLogout: () => Promise<void>;
  onSessionContinue: () => void;
  onSessionAbandon: () => Promise<void>;
}

/**
 * Renders all modal dialogs for the application.
 * Centralizes modal management and reduces App.tsx size.
 */
export function ModalLayer({
  onLogout,
  onSessionContinue,
  onSessionAbandon,
}: ModalLayerProps) {
  return (
    <>
      <OnboardingModal />
      <RewardsModal />
      <SessionRecoveryModal
        onContinue={onSessionContinue}
        onAbandon={onSessionAbandon}
      />
      <SettingsMenu onLogout={onLogout} />
      <BuildPresetsModal />
      <PvpPanel />
      <PvpBattleResult />
      <PvpReplayViewer />
      <GuildPanel />
      <GuildCreateModal onSuccess={() => {}} />
      <GuildSearchModal onSuccess={() => {}} />
      <MessagesModal />
      <LeaderboardModal />
      <StatisticsDashboardModal />
      <HubPreviewModal />
      <GuildPreviewModal />
      <ShopModal />
      <ArtifactsModal />
      <IdleRewardsModal />
      <AchievementsModal />
      <PillarUnlockModal
        visible={pillarUnlockModalVisible.value}
        onClose={closePillarUnlockModal}
      />
      <GuestRegistrationModal />
      <StatPointsModal />
      <AdminBroadcastPanel />
      <AdminModerationPanel />
    </>
  );
}
