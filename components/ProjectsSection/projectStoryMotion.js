// The desktop choreography is a function of scroll position. Sampling an
// earlier position restores the laptop, typography, and project handoff.
// A settled project's screenshot gallery has its own paused/resumed clock.
export const PROJECT_STORY_INTRO_END = 0.44

const clamp01 = value => Math.min(1, Math.max(0, value))
const smooth = (value, start, end) => {
  const t = clamp01((value - start) / (end - start))
  return t * t * (3 - 2 * t)
}
const countOf = value => Number.isFinite(value) && value >= 1
  ? Math.max(1, Math.min(1000, Math.floor(value)))
  : 4
const progressOf = value => typeof value === 'number' && !Number.isNaN(value)
  ? clamp01(value)
  : 0

const interpolate = (progress, stops, logarithmic = false) => {
  if (progress <= stops[0][0]) return stops[0][1]
  for (let index = 1; index < stops.length; index += 1) {
    const [end, endValue] = stops[index]
    if (progress <= end) {
      const [start, startValue] = stops[index - 1]
      const t = smooth(progress, start, end)
      return logarithmic
        ? Math.exp(Math.log(startValue) + (Math.log(endValue) - Math.log(startValue)) * t)
        : startValue + (endValue - startValue) * t
    }
  }
  return stops[stops.length - 1][1]
}

const TITLE_SCALE = [[0, 20], [0.035, 9], [0.08, 3.5], [0.125, 1.4], [0.15, 1]]
const TITLE_TRACKING = [[0, -0.085], [0.155, -0.085], [0.185, 0.19], [0.21, -0.085]]
const LAPTOP_X = [[0.22, 1.3], [0.29, 0.72], [0.33, 0.53], [0.365, 0.52], [0.43, 0.715]]
const LAPTOP_Y = [[0.22, 0.54], [0.33, 0.54], [0.365, 0.55], [0.43, 0.53]]
const LAPTOP_WIDTH = [[0.22, 0.22], [0.29, 0.4], [0.33, 0.5], [0.365, 1.28], [0.43, 0.54]]
const LAPTOP_ROTATION_X = [[0.22, 0.16], [0.29, 0.04], [0.365, 0.10], [0.43, 0.10]]
const LAPTOP_ROTATION_Y = [[0.22, 0.5], [0.29, 0.35], [0.33, 0.2], [0.365, 0.12], [0.43, -0.30]]
const LAPTOP_ROTATION_Z = [[0.22, 0.13], [0.29, 0.08], [0.365, 0.025], [0.43, 0.065]]

// A navigation destination lands inside the fully readable part of a project,
// preserving the actual project count instead of assuming the mockup's five.
export function projectStoryStop(index, projectCount = 4) {
  const count = countOf(projectCount)
  const selected = Number.isFinite(index) ? Math.min(count - 1, Math.max(0, Math.floor(index))) : 0
  return PROJECT_STORY_INTRO_END + (1 - PROJECT_STORY_INTRO_END) * (selected + 0.8) / count
}

