import { describe, expect, test } from '@jest/globals';
import { measureNavigation, measureSurface, measureWindow, SURFACE_METRICS, type WindowClass, type WindowSize } from './responsiveSurface';

const none = { top: 0, right: 0, bottom: 0, left: 0 };

describe('window classification', () => {
  test.each<[WindowSize, WindowClass]>([
    [{ width: 390, height: 844 }, 'compact'],
    [{ width: 844, height: 390 }, 'short-wide'],
    [{ width: 700, height: 550 }, 'short-wide'],
    [{ width: 390, height: 700 }, 'compact'],
    [{ width: 700, height: 700 }, 'medium'],
    [{ width: 840, height: 600 }, 'large'],
    [{ width: 599, height: 600 }, 'compact'],
    [{ width: 600, height: 600 }, 'medium'],
    [{ width: 839, height: 600 }, 'medium'],
    [{ width: 840, height: 599 }, 'short-wide'],
    [{ width: 600, height: 501 }, 'medium'],
    [{ width: 600, height: 500 }, 'short-wide'],
    [{ width: 500, height: 479 }, 'short-wide'],
    [{ width: 500, height: 480 }, 'compact'],
  ])('%j is %s', (size, expected) => {
    expect(measureWindow(size, none).windowClass).toBe(expected);
  });

  test('safe insets affect available geometry; IME affects only the task surface', () => {
    const rawWindow = { width: 860, height: 660 };
    const systemInsets = { top: 24, right: 12, bottom: 40, left: 12 };
    const normal = measureWindow(rawWindow, systemInsets);
    const typing = measureWindow(rawWindow, systemInsets, 270);
    expect(normal).toMatchObject({ availableWidth: 836, availableHeight: 596, windowClass: 'short-wide', surfaceHeight: 596 });
    expect(typing).toMatchObject({ availableWidth: 836, availableHeight: 596, windowClass: 'short-wide', surfaceHeight: 326, imeOcclusion: 270 });
  });
});

describe('surface envelopes', () => {
  test.each([
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ])('keeps compact and short-wide content bounded in %j', (rawWindow) => {
    const window = measureWindow(rawWindow, { top: 24, right: 0, bottom: 24, left: 0 });
    const nav = measureNavigation('bottom', 60, 48);
    const browsing = measureSurface(window, 'browsing', nav.height);
    const sheet = measureSurface(window, 'sheet');
    expect(browsing.contentWidth).toBeGreaterThan(0);
    expect(browsing.contentWidth).toBeLessThanOrEqual(window.availableWidth - 2 * SURFACE_METRICS.outerGutter);
    expect(browsing.contentHeight).toBeGreaterThan(0);
    expect(browsing.contentHeight).toBeLessThan(window.surfaceHeight);
    expect(sheet.contentHeight).toBeGreaterThan(0);
    expect(sheet.contentHeight).toBeLessThanOrEqual(window.surfaceHeight);
    if (window.windowClass === 'short-wide') expect(sheet.presentation).toBe('full-height');
  });

  test('navigation grows with labels and rail reports when labels need another presentation', () => {
    expect(measureNavigation('bottom', 80, 60).height).toBeGreaterThan(SURFACE_METRICS.bottomNavNominalHeight);
    expect(measureNavigation('rail', 80, 20)).toEqual({ width: 96, labelFits: true });
    expect(measureNavigation('rail', 100, 20)).toEqual({ width: 96, labelFits: false });
    const window = measureWindow({ width: 900, height: 700 }, none);
    expect(measureSurface(window, 'browsing', 0, 96).contentWidth)
      .toBeLessThan(measureSurface(window, 'browsing').contentWidth);
  });

  test('caps content and never returns negative geometry under extreme occlusion', () => {
    const window = measureWindow({ width: 1600, height: 900 }, none, 2000);
    expect(measureSurface(window, 'task')).toMatchObject({ contentWidth: 560, contentHeight: 0 });
    expect(measureSurface(window, 'browsing', 100)).toMatchObject({ contentWidth: 1280, contentHeight: 0 });
  });
});
