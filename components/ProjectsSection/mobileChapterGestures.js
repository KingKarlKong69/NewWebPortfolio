// Gesture decisions are shared by touch, wheel and keyboard navigation.
// A gesture selects one adjacent reading stop, never a number of raw pixels.
export function adjacentMobileStop(stops, index, direction, before, after) {
  const next = index + Math.sign(direction)
  return next < 0 ? before : next >= stops.length ? after : stops[next]
}

export function mobileSwipeDirection(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.max(Math.abs(dx), Math.abs(dy)) < 28) return 0
  return Math.sign(Math.abs(dx) > Math.abs(dy) ? -dx : -dy)
}
