import React, { useEffect, useRef } from 'react';
import { MazeData } from '../types/game';
import { CELL_WORLD_SIZE } from '../utils/mazeGenerator';

interface MinimapProps {
  mazeRef: React.MutableRefObject<MazeData | null>;
  playerPosRef: React.MutableRefObject<{ x: number; z: number; yaw: number }>;
  expanded: boolean;
  onToggleExpand: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  mazeRef,
  playerPosRef,
  expanded,
  onToggleExpand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const compassCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;

    const draw = () => {
      // 1. Draw rotating compass above the minimap
      const compassCanvas = compassCanvasRef.current;
      if (compassCanvas) {
        const cctx = compassCanvas.getContext('2d');
        if (cctx) {
          const cw = compassCanvas.width;
          const ch = compassCanvas.height;
          cctx.clearRect(0, 0, cw, ch);

          // Convert Three.js yaw to compass bearing in degrees:
          // yaw = 0 -> North (0°), yaw = -PI/2 -> East (90°), yaw = PI -> South (180°), yaw = PI/2 -> West (270°)
          const rawDeg = ((-playerPosRef.current.yaw * 180) / Math.PI) % 360;
          const bearing = (rawDeg + 360) % 360;

          // Left mini rotating rose dial (radius 12px at x=16, y=ch/2)
          const dialX = 16;
          const dialY = ch / 2;
          const dialR = 11;

          cctx.save();
          cctx.translate(dialX, dialY);
          cctx.strokeStyle = '#334155';
          cctx.lineWidth = 1.5;
          cctx.beginPath();
          cctx.arc(0, 0, dialR, 0, Math.PI * 2);
          cctx.stroke();

          // Rotate dial needle so North arrow points relative to player's view
          cctx.rotate((-bearing * Math.PI) / 180);
          // North needle (Amber/Red)
          cctx.fillStyle = '#F59E0B';
          cctx.beginPath();
          cctx.moveTo(0, -dialR + 2);
          cctx.lineTo(3.2, 0);
          cctx.lineTo(-3.2, 0);
          cctx.closePath();
          cctx.fill();

          // South needle (Slate)
          cctx.fillStyle = '#64748B';
          cctx.beginPath();
          cctx.moveTo(0, dialR - 2);
          cctx.lineTo(3.2, 0);
          cctx.lineTo(-3.2, 0);
          cctx.closePath();
          cctx.fill();
          cctx.restore();

          // Sliding horizontal compass tape on the right side of the dial
          const tapeLeft = 34;
          const tapeRight = cw - 36;
          const tapeWidth = tapeRight - tapeLeft;
          const tapeCenterX = tapeLeft + tapeWidth / 2;
          const pxPerDeg = tapeWidth / 150; // 150 degrees visible field on the strip

          cctx.save();
          cctx.beginPath();
          cctx.rect(tapeLeft, 0, tapeWidth, ch);
          cctx.clip();

          const cardinals: Array<{ deg: number; label: string; color: string; major: boolean }> = [
            { deg: 0, label: 'С', color: '#F59E0B', major: true },
            { deg: 45, label: 'СВ', color: '#94A3B8', major: false },
            { deg: 90, label: 'В', color: '#E2E8F0', major: true },
            { deg: 135, label: 'ЮВ', color: '#94A3B8', major: false },
            { deg: 180, label: 'Ю', color: '#E2E8F0', major: true },
            { deg: 225, label: 'ЮЗ', color: '#94A3B8', major: false },
            { deg: 270, label: 'З', color: '#E2E8F0', major: true },
            { deg: 315, label: 'СЗ', color: '#94A3B8', major: false },
          ];

          // Draw minor 15-degree ticks
          cctx.strokeStyle = '#334155';
          cctx.lineWidth = 1;
          for (let deg = 0; deg < 360; deg += 15) {
            let diff = deg - bearing;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            if (Math.abs(diff) <= 80) {
              const x = tapeCenterX + diff * pxPerDeg;
              const isCardinal = deg % 45 === 0;
              cctx.beginPath();
              cctx.moveTo(x, ch - (isCardinal ? 6 : 4));
              cctx.lineTo(x, ch - 1);
              cctx.stroke();
            }
          }

          // Draw cardinal & intercardinal labels
          cctx.textAlign = 'center';
          cctx.textBaseline = 'middle';
          for (const item of cardinals) {
            let diff = item.deg - bearing;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            if (Math.abs(diff) <= 82) {
              const x = tapeCenterX + diff * pxPerDeg;
              cctx.font = item.major
                ? '700 11px "Outfit", sans-serif'
                : '500 9.5px "Plus Jakarta Sans", sans-serif';
              cctx.fillStyle = item.color;
              cctx.fillText(item.label, x, ch * 0.42);
            }
          }

          // Center fixed lubber triangle indicator
          cctx.fillStyle = '#38BDF8';
          cctx.beginPath();
          cctx.moveTo(tapeCenterX, 1);
          cctx.lineTo(tapeCenterX - 3.5, 5);
          cctx.lineTo(tapeCenterX + 3.5, 5);
          cctx.closePath();
          cctx.fill();

          cctx.restore();

          // Right numeric degree readout (tabular)
          cctx.font = '700 10px "JetBrains Mono", monospace';
          cctx.fillStyle = '#38BDF8';
          cctx.textAlign = 'right';
          cctx.textBaseline = 'middle';
          cctx.fillText(`${Math.round(bearing)}°`, cw - 4, ch / 2);
        }
      }

      // 2. Draw fog-of-war minimap
      const canvas = canvasRef.current;
      const maze = mazeRef.current;
      if (canvas && maze) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Dark slate background
          ctx.fillStyle = '#0B1120';
          ctx.fillRect(0, 0, w, h);

          const pad = 10;
          const drawSize = w - pad * 2;
          const cellPx = drawSize / maze.size;

          // Draw cells with fog-of-war
          for (let gz = 0; gz < maze.size; gz++) {
            for (let gx = 0; gx < maze.size; gx++) {
              const cx = pad + gx * cellPx;
              const cz = pad + gz * cellPx;

              if (!maze.revealed[gz][gx]) {
                // Unexplored fog
                ctx.fillStyle = '#0F172A';
                ctx.fillRect(cx, cz, cellPx + 0.5, cellPx + 0.5);
                // Subtle fog grid dot
                if ((gx + gz) % 2 === 0) {
                  ctx.fillStyle = '#1E293B';
                  ctx.fillRect(
                    cx + cellPx * 0.4,
                    cz + cellPx * 0.4,
                    Math.max(1.5, cellPx * 0.2),
                    Math.max(1.5, cellPx * 0.2)
                  );
                }
              } else if (maze.grid[gz][gx] === 1) {
                // Discovered Wall block
                ctx.fillStyle = '#475569';
                ctx.fillRect(cx + 0.5, cz + 0.5, cellPx - 1, cellPx - 1);
              } else {
                // Discovered Open Corridor
                ctx.fillStyle = '#1E293B';
                ctx.fillRect(cx, cz, cellPx + 0.4, cellPx + 0.4);
              }
            }
          }

          // Draw Start marker if revealed
          if (maze.revealed[maze.startCell.z][maze.startCell.x]) {
            const sx = pad + (maze.startCell.x + 0.5) * cellPx;
            const sz = pad + (maze.startCell.z + 0.5) * cellPx;
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(sx, sz, Math.max(3, cellPx * 0.28), 0, Math.PI * 2);
            ctx.stroke();
          }

          // Draw Collectibles in revealed cells
          for (const item of maze.collectibles) {
            if (item.collected) continue;
            if (maze.revealed[item.gridZ]?.[item.gridX]) {
              const ix = pad + (item.gridX + 0.5) * cellPx;
              const iz = pad + (item.gridZ + 0.5) * cellPx;

              ctx.save();
              ctx.translate(ix, iz);
              ctx.rotate(Math.PI / 4);
              ctx.fillStyle = '#FBBF24';
              const r = Math.max(3.5, cellPx * 0.32);
              ctx.fillRect(-r / 2, -r / 2, r, r);
              ctx.restore();
            }
          }

          // Draw Exit Portal if revealed
          if (maze.revealed[maze.exitCell.z]?.[maze.exitCell.x]) {
            const ex = pad + (maze.exitCell.x + 0.5) * cellPx;
            const ez = pad + (maze.exitCell.z + 0.5) * cellPx;
            ctx.fillStyle = '#10B981';
            ctx.beginPath();
            ctx.arc(ex, ez, Math.max(4.5, cellPx * 0.38), 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#A7F3D0';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Draw Player position and view cone
          const halfWorld = (maze.size * CELL_WORLD_SIZE) / 2;
          const normX = (playerPosRef.current.x + halfWorld) / (maze.size * CELL_WORLD_SIZE);
          const normZ = (playerPosRef.current.z + halfWorld) / (maze.size * CELL_WORLD_SIZE);

          const px = pad + normX * drawSize;
          const pz = pad + normZ * drawSize;
          // Three.js camera forward with rotation.y = yaw looks along (-sin(yaw), -cos(yaw))
          const headingAngle = Math.atan2(
            -Math.cos(playerPosRef.current.yaw),
            -Math.sin(playerPosRef.current.yaw)
          );

          // View cone wedge
          ctx.save();
          ctx.translate(px, pz);
          ctx.rotate(headingAngle);

          const coneGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, cellPx * 2.4);
          coneGrad.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
          coneGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, cellPx * 2.4, -0.48, 0.48);
          ctx.closePath();
          ctx.fill();

          // Player directional arrow
          const arrowSize = Math.max(5, cellPx * 0.45);
          ctx.fillStyle = '#F8FAFC';
          ctx.beginPath();
          ctx.moveTo(arrowSize, 0);
          ctx.lineTo(-arrowSize * 0.7, -arrowSize * 0.65);
          ctx.lineTo(-arrowSize * 0.35, 0);
          ctx.lineTo(-arrowSize * 0.7, arrowSize * 0.65);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [mazeRef, playerPosRef, expanded]);

  const pixelSize = expanded ? 280 : 184;

  return (
    <div className="pointer-events-auto flex flex-col items-end">
      <div className="bg-[#0F172A]/95 border border-slate-700/80 rounded-xl p-2.5 shadow-2xl">
        {/* Rotating Compass Strip directly above the Minimap */}
        <div className="mb-2 bg-[#0B1120] border border-slate-800 rounded-lg px-1 py-0.5">
          <canvas
            ref={compassCanvasRef}
            width={pixelSize - 8}
            height={28}
            className="block"
          />
        </div>

        <div className="flex items-center justify-between gap-3 mb-1.5 px-1">
          <span className="text-xs font-medium text-slate-300 tracking-wide">
            Карта коридоров
          </span>
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-[11px] font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer whitespace-nowrap"
            title="Переключить размер карты (Tab / M)"
          >
            {expanded ? 'Свернуть [M]' : 'Крупнее [M]'}
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={pixelSize}
          height={pixelSize}
          className="rounded-lg border border-slate-800 block"
        />

        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-1">
          <span>Игрок</span>
          <span>·</span>
          <span className="text-amber-400">Реликвия</span>
          <span>·</span>
          <span className="text-emerald-400">Выход</span>
        </div>
      </div>
    </div>
  );
};
