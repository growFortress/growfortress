import { Modal } from "../shared/Modal.js";
import { useTranslation } from "../../i18n/useTranslation.js";
import {
  legalModalVisible,
  activeLegalTab,
  closeLegalModal,
  setLegalTab,
  type LegalTab,
} from "../../state/legal.signals.js";
import {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  COOKIE_POLICY,
  PAYMENT_TERMS,
} from "../../content/legal/index.js";
import styles from "./LegalModal.module.css";

type LegalContent = { title: string; content: string };

type LegalContentByLanguage = Record<"pl" | "en", LegalContent>;

const LEGAL_CONTENT: Record<LegalTab, LegalContentByLanguage> = {
  terms: TERMS_OF_SERVICE,
  privacy: PRIVACY_POLICY,
  cookies: COOKIE_POLICY,
  payment: PAYMENT_TERMS,
};

export function LegalModal() {
  const { t, language } = useTranslation("modals");
  const isVisible = legalModalVisible.value;
  const activeTab = activeLegalTab.value;
  const languageKey = language === "pl" ? "pl" : "en";
  const currentContent = LEGAL_CONTENT[activeTab][languageKey];
  const legalTabs: { id: LegalTab; label: string; icon: string }[] = [
    { id: "terms", label: t("legalModal.tabs.terms"), icon: "📜" },
    { id: "privacy", label: t("legalModal.tabs.privacy"), icon: "🔒" },
    { id: "cookies", label: t("legalModal.tabs.cookies"), icon: "🍪" },
    { id: "payment", label: t("legalModal.tabs.payment"), icon: "💳" },
  ];

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      title={t("legalModal.title")}
      onClose={closeLegalModal}
      size="large"
      ariaLabel={t("legalModal.ariaLabel")}
    >
      <div
        class={styles.tabs}
        role="tablist"
        aria-label={t("legalModal.tabListLabel")}
      >
        {legalTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            class={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ""}`}
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
          © {new Date().getFullYear()}{" "}
          <a
            href={`/company/index-${languageKey}.html`}
            target="_blank"
            rel="noopener noreferrer"
            class={styles.companyLink}
          >
            PlazaWorks
          </a>
          {" • "}
          <a href="mailto:help@growfortress.com" class={styles.companyLink}>
            help@growfortress.com
          </a>
        </span>
      </div>
    </Modal>
  );
}

export default LegalModal;
