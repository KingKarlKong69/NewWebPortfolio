// Typing and carousel travel use active time; scroll supplies charge and ascent.
export const JOURNEY_CHARGE_MS = 3000
export const JOURNEY_FORM_MS = 2300
export const JOURNEY_ABSORB_MS = 2000
export const JOURNEY_CENTER_MS = 900
export const JOURNEY_CENTER_SETTLE_MS = 250
export const JOURNEY_FINAL_CHARGE_MS = 550 // Legacy import compatibility.
export const JOURNEY_ASCEND_MS = 800 // Legacy phaseProgress/elapsed compatibility; ascent is scroll-driven.
export const JOURNEY_HEADING_PX_PER_CHARACTER = 45
export const JOURNEY_TEXT_PX_PER_CHARACTER = 40
export const JOURNEY_DELETE_TRAVEL_MULTIPLIER = 1.8
const ABSORPTION_ROTATION = Math.PI * 2 * 1.75
const clamp01 = value => Math.max(0, Math.min(1, value))
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t) }
const durations = Object.freeze({
  charging: JOURNEY_CHARGE_MS,
  forming: JOURNEY_FORM_MS,
  absorbing: JOURNEY_ABSORB_MS,
  centering: JOURNEY_CENTER_MS,
  centerSettle: JOURNEY_CENTER_SETTLE_MS,
})
const chargePhase = phase => phase === 'gate' || phase === 'ready'
const textLength = state => state.lengths[state.memoryIndex]
const headingLength = state => state.headingLengths[state.memoryIndex]
const headingDistance = state => headingLength(state) * JOURNEY_HEADING_PX_PER_CHARACTER
const readingDistance = state => headingDistance(state) + textLength(state) * JOURNEY_TEXT_PX_PER_CHARACTER
export const JOURNEY_HEADING_CHARACTERS_PER_SECOND = 40
export const JOURNEY_TEXT_CHARACTERS_PER_SECOND = 65
export const JOURNEY_IDLE_ROTATION = 0.18
const DRAG_RADIANS_PER_PIXEL = .006
const STRONG_RELEASE_SPEED = .65
const MAX_DRAG_SPEED = 6
const REVERSE_TRAVEL_THRESHOLD = 160
const REVERSE_EVENT_LIMIT = 100
const REVERSE_GESTURE_GAP_MS = 180
const REVERSE_COOLDOWN_MS = 400

function clearReverseInput(state) {
  state.reverseTravel = 0
  state.lastReverseAt = null
  state.reverseCooldownUntil = 0
  state.reverseNeedsRelease = false
}

function clearEnergy(state) {
  state.charge = 0
  state.scrollVelocity = 0
  state.sustainedMs = 0
  state.lastScrollAt = null
}

function enter(state, phase, now, elapsed = 0, direction = 1) {
  state.dragging = false
  state.dragVelocity = 0
  state.dragSampleAt = null
  state.rotationVelocity = JOURNEY_IDLE_ROTATION
  state.phase = phase
  state.phaseElapsed = elapsed
  state.phaseDirection = direction
  state.phaseStarted = now - elapsed
  state.complete = phase === 'done'
  state.ascentProgress = phase === 'done' ? 1 : phase === 'ascending' ? clamp01(elapsed / JOURNEY_ASCEND_MS) : 0
  state.reversePastReading = false
  clearEnergy(state)
}

function clearReading(state) {
  state.readPosition = 0
  state.readTarget = 0
  state.headingCharacters = 0
  state.textCharacters = 0
  state.rotationTarget = state.rotation
}

function absorptionRotation(state) {
  const progress = clamp01(state.phaseElapsed / JOURNEY_ABSORB_MS)
  return progress * progress * ABSORPTION_ROTATION
}

function updateCharacters(state) {
  state.headingCharacters = Math.min(headingLength(state), state.readPosition / JOURNEY_HEADING_PX_PER_CHARACTER)
  state.textCharacters = Math.max(0, Math.min(textLength(state),
    (state.readPosition - headingDistance(state)) / JOURNEY_TEXT_PX_PER_CHARACTER))
}

