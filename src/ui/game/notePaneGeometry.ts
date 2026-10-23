/** App already owns all system edges; only the additional IME occlusion is removed. */
export function getNotePaneGeometry(pane: { width: number; height: number }, imeOcclusion: number, systemBottom: number) {
  return {
    width: Math.max(0, pane.width),
    height: Math.max(0, pane.height - Math.max(0, imeOcclusion - systemBottom)),
  };
}
