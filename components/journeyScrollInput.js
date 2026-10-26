// Normalize WheelEvent units while retaining real travel. The controller uses
// travel and time together, so a trackpad stream is never reduced to "beats".
export function normalizeJourneyWheel(delta, mode = 0, pageHeight = 800) {
  if (!Number.isFinite(delta)) return 0
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? Math.max(1,
    Number.isFinite(pageHeight) ? pageHeight : 800) : 1)
  return Math.max(-240, Math.min(240, pixels))
}