function restoreReady(state, memoryIndex, now) {
  state.memoryIndex = memoryIndex
  state.readPosition = readingDistance(state)
  state.readTarget = state.readPosition
  updateCharacters(state)
  state.rotationTarget = state.rotation
  enter(state, 'ready', now)
  // Do not turn the tail of one upward gesture into the next memory rewind.
  state.reverseTravel = 0
  state.reverseCooldownUntil = now + REVERSE_COOLDOWN_MS
  state.reverseNeedsRelease = true
}

function beginAbsorption(state, now) {
  // Save the rendered angle so inverse particles rebuild the same photograph.
  state.rotationTarget = state.rotation
  state.memories[state.memoryIndex] = { rotation: state.rotation }
  enter(state, 'absorbing', now)
}

function rewindAbsorption(state, memoryIndex, now) {
  const remembered = state.memories[memoryIndex]
  // A rail jump may have no historical angle. Its hidden endpoint stays fixed.
  const rotation = remembered ? remembered.rotation : state.rotation - ABSORPTION_ROTATION
  restoreReady(state, memoryIndex, now)
  state.rotation = rotation
  state.rotationTarget = rotation
  state.memories[memoryIndex] = { rotation }
  enter(state, 'absorbing', now, JOURNEY_ABSORB_MS, -1)
}

function finishTimedPhase(state, now) {
  if (state.phaseDirection < 0) {
    switch (state.phase) {
      case 'charging':
        enter(state, 'gate', now)
        state.charge = 0.999999 // Cool naturally after unwinding the first spin.
        break
      case 'forming':
        if (state.memoryIndex > 0) rewindAbsorption(state, state.memoryIndex - 1, now)
        else enter(state, 'charging', now, JOURNEY_CHARGE_MS, -1)
        break
      case 'absorbing': restoreReady(state, state.memoryIndex, now); break
      case 'centering': rewindAbsorption(state, state.memoryIndex, now); break
      case 'centerSettle': enter(state, 'centering', now, JOURNEY_CENTER_MS, -1); break
      default: break
    }
    return
  }
  switch (state.phase) {
    case 'charging': enter(state, 'forming', now); break
    case 'forming': enter(state, 'reading', now); break
    case 'absorbing':
      state.rotation += ABSORPTION_ROTATION
      state.rotationTarget = state.rotation
      if (state.memoryIndex + 1 < state.lengths.length) {
        state.memoryIndex += 1
        clearReading(state)
        enter(state, 'forming', now)
      } else enter(state, 'centering', now)
      break
    case 'centering': enter(state, 'centerSettle', now); break
    case 'centerSettle': enter(state, 'ascending', now); break
    default: break
  }
}

export function createJourneyCarousel(lengths = [1, 1, 1, 1, 1], headingLengths = []) {
  const textLengths = Array.isArray(lengths) && lengths.length
    ? lengths.map(value => Math.max(1, Math.floor(finite(value, 1))))
    : [1, 1, 1, 1, 1]
  return {
    lengths: textLengths,
    headingLengths: textLengths.map((_, index) => Math.max(1, Math.floor(finite(headingLengths[index], 24)))),
    phase: 'gate', memoryIndex: 0, nowMs: 0, phaseStarted: 0,
    phaseElapsed: 0, phaseDirection: 1, memories: [], reversePastReading: false,
    charge: 0, scrollVelocity: 0, sustainedMs: 0, lastScrollAt: null,
    readPosition: 0, readTarget: 0, headingCharacters: 0, textCharacters: 0,
    rotation: 0, rotationTarget: 0, rotationVelocity: JOURNEY_IDLE_ROTATION,
    dragging: false, dragVelocity: 0, dragSampleAt: null, autoResumeAt: 0,
    reverseTravel: 0, lastReverseAt: null, reverseCooldownUntil: 0, reverseNeedsRelease: false,
    ascentProgress: 0,
    complete: false, exitRequested: false, lastInput: 'ignored',
  }
}

