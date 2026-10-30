export const MOBILE_ABOUT_TRAVEL = 23.5
export const MOBILE_MEMORY_START = 11.5
export const MOBILE_MEMORY_LENGTH = 2
export const MOBILE_MEMORY_PIN_SPACING = 1.5
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const smooth = (value, start, end) => {
  const t = clamp((value - start) / (end - start))
  return t * t * (3 - 2 * t)
}
const windowOpacity = (value, start, end, fade = .3) => smooth(value, start, start + fade) * (1 - smooth(value, end - fade, end))

// The rail has fixed world endpoints and widely spaced pins. The core moves
// first; the camera follows later, bringing the next pin into the reading pose.
export function sampleMobileAbout(progress) {
  const p = clamp(progress), t = p * MOBILE_ABOUT_TRAVEL
  const memoryTravel = (t - MOBILE_MEMORY_START) / MOBILE_MEMORY_LENGTH
  const memoryIndex = Math.min(4, Math.max(0, Math.floor(memoryTravel)))
  const local = clamp(memoryTravel - memoryIndex)
  const memoryVisible = t >= MOBILE_MEMORY_START && t < 21.5
  const arrive = smooth(local, 0, .16), depart = smooth(local, .65, 1)
  const cameraFollow = smooth(local, .74, 1)
  const pulse = memoryVisible ? Math.sin(smooth(local, .02, .22) * Math.PI) : 0
  const exitCenter = smooth(t, 21.5, 22.25), grow = smooth(t,21.7,22.3), ascent = smooth(t, 22.3, 23.5)
  const dock = smooth(t, 10.55, 11.5)
  // Last pin is a real endpoint: the core leaves it for the center, rather
  // than taking a fictional sixth step down a rail beyond the final memory.
  const travel = memoryIndex < 4 ? depart : 0
  const camera = memoryIndex < 4 ? cameraFollow : 0
  const lineCamera = memoryVisible ? memoryIndex + camera : t >= 21.5 ? 4 : 0
  const coreX = t < 21.5 ? .5 + (.085 - .5) * dock : .085 + (.5 - .085) * exitCenter
  const coreY = t < MOBILE_MEMORY_START
    ? -.22 + .75 * smooth(t, 9.5, 10.5) - .30 * dock
    : t < 21.5 ? .23 + MOBILE_MEMORY_PIN_SPACING*(travel-camera) : .23 + (.46 - .23) * exitCenter - .86 * ascent
  return {
    progress:p, t, memoryIndex, local,
    introOpacity:windowOpacity(t,-.5,1.8,.4),introRise:smooth(t,.9,1.8),
    bioIndex:t < 4.5 ? 0 : t < 6.5 ? 1 : 2,
    biography:[windowOpacity(t, 2.5, 4.5), windowOpacity(t, 4.5, 6.5), windowOpacity(t, 6.5, 8.65)],
    backgroundOpacity:smooth(t,1.1,1.8)*(1-smooth(t, 8.2, 8.8)),
    openingOpacity:smooth(t,1.1,1.8)*(1-smooth(t, 2, 2.55)),
    copyOpacity:smooth(t,2.2,2.65)*(1-smooth(t,8.2,8.8)),
    underlineProgress:clamp((t-2.5)/6.15),
    portraitDock:smooth(t,1.8,2.7), portraitMix:smooth(t,2.2,3),
    journeyTitleOpacity:windowOpacity(t,8.6,11.65,.4),
    journeyTitleDock:smooth(t,9.2,10),
    journeyIntroOpacity:smooth(t,9.5,10)*(1-smooth(t,10.7,11.4)),
    lineOpacity:smooth(t,10.7,11.5)*(1-smooth(t,21.5,22.15)),
    lineCamera,lineTravel:memoryIndex+travel,
    lineStart:.23-lineCamera*MOBILE_MEMORY_PIN_SPACING,
    lineHeight:4*MOBILE_MEMORY_PIN_SPACING,
    pinPositions:Array.from({length:5},(_,index)=>.23+(index-lineCamera)*MOBILE_MEMORY_PIN_SPACING),
    memoryOpacity:memoryVisible ? arrive*(1-smooth(local,.65,.82)) : 0,
    coreX, coreY,
    coreOpacity:smooth(t,9.5,9.9)*(1-smooth(t,23.15,23.5)),
    coreScale:t<21.5 ? .48-.30*dock : .18+grow*.55,
    coreCharge:pulse*.55,
    spinSpeed:.3+pulse*2.2,
    ascend:ascent,projectsReveal:smooth(t,22.3,23.5),
  }
}
