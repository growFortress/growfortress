/**
 * EnergyBurst - GSAP-powered upgrade animation
 * Creates an explosive particle effect when upgrading buildings
 */
import { useEffect, useRef } from 'preact/hooks';
import gsap from 'gsap';
import styles from './effects.module.css';

interface EnergyBurstProps {
  trigger: boolean;
  onComplete?: () => void;
}

export function EnergyBurst({ trigger, onComplete }: EnergyBurstProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trigger && containerRef.current) {
      const container = containerRef.current;
      const particle = container.querySelector(`.${styles.burstParticle}`);
      const ring = container.querySelector(`.${styles.burstRing}`);
      const flash = container.querySelector(`.${styles.burstFlash}`);

      if (!particle || !ring || !flash) return;

      const tl = gsap.timeline({
        onComplete: () => {
          onComplete?.();
        },
      });

      // Flash effect
      tl.fromTo(
        flash,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.1, ease: 'power2.out' }
      );
      tl.to(flash, { opacity: 0, scale: 1.5, duration: 0.3, ease: 'power2.out' }, '-=0.05');

      // Ring expansion
      tl.fromTo(
        ring,
        { opacity: 1, scale: 0 },
        { opacity: 0, scale: 5, duration: 0.5, ease: 'power2.out' },
        '-=0.3'
      );

      // Particle burst (create multiple particles dynamically)
      const particleCount = 8;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = 50 + Math.random() * 30;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        const clone = particle.cloneNode(true) as HTMLElement;
        container.appendChild(clone);

        tl.fromTo(
          clone,
          { opacity: 1, scale: 1, x: 0, y: 0 },
          {
            opacity: 0,
            scale: 0.5,
            x,
            y,
            duration: 0.4 + Math.random() * 0.2,
            ease: 'power2.out',
            onComplete: () => clone.remove(),
          },
          '-=0.4'
        );
      }
    }
  }, [trigger, onComplete]);

  return (
    <div ref={containerRef} className={styles.burst}>
      <div className={styles.burstParticle} />
      <div className={styles.burstRing} />
      <div className={styles.burstFlash} />
    </div>
  );
}