export function clearJourneyCarouselCharge(state, nowMs = state.nowMs) {
  advanceJourneyCarousel(state, nowMs)
  state.dragging = false
  state.dragVelocity = 0
  state.dragSampleAt = null
  state.rotationVelocity = JOURNEY_IDLE_ROTATION
  clearEnergy(state)
  return state
}

function integrate(state, elapsed, start) {
  let left = elapsed
  let cursor = start
  while (left > 0) {
    const phase = state.phase
    const duration = durations[phase]
    const boundary = duration
      ? state.phaseDirection > 0 ? duration - state.phaseElapsed : state.phaseElapsed
      : Infinity
    if (boundary < 0.000001) {
      state.phaseElapsed = state.phaseDirection > 0 ? duration : 0
      finishTimedPhase(state, cursor)
      continue
    }
    const milliseconds = Math.min(left, 8, boundary)
    const seconds = milliseconds / 1000
    cursor += milliseconds
    if (chargePhase(phase)) {
      const endVelocity = state.scrollVelocity * Math.exp(-seconds / 0.18)
      const velocity = (state.scrollVelocity + endVelocity) * 0.5
      state.scrollVelocity = endVelocity
      if (velocity > 300) state.sustainedMs = Math.min(1000, state.sustainedMs + milliseconds)
      else state.sustainedMs = Math.max(0, state.sustainedMs - milliseconds * 2)
      const sustained = clamp01((state.sustainedMs - 120) / 400)
      const effort = Math.max(0, Math.min(1.4, (velocity - 220) / 480))
      const gain = effort * sustained * 0.95
      const resistance = velocity > 300 ? 0.07 + state.charge * 0.12 : 0.24 + state.charge * 0.30
      state.charge = clamp01(state.charge + (gain - resistance) * seconds)
      if (state.charge >= 1) {
        if (phase === 'gate') enter(state, 'charging', cursor)
        else beginAbsorption(state, cursor)
        state.lastInput = phase === 'gate' ? 'charge' : 'absorb'
      }
    }
    if (phase === 'reading') {
      const headingRemaining = Math.max(0, headingDistance(state) - state.readPosition)
      const headingRate = JOURNEY_HEADING_CHARACTERS_PER_SECOND * JOURNEY_HEADING_PX_PER_CHARACTER
      const headingSeconds = Math.min(seconds, headingRemaining / headingRate)
      state.readPosition = Math.min(readingDistance(state), state.readPosition + headingSeconds * headingRate
        + (seconds-headingSeconds) * JOURNEY_TEXT_CHARACTERS_PER_SECOND * JOURNEY_TEXT_PX_PER_CHARACTER)
      state.readTarget = state.readPosition
      updateCharacters(state)
      if (state.readPosition >= readingDistance(state) - 0.02) {
        state.readPosition = readingDistance(state)
        updateCharacters(state)
        enter(state, 'ready', cursor)
      }
    }
    if(phase==='erasing'){
      state.readPosition=Math.max(0,state.readPosition-seconds*JOURNEY_TEXT_CHARACTERS_PER_SECOND*JOURNEY_TEXT_PX_PER_CHARACTER*1.8)
      state.readTarget=state.readPosition;updateCharacters(state)
      if(state.readPosition===0)enter(state,'forming',cursor,JOURNEY_FORM_MS,-1)
    }
    if ((phase === 'reading' || phase === 'ready') && !state.dragging) {
      // A thrown ribbon coasts, then returns to one clockwise idle direction.
      const initialVelocity = state.rotationVelocity
      const decay = Math.exp(-seconds / .72)
      state.rotationVelocity = JOURNEY_IDLE_ROTATION + (initialVelocity - JOURNEY_IDLE_ROTATION) * decay
      state.rotationTarget += JOURNEY_IDLE_ROTATION * seconds
        + (initialVelocity - JOURNEY_IDLE_ROTATION) * .72 * (1 - decay)
    }
    if (duration && state.phase === phase) state.phaseElapsed += milliseconds * state.phaseDirection
    state.rotation += (state.rotationTarget - state.rotation) * (1 - Math.exp(-seconds / 0.20))
    if (Math.abs(state.rotationTarget - state.rotation) < 0.000001) state.rotation = state.rotationTarget
    left -= milliseconds
    if (duration && state.phase === phase && (state.phaseElapsed >= duration || state.phaseElapsed <= 0)) {
      state.phaseElapsed = Math.max(0, Math.min(duration, state.phaseElapsed))
      finishTimedPhase(state, cursor)
    }
  }
}

