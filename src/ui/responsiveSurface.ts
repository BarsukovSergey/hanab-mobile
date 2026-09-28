export type WindowClass = 'compact' | 'short-wide' | 'medium' | 'large';
export type WindowSize = { width: number; height: number };
export type SystemSafeInsets = { top: number; right: number; bottom: number; left: number };

export const SURFACE_METRICS = {
  browsingAppBarMinHeight: 56,
  roomHeaderMinHeight: 48,
  bottomNavNominalHeight: 64,
  railMinWidth: 72,
  railMaxWidth: 96,
  primaryTouchTarget: 48,
  outerGutter: 16,
  formContentMaxWidth: 560,
  readingContentMaxWidth: 720,
  largeContentMaxWidth: 1280,
} as const;

const nonNegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

/** Raw window and system insets are separate inputs. IME never participates in classification. */
export function measureWindow(rawWindow: WindowSize, systemInsets: SystemSafeInsets, imeOcclusion = 0) {
  const availableWidth = Math.max(0, nonNegative(rawWindow.width) - nonNegative(systemInsets.left) - nonNegative(systemInsets.right));
  const availableHeight = Math.max(0, nonNegative(rawWindow.height) - nonNegative(systemInsets.top) - nonNegative(systemInsets.bottom));
  const shortWide = availableWidth > availableHeight && (
    availableHeight < 480 || (availableHeight < 600 && availableWidth / availableHeight >= 1.2)
  );
  const windowClass: WindowClass = shortWide ? 'short-wide'
    : availableWidth < 600 ? 'compact'
      : availableWidth >= 840 && availableHeight >= 600 ? 'large' : 'medium';
  return {
    rawWindow,
    systemInsets,
    availableWidth,
    availableHeight,
    imeOcclusion: nonNegative(imeOcclusion),
    surfaceHeight: Math.max(0, availableHeight - nonNegative(imeOcclusion)),
    windowClass,
  };
}

export type MeasuredWindow = ReturnType<typeof measureWindow>;

/** Text measurements let navigation grow for font scale instead of clipping labels. */
export function measureNavigation(kind: 'bottom' | 'rail', labelWidth: number, labelHeight: number) {
  if (kind === 'bottom') {
    return { height: Math.max(SURFACE_METRICS.bottomNavNominalHeight, nonNegative(labelHeight) + 32) };
  }
  const requiredWidth = nonNegative(labelWidth) + 16;
  return {
    width: Math.min(SURFACE_METRICS.railMaxWidth, Math.max(SURFACE_METRICS.railMinWidth, requiredWidth)),
    labelFits: requiredWidth <= SURFACE_METRICS.railMaxWidth,
  };
}

/** The host consumes system insets once; child surfaces receive available geometry. */
export function measureSurface(window: MeasuredWindow, kind: 'browsing' | 'task' | 'sheet', navigationHeight = 0, navigationWidth = 0) {
  const { outerGutter, browsingAppBarMinHeight } = SURFACE_METRICS;
  const width = Math.max(0, window.availableWidth - (kind === 'browsing' ? nonNegative(navigationWidth) : 0) - 2 * outerGutter);
  const cap = kind === 'task' ? SURFACE_METRICS.formContentMaxWidth
    : kind === 'browsing' ? SURFACE_METRICS.largeContentMaxWidth : SURFACE_METRICS.readingContentMaxWidth;
  const contentWidth = Math.min(width, cap);
  const topEnvelope = kind === 'browsing' ? browsingAppBarMinHeight : 0;
  const bottomEnvelope = kind === 'browsing' ? nonNegative(navigationHeight) : 0;
  const contentHeight = Math.max(0, window.surfaceHeight - topEnvelope - bottomEnvelope);
  // Editors need a full-height task when a short sheet cannot fit its header, input and action.
  const presentation = kind === 'sheet' && (window.windowClass === 'short-wide' || contentHeight < 3 * SURFACE_METRICS.primaryTouchTarget)
    ? 'full-height' : 'bounded';
  return { contentWidth, contentHeight, presentation };
}
