import { Modal } from '../shared/Modal.js';
import {
  legalModalVisible,
  activeLegalTab,
  closeLegalModal,
  setLegalTab,
  type LegalTab,
} from '../../state/legal.signals.js';
import {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  COOKIE_POLICY,
  PAYMENT_TERMS,
} from '../../content/legal/index.js';
import styles from './LegalModal.module.css';

const LEGAL_TABS: { id: LegalTab; label: string; icon: string }[] = [
  { id: 'terms', label: 'Regulamin', icon: '📜' },
  { id: 'privacy', label: 'Prywatność', icon: '🔒' },
  { id: 'cookies', label: 'Cookies', icon: '🍪' },
  { id: 'payment', label: 'Płatności', icon: '💳' },
];

const LEGAL_CONTENT: Record<LegalTab, { title: string; content: string }> = {
  terms: TERMS_OF_SERVICE,
  privacy: PRIVACY_POLICY,
  cookies: COOKIE_POLICY,
  payment: PAYMENT_TERMS,
};

export function LegalModal() {
  const isVisible = legalModalVisible.value;
  const activeTab = activeLegalTab.value;
  const currentContent = LEGAL_CONTENT[activeTab];

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      title="Informacje prawne"
      onClose={closeLegalModal}
      size="large"
      ariaLabel="Informacje prawne"
    >
      <div class={styles.tabs} role="tablist" aria-label="Dokumenty prawne">
        {LEGAL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            class={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ''}`}
            onClick={() => setLegalTab(tab.id)}
            aria-selected={activeTab === tab.id}
            role="tab"
            id={`legal-tab-${tab.id}`}
            aria-controls={`legal-panel-${tab.id}`}
          >
            <span class={styles.tabIcon} aria-hidden="true">
              {tab.icon}
            </span>
            <span class={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      <div
        class={styles.content}
        role="tabpanel"
        id={`legal-panel-${activeTab}`}
        aria-labelledby={`legal-tab-${activeTab}`}
      >
        <h3 class={styles.contentTitle}>{currentContent.title}</h3>
        <div
          class={styles.contentBody}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: currentContent.content }}
        />
      </div>

      <div class={styles.footer}>
        <span class={styles.companyInfo}>
          © {new Date().getFullYear()} PlazaWorks • help@growfortress.com
        </span>
      </div>
    </Modal>
  );
}

export default LegalModal;
