// Elapsed time is supplied by the scene. The controller never reads the clock,
// schedules work, or advances a project that is hidden or being scrolled away.
export const PROJECT_SCREENSHOT_HOLD_SECONDS = 4.5
export const PROJECT_SCREENSHOT_TRANSITION_SECONDS = 1.5
export const PROJECT_SLIDESHOW_MAX_TRANSITION_DELTA = 0.1

const countOf = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
const indexOf = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
const smooth = value => value * value * (3 - 2 * value)

export function createProjectSlideshow() {
  return { slots: new Map(), activeProjectIndex: null, playing: false }
}

function reconcileCount(slot, imageCount) {
  if (slot.imageCount === imageCount) return
  const previousCount = slot.imageCount
  slot.imageCount = imageCount
  if (imageCount < 2 || previousCount < 2 || slot.currentIndex >= imageCount) {
    slot.currentIndex = imageCount ? Math.min(slot.currentIndex, imageCount - 1) : 0
    slot.nextIndex = imageCount > 1 ? (slot.currentIndex + 1) % imageCount : slot.currentIndex
    slot.phase = 'hold'
    slot.elapsed = 0
  } else if (slot.phase === 'transition' && slot.nextIndex >= imageCount) {
    // An incoming image was removed. Keep the surviving source visible rather
    // than accidentally sampling a texture outside the new screenshot list.
    slot.phase = 'hold'
    slot.elapsed = 0
    slot.nextIndex = (slot.currentIndex + 1) % imageCount
  }
}

function slotFor(state, projectIndex, imageCount) {
  let slot = state.slots.get(projectIndex)
  if (!slot) {
    slot = { imageCount, currentIndex: 0, nextIndex: imageCount > 1 ? 1 : 0, phase: 'hold', elapsed: 0 }
    state.slots.set(projectIndex, slot)
  }
  return slot
}

function sampleSlot(slot, projectIndex, imageCount, playing, output) {
  const transition = imageCount > 1 && slot.phase === 'transition'
  output.projectIndex = projectIndex
  output.imageCount = imageCount
  output.currentIndex = imageCount ? slot.currentIndex : -1
  output.nextIndex = imageCount > 1
    ? transition ? slot.nextIndex : (slot.currentIndex + 1) % imageCount
    : output.currentIndex
  output.mix = transition ? smooth(slot.elapsed / PROJECT_SCREENSHOT_TRANSITION_SECONDS) : 0
  output.phase = !imageCount ? 'empty' : imageCount === 1 ? 'static' : slot.phase
  output.playing = playing
  output.needsFrame = playing && transition
  output.nextWakeMs = !playing ? Infinity : transition ? 0
    : Math.max(0, PROJECT_SCREENSHOT_HOLD_SECONDS - slot.elapsed) * 1000
  return output
}

// Read a remembered project's textures during a channel handoff without
// pausing another project's playback or altering the active playback clock.
export function peekProjectSlideshow(state, projectIndex, imageCount, output = {}) {
  const selected = indexOf(projectIndex)
  const count = countOf(imageCount)
  const slot = slotFor(state, selected, count)
  reconcileCount(slot, count)
  return sampleSlot(slot, selected, count, false, output)
}

// delta is in seconds. Call with playing=false as soon as scrolling starts,
// a project handoff starts, or the section/document becomes hidden. Each project
// remembers both its hold time and any partially completed dissolve.
//
// During a hold, nextWakeMs lets a demand-rendered canvas sleep until the image
// should change. A delayed timer stops at the start of the dissolve; it cannot
// silently consume that transition. Dissolve frames cap unusually large deltas
// so a stalled frame cannot jump through the screenshot sequence.
export function advanceProjectSlideshow(state, delta, options = {}, output = {}) {
  const projectIndex = indexOf(options.projectIndex)
  const imageCount = countOf(options.imageCount)
  const slot = slotFor(state, projectIndex, imageCount)
  const previousCount = slot.imageCount
  reconcileCount(slot, imageCount)
  const playing = options.playing === true && !options.reducedMotion && imageCount > 1
  const resumed = state.activeProjectIndex !== projectIndex || !state.playing || previousCount < 2
  const elapsed = !resumed && playing && Number.isFinite(delta) ? Math.max(0, delta) : 0
  state.activeProjectIndex = projectIndex
  state.playing = playing

  if (elapsed > 0) {
    if (slot.phase === 'hold') {
      slot.elapsed = Math.min(PROJECT_SCREENSHOT_HOLD_SECONDS, slot.elapsed + elapsed)
      if (slot.elapsed >= PROJECT_SCREENSHOT_HOLD_SECONDS - 1e-9) {
        slot.phase = 'transition'
        slot.nextIndex = (slot.currentIndex + 1) % imageCount
        slot.elapsed = 0
      }
    } else {
      slot.elapsed = Math.min(PROJECT_SCREENSHOT_TRANSITION_SECONDS,
        slot.elapsed + Math.min(elapsed, PROJECT_SLIDESHOW_MAX_TRANSITION_DELTA))
      if (slot.elapsed >= PROJECT_SCREENSHOT_TRANSITION_SECONDS - 1e-9) {
        slot.currentIndex = slot.nextIndex
        slot.nextIndex = (slot.currentIndex + 1) % imageCount
        slot.phase = 'hold'
        slot.elapsed = 0
      }
    }
  }

  return sampleSlot(slot, projectIndex, imageCount, playing, output)
}
