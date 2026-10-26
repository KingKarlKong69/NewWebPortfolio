// One reversible timeline for the desktop About scene. All ranges use normalized
// scroll progress so wheel, trackpad, keyboard, and reverse scrolling agree.
export const ABOUT_STORY_STOPS = Object.freeze([0, 0.37, 0.61, 0.77, 0.89, 1])

const clamp01 = value => Math.min(1, Math.max(0, value))
const smooth = (value, start, end) => {
  const t = clamp01((value - start) / (end - start))
  return t * t * (3 - 2 * t)
}

const LINE_STOPS = [
  [0.54, 0],
  [0.64, 0.30],
  [0.70, 0.42],
  [0.84, 0.65],
  [0.98, 1],
]

const sampleLineProgress = progress => {
  if (progress <= LINE_STOPS[0][0]) return 0
  for (let index = 1; index < LINE_STOPS.length; index += 1) {
    const [end, endValue] = LINE_STOPS[index]
    if (progress <= end) {
      const [start, startValue] = LINE_STOPS[index - 1]
      return startValue + (endValue - startValue) * smooth(progress, start, end)
    }
  }
  return 1
}

export function sampleAboutStory(progress, output = {}) {
  const p = typeof progress === 'number' && !Number.isNaN(progress) ? clamp01(progress) : 0
  const firstPoseChange = smooth(p, 0.44, 0.49)
  const secondPoseChange = smooth(p, 0.55, 0.60)
  const thirdPoseChange = smooth(p, 0.64, 0.69)
  const bio0In = smooth(p, 0.67, 0.70)
  const bio0Out = smooth(p, 0.77, 0.79)
  const bio1In = smooth(p, 0.79, 0.81)
  const bio1Out = smooth(p, 0.89, 0.91)
  const bio2In = smooth(p, 0.91, 0.94)

  output.progress = p
  output.introOpacity = smooth(p, 0, 0.035) * (1 - smooth(p, 0.09, 0.16))
  output.heroDim = smooth(p, 0.09, 0.18)
  output.titleOpacity = smooth(p, 0.12, 0.18)
  output.titleBlur = 18 * (1 - smooth(p, 0.14, 0.28))
  output.titleDock = smooth(p, 0.30, 0.39)
  output.portraitReveal = smooth(p, 0.19, 0.28)
  output.portraitRise = 1 - smooth(p, 0.19, 0.29)
  output.portraitBrightness = 0.035 + 0.965 * smooth(p, 0.27, 0.38)
  output.portraitBlur = 12 * (1 - smooth(p, 0.22, 0.37))
  output.portraitDock = smooth(p, 0.37, 0.53)
  output.firstLine = smooth(p, 0.39, 0.45)
  output.secondLine = smooth(p, 0.46, 0.53)
  output.lineProgress = sampleLineProgress(p)
  output.labelCyan = smooth(p, 0.64, 0.70)

  // Adjacent crossfades sum to exactly one, including every transition frame.
  output.pose0Opacity = 1 - firstPoseChange
  output.pose1Opacity = firstPoseChange - secondPoseChange
  output.pose2Opacity = secondPoseChange - thirdPoseChange
  output.pose3Opacity = thirdPoseChange

  output.bio0Opacity = bio0In * (1 - bio0Out)
  output.bio0Y = 18 * (1 - bio0In) - 16 * bio0Out
  output.bio1Opacity = bio1In * (1 - bio1Out)
  output.bio1Y = 18 * (1 - bio1In) - 16 * bio1Out
  output.bio2Opacity = bio2In
  output.bio2Y = 18 * (1 - bio2In)
  output.stage = 0
  for (let index = 1; index < ABOUT_STORY_STOPS.length; index += 1) {
    if (p >= ABOUT_STORY_STOPS[index]) output.stage = index
  }
  return output
}
