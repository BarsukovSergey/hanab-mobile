import { describe, expect, test } from '@jest/globals';
import { legacyResponsiveHints, measureNavigation, measureSurface, measureWindow, reconcileWindow, SURFACE_METRICS, type WindowClass, type WindowSize } from './responsiveSurface';

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

  test.each([
    [{ width: 600, height: 600 }, 'medium', false, false, 720],
    [{ width: 700, height: 700 }, 'medium', false, false, 720],
    [{ width: 620, height: 610 }, 'medium', true, false, 1080],
    [{ width: 760, height: 760 }, 'medium', true, false, 1080],
    [{ width: 900, height: 700 }, 'large', true, true, 1280],
    [{ width: 900, height: 500 }, 'short-wide', false, false, 720],
  ] as [WindowSize, WindowClass, boolean, boolean, number][])(
    'preserves legacy hints for %j in %s', (size, windowClass, wide, tablet, contentMaxWidth) => {
      expect(legacyResponsiveHints(size, windowClass)).toEqual({ wide, tablet, contentMaxWidth });
    },
  );

  test('holds the unoccluded class across frame resize before keyboardDidShow and through hide', () => {
    const normal = measureWindow({ width: 700, height: 700 }, none);
    const reduced = measureWindow({ width: 700, height: 400 }, none);
    const initial = reconcileWindow(null, normal, 0);
    const beforeEvent = reconcileWindow(initial.baseline, reduced, 0);
    expect(beforeEvent).toMatchObject({ pendingHeightResize: true, geometry: { windowClass: 'medium', surfaceHeight: 400 } });
    const typing = reconcileWindow(beforeEvent.baseline, reduced, 300);
    expect(typing).toMatchObject({ pendingHeightResize: false, geometry: { windowClass: 'medium', imeOcclusion: 300, surfaceHeight: 400 } });
    const resizedWhileTyping = reconcileWindow(typing.baseline, measureWindow({ width: 700, height: 150 }, none), 300);
    expect(resizedWhileTyping.geometry.windowClass).toBe('short-wide');
    const rotatedWhileTyping = reconcileWindow(typing.baseline, measureWindow({ width: 900, height: 400 }, none), 300);
    expect(rotatedWhileTyping.geometry.windowClass).toBe('large');
    const hiding = reconcileWindow(typing.baseline, reduced, 0);
    expect(hiding.geometry.windowClass).toBe('medium');
    const restored = reconcileWindow(hiding.baseline, normal, 0);
    expect(restored).toMatchObject({ pendingHeightResize: false, geometry: { windowClass: 'medium', surfaceHeight: 700 } });
    expect(reconcileWindow(restored.baseline, reduced, 0, true).geometry.windowClass).toBe('short-wide');
    expect(reconcileWindow(restored.baseline, measureWindow({ width: 900, height: 700 }, none), 0).geometry.windowClass).toBe('large');
  });
});

describe('surface envelopes', () => {
  test.each([
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ])('keeps compact and short-wide content bounded in %j', (rawWindow) => {
    const window = measureWindow(rawWindow, { top: 24, right: 0, bottom: 24, left: 0 });
    const nav = measureNavigation('bottom', 60, 48, window.availableWidth);
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
    expect(measureNavigation('bottom', 80, 60, 400).height).toBeGreaterThan(SURFACE_METRICS.bottomNavNominalHeight);
    expect(measureNavigation('bottom', 64, 20, 400).presentation).toBe('one-row');
    expect(measureNavigation('bottom', 110, 20, 400).presentation).toBe('two-row');
    expect(measureNavigation('bottom', 110, 20, 400).height).toBeGreaterThan(measureNavigation('bottom', 64, 20, 400).height);
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
