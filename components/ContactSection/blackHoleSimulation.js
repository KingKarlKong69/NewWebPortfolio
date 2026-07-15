import * as THREE from 'three'

export const SURGE_PHASE = Object.freeze({
  IDLE: 'idle',
  CHARGING: 'charging',
  ABSORBING: 'absorbing',
  DECAYING: 'decaying'
})

export const SURGE_TIMING = Object.freeze({
  chargeEnd: 0.6,
  absorbEnd: 4,
  end: 5
})

const clamp01 = (value) => Math.max(0, Math.min(1, value))

export function smoothStep(value) {
  const next = clamp01(value)
  return next * next * (3 - 2 * next)
}

export function createSurgeState() {
  return {
    phase: SURGE_PHASE.IDLE,
    visualTime: 0,
    elapsed: 0,
    intensity: 0,
    warmth: 0,
    gravity: 1,
    flow: 1,
    charge: 0,
    absorption: 0,
    decay: 0,
    generation: 0,
    completedGeneration: 0,
    cooldownUntil: 0
  }
}

export function beginSurge(state, now = performance.now()) {
  if (state.phase !== SURGE_PHASE.IDLE || now < state.cooldownUntil) return false

  state.phase = SURGE_PHASE.CHARGING
  state.elapsed = 0
  state.intensity = 0
  state.warmth = 0
  state.gravity = 1
  state.flow = 1
  state.charge = 0
  state.absorption = 0
  state.decay = 0
  state.generation += 1
  return true
}

export function advanceSurge(state, delta) {
  if (state.phase === SURGE_PHASE.IDLE) return false

  const previousPhase = state.phase
  state.elapsed = Math.min(SURGE_TIMING.end, state.elapsed + Math.min(Math.max(delta, 0), 1.25))

  if (state.elapsed < SURGE_TIMING.chargeEnd) {
    const progress = smoothStep(state.elapsed / SURGE_TIMING.chargeEnd)
    state.phase = SURGE_PHASE.CHARGING
    state.charge = progress
    state.absorption = 0
    state.decay = 0
    state.intensity = progress
    state.warmth = progress * 0.72
    state.gravity = 1 + progress * 4.2
    state.flow = 1 + progress * 1.7
  } else if (state.elapsed < SURGE_TIMING.absorbEnd) {
    const progress = smoothStep((state.elapsed - SURGE_TIMING.chargeEnd) / (SURGE_TIMING.absorbEnd - SURGE_TIMING.chargeEnd))
    state.phase = SURGE_PHASE.ABSORBING
    state.charge = 1
    state.absorption = progress
    state.decay = 0
    state.intensity = 1
    state.warmth = 0.72 + Math.sin(progress * Math.PI) * 0.28
    state.gravity = 5.2 + progress * 5.8
    state.flow = 2.7 + progress * 0.75
  } else {
    const progress = smoothStep((state.elapsed - SURGE_TIMING.absorbEnd) / (SURGE_TIMING.end - SURGE_TIMING.absorbEnd))
    const remaining = 1 - progress
    state.phase = SURGE_PHASE.DECAYING
    state.charge = 1
    state.absorption = 1
    state.decay = progress
    state.intensity = remaining
    state.warmth = remaining * 0.72
    state.gravity = 1 + remaining * 2.4
    state.flow = 1 + remaining * 1.7
  }

  if (state.elapsed >= SURGE_TIMING.end) {
    state.phase = SURGE_PHASE.IDLE
    state.elapsed = 0
    state.intensity = 0
    state.warmth = 0
    state.gravity = 1
    state.flow = 1
    state.charge = 0
    state.absorption = 0
    state.decay = 0
    state.completedGeneration = state.generation
    state.cooldownUntil = performance.now() + 420
  }

  return previousPhase !== state.phase
}

export function seededValue(seed) {
  const value = Math.sin(seed * 91.731 + 17.17) * 43758.5453
  return value - Math.floor(value)
}

export function clampVectorLength(vector, maxLength) {
  const lengthSq = vector.lengthSq()
  if (!Number.isFinite(lengthSq)) {
    vector.set(0, 0, 0)
    return vector
  }

  if (lengthSq > maxLength * maxLength) vector.multiplyScalar(maxLength / Math.sqrt(lengthSq))
  return vector
}

export function finiteVector(vector, fallback = new THREE.Vector3()) {
  if (Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z)) return vector
  return vector.copy(fallback)
}