export function advanceJourneyCarousel(state, nowMs) {
  const now = Math.max(state.nowMs, finite(nowMs, state.nowMs))
  if (now > state.nowMs) integrate(state, now - state.nowMs, state.nowMs)
  state.nowMs = now
  return state
}

function reverse(state, delta, now) {
  state.exitRequested = false
  state.lastInput = 'reverse'
  clearEnergy(state)
  const gap = state.lastReverseAt === null ? Infinity : now - state.lastReverseAt
  state.lastReverseAt = now
  if (state.phase === 'gate') {
    state.exitRequested = true
    state.lastInput = 'exit'
  } else if (state.phase === 'reading' || state.phase === 'ready') {
    if (gap >= REVERSE_GESTURE_GAP_MS) state.reverseTravel = 0
    if (now < state.reverseCooldownUntil || (state.reverseNeedsRelease && gap < REVERSE_GESTURE_GAP_MS)) return
    state.reverseNeedsRelease = false
    state.reverseTravel += Math.min(REVERSE_EVENT_LIMIT, -delta)
    state.lastInput = 'reverse-input'
    if (state.reverseTravel < REVERSE_TRAVEL_THRESHOLD) return
    // Unbuild the current memory, then reconstruct the preceding memory from
    // its saved absorption angle. A first-memory rewind returns to the gate.
    state.reverseTravel = 0
    state.reverseNeedsRelease = true
    state.reverseCooldownUntil = now + REVERSE_COOLDOWN_MS
    state.rotationTarget = state.rotation
    enter(state, 'erasing', now, 0, -1)
  } else if (durations[state.phase]) state.phaseDirection = -1
}

export function inputJourneyCarousel(state, deltaPixels, nowMs) {
  advanceJourneyCarousel(state, nowMs)
  const now = state.nowMs
  const delta = finite(deltaPixels)
  state.lastInput = 'ignored'
  if (!delta) return state
  // The host's native scroll position owns the final camera handoff.
  if (state.phase === 'ascending' || state.phase === 'done') return state
  if (delta < 0) { reverse(state, delta, now); return state }
  state.exitRequested = false
  clearReverseInput(state)
  if(state.phase==='erasing'){enter(state,'reading',now);return state}
  if (durations[state.phase]) {
    state.phaseDirection = 1
    state.lastInput = 'resume'
  } else if (chargePhase(state.phase)) {
    if (state.lastScrollAt !== null && now <= state.lastScrollAt) return state
    const gap = state.lastScrollAt === null ? 100 : now - state.lastScrollAt
    const budget = Math.min(180, Math.max(2, gap * 2.4))
    const accepted = Math.min(delta, budget)
    state.scrollVelocity = Math.min(1900, state.scrollVelocity + accepted / 0.18)
    state.lastScrollAt = now
    state.lastInput = 'charging-input'
  } else if (state.phase === 'reading') {
    clearEnergy(state)
  }
  return state
}

