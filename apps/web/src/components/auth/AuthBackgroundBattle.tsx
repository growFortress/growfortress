import { useEffect, useRef } from 'preact/hooks';
import { Application, Container, Graphics, BlurFilter } from 'pixi.js';

interface AuthBackgroundBattleProps {
  className?: string;
}

// Hero/enemy representation with actual game models
interface BattleEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colors: { primary: number; secondary: number; accent: number };
  size: number;
  isHero: boolean;
  heroId?: string; // For hero shape types
  enemyColor?: number; // For enemy colors
  graphics: Graphics;
  attackCooldown: number;
  health: number;
  maxHealth: number;
}

// Hero models from game (6 heroes)
const HERO_MODELS = [
  { id: 'storm', colors: { primary: 0x9932cc, secondary: 0xdda0dd, accent: 0xffff00 } },
  { id: 'forge', colors: { primary: 0x00f0ff, secondary: 0xff00aa, accent: 0xccff00 } },
  { id: 'titan', colors: { primary: 0x228b22, secondary: 0x8fbc8f, accent: 0x98fb98 } },
  { id: 'vanguard', colors: { primary: 0x228b22, secondary: 0x8fbc8f, accent: 0x98fb98 } },
  { id: 'rift', colors: { primary: 0xff4500, secondary: 0xff8c00, accent: 0xffd700 } },
  { id: 'frost_unit', colors: { primary: 0x00bfff, secondary: 0xe0ffff, accent: 0x87ceeb } },
];

// Enemy models from different pillars (8 enemies)
const ENEMY_MODELS = [
  { type: 'robot', color: 0x00ccff },        // Science
  { type: 'demon', color: 0xff0066 },        // Magic
  { type: 'kree_soldier', color: 0x3366ff }, // Cosmos
  { type: 'sentinel', color: 0xff6600 },     // Mutants
  { type: 'einherjar', color: 0xffcc00 },    // Gods
  { type: 'gangster', color: 0x888888 },     // Streets
  { type: 'sorcerer', color: 0xcc00ff },     // Magic
  { type: 'cosmic_beast', color: 0x9900cc }, // Cosmos
];

