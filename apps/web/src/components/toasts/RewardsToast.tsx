import { useEffect } from 'preact/hooks';
import { toastMessage, hideRewardsToast } from '../../state/index.js';
import { TOAST_DURATION_MS } from '../../constants.js';

export function RewardsToast() {
  useEffect(() => {
    if (toastMessage.value) {
      const timer = setTimeout(() => {
        hideRewardsToast();
      }, TOAST_DURATION_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toastMessage.value]);

  return (
    <div class={`rewards-toast ${toastMessage.value ? 'visible' : ''}`}>
      {toastMessage.value && (
        <>
          <span class="reward-gold">+{toastMessage.value.gold} Gold</span>
          <span class="reward-dust">+{toastMessage.value.dust} Dust</span>
          <span class="reward-xp">+{toastMessage.value.xp} XP</span>
        </>
      )}
    </div>
  );
}
