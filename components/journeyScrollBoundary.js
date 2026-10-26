// Native wheel, keyboard, touch, and scrollbar travel share one boundary.
// Explicit section navigation can bypass the story; ordinary scrolling cannot.
export function constrainJourneyScroll({ previous, next, start, gate, ascentDistance, phase, bypass = false, engaged = false, exitRequested = false }) {
  if (bypass || ![previous, next, start, gate, ascentDistance].every(Number.isFinite)) return next
  // An initial deep link or a visitor already below Journey is not pulled back.
  if (previous > gate + ascentDistance + 3 && next > gate + ascentDistance) return next
  const returning = previous >= gate-3 && next < gate
  if ((engaged || returning) && phase !== 'gate' && !exitRequested) next = Math.max(gate,next)
  if (next < start || (previous < start && next < gate)) return next
  if (phase === 'done') return next
  const limit = phase === 'ascending' ? gate + ascentDistance : gate
  return Math.min(next, limit)
}

export function journeyAscentAt(scrollY, gate, distance) {
  return Math.max(0, Math.min(1, (scrollY-gate)/Math.max(1,distance)))
}
