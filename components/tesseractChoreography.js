// All times are active scene seconds. No wall clock or timer can advance the
// introduction or an autonomous action while the hero is out of view.
export const TESSERACT_EMERGENCE_SECONDS = 3.1
export const TESSERACT_ACTIONS = ['ascension', 'orbit', 'compression', 'reconfigure']
export const TESSERACT_ACTION_DURATIONS = {
  ascension: 11.6,
  orbit: 13.8,
  compression: 8,
  reconfigure: 5
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const smooth = (value) => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

export function createTesseractChoreography(anchored = true, random = Math.random) {
  return {
    elapsed: anchored ? 0 : TESSERACT_EMERGENCE_SECONDS,
    phase: anchored ? 'waiting' : 'ready',
    action: null,
    random,
    sequence: 0,
    idleTime: 0,
    idleDelay: 4.4
  }
}

export function interruptTesseractChoreography(choreography) {
  if (choreography.action && !choreography.action.stopping) {
    choreography.action.stopping = true
    choreography.action.stopElapsed = 0
  }
  choreography.idleTime = 0
}

export function stepTesseractChoreography(choreography, delta, {
  active = true,
  reducedMotion = false,
  interacting = false
} = {}) {
  if (reducedMotion) {
    // Show the finished composition immediately without a scale/rise effect.
    // Turning motion back on later must not replay the initial materialization.
    choreography.elapsed = Math.max(choreography.elapsed, TESSERACT_EMERGENCE_SECONDS)
    choreography.phase = 'ready'
    interruptTesseractChoreography(choreography)
    choreography.action = null
    return choreography
  }
  if (!active) return choreography

  const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.05)
  choreography.elapsed += dt
  const time = choreography.elapsed
  choreography.phase = time < 0.12 ? 'waiting'
    : time < 0.68 ? 'charging'
      : time < 2.1 ? 'materializing'
        : time < TESSERACT_EMERGENCE_SECONDS ? 'settling' : 'ready'

  if (choreography.phase !== 'ready') return choreography
  if (interacting) {
    interruptTesseractChoreography(choreography)
  }

  if (choreography.action) {
    if (choreography.action.stopping) {
      choreography.action.stopElapsed += dt
      choreography.action.weight = 1 - smooth(choreography.action.stopElapsed / 0.85)
      if (choreography.action.weight <= 0) choreography.action = null
      return choreography
    }
    choreography.action.elapsed += dt
    if (choreography.action.elapsed >= TESSERACT_ACTION_DURATIONS[choreography.action.type]) {
      choreography.action = null
      choreography.idleTime = 0
      choreography.idleDelay = 4.2 + clamp(choreography.random(), 0, 0.999999) * 2
    }
    return choreography
  }

  if (interacting) return choreography

  choreography.idleTime += dt
  if (choreography.idleTime >= choreography.idleDelay) {
    choreography.action = {
      type: TESSERACT_ACTIONS[Math.floor(clamp(choreography.random(), 0, 0.999999) * TESSERACT_ACTIONS.length)],
      elapsed: 0,
      seed: choreography.random() * Math.PI * 2,
      weight: 1,
      stopping: false
    }
    choreography.sequence += 1
    choreography.idleTime = 0
  }
  return choreography
}

export function sampleTesseractEmergence(elapsed, output = {}) {
  const rise = smooth((elapsed - 0.68) / 1.42)
  const reveal = smooth((elapsed - 0.68) / 0.46)
  const settle = smooth((elapsed - 2.1) / 1)
  const handCharge = smooth((elapsed - 0.12) / 0.5)
  const gathering = smooth((elapsed - 0.26) / 0.4) * (1 - smooth((elapsed - 2.25) / 0.72))
  output.visible = elapsed > 0.68
  output.scale = reveal * (0.12 + rise * 0.88 + Math.sin(rise * Math.PI) * 0.055)
  output.y = 1.65 * (rise - 1)
  output.handGlow = handCharge * (1 - settle * 0.72)
  output.gathering = gathering
  output.bloom = reveal * (0.42 + Math.sin(rise * Math.PI) * 0.5) * (1 - settle * 0.45)
  output.ready = elapsed >= TESSERACT_EMERGENCE_SECONDS
  return output
}

