/**
 * Gacha Banner Modal - Hero Summoning
 *
 * Features:
 * - Active banner display with featured heroes
 * - Single and 10x pull buttons
 * - Pity and spark progress display
 * - Pull results animation
 */

import { useEffect } from "preact/hooks";
import { Modal } from "../shared/Modal.js";
import { Button } from "../shared/Button.js";
import { DustIcon } from "../icons/index.js";
import { HeroAvatar } from "../shared/HeroAvatar.js";
import { getHeroById } from "@arcade/sim-core";
import type { HeroIdType } from "@arcade/protocol";
import {
  gachaModalVisible,
  selectedBanner,
  lastPullResults,
  showPullResults,
  isLoadingBanners,
  isPulling,
  gachaError,
  heroPityCount,
  heroSparkCount,
  heroShards,
  canAffordSinglePull,
  canAffordTenPull,
  canRedeemSpark,
  pityProgress,
  sparkProgress,
  heroBanners,
  HERO_PULL_COST_SINGLE,
  HERO_PULL_COST_TEN,
  PITY_THRESHOLD,
  SPARK_THRESHOLD,
  loadBanners,
  loadGachaStatus,
  pullHero,
  selectBanner,
  hideGachaModal,
  dismissPullResults,
} from "../../state/gacha.signals.js";
import { displayDust } from "../../state/game.signals.js";
import styles from "./GachaBannerModal.module.css";

const RARITY_COLORS: Record<string, string> = {
  common: "#6b7280",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#fbbf24",
};

const RARITY_LABELS: Record<string, string> = {
  common: "Zwykly",
  rare: "Rzadki",
  epic: "Epicki",
  legendary: "Legendarny",
};

