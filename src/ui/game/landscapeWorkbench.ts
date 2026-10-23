/** Clue owns the fixed action envelope, regardless of candidate count or tool.
 * Additional inspection space keeps Hypothetical/review secondary tasks usable. */
export function getLandscapeWorkbenchEnvelope(fontScale: number) {
  const scale = Math.max(1, fontScale);
  const choiceHeight = Math.max(26, Math.ceil(18 * scale + 4));
  const footerHeight = Math.max(26, Math.ceil(14 * scale + 6));
  const paletteHeight = 2 * choiceHeight + 2;
  const composerHeight = Math.max(paletteHeight, 2 * footerHeight + 2);
  const compactActionHeight = Math.max(32, Math.ceil(16 * scale + 12));
  const secondaryHeight = compactActionHeight + 4;
  const inspectionHeight = Math.max(40, compactActionHeight + 8);
  const minimumHeight = secondaryHeight + composerHeight + inspectionHeight + 6;
  return { choiceHeight, footerHeight, paletteHeight, composerHeight,
    secondaryHeight, inspectionHeight, minimumHeight, comfortableHeight: minimumHeight + 40 };
}
