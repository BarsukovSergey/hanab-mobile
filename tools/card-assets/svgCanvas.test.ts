import { describe, expect, it } from '@jest/globals';
import { createSvgCardRendererBackend, SvgCanvasContext } from './svgCanvas';

function renderGradient(): string {
  const ctx = new SvgCanvasContext(100, 120);
  const gradient = ctx.createLinearGradient(0, 0, 100, 120);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 100, 120);
  return ctx.toSvg();
}

describe('SvgCanvasContext', () => {
  it('uses deterministic gradient identifiers', () => {
    const first = renderGradient();
    const second = renderGradient();

    expect(first).toBe(second);
    expect(first).toContain('id="g0"');
    expect(first).toContain('fill="url(#g0)"');
  });

  it('applies transforms when path commands are recorded', () => {
    const ctx = new SvgCanvasContext(100, 100);
    ctx.beginPath();
    ctx.scale(2, 2);
    ctx.moveTo(1, 1);
    ctx.scale(0.5, 0.5);
    ctx.lineTo(3, 3);
    ctx.stroke();

    const svg = ctx.toSvg();
    expect(svg).toContain('d="M 2 2 L 3 3"');
  });

  it('clones the current drawing instead of sharing later mutations', () => {
    const backend = createSvgCardRendererBackend(50, 50);
    const { cvs, ctx } = backend.createCanvas();
    (ctx as unknown as SvgCanvasContext).fillRect(0, 0, 10, 10);

    const cloned = backend.cloneCanvas(cvs, ctx);
    (ctx as unknown as SvgCanvasContext).fillRect(20, 20, 10, 10);
    const saved = backend.saveCanvas(cvs, ctx);

    expect(saved).not.toBe(cloned);
    expect(cloned).not.toContain('20 20');
  });
});