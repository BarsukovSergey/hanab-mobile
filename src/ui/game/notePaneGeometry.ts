/** App already owns all system edges; only the additional IME occlusion is removed. */
export function getNotePaneGeometry(pane: { width: number; height: number }, imeOcclusion: number, systemBottom: number) {
  return {
    width: Math.max(0, pane.width),
    height: Math.max(0, pane.height - Math.max(0, imeOcclusion - systemBottom)),
  };
}

export function notePaneFitsFooter(pane: { width: number; height: number }, footer: { width: number; height: number }) {
  return [pane.width, pane.height, footer.width, footer.height].every(Number.isFinite)
    && footer.width > 0 && footer.height > 0
    && Math.ceil(footer.width) <= pane.width && Math.ceil(footer.height) <= pane.height;
}
