import { useEffect, useState } from "preact/hooks";
import { useTranslation } from "../../i18n/useTranslation.js";
import { openLegalModal } from "../../state/index.js";
import styles from "./CookieBanner.module.css";

const CONSENT_KEY = "cookie-consent";

export function CookieBanner() {
  const { t } = useTranslation("modals");
  const [visible, setVisible] = useState(false);
  const [delayComplete, setDelayComplete] = useState(false);

  // Delay showing banner to avoid cluttering initial load (1 minute)
  useEffect(() => {
    const timer = setTimeout(() => setDelayComplete(true), 60000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!delayComplete) return;
    if (localStorage.getItem(CONSENT_KEY)) return;
    setVisible(true);
  }, [delayComplete]);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      class={styles.banner}
      role="dialog"
      aria-live="polite"
      aria-label={t("cookieBanner.label")}
    >
      <div class={styles.text}>
        <strong>{t("cookieBanner.title")}</strong> {t("cookieBanner.body")}
      </div>
      <div class={styles.actions}>
        <button type="button" class={styles.primary} onClick={handleAccept}>
          {t("cookieBanner.accept")}
        </button>
        <button
          type="button"
          class={styles.secondary}
          onClick={() => openLegalModal("cookies")}
        >
          {t("cookieBanner.policy")}
        </button>
      </div>
    </div>
  );
}

export default CookieBanner;