export function sampleProjectStory(progress, projectCount = 4, output = {}) {
  const p = progressOf(progress)
  const count = countOf(projectCount)
  const rawTravel = clamp01((p - PROJECT_STORY_INTRO_END) / (1 - PROJECT_STORY_INTRO_END)) * count
  // Composing the longer runway can introduce a few ulps at exact chapter
  // boundaries. Canonicalize those boundaries before choosing their copy.
  const travel = Math.abs(rawTravel-Math.round(rawTravel))<1e-10 ? Math.round(rawTravel) : rawTravel
  const projectIndex = Math.min(count - 1, Math.floor(travel))
  const local = Math.min(1, Math.max(0, travel - projectIndex))

  output.progress = p
  output.titleScale = interpolate(p, TITLE_SCALE, true)
  output.titleTracking = interpolate(p, TITLE_TRACKING)
  output.titleY = smooth(p, 0.21, 0.265) * 1.1
  output.titleOpacity = 1 - smooth(p, 0.242, 0.265)

  // Coordinates are the projected center of the model as viewport fractions.
  // The temporary close-up is deliberate; the settled right-hand model stays
  // in one pose while project content advances.
  output.laptopX = interpolate(p, LAPTOP_X)
  output.laptopY = interpolate(p, LAPTOP_Y)
  output.laptopWidth = interpolate(p, LAPTOP_WIDTH)
  output.laptopRotationX = interpolate(p, LAPTOP_ROTATION_X)
  output.laptopRotationY = interpolate(p, LAPTOP_ROTATION_Y)
  output.laptopRotationZ = interpolate(p, LAPTOP_ROTATION_Z)
  output.laptopOpacity = smooth(p, 0.22, 0.265)
  output.lidOpen = smooth(p, 0.375, 0.43)
  output.screenPower = smooth(p, 0.415, 0.445)
  output.dotOpacity = smooth(p, 0.245, 0.30)

  output.projectIndex = projectIndex
  output.projectProgress = local
  output.revealProgress = smooth(local, 0.08, 0.66)
  const entrance = smooth(local, projectIndex === 0 ? 0.08 : 0, projectIndex === 0 ? 0.14 : 0.08)
  const exit = projectIndex === count - 1 ? 0 : smooth(local, 0.90, 1)
  output.copyOpacity = entrance * (1 - exit)
  output.eyebrowReveal = smooth(local, 0.08, 0.16)
  output.titleReveal = smooth(local, 0.16, 0.32)
  output.roleReveal = smooth(local, 0.31, 0.40)
  output.stackReveal = smooth(local, 0.39, 0.48)
  output.impactReveal = smooth(local, 0.47, 0.55)
  output.actionsReveal = smooth(local, 0.54, 0.63)
  output.navReveal = smooth(local, 0.59, 0.66)

  // Keep the same source/target pair on both sides of each project boundary.
  // At either end the visible screenshot is unchanged when the pair advances.
  // The laptop shader uses screenTransition for brief TV-channel interference.
  const nextBoundary = Math.round(travel)
  // Give the TV handoff enough scroll travel to be perceived in either
  // direction. It occupies 32% of a chapter, with a clean reading hold.
  const transitionWidth = 0.16
  if (nextBoundary > 0 && nextBoundary < count && Math.abs(travel - nextBoundary) <= transitionWidth) {
    const mix = clamp01((travel - nextBoundary + transitionWidth) / (transitionWidth * 2))
    output.screenCurrentIndex = nextBoundary - 1
    output.screenNextIndex = nextBoundary
    output.screenMix = mix * mix * (3 - 2 * mix)
    output.screenTransition = Math.sin(mix * Math.PI)
  } else {
    output.screenCurrentIndex = projectIndex
    output.screenNextIndex = projectIndex
    output.screenMix = 0
    output.screenTransition = 0
  }
  return output
}

// Projects and laptop entry keep their established distances. Skills receives
// a slower native-scroll journey and a genuinely longer post-AI landscape.
export const SERVICES_HANDOFF_START = .955
export const SERVICES_HANDOFF_END = .9675

export function projectsSkillsLayout(projectCount = 4) {
  const projectsDistance = 700 + countOf(projectCount) * 300
  const transitionDistance = 1550
  const expeditionDistance = 4800
  const distance = projectsDistance + transitionDistance + expeditionDistance
  return {
    height: distance + 100,
    projectsEnd: projectsDistance / distance,
    transitionEnd: (projectsDistance + transitionDistance) / distance,
    skillsStop: (projectsDistance + transitionDistance * .995) / distance,
    expeditionDistance,
    servicesOverlap: 100 + expeditionDistance * (1-SERVICES_HANDOFF_START),
    servicesEntryHold: expeditionDistance * (SERVICES_HANDOFF_END-SERVICES_HANDOFF_START)
  }
}

export function projectsSkillsStop(index, projectCount = 4) {
  return projectStoryStop(index, projectCount) * projectsSkillsLayout(projectCount).projectsEnd
}

// A single world-distance mapping maintains the same low camera velocity in
// both the mountain chapters and the long closing landscape. Physical scroll
// space, rather than a pause or accumulated input, supplies the reading time.
const TRAVEL_START = -70, TRAVEL_END = 1382, TRAVEL_SPAN = TRAVEL_END-TRAVEL_START
const progressAtTravel = x => (x-TRAVEL_START)/TRAVEL_SPAN
export const SKILLS_TOOLSET_STOP=progressAtTravel(410)
const CHECKPOINT_CAMERA_X = [-52,38,126,214,302]
export const SKILLS_CHECKPOINT_STOPS = CHECKPOINT_CAMERA_X.map(progressAtTravel)
// Reading windows, not stationary holds. Export retained for the scene audit.
export const SKILLS_MOUNTAIN_DWELLS = [0,88,176,264,352].map(x=>[progressAtTravel(x-12),progressAtTravel(x+18)])