export function constrainTesseractToHand(x, y, z, output = {}) {
  output.x = clamp(x, -0.78, 0.78)
  output.y = clamp(y, -0.5, 0.85)
  output.z = clamp(z, -0.18, 0.18)
  return output
}

export const TESSERACT_SUBJECT_ORBIT = {
  chargeEnd: 2.4,
  orbitStart: 2.9,
  orbitEnd: 10.5,
  duration: TESSERACT_ACTION_DURATIONS.ascension,
  laps: 2
}

// Coordinates are portrait fractions, measured from the resting core center.
// Starting at the front/bottom of the ellipse joins the hand without a jump.
// The rear semicircle sits above the front, so this reads as an orbit around
// the torso in depth, rather than a screen-space circle floating beside it.
export function sampleTesseractSubjectOrbit(elapsed, output = {}) {
  const {chargeEnd, orbitStart, orbitEnd, duration, laps} = TESSERACT_SUBJECT_ORBIT
  const charge = smooth(elapsed / chargeEnd)
  const recover = 1 - smooth((elapsed - orbitEnd) / (duration - orbitEnd))
  const progress = clamp((elapsed - orbitStart) / (orbitEnd - orbitStart), 0, 1)
  const easedProgress = progress * progress * progress * (progress * (progress * 6 - 15) + 10)
  const angle = easedProgress * Math.PI * 2 * laps
  const orbiting = elapsed >= orbitStart && elapsed < orbitEnd
  const depth = Math.cos(angle)
  output.charge = charge * recover
  output.fire = smooth((elapsed - 1.1) / 1.3) * recover
  output.spin = (charge * 9 + smooth((elapsed - 1.55) / 0.85) * 46) * recover
  output.ringSpin = (charge * 25 + smooth((elapsed - 1.55) / 0.85) * 95) * recover
  output.angle = angle
  output.progress = progress
  output.orbiting = orbiting
  // Exact zero at both ends avoids accumulated floating-point return drift.
  output.x = orbiting ? Math.sin(angle) * 0.42 : 0
  output.y = orbiting ? (depth - 1) * 0.105 + Math.sin(angle) * 0.035 : 0
  output.depth = orbiting ? depth : 1
  output.scale = orbiting ? 0.86 + depth * 0.14 : 1
  output.behind = orbiting && depth < 0
  output.glow = charge * recover * (1.6 + smooth((elapsed - 1.8) / 0.6) * 1.45)
  output.trail = smooth((elapsed - orbitStart) / 0.22) * recover
  return output
}

export function sampleTesseractPlayfulOrbit(elapsed, output = {}) {
  const time = Math.max(0, elapsed)
  const split = smooth((time - 2.5) / 0.65)
  const merge = smooth((time - 11.9) / 0.85)
  const separation = split * (1 - merge)
  const shrink = smooth(time / 0.65)
  const restore = smooth((time - 12.7) / 1.1)
  const chaseTime = Math.max(0, time - 3.15)
  const acceleration = Math.max(0, time - 9.3)
  // Continuous angle and increasing angular velocity through the reunion.
  const angle = chaseTime * 3.4 + acceleration * acceleration * 2.9
  const radius = separation * (0.79 + Math.sin(chaseTime * 1.7) * 0.12)
  output.amount = separation
  output.scale = 1 - shrink * (1 - restore) * 0.8
  output.split = separation
  output.shake = time < 2.5 ? smooth(time / 0.2) * (1 - smooth((time - 2.3) / 0.2)) : 0
  output.x = Math.cos(angle) * radius
  output.y = Math.sin(angle) * radius * 0.55
  output.z = Math.sin(angle) * radius * 0.35
  output.angle = angle
  output.spin = 2 + Math.min(22, acceleration * 7)
  output.particles = smooth((time - 2.35) / 0.15) * (1 - smooth((time - 13) / 0.65))
  output.white = split * (1 - restore)
  output.phase = time < 2.5 ? 'shaking' : time < 3.15 ? 'splitting' : time < 9.3 ? 'chasing' : time < 12.75 ? 'merging' : 'restoring'
  return output
}

