import type { CSSProperties } from "preact/compat";
import { createPortal } from "preact/compat";
import { useEffect, useLayoutEffect, useState, useRef } from "preact/hooks";
import {
  activeTutorialTip,
  dismissCurrentTip,
  completeInteractiveTip,
  skipAllTutorials,
} from "../../state/tutorial.signals.js";
import { useTranslation } from "../../i18n/useTranslation.js";
import { useTutorialCompletion, isInteractiveTip } from "../../hooks/useTutorialCompletion.js";
import styles from "./TutorialHighlight.module.css";

function getTooltipPosition(
  position: string,
  targetRect: DOMRect | null
): CSSProperties {
  if (!targetRect || position === "center") {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const padding = 16;
  const tooltipWidth = 280;
  const tooltipHeight = 180; // Estimated
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Helper to clamp horizontal position within viewport
  const clampLeft = (left: number) => Math.max(padding, Math.min(left, viewportWidth - tooltipWidth - padding));
  const clampTop = (top: number) => Math.max(padding, Math.min(top, viewportHeight - tooltipHeight - padding));

  switch (position) {
    case "bottom": {
      const left = clampLeft(targetRect.left + targetRect.width / 2 - tooltipWidth / 2);
      const top = Math.min(targetRect.bottom + padding, viewportHeight - tooltipHeight - padding);
      return { top: `${top}px`, left: `${left}px` };
    }
    case "top": {
      const left = clampLeft(targetRect.left + targetRect.width / 2 - tooltipWidth / 2);
      const top = Math.max(targetRect.top - tooltipHeight - padding, padding);
      return { top: `${top}px`, left: `${left}px` };
    }
    case "left": {
      const left = Math.max(targetRect.left - tooltipWidth - padding, padding);
      const top = clampTop(targetRect.top + targetRect.height / 2 - tooltipHeight / 2);
      return { top: `${top}px`, left: `${left}px` };
    }
    case "right": {
      const left = Math.min(targetRect.right + padding, viewportWidth - tooltipWidth - padding);
      const top = clampTop(targetRect.top + targetRect.height / 2 - tooltipHeight / 2);
      return { top: `${top}px`, left: `${left}px` };
    }
    default:
      return {};
  }
}

export function TutorialHighlight() {
  const { t } = useTranslation("game");
  const tip = activeTutorialTip.value;
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  // Use the tutorial completion hook for signal/action-based completion
  useTutorialCompletion();

  // Check if this is an interactive tip
  const isInteractive = isInteractiveTip(tip);

  // Find highlighted element - use useLayoutEffect to avoid visual jump
  useLayoutEffect(() => {
    if (!tip) {
      setTargetRect(null);
      return undefined;
    }

    if (!tip.highlightRef) {
      setTargetRect(null);
      return undefined;
    }

    const element = document.querySelector(
      `[data-tutorial="${tip.highlightRef}"]`
    );

    if (!element) {
      setTargetRect(null);
      return undefined;
    }

    setTargetRect(element.getBoundingClientRect());

    // Update position on scroll/resize
    const updateRect = () => {
      const el = document.querySelector(
        `[data-tutorial="${tip.highlightRef}"]`
      );
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    };

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [tip]);

  // Click-based completion detection
  useEffect(() => {
    if (!tip?.completion || tip.completion.type !== "click") return;
    if (!tip.highlightRef) return;

    const element = document.querySelector(
      `[data-tutorial="${tip.highlightRef}"]`
    );
    if (!element) return;

    const handleClick = () => {
      completeInteractiveTip();
    };

    // Use capture phase to detect click before it bubbles
    element.addEventListener("click", handleClick, { capture: true });

    return () => {
      element.removeEventListener("click", handleClick, { capture: true });
    };
  }, [tip]);

  // Auto-dismiss timer (skip for interactive tips)
  useEffect(() => {
    // Don't auto-dismiss interactive tips
    if (!tip || !tip.autoDismissMs || isInteractive) return;

    dismissTimerRef.current = window.setTimeout(() => {
      handleDismiss();
    }, tip.autoDismissMs);

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [tip, isInteractive]);

  const handleDismiss = () => {
    dismissCurrentTip();
  };

  const handleOverlayClick = (e: MouseEvent) => {
    // Don't dismiss if clicking the tooltip itself
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.tooltip}`)) {
      return;
    }
    handleDismiss();
  };

  if (!tip) return null;

  // Don't render until we have the target rect (prevents position jump)
  // Only applies when highlightRef is set - centered tips render immediately
  if (tip.highlightRef && !targetRect) return null;

  const tooltipStyle = getTooltipPosition(tip.position, targetRect);

  // Button text differs for interactive tips
  const buttonText = isInteractive
    ? t("tutorial.tryIt", { defaultValue: "Try it!" })
    : t("tutorial.dismiss");

  const content = (
    <div class={styles.overlay} onClick={handleOverlayClick}>
      {/* Highlight cutout (if targeting element) */}
      {targetRect && (
        <div
          class={`${styles.highlightBox} ${isInteractive ? styles.interactive : ""}`}
          style={{
            top: `${targetRect.top - 8}px`,
            left: `${targetRect.left - 8}px`,
            width: `${targetRect.width + 16}px`,
            height: `${targetRect.height + 16}px`,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        class={`${styles.tooltip} ${isInteractive ? styles.interactive : ""}`}
        style={tooltipStyle}
      >
        <h3 class={styles.title}>{tip.title}</h3>
        <p class={styles.description}>{tip.description}</p>
        <button
          class={`${styles.dismissBtn} ${isInteractive ? styles.tryItBtn : ""}`}
          onClick={handleDismiss}
        >
          {buttonText}
        </button>
        {/* Skip link for interactive tips (escape hatch if stuck) */}
        {isInteractive && (
          <button class={styles.skipLink} onClick={handleDismiss}>
            {t("tutorial.skip", { defaultValue: "Skip for now" })}
          </button>
        )}
        {/* Skip All Tutorials button - only on first step */}
        {tip.id === "welcome_intro" && (
          <button class={styles.skipAllBtn} onClick={() => skipAllTutorials()}>
            {t("tutorial.skipAll", { defaultValue: "Skip All Tutorials" })}
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