export function dragJourneyCarousel(state, deltaPixels, dragging, nowMs = state.nowMs, pointerTimeMs = nowMs) {
  advanceJourneyCarousel(state, nowMs)
  if (state.phase !== 'reading' && state.phase !== 'ready') return false
  const wasDragging = state.dragging
  const delta = -Math.max(-160, Math.min(160, finite(deltaPixels))) * DRAG_RADIANS_PER_PIXEL
  const now = state.nowMs
  const pointerNow = finite(pointerTimeMs, now)
  state.dragging = Boolean(dragging)
  if (state.dragging && !wasDragging) {
    state.dragVelocity = 0
    state.rotationVelocity = 0
    state.dragSampleAt = pointerNow
    state.rotationTarget = state.rotation
  }
  if (delta) {
    state.rotationTarget += delta
    if (state.dragging) {
      const seconds = Math.max(.008, (pointerNow - (state.dragSampleAt ?? pointerNow)) / 1000)
      const velocity = Math.max(-MAX_DRAG_SPEED, Math.min(MAX_DRAG_SPEED, delta / seconds))
      state.dragVelocity = state.dragVelocity * .3 + velocity * .7
      state.dragSampleAt = pointerNow
      state.rotation = state.rotationTarget
    }
  }
  if (!state.dragging) {
    const releaseAge = pointerNow - state.dragSampleAt
    const fresh = state.dragSampleAt !== null && releaseAge >= 0 && releaseAge <= 140
    const throwVelocity = fresh ? state.dragVelocity : 0
    state.rotationVelocity = wasDragging && Math.abs(throwVelocity) >= STRONG_RELEASE_SPEED
      ? throwVelocity : JOURNEY_IDLE_ROTATION
    state.dragVelocity = 0
    state.dragSampleAt = null
    // Remove delayed follow-through: a gentle release immediately returns to
    // clockwise motion; only measured strong release velocity can reverse it.
    state.rotation = state.rotationTarget
  }
  return true
}

export function inputJourneyCarouselAscent(state, deltaProgress, nowMs = state.nowMs) {
  advanceJourneyCarousel(state, nowMs)
  if (state.phase !== 'ascending' && state.phase !== 'done') return false
  const delta = finite(deltaProgress)
  if (!delta) return true
  const progress = clamp01(state.ascentProgress + delta)
  if (progress >= 1) enter(state, 'done', state.nowMs)
  else {
    state.phase = 'ascending'
    state.complete = false
    state.ascentProgress = progress
    state.phaseDirection = delta > 0 ? 1 : -1
    state.phaseElapsed = progress * JOURNEY_ASCEND_MS
  }
  state.exitRequested = false
  state.lastInput = 'ascent-scroll'
  return true
}

export function rewindJourneyCarouselEnding(state, nowMs = state.nowMs) {
  advanceJourneyCarousel(state, nowMs)
  if ((state.phase !== 'ascending' && state.phase !== 'done') || state.ascentProgress > .000001) return false
  // Native scrolling has brought the tesseract back to its centered endpoint.
  // Reverse the authored ending before rebuilding the final memory in place.
  state.exitRequested = false
  state.lastInput = 'rewind-ending'
  state.reverseTravel = 0
  state.lastReverseAt = state.nowMs
  state.reverseNeedsRelease = true
  enter(state, 'centerSettle', state.nowMs, JOURNEY_CENTER_SETTLE_MS, -1)
  return true
}

export function seekJourneyCarousel(state, memoryIndex, nowMs) {
  const now = Math.max(state.nowMs, finite(nowMs, state.nowMs))
  state.nowMs = now
  const index = Math.max(0, Math.min(state.lengths.length - 1, Math.floor(finite(memoryIndex))))
  if (state.phase === 'absorbing') state.rotation += absorptionRotation(state)
  state.memoryIndex = index
  clearReverseInput(state)
  clearReading(state)
  enter(state, 'forming', now)
  state.exitRequested = false
  state.lastInput = 'seek'
  return state
}

export function resetJourneyCarousel(state, nowMs) {
  const now = Math.max(state.nowMs, finite(nowMs, state.nowMs))
  state.nowMs = now
  state.memoryIndex = 0
  state.rotation = 0
  state.rotationTarget = 0
  state.memories = []
  state.dragging = false
  state.autoResumeAt = 0
  clearReverseInput(state)
  clearReading(state)
  enter(state, 'gate', now)
  state.exitRequested = false
  state.lastInput = 'reset'
  return state
}