export function sampleSkillsExpedition(progress, output = {}) {
  const p = progressOf(progress)
  const travel = TRAVEL_START+TRAVEL_SPAN*p
  const chapter = Math.min(4, Math.max(0, Math.round(travel / 88)))
  const distanceFromChapter = Math.abs(travel - chapter * 88)
  output.expeditionProgress = p
  output.expeditionTravel = travel
  output.chapterIndex = chapter
  const chapterX = chapter * 88
  output.chapterActivation = smooth(travel,chapterX-34,chapterX-12) *
    (1-smooth(travel,chapterX+18,chapterX+42)) * (1-smooth(distanceFromChapter,28,46))
  // The leading light remains in the middle foreground as the camera travels.
  // Its first encounter is at checkpoint one, entered visibly from the left.
  output.routeHead = travel + 8 - (1-smooth(travel,-70,-52))*46
  output.routeReveal = smooth(travel,-68,-57)
  let checkpointIndex = -1, checkpointReveal = 0
  CHECKPOINT_CAMERA_X.forEach((center,index)=>{
    const reveal = smooth(travel,center-17,center-5) * (1-smooth(travel,center+8,center+24))
    if(reveal>checkpointReveal){checkpointIndex=index;checkpointReveal=reveal}
  })
  output.checkpointIndex = checkpointIndex
  output.checkpointReveal = checkpointReveal
  output.checkpointDim = checkpointReveal*.32
  output.chapterActivation *= 1-checkpointReveal
  // This is a location in the world. It stays formed after discovery; the
  // projected anchor carries it out of frame instead of an artificial exit.
  output.endingReveal = smooth(travel,382,404)
  output.terrainDissolve = 0
  output.introMorph = smooth(travel,316,337)
  output.introHold = 1-smooth(travel,376,397)
  // White fills the frame before darkening to the receiving Services field.
  output.exitLight = smooth(travel,1110,1360)
  output.whiteout = smooth(p,.88,.955)
  output.servicesReveal = smooth(p,SERVICES_HANDOFF_START,SERVICES_HANDOFF_END)
  return output
}

export function sampleProjectsSkillsStory(progress, projectCount = 4, output = {}) {
  const p = progressOf(progress)
  const { projectsEnd, transitionEnd } = projectsSkillsLayout(projectCount)
  sampleProjectStory(Math.min(1, p / projectsEnd), projectCount, output)
  const t = clamp01((p - projectsEnd) / (transitionEnd - projectsEnd))
  sampleSkillsExpedition((p - transitionEnd) / (1 - transitionEnd), output)
  const center = smooth(t, .27, .45)
  const face = smooth(t, .32, .49)
  output.progress = p
  output.skillsProgress = t
  output.copyExit = smooth(t, 0, .095)
  output.copyOpacity *= 1 - output.copyExit
  output.screenExit = smooth(t, .075, .18)
  output.cosmosReveal = smooth(t, .22, .32)
  output.screenCenterAlignment = smooth(t, .37, .50)
  output.portalDolly = smooth(t, .50, .67)
  output.portalOpacity = smooth(t, .68, .70)
  output.worldExpand = smooth(t, .70, .78)
  output.worldTravel = smooth(t, .70, .92)
  output.terrainFormation = smooth(t, .86, .97)
  output.skillsReveal = smooth(t, .973, .99)
  output.skillsIntroOpacity = output.skillsReveal * output.introHold
  output.skillsGlitch = Math.sin(output.skillsReveal * Math.PI) ** 2
  output.backlightOpacity = 1 - smooth(t, .28, .54)
  output.dotOpacity *= 1 - smooth(t, .32, .57)
  output.laptopX += (.5 - output.laptopX) * center
  output.laptopY += (.54 - output.laptopY) * center
  output.laptopWidth += (.62 - output.laptopWidth) * center
  // The open lid is tilted -0.09rad relative to the chassis. Compensating
  // for it and the camera's pitch makes the display parallel to the viewport.
  const frontPitch = -Math.atan2(2.02, 10.2) + .09
  output.laptopRotationX += (frontPitch - output.laptopRotationX) * face
  output.laptopRotationY *= 1 - face
  output.laptopRotationZ *= 1 - face
  // Keep the screen opaque beneath the overlay throughout the matched handoff.
  output.laptopOpacity *= 1 - smooth(t, .70, .705)
  return output
}
