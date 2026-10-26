// One reversible camera path. Input remains native page scrolling.
export const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
export const smoothRange = (value, start, end) => {
  const t = clamp01((value - start) / (end - start))
  return t * t * (3 - 2 * t)
}
const KEYS = [
  [0, [0, 4, 23]], [.105, [0, 4, 23]],
  [.25, [-4, -9, 12]], [.31, [-4, -9, 12]],
  [.41, [5, -9, 5]], [.45, [5, -9, 5]],
  [.55, [6, -17, 17], 0], [.60, [6, -17, 17], 0],
  [.70, [-1.5, -12.5, 27]], [.83, [-1.5, -12.5, 27]],
  [1, [-1.5, -12.5, 27]]
]
export function sampleServicesStory(value) {
  const progress = clamp01(value)
  const titleProgress = Math.min(progress / .66, 1)
  let index = KEYS.findIndex((key, i) => i < KEYS.length - 1 && titleProgress <= KEYS[i + 1][0])
  if (index < 0) index = KEYS.length - 2
  const [start, a] = KEYS[index]
  const [end, b] = KEYS[index + 1]
  const blend = smoothRange(titleProgress, start, end)
  const lookA=KEYS[index][2]??a[0], lookB=KEYS[index+1][2]??b[0]
  return {
    progress,
    camera: a.map((axis, i) => axis + (b[i] - axis) * blend),
    lookX:lookA+(lookB-lookA)*blend,
    dissolve: smoothRange(progress, .48, .63),
    assembly: smoothRange(progress, .64, .84),
    deck: smoothRange(progress, .72, .86),
    deckY: (1 - smoothRange(progress, .76, .88)) * 5,
    phase: progress < .1 ? 'services' : progress < .24 ? 'what' : progress < .32 ? 'i' : progress < .41 ? 'offer' : progress < .48 ? 'together' : progress < .64 ? 'disintegrate' : progress < .86 ? 'assemble' : 'deck'
  }
}

// Stable, surface-sampled origins are supplied by Three.js. Destinations map
// to the five image columns; the same input yields the same reverse journey.
export function sampleServiceParticle(source, destination, seed, value, state) {
  const {dissolve, assembly} = state || sampleServicesStory(value)
  const angle = dissolve * Math.PI * 1.25 + assembly * Math.PI * .8
  const c = Math.cos(angle), s = Math.sin(angle)
  const spread = Math.sin(dissolve * Math.PI * .5) * (1 - assembly)
  const x = source[0] * c - (source[1] + 12.5) * s
  const y = source[0] * s + (source[1] + 12.5) * c - 12.5
  const burst = [x + Math.sin(seed * 18.7) * spread * 4, y + Math.cos(seed * 24.1) * spread * 3, source[2] + Math.sin(seed * 31.4) * spread * 5]
  const column = Math.min(4, Math.floor(seed * 5))
  const settle = smoothRange(assembly, column * .12, .48 + column * .12)
  if(settle>=1)return destination.slice()
  if(dissolve===0&&assembly===0)return source.slice()
  return burst.map((axis, i) => axis + (destination[i] - axis) * settle)
}
