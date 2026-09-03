import type { PipDrawingContext } from '../pipVectorRecorder';

// Source-faithful port of Hanabi-Live drawPipFunctions.ts @ 054e859b...
export function drawKatakanaHe(ctx: PipDrawingContext): void {
  ctx.translate(-90, -85);
  ctx.scale(0.7, 0.7);
  ctx.beginPath();
  ctx.moveTo(68, 165);
  ctx.lineTo(52, 152);
  ctx.quadraticCurveTo(70, 100, 85, 45);
  ctx.quadraticCurveTo(160, 60, 228, 198);
  ctx.quadraticCurveTo(170, 150, 115, 92);
  ctx.quadraticCurveTo(90, 130, 68, 165);
  ctx.closePath();
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'black';
  ctx.stroke();
}
