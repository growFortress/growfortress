import { signal, type Signal } from '@preact/signals';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBulkRewards, claimBulkReward } from '../../api/client.js';
import styles from './RewardsModal.module.css';

export const rewardsModalVisible: Signal<boolean> = signal(false);
export const hasUnclaimedRewards: Signal<boolean> = signal(false);

export function showRewardsModal() {
  rewardsModalVisible.value = true;
}

export function hideRewardsModal() {
  rewardsModalVisible.value = false;
}

export function RewardsModal() {
  const queryClient = useQueryClient();

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ['rewards'],
    queryFn: getBulkRewards,
    enabled: rewardsModalVisible.value,
  });

  // Sync the unclaimed rewards signal
  if (rewards.length > 0 && !hasUnclaimedRewards.value) {
    hasUnclaimedRewards.value = true;
  } else if (rewards.length === 0 && hasUnclaimedRewards.value) {
    hasUnclaimedRewards.value = false;
  }

  const claimMutation = useMutation({
    mutationFn: claimBulkReward,
    onSuccess: () => {
      // Invalidate both rewards list and player profile (to update gold/dust)
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error: any) => {
      alert('Failed to claim reward: ' + error.message);
    }
  });

  if (!rewardsModalVisible.value) return null;

  const handleOverlayClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains(styles.overlay)) {
      hideRewardsModal();
    }
  };

  return (
    <div class={styles.overlay} onClick={handleOverlayClick}>
      <div class={styles.modal}>
        <div class={styles.header}>
          <h2 class={styles.title}>Nagrody Systemowe</h2>
          <button class={styles.closeBtn} onClick={hideRewardsModal}>×</button>
        </div>

        <div class={styles.content}>
          {isLoading ? (
            <div class="text-center p-8 opacity-50">Wczytywanie nagród...</div>
          ) : rewards.length > 0 ? (
            <div class={styles.rewardList}>
              {rewards.map((reward) => (
                <div key={reward.id} class={styles.rewardItem}>
                  <div class={styles.rewardInfo}>
                    <h3 class={styles.rewardTitle}>{reward.title}</h3>
                    <p class={styles.rewardDesc}>{reward.description}</p>
                    <div class={styles.rewardBadge}>
                      {reward.type === 'GOLD' ? '💰' : 
                       reward.type === 'DUST' ? '💨' : 
                       reward.type === 'SIGILS' ? '🔯' : '🎁'}
                      {reward.value} {reward.type}
                    </div>
                  </div>
                  <button 
                    class={styles.claimBtn}
                    onClick={() => claimMutation.mutate(reward.id)}
                    disabled={claimMutation.isPending}
                  >
                    {claimMutation.isPending && claimMutation.variables === reward.id ? 'Odbieranie...' : 'Odbierz'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div class={styles.emptyState}>
              <div class={styles.emptyIcon}>📭</div>
              <div class={styles.emptyText}>Nie masz obecnie żadnych nowych nagród.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
