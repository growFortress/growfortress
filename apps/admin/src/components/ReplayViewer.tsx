import { useEffect, useRef, useState } from 'preact/hooks';
import { Simulation, createClientSimulation, FP } from '@arcade/sim-core';

interface ReplayViewerProps {
  seed: number;
  config: any;
  events: any[];
}

export function ReplayViewer({ seed, config, events }: ReplayViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation | null>(null);
  const [currentTick, setCurrentTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [maxTicks, setMaxTicks] = useState(0);
  const requestRef = useRef<number>();

  useEffect(() => {
    // Initialize simulation
    const sim = createClientSimulation(seed, config);
    sim.setEvents(events);
    simRef.current = sim;

    // Find max tick from events or reasonably high number
    const lastEventTick = events.length > 0 ? events[events.length - 1].tick : 0;
    setMaxTicks(Math.max(lastEventTick + 300, 3000)); // Buffer
  }, [seed, config, events]);

  const step = () => {
    if (!simRef.current || !isPlaying) return;

    // Run as many steps as needed for playback speed
    // e.g. if we are at 60fps and tickHz is 30, speed 1 means 0.5 ticks per frame
    // For simplicity, let's do N steps per frame based on speed
    for (let i = 0; i < playbackSpeed; i++) {
        if (!simRef.current.state.ended) {
            simRef.current.step();
        }
    }

    setCurrentTick(simRef.current.state.tick);
    render();
    requestRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(step);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      render(); // Final render when paused
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas || !simRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = simRef.current.state;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = 2; // Arbitrary scale to fit simulation coordinates to pixels

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Fortress
    ctx.fillStyle = '#3b82f6';
    const fsize = 40;
    ctx.fillRect(centerX - fsize/2, centerY - fsize/2, fsize, fsize);
    
    // HP Bar Fortress
    const hpPercent = state.fortressHp / state.fortressMaxHp;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(centerX - fsize/2, centerY - fsize/2 - 10, fsize, 5);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(centerX - fsize/2, centerY - fsize/2 - 10, fsize * hpPercent, 5);

    // Enemies
    ctx.fillStyle = '#f87171';
    state.enemies.forEach(enemy => {
        const ex = FP.toFloat(enemy.x);
        const ey = FP.toFloat(enemy.y);
        ctx.beginPath();
        ctx.arc(centerX + ex * scale, centerY + ey * scale, 8, 0, Math.PI * 2);
        ctx.fill();
    });

    // Projectiles
    ctx.fillStyle = '#facc15';
    state.projectiles.forEach(p => {
        const px = FP.toFloat(p.x);
        const py = FP.toFloat(p.y);
        ctx.beginPath();
        ctx.arc(centerX + px * scale, centerY + py * scale, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // Turrets
    ctx.fillStyle = '#94a3b8';
    state.turrets.forEach(t => {
        // Turrets have slotIndex, we need to find the slot position
        const slot = config.turretSlots.find((s: any) => s.index === t.slotIndex);
        if (slot) {
            const tx = FP.toFloat(slot.x);
            const ty = FP.toFloat(slot.y);
            ctx.fillRect(centerX + tx * scale - 10, centerY + ty * scale - 10, 20, 20);
        }
    });

    // Stats Overlay
    ctx.fillStyle = 'white';
    ctx.font = '14px monospace';
    ctx.fillText(`Wave: ${state.wave+1}`, 10, 20);
    ctx.fillText(`Enemies: ${state.enemies.length}`, 10, 40);
    ctx.fillText(`Gold: ${state.gold}`, 10, 60);
    ctx.fillText(`Tick: ${state.tick}`, 10, 80);
    if (state.won) ctx.fillText('VICTORY!', width/2 - 30, height/2 - 50);
    if (state.ended && !state.won) ctx.fillText('GAME OVER', width/2 - 40, height/2 - 50);
  };

  const handleSeek = (e: any) => {
    const targetTick = parseInt(e.currentTarget.value);
    resetAndFastForward(targetTick);
  };

  const resetAndFastForward = (tick: number) => {
    const sim = createClientSimulation(seed, config);
    sim.setEvents(events);
    // Fast forward
    while (sim.state.tick < tick && !sim.state.ended) {
        sim.step();
    }
    simRef.current = sim;
    setCurrentTick(sim.state.tick);
    render();
  };

  return (
    <div class="bg-gray-900 p-4 rounded-lg">
      <div class="relative">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={600} 
          class="w-full h-auto bg-black rounded border border-gray-700 shadow-2xl"
        />
      </div>
      
      <div class="mt-4 space-y-4">
        {/* Timeline */}
        <div class="flex items-center gap-4">
          <span class="text-xs text-gray-400 w-12">{currentTick}</span>
          <input 
            type="range" 
            min="0" 
            max={maxTicks} 
            value={currentTick} 
            onInput={handleSeek}
            class="flex-1 accent-indigo-500 mr-1 ml-1"
          />
          <span class="text-xs text-gray-400 w-12">{maxTicks}</span>
        </div>

        {/* Controls */}
        <div class="flex justify-between items-center">
          <div class="flex gap-2">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-md font-medium transition-colors"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button 
              onClick={() => resetAndFastForward(0)}
              class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Restart
            </button>
          </div>

          <div class="flex items-center gap-2">
            <label class="text-xs text-gray-400 uppercase tracking-wider">Speed:</label>
            <select 
              value={playbackSpeed} 
              onChange={(e) => setPlaybackSpeed(parseFloat(e.currentTarget.value))}
              class="bg-gray-800 text-white border border-gray-700 rounded p-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
              <option value="8">8x</option>
              <option value="16">16x</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