export function AuthBackgroundBattle({ className }: AuthBackgroundBattleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const entitiesRef = useRef<BattleEntity[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let destroyed = false;
    let initialized = false;
    const app = new Application();
    appRef.current = app;
    const destroyApp = (target: Application | null | undefined) => {
      if (!target || !initialized || typeof target.destroy !== 'function') return;
      target.destroy(true, { children: true, texture: true });
    };

    const initBattle = async () => {
      if (destroyed || !canvasRef.current) return;

      try {
        const parent = canvasRef.current.parentElement;
        if (!parent) return;

        await app.init({
          canvas: canvasRef.current,
          width: parent.clientWidth,
          height: parent.clientHeight,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        initialized = true;

        if (destroyed || appRef.current !== app) {
          destroyApp(app);
          return;
        }

        // Create main container with blur filter for depth effect
        const battleContainer = new Container();
        const blurFilter = new BlurFilter({
          strength: 2, // Reduced from 4
          quality: 2,
        });
        battleContainer.filters = [blurFilter];
        battleContainer.alpha = 0.35; // Moderate opacity
        app.stage.addChild(battleContainer);

        // Create entities
        const entities: BattleEntity[] = [];
        const width = app.screen.width;
        const height = app.screen.height;

        // Heroes (left side) - 6 heroes from game
        for (let i = 0; i < 6; i++) {
          const heroModel = HERO_MODELS[i];
          const graphics = new Graphics();
          const entity: BattleEntity = {
            x: width * 0.15 + (i % 3) * 70,
            y: height * 0.3 + Math.floor(i / 3) * 100,
            vx: 0.4, // Faster movement (60% slowdown instead of 70%)
            vy: Math.sin(i) * 0.15,
            colors: heroModel.colors,
            size: 28 + (i % 2) * 4,
            isHero: true,
            heroId: heroModel.id,
            graphics,
            attackCooldown: 0,
            health: 100,
            maxHealth: 100,
          };
          
          battleContainer.addChild(graphics);
          entities.push(entity);
        }

        // Enemies (right side) - 8 enemies from different pillars
        for (let i = 0; i < 8; i++) {
          const enemyModel = ENEMY_MODELS[i];
          const graphics = new Graphics();
          const entity: BattleEntity = {
            x: width * 0.75 - (i % 4) * 55,
            y: height * 0.25 + Math.floor(i / 4) * 90,
            vx: -0.35, // Faster movement
            vy: Math.cos(i) * 0.12,
            colors: { primary: enemyModel.color, secondary: enemyModel.color, accent: enemyModel.color },
            size: 22 + (i % 3) * 3,
            isHero: false,
            enemyColor: enemyModel.color,
            graphics,
            attackCooldown: 0,
            health: 100,
            maxHealth: 100,
          };
          
          battleContainer.addChild(graphics);
          entities.push(entity);
        }

        entitiesRef.current = entities;

        // Animation loop - 60% slowdown (deltaTime * 0.4)
        let lastTime = performance.now();
        const animate = (currentTime: number) => {
          if (destroyed) return;

          const deltaTime = (currentTime - lastTime) * 0.4; // 60% slowdown
          lastTime = currentTime;

          const width = app.screen.width;
          const height = app.screen.height;
          const time = currentTime * 0.001; // Convert to seconds

          entities.forEach((entity) => {
            // Slow motion movement
            entity.x += entity.vx * (deltaTime / 16);
            entity.y += entity.vy * (deltaTime / 16);

            // Bounce off edges with some margin
            if (entity.x < width * 0.1 || entity.x > width * 0.9) {
              entity.vx *= -1;
            }
            if (entity.y < height * 0.15 || entity.y > height * 0.85) {
              entity.vy *= -1;
            }

            // Attack cooldown
            entity.attackCooldown = Math.max(0, entity.attackCooldown - deltaTime);

            // Simple attack logic - create projectile effect
            if (entity.attackCooldown === 0) {
              const closestEnemy = entities.find(e => e.isHero !== entity.isHero);
              if (closestEnemy) {
                const dx = closestEnemy.x - entity.x;
                const dy = closestEnemy.y - entity.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 350) {
                  // Create attack visual
                  createAttackEffect(battleContainer, entity, closestEnemy);
                  entity.attackCooldown = 1800 + Math.random() * 1200; // Random cooldown
                }
              }
            }

            // Render entity with actual game models
            renderEntity(entity, time);
          });

          animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);
      } catch (e) {
        destroyApp(app);
        if (appRef.current === app) {
          appRef.current = null;
        }
        console.warn('Failed to initialize AuthBackgroundBattle:', e);
      }
    };

    initBattle();

    // Cleanup
    return () => {
      destroyed = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      const currentApp = appRef.current;
      appRef.current = null;
      destroyApp(currentApp);
      entitiesRef.current = [];
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      class={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

// Render entity with actual game models
function renderEntity(entity: BattleEntity, time: number) {
  const g = entity.graphics;
  g.clear();

  // Shadow
  const shadowOffsetY = entity.size * 0.7;
  const shadowWidth = entity.size * 0.6;
  const shadowHeight = entity.size * 0.2;
  g.ellipse(0, shadowOffsetY, shadowWidth, shadowHeight)
    .fill({ color: 0x000000, alpha: 0.3 });

  if (entity.isHero) {
    // Render hero with actual shape from game
    drawHeroShape(g, entity.heroId!, entity.size, entity.colors, time);
  } else {
    // Render enemy (hexagon shape for all enemies)
    drawEnemyShape(g, entity.size, entity.enemyColor!);
  }

  // Position
  g.position.set(entity.x, entity.y);
}

// Hero shape type mapping
type HeroShapeType = 'hexagon' | 'diamond' | 'octagonGear' | 'lightning' | 'frost' | 'voidPortal' | 'circle';

const HERO_SHAPE_MAP: Record<string, HeroShapeType> = {
  storm: 'lightning',
  forge: 'octagonGear',
  titan: 'voidPortal',
  vanguard: 'hexagon',
  rift: 'diamond',
  frost_unit: 'frost',
};

// Hero shape rendering (simplified from HeroSystem.ts)
function drawHeroShape(g: Graphics, heroId: string, size: number, colors: { primary: number; secondary: number; accent: number }, time: number) {
  const bodySize = size * 0.85;
  const shapeType = HERO_SHAPE_MAP[heroId] || 'circle';

  switch (shapeType) {
    case 'hexagon':
      drawHexagon(g, bodySize, colors);
      break;
    case 'diamond':
      drawDiamond(g, bodySize, colors, time);
      break;
    case 'octagonGear':
      drawOctagonGear(g, bodySize, colors, time);
      break;
    case 'lightning':
      drawLightningShape(g, bodySize, colors, time);
      break;
    case 'frost':
      drawFrostShape(g, bodySize, colors, time);
      break;
    case 'voidPortal':
      drawVoidPortal(g, bodySize, colors, time);
      break;
    default:
      g.circle(0, 0, bodySize)
        .fill({ color: colors.primary })
        .stroke({ width: 3, color: colors.secondary });
  }
}

function drawHexagon(g: Graphics, size: number, colors: { primary: number; secondary: number; accent: number }) {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    points.push(Math.cos(angle) * size, Math.sin(angle) * size);
  }
  g.poly(points).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });
  
  // Inner highlight
  const innerPoints: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    innerPoints.push(Math.cos(angle) * size * 0.6, Math.sin(angle) * size * 0.6);
  }
  g.poly(innerPoints).fill({ color: colors.secondary, alpha: 0.15 });
}

function drawDiamond(g: Graphics, size: number, colors: { primary: number; secondary: number; accent: number }, time: number) {
  const stretch = 1.2;
  const points = [0, -size * stretch, size, 0, 0, size * stretch, -size, 0];
  g.poly(points).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });
  
  // Inner crystal facets
  const facetAlpha = 0.4 + Math.sin(time * 4) * 0.1;
  g.moveTo(0, -size * stretch * 0.7).lineTo(size * 0.5, 0).lineTo(0, size * stretch * 0.7);
  g.stroke({ width: 1, color: 0xffffff, alpha: facetAlpha });
}