// Pixel coordinates are local to the portrait, so the drag radius scales with
// the subject rather than the much smaller hand/canvas. No visible circle is drawn.
export function constrainTesseractDrag(x, y, width, height, anchorX, anchorY, output = {}) {
  const centerX = width * 0.56 - anchorX
  const centerY = height * 0.56 - anchorY
  const radius = width * 0.43
  const dx = x - centerX
  const dy = y - centerY
  const distance = Math.hypot(dx, dy)
  const amount = distance > radius ? radius / distance : 1
  output.x = centerX + dx * amount
  output.y = centerY + dy * amount
  output.limited = distance >= radius * 0.985
  output.radius = radius
  return output
}

export function createTesseractInteraction() {
  return {phase: 'idle', elapsed: 0, angerCount: 0, x: 0, y: 0, originX: 0, originY: 0, charge: 0, scale: 1, red: 0, burst: false}
}

export function beginTesseractDrag(state) {
  if (state.angerCount >= 3 || state.phase === 'burst') return false
  state.phase = 'dragging'
  state.elapsed = 0
  state.charge = 0
  return true
}

export function moveTesseractDrag(state, point) {
  if (state.phase !== 'dragging' && state.phase !== 'charging') return
  state.x = point.x
  state.y = point.y
  if (point.limited && state.phase !== 'charging') {
    state.phase = 'charging'
    state.elapsed = 0
  } else if (!point.limited) {
    state.phase = 'dragging'
    state.elapsed = 0
    state.charge = 0
  }
}

export function releaseTesseractDrag(state) {
  if (state.phase === 'burst') return
  state.phase = 'returning'
  state.elapsed = 0
  state.originX = state.x
  state.originY = state.y
  state.charge = 0
}

export function stepTesseractInteraction(state, delta, active = true) {
  if (!active) return state
  const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.05)
  state.elapsed += dt
  if (state.phase === 'charging') {
    state.charge = clamp(state.elapsed / 3, 0, 1)
    state.red = 0.35 + state.charge * 0.65
    if (state.charge >= 1) {
      state.phase = 'burst'
      state.elapsed = 0
      state.originX = state.x
      state.originY = state.y
      state.burst = true
    }
  } else if (state.phase === 'burst') {
    state.red = 1
    state.scale = 1 + 9 * smooth(state.elapsed / 0.15) * (1 - smooth((state.elapsed - 0.26) / 0.34))
    const home = 1 - smooth((state.elapsed - 0.2) / 0.52)
    state.x = state.originX * home
    state.y = state.originY * home
    if (state.elapsed >= 0.85) {
      state.angerCount += 1
      state.phase = 'idle'
      state.scale = 1
      state.x = 0
      state.y = 0
      state.charge = 0
      state.burst = false
    }
  } else if (state.phase === 'returning') {
    const home = 1 - smooth(state.elapsed / 0.65)
    state.x = state.originX * home
    state.y = state.originY * home
    state.red *= Math.exp(-dt * 7)
    if (state.elapsed >= 0.65) {
      state.phase = 'idle'
      state.x = 0
      state.y = 0
    }
  } else if (state.phase === 'dodging') {
    if (state.elapsed >= 1.2) releaseTesseractDrag(state)
  } else {
    state.red *= Math.exp(-dt * 7)
  }
  return state
}
