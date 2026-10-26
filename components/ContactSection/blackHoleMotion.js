// Phase wrapping preserves precision indefinitely. Material rotates as one field:
// no radius-dependent angular speed and no unbounded noise-coordinate drift.
const TAU = Math.PI * 2
const wrap = value => ((value % TAU) + TAU) % TAU

export function advanceBlackHoleMotion(motion, delta, rotationSpeed = 1) {
  const dt = Number.isFinite(delta) ? Math.min(Math.max(delta, 0), .05) : 0
  const speed = Number.isFinite(rotationSpeed) ? Math.min(3, Math.max(-3, rotationSpeed)) : 1
  motion.time += dt
  motion.flow = wrap(motion.flow + dt * speed * .028)
  motion.turbulence = wrap((motion.turbulence || 0) + dt * .08)
  return motion
}

// Integrate local speeds from the shared clock's *increment*, not its absolute
// wrapped angle. Noninteger multipliers never jump at 2pi or when edited.
export function advanceBlackHoleMaterialPhases(phases, flow, values) {
  if (!Number.isFinite(flow)) return phases
  const previous = Number.isFinite(phases.lastFlow) ? phases.lastFlow : flow
  const increment = Math.atan2(Math.sin(flow - previous), Math.cos(flow - previous))
  for (const part of ['disk', 'upper', 'lower']) {
    const raw = values[`${part}FlowSpeed`]
    const speed = Number.isFinite(raw) ? Math.min(2, Math.max(0, raw)) : 1
    phases[part] = wrap((phases[part] || 0) + increment * speed)
  }
  phases.lastFlow = flow
  return phases
}