function drawOctagonGear(g: Graphics, size: number, colors: { primary: number; secondary: number; accent: number }, time: number) {
  const points: number[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 + time * 0.5;
    const r = i % 2 === 0 ? size : size * 0.85;
    points.push(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  g.poly(points).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });
  
  // Rotating inner gear
  for (let i = 0; i < 4; i++) {
    const angle = time * -1 + (i * Math.PI) / 2;
    g.moveTo(0, 0)
      .lineTo(Math.cos(angle) * size * 0.6, Math.sin(angle) * size * 0.6)
      .stroke({ width: 2, color: colors.accent, alpha: 0.6 });
  }
}

function drawLightningShape(g: Graphics, size: number, colors: { primary: number; secondary: number; accent: number }, time: number) {
  g.circle(0, 0, size).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });
  
  // Lightning bolt
  const boltAlpha = 0.7 + Math.sin(time * 10) * 0.2;
  const boltScale = size * 0.5;
  g.moveTo(0, -boltScale)
    .lineTo(-boltScale * 0.3, 0)
    .lineTo(boltScale * 0.2, 0)
    .lineTo(0, boltScale)
    .stroke({ width: 3, color: colors.accent, alpha: boltAlpha });
}

function drawFrostShape(g: Graphics, size: number, colors: { primary: number; secondary: number; accent: number }, time: number) {
  g.circle(0, 0, size).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });
  
  // Snowflake arms
  const armCount = 6;
  const armAlpha = 0.6 + Math.sin(time * 3) * 0.1;
  for (let i = 0; i < armCount; i++) {
    const angle = (i * Math.PI * 2) / armCount;
    const armLength = size * 0.7;
    const endX = Math.cos(angle) * armLength;
    const endY = Math.sin(angle) * armLength;
    g.moveTo(0, 0).lineTo(endX, endY).stroke({ width: 2, color: colors.accent, alpha: armAlpha });
  }
}

function drawVoidPortal(g: Graphics, size: number, colors: { primary: number; secondary: number; accent: number }, time: number) {
  // Outer hexagon
  const outerPoints: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    outerPoints.push(Math.cos(angle) * size, Math.sin(angle) * size);
  }
  g.poly(outerPoints).fill({ color: colors.primary }).stroke({ width: 3, color: colors.secondary });
  
  // Dark core
  g.circle(0, 0, size * 0.4).fill({ color: 0x0a0014, alpha: 0.9 });
  
  // Swirling particles
  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const baseAngle = (i * Math.PI * 2) / particleCount + time * 1.5;
    const spiralProgress = ((time * 0.8 + i * 0.3) % 1);
    const radius = size * (0.8 - spiralProgress * 0.5);
    const angle = baseAngle + spiralProgress * Math.PI;
    
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    const particleAlpha = 0.3 + (1 - spiralProgress) * 0.5;
    
    g.circle(px, py, 2).fill({ color: colors.accent, alpha: particleAlpha });
  }
}

// Enemy shape rendering (hexagon for all)
function drawEnemyShape(g: Graphics, size: number, color: number) {
  // Hexagon shape for enemies
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    points.push(Math.cos(angle) * size, Math.sin(angle) * size);
  }
  
  g.poly(points).fill({ color, alpha: 0.85 });
  
  // Inner detail
  g.circle(0, 0, size * 0.3).fill({ color: 0x000000, alpha: 0.4 });
}

// Create attack effect between entities
function createAttackEffect(container: Container, from: BattleEntity, to: BattleEntity) {
  const projectile = new Graphics();
  const color = from.isHero ? from.colors.primary : from.enemyColor!;
  
  projectile.circle(0, 0, 4)
    .fill({ color, alpha: 0.8 });
  
  projectile.position.set(from.x, from.y);
  container.addChild(projectile);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const duration = dist * 2; // Slow projectile
  
  let elapsed = 0;
  const animate = () => {
    elapsed += 16;
    const progress = Math.min(1, elapsed / duration);
    
    projectile.position.x = from.x + dx * progress;
    projectile.position.y = from.y + dy * progress;
    projectile.alpha = 0.8 * (1 - progress);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Hit effect
      const hitEffect = new Graphics();
      hitEffect.circle(0, 0, 15)
        .fill({ color, alpha: 0.6 });
      hitEffect.position.set(to.x, to.y);
      container.addChild(hitEffect);
      
      // Fade out hit effect
      let hitElapsed = 0;
      const fadeOut = () => {
        hitElapsed += 16;
        const fadeProgress = hitElapsed / 300;
        hitEffect.scale.set(1 + fadeProgress * 2);
        hitEffect.alpha = 0.6 * (1 - fadeProgress);
        
        if (fadeProgress < 1) {
          requestAnimationFrame(fadeOut);
        } else {
          container.removeChild(hitEffect);
        }
      };
      requestAnimationFrame(fadeOut);
      
      container.removeChild(projectile);
    }
  };
  
  requestAnimationFrame(animate);
}