export function GachaBannerModal() {
  const isVisible = gachaModalVisible.value;
  const banners = heroBanners.value;
  const banner = selectedBanner.value;
  const pulling = isPulling.value;
  const loading = isLoadingBanners.value;
  const error = gachaError.value;
  const results = lastPullResults.value;
  const showResults = showPullResults.value;
  const dust = displayDust.value;

  // Load data when modal opens
  useEffect(() => {
    if (isVisible) {
      loadBanners();
      loadGachaStatus();
    }
  }, [isVisible]);

  const handlePull = async (count: "single" | "ten") => {
    await pullHero(count);
  };

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      title="Przywolanie Bohaterow"
      onClose={hideGachaModal}
      class={styles.modal}
      ariaLabel="Gacha Banner Modal"
    >
      <div class={styles.container}>
        {/* Left: Banner Selection */}
        <div class={styles.bannerList}>
          <h3 class={styles.sectionTitle}>Aktywne Bannery</h3>
          {loading ? (
            <div class={styles.loading}>Ladowanie...</div>
          ) : banners.length === 0 ? (
            <div class={styles.empty}>Brak aktywnych bannerow</div>
          ) : (
            banners.map((b) => (
              <button
                key={b.id}
                class={`${styles.bannerItem} ${banner?.id === b.id ? styles.selected : ""}`}
                onClick={() => selectBanner(b)}
              >
                <div class={styles.bannerName}>{b.name}</div>
                <div class={styles.bannerMeta}>
                  x{b.rateUpMultiplier} Rate-Up
                </div>
              </button>
            ))
          )}
        </div>

        {/* Center: Banner Details & Pull */}
        <div class={styles.mainContent}>
          {banner ? (
            <>
              <div class={styles.bannerHeader}>
                <h2 class={styles.bannerTitle}>{banner.name}</h2>
                {banner.description && (
                  <p class={styles.bannerDescription}>{banner.description}</p>
                )}
              </div>

              {/* Featured Heroes */}
              <div class={styles.featuredSection}>
                <h4 class={styles.featuredTitle}>
                  Wyroznienie (x{banner.rateUpMultiplier})
                </h4>
                <div class={styles.featuredGrid}>
                  {banner.featuredItems.map((heroId) => {
                    const hero = getHeroById(heroId);
                    if (!hero) return null;
                    return (
                      <div key={heroId} class={styles.featuredHero}>
                        <HeroAvatar
                          heroId={heroId as HeroIdType}
                          tier={1}
                          size={48}
                        />
                        <div class={styles.heroName}>{hero.name}</div>
                        <div
                          class={styles.heroRarity}
                          style={{ color: RARITY_COLORS[hero.rarity] }}
                        >
                          {RARITY_LABELS[hero.rarity] || hero.rarity}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pull Buttons */}
              <div class={styles.pullSection}>
                <div class={styles.dustBalance}>
                  <DustIcon size={20} />
                  <span>{dust.toLocaleString()}</span>
                </div>

                <div class={styles.pullButtons}>
                  <Button
                    onClick={() => handlePull("single")}
                    disabled={!canAffordSinglePull.value || pulling}
                    variant="primary"
                    class={styles.pullButton}
                  >
                    <span>Przywolaj x1</span>
                    <span class={styles.pullCost}>
                      <DustIcon size={14} />
                      {HERO_PULL_COST_SINGLE}
                    </span>
                  </Button>

                  <Button
                    onClick={() => handlePull("ten")}
                    disabled={!canAffordTenPull.value || pulling}
                    variant="primary"
                    class={`${styles.pullButton} ${styles.tenPull}`}
                  >
                    <span>Przywolaj x10</span>
                    <span class={styles.pullCost}>
                      <DustIcon size={14} />
                      {HERO_PULL_COST_TEN}
                    </span>
                    <span class={styles.discount}>-10%</span>
                  </Button>
                </div>

                {pulling && (
                  <div class={styles.pullingIndicator}>Przywolywanie...</div>
                )}

                {error && <div class={styles.error}>{error}</div>}
              </div>
            </>
          ) : (
            <div class={styles.noBanner}>
              <p>Wybierz banner z listy po lewej stronie</p>
            </div>
          )}
        </div>

        {/* Right: Pity & Spark Progress */}
        <div class={styles.progressPanel}>
          <h3 class={styles.sectionTitle}>Postep</h3>

          {/* Pity Counter */}
          <div class={styles.progressItem}>
            <div class={styles.progressLabel}>
              <span>Gwarancja (Pity)</span>
              <span>
                {heroPityCount.value}/{PITY_THRESHOLD}
              </span>
            </div>
            <div class={styles.progressBar}>
              <div
                class={styles.progressFill}
                style={{ width: `${pityProgress.value}%` }}
              />
            </div>
            <div class={styles.progressHint}>
              Gwarantowany Epic+ co {PITY_THRESHOLD} przywolan
            </div>
          </div>

          {/* Spark Counter */}
          <div class={styles.progressItem}>
            <div class={styles.progressLabel}>
              <span>Iskra (Spark)</span>
              <span>
                {heroSparkCount.value}/{SPARK_THRESHOLD}
              </span>
            </div>
            <div class={styles.progressBar}>
              <div
                class={`${styles.progressFill} ${styles.sparkFill}`}
                style={{ width: `${sparkProgress.value}%` }}
              />
            </div>
            <div class={styles.progressHint}>
              Wybierz dowolnego bohatera przy {SPARK_THRESHOLD} iskrach
            </div>
            {canRedeemSpark.value && (
              <Button variant="secondary" class={styles.redeemButton}>
                Wymien Iskre
              </Button>
            )}
          </div>

          {/* Shards */}
          <div class={styles.shardsInfo}>
            <div class={styles.shardsLabel}>Odlamki</div>
            <div class={styles.shardsValue}>{heroShards.value}</div>
            <div class={styles.shardsHint}>
              100 odlamkow = 1 tier upgrade bohatera
            </div>
          </div>

          {/* Drop Rates */}
          <div class={styles.ratesInfo}>
            <h4>Szanse:</h4>
            <div class={styles.ratesList}>
              <div>
                <span style={{ color: RARITY_COLORS.common }}>Zwykly</span>: 60%
              </div>
              <div>
                <span style={{ color: RARITY_COLORS.rare }}>Rzadki</span>: 30%
              </div>
              <div>
                <span style={{ color: RARITY_COLORS.epic }}>Epicki</span>: 8%
              </div>
              <div>
                <span style={{ color: RARITY_COLORS.legendary }}>
                  Legendarny
                </span>
                : 2%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pull Results Overlay */}
      {showResults && results.length > 0 && (
        <div class={styles.resultsOverlay} onClick={dismissPullResults}>
          <div class={styles.resultsContainer}>
            <h2 class={styles.resultsTitle}>Wynik Przywolania!</h2>
            <div class={styles.resultsGrid}>
              {results.map((result, i) => (
                <div
                  key={i}
                  class={`${styles.resultCard} ${result.isNew ? styles.newHero : ""}`}
                  style={{
                    borderColor: RARITY_COLORS[result.rarity],
                    animationDelay: `${i * 0.1}s`,
                  }}
                >
                  <HeroAvatar
                    heroId={result.heroId as HeroIdType}
                    tier={1}
                    size={48}
                  />
                  <div class={styles.resultName}>{result.heroName}</div>
                  <div
                    class={styles.resultRarity}
                    style={{ color: RARITY_COLORS[result.rarity] }}
                  >
                    {RARITY_LABELS[result.rarity] || result.rarity}
                  </div>
                  {result.isNew ? (
                    <div class={styles.newBadge}>NOWY!</div>
                  ) : (
                    <div class={styles.shardsBadge}>
                      +{result.shardsGranted} odlamkow
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={dismissPullResults} variant="primary">
              Zamknij
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
