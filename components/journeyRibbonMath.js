export const RIBBON_PANEL_COUNT = 14
export const RIBBON_STEP = Math.PI * 2 / RIBBON_PANEL_COUNT
export const MOSAIC_CORE_X = .34
export const MOSAIC_CORE_Y = .39
export const MOSAIC_CENTER_X = MOSAIC_CORE_X
export const MOSAIC_CENTER_Y = MOSAIC_CORE_Y
export const MOSAIC_RADIUS = .245
export const MOSAIC_FOCAL_RADIUS = 4.2
export const MOSAIC_PITCH = .18
export const MOSAIC_ROLL = .035
export const MOSAIC_PANEL_HEIGHT = .16

const TAU = Math.PI * 2
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback
const clamp = value => Math.max(0, Math.min(1, finite(value)))
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t) }
export const positiveModulo = (value, count) => ((value % count) + count) % count

// One complete row surrounds the origin, which is also the tesseract's actual
// depth. Near panels have positive Z; the rear half has negative Z.
const FORMATION_DELAYS = Array.from({ length: RIBBON_PANEL_COUNT }, (_, panel) => {
  const angle = panel * RIBBON_STEP
  return (1 - Math.cos(angle)) * .09
})

export function ribbonTransform(input = {}, output = {}) {
  output.pitch = MOSAIC_PITCH + Math.max(-.22, Math.min(.22, finite(input.ringTiltX)))
  output.yaw = Math.max(-.25, Math.min(.25, finite(input.ringTiltY)))
  output.offsetX = Math.max(-.018, Math.min(.018, finite(input.ringOffsetX)))
  output.offsetY = Math.max(-.018, Math.min(.018, finite(input.ringOffsetY)))
  return output
}

// Explicit perspective matches the GPU's cylindrical projection while keeping
// the shared Hero tesseract compatible with its orthographic scene camera.
export function projectMosaicPoint(angle, rowY, aspect = 2, output = {}, transform = {}) {
  const ratio = Math.max(.8, finite(aspect, 2))
  const { pitch, yaw, offsetX, offsetY } = ribbonTransform(transform)
  const radius = MOSAIC_RADIUS * ratio
  const x = Math.sin(angle) * radius
  const y = MOSAIC_CENTER_Y - rowY
  const z = Math.cos(angle) * radius
  const pitchedY = y * Math.cos(pitch) - z * Math.sin(pitch)
  const pitchedZ = y * Math.sin(pitch) + z * Math.cos(pitch)
  const yawedX = x * Math.cos(yaw) + pitchedZ * Math.sin(yaw)
  const yawedZ = -x * Math.sin(yaw) + pitchedZ * Math.cos(yaw)
  const rolledX = yawedX * Math.cos(MOSAIC_ROLL) - pitchedY * Math.sin(MOSAIC_ROLL)
  const rolledY = yawedX * Math.sin(MOSAIC_ROLL) + pitchedY * Math.cos(MOSAIC_ROLL)
  const focal = radius * MOSAIC_FOCAL_RADIUS
  const perspective = focal / (focal - yawedZ)
  output.x = MOSAIC_CENTER_X + offsetX + rolledX * perspective / ratio
  output.y = MOSAIC_CENTER_Y + offsetY - rolledY * perspective
  output.z = yawedZ
  output.perspective = perspective
  return output
}

export function sampleRibbonPanel(index, rotation, output = {}, aspect = 2, transform = {}) {
  const panel = positiveModulo(index | 0, RIBBON_PANEL_COUNT)
  const angle = positiveModulo(panel * RIBBON_STEP + finite(rotation) + Math.PI, TAU) - Math.PI
  const span = RIBBON_STEP * .975
  const center = projectMosaicPoint(angle, MOSAIC_CENTER_Y, aspect, output, transform)
  const left = projectMosaicPoint(angle - span / 2, MOSAIC_CENTER_Y, aspect, {}, transform)
  const right = projectMosaicPoint(angle + span / 2, MOSAIC_CENTER_Y, aspect, {}, transform)
  const top = projectMosaicPoint(angle, MOSAIC_CENTER_Y - MOSAIC_PANEL_HEIGHT / 2, aspect, {}, transform)
  const bottom = projectMosaicPoint(angle, MOSAIC_CENTER_Y + MOSAIC_PANEL_HEIGHT / 2, aspect, {}, transform)
  const { pitch, yaw } = ribbonTransform(transform)
  const facing = Math.max(0, Math.cos(angle) * Math.cos(pitch) * Math.cos(yaw) - Math.sin(angle) * Math.sin(yaw))
  center.width = Math.abs(right.x - left.x)
  center.height = Math.abs(bottom.y - top.y)
  center.rotationY = center.angle = angle
  center.rotationZ = MOSAIC_ROLL
  center.bend = center.angularWidth = span
  center.row = 0
  center.rowY = MOSAIC_CENTER_Y
  center.panelHeight = MOSAIC_PANEL_HEIGHT
  center.opacity = .72 + facing * .28
  center.brightness = .34 + facing * .66
  // Identity stays attached to the physical panel through the rear seam and
  // reverse dragging. Sparse memories simply repeat across the complete ring.
  center.photoStep = panel
  center.nextPhotoStep = panel
  center.photoMix = 0
  center.dominance = center.width * center.height * facing
  return center
}

export function ribbonFrontPanel(rotation, aspect = 2) {
  let panel = 0
  let highest = -1
  for (let index = 0; index < RIBBON_PANEL_COUNT; index++) {
    const pose = sampleRibbonPanel(index, rotation, {}, aspect)
    if (pose.dominance > highest) { panel = index; highest = pose.dominance }
  }
  return panel
}

export function ribbonFrontImage(rotation, imageCount, aspect = 2) {
  return positiveModulo(ribbonFrontPanel(rotation, aspect), Math.max(1, imageCount | 0))
}

export function ribbonFormation(index, progress) {
  // Fill the front first, then the curling sides and rear. All panels
  // have settled before progress reaches one, regardless of photo count.
  const delay = FORMATION_DELAYS[positiveModulo(index | 0, RIBBON_PANEL_COUNT)]
  return clamp((finite(progress) - delay) / .73)
}

export function sampleRibbonFormation(pose, index, progress, coreX, coreY, output = {}) {
  const local = ribbonFormation(index, progress)
  const ease = smooth(local)
  const curl = Math.sin(Math.PI * local) * (1 - local)
  const angle = (1 - local) * Math.PI * 2.25 + index * .37
  output.x = finite(coreX, MOSAIC_CORE_X) + (pose.x - finite(coreX, MOSAIC_CORE_X)) * ease + Math.sin(angle) * curl * .105
  output.y = finite(coreY, MOSAIC_CORE_Y) + (pose.y - finite(coreY, MOSAIC_CORE_Y)) * ease + Math.cos(angle) * curl * .08
  output.scale = .025 + ease * .975
  output.twist = (1 - ease) * .62
  output.local = local
  return output
}

export function ribbonCoverScale(imageAspect, panelAspect) {
  const image = Math.max(.001, finite(imageAspect, 1))
  const panel = Math.max(.001, finite(panelAspect, 1))
  return image > panel ? [panel / image, 1] : [1, image / panel]
}
