import type { PipDrawingContext } from '../pipVectorRecorder';

// Source-faithful port of Hanabi-Live drawPipFunctions.ts @ 054e859b...
export function drawTriangle(ctx: PipDrawingContext): void {
  ctx.scale(150 / 42, 150 / 42);
  ctx.beginPath();
  ctx.transform(1, 0, 0, 1, 16.9774, -22.3191);
  ctx.moveTo(-16.977_913, 37.727_61);
  ctx.lineTo(-34.930_431, 6.631_814);
  ctx.lineTo(0.975_572, 6.632_296);
  ctx.closePath();
  ctx.moveTo(-16.997_733, 26.070_432);
  ctx.lineTo(-9.120_09, 12.425_835);
  ctx.lineTo(-24.875_376, 12.425_835);
  ctx.closePath();
  ctx.transform(1, 0, 0, 1, -16.9774, 22.3191);
  ctx.scale(42 / 150, 42 / 150);
}
