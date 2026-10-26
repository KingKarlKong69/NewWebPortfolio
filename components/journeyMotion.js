// Scroll controls the biography-to-Journey opening. Once the original core
// reaches the center, the gesture controller owns the memory carousel.
export const JOURNEY_VORTEX_END = .085 / .30
export const JOURNEY_STOPS = Object.freeze([.23 / .30, 1, 1, 1, 1, 1])

const clamp01 = value => Math.max(0, Math.min(1, value))
const smooth = (value, start, end) => {
  const t = clamp01((value - start) / (end - start))
  return t * t * (3 - 2 * t)
}

export function sampleJourney(progress, output = {}) {
  const progress01 = typeof progress === 'number' && !Number.isNaN(progress) ? clamp01(progress) : 0
  const p = progress01 * .30
  const titleEnter = smooth(p, .08, .16)
  const titleExit = smooth(p, .235, .28)
  const coreEnter = smooth(p, .26, .295)
  output.progress = progress01
  output.vortex = smooth(p, 0, .085)
  output.vortexLight = smooth(p, .005, .045) * (1 - smooth(p, .045, .10))
  output.journeyOpacity = smooth(p, .075, .09)
  output.introTitleScale = output.titleScale = .035 + .965 * titleEnter
  output.introTitleOpacity = output.titleOpacity = smooth(p, .08, .105) * (1 - titleExit)
  output.introTitleX = output.titleX = -1.15 * titleExit
  output.introTyping = smooth(p, .15, .23)
  output.introOpacity = smooth(p, .15, .16) * (1 - titleExit)
  output.titleExit = titleExit
  output.coreX = .5
  output.coreY = -.2 + .7 * coreEnter
  output.coreOpacity = coreEnter
  output.coreScale = 1
  output.coreCharge = 0
  output.stage = 0
  return output
}