export function sampleJourneyCarousel(state, nowMs, output = {}) {
  advanceJourneyCarousel(state, nowMs)
  const phase = state.phase
  const local = phase === 'ascending' ? state.ascentProgress
    : durations[phase] ? clamp01(state.phaseElapsed / durations[phase]) : 0
  const eased = smooth(local)
  const forming = phase === 'forming'
  const visible = phase === 'reading' || phase === 'ready' || phase === 'erasing' || phase === 'absorbing'
  const ending = phase === 'centering' || phase === 'centerSettle' || phase === 'ascending' || phase === 'done'
  const absorption = phase === 'absorbing' ? local : 0
  const ascend = phase === 'ascending' ? eased : phase === 'done' ? 1 : 0
  const centerProgress = phase === 'centering' ? eased : ending ? 1 : 0
  const readProgress = clamp01(state.readPosition / readingDistance(state))
  const charge = chargePhase(phase) ? state.charge : phase === 'charging' ? 1 : 0
  let fraction = 0
  if (phase === 'charging') fraction = local * 0.10
  else if (forming) {
    const start = state.memoryIndex === 0 ? 0.10 : 0
    fraction = start + local * (0.22 - start)
  } else if (phase === 'reading' || phase === 'erasing') fraction = 0.22 + readProgress * 0.62
  else if (phase === 'ready') fraction = 0.84 + state.charge * 0.04
  else if (phase === 'absorbing') fraction = 0.88 + local * 0.12
  const denominator = state.lengths.length + 0.30
  let progress = (state.memoryIndex + fraction) / denominator
  if (phase === 'centering') progress = (state.lengths.length + local * 0.10) / denominator
  if (phase === 'centerSettle') progress = (state.lengths.length + 0.10 + local * 0.05) / denominator
  if (phase === 'ascending') progress = (state.lengths.length + 0.15 + local * 0.15) / denominator
  if (phase === 'done') progress = 1
  output.phase = phase
  output.memoryIndex = state.memoryIndex
  output.phaseProgress = local
  output.transitionDirection = state.phaseDirection
  output.charge = charge
  output.chargeProgress = phase === 'charging' ? eased : charge
  output.formation = forming ? local : visible ? 1 : 0
  output.absorption = absorption
  output.centerProgress = centerProgress
  output.coreCharge = phase === 'charging' ? 1
    : forming ? 1 - eased : phase === 'absorbing' ? 1
      : phase === 'centering' ? 1 - smooth(local / 0.65) : ending ? 0 : charge
  output.carouselOpacity = forming ? smooth(local / 0.45) : visible ? 1 - smooth((absorption - 0.25) / 0.75) : 0
  output.carouselScale = forming ? 1 : phase === 'absorbing' ? Math.max(0.02, Math.pow(1 - eased, 1.4)) : 1
  output.headingCharacters = state.headingCharacters
  output.textCharacters = state.textCharacters
  output.readingProgress = readProgress
  output.textProgress = clamp01(state.textCharacters / textLength(state))
  output.typing = phase === 'reading' ? 1 : 0
  output.deleting = phase==='erasing'?1:0
  output.rotation = state.rotation + (phase === 'absorbing' ? absorptionRotation(state) : 0)
  output.spinSpeed = phase === 'charging' ? 0.25 + eased * 0.75
    : phase === 'absorbing' ? 0.2 + eased * 0.8 : forming ? 1 - eased
      : phase === 'centering' ? 0.3 * (1 - eased) : charge * 0.25
  output.ascend = ascend
  output.coreOpacity = 1 - smooth((ascend - 0.60) / 0.40)
  const compacting = phase === 'absorbing' ? 1 - smooth((local - 0.70) / 0.30) : 1
  output.coreScale = ending ? 1 : 1 + output.coreCharge * 0.06 * compacting
  const opening = phase === 'gate' || phase === 'charging' ? 0
    : forming && state.memoryIndex === 0 ? smooth(local / 0.8) : 1
  const originX = 0.50 + (0.34 - 0.50) * opening
  const originY = 0.50 + (0.39 - 0.50) * opening
  output.coreX = originX + (0.50 - originX) * centerProgress
  output.coreY = originY + (0.50 - originY) * centerProgress - ascend
  output.progress = clamp01(progress)
  output.complete = state.complete
  return output
}
