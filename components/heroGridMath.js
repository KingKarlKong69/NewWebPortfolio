const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export const HERO_GRID_RIPPLE_LIFETIME = 2.8
export const HERO_GRID_RIPPLE_LIMIT = 5
export const HERO_GRID_HOLD_LIMIT = 3.2
export const HERO_GRID_GLITCH_DURATION = 1.8
export const HERO_GRID_FULL_CHARGE = 0.985

export function isHeroGridInViewport(rect, viewportWidth, viewportHeight) {
  return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 &&
    rect.left < viewportWidth && rect.top < viewportHeight
}

// A tap retains the familiar small wave. Holding builds smoothly toward a
// bounded charge, so a long press cannot produce an unbounded deformation.
export function getHeroGridHoldCharge(heldSeconds) {
  if (!Number.isFinite(heldSeconds)) return 0
  const progress = clamp((heldSeconds - 0.12) / (HERO_GRID_HOLD_LIMIT - 0.12), 0, 1)
  return progress * progress * (3 - 2 * progress)
}

export function createHeroGridRipple(x, y, started, heldSeconds = 0, width = 1600, height = 455) {
  const charge = getHeroGridHoldCharge(heldSeconds)
  const speed = clamp(width * 0.25, 180, 430) * (1 + charge * 0.65)
  const farthest = Math.hypot(Math.max(x, width - x), Math.max(y, height - y))
  const glitchStart = charge >= HERO_GRID_FULL_CHARGE ? farthest / speed + 0.28 : 0
  return {
    x, y, started, charge,
    strength: 1 + charge * 2.2,
    reach: 1 + charge * 0.65,
    spreadSpeed: Math.max(260, width * 0.8),
    glitchStart,
    lifetime: glitchStart ? glitchStart + HERO_GRID_GLITCH_DURATION : HERO_GRID_RIPPLE_LIFETIME + charge * 2
  }
}

// Each charged release owns one finite sequence. Its glitch begins after the
// main wave reaches the furthest corner and ends exactly 1.8 seconds later.
export function getHeroGridReleaseState(ripple, now, output = {}) {
  const age = now - ripple.started
  const charged = ripple.charge >= HERO_GRID_FULL_CHARGE
  const active = age >= 0 && age < (ripple.lifetime ?? HERO_GRID_RIPPLE_LIFETIME)
  output.age = age
  output.charged = charged
  output.phase = !active ? 'complete' : charged && age >= ripple.glitchStart ? 'glitch' : 'wave'
  output.blast = active && charged ? Math.pow(clamp(1 - age / 0.72, 0, 1), 2) : 0
  output.neonRadius = active && charged ? age * ripple.spreadSpeed : 0
  output.glitch = output.phase === 'glitch' ? Math.min(1, (ripple.lifetime - age) / 0.16) : 0
  return output
}

// Return a smooth, finite funnel profile in local floor coordinates. Increasing
// charge narrows its throat while deepening the well; its rim stays local.
export function getHeroGridFunnel(hover, width, height, output = {}) {
  const held = clamp(hover.holdStrength || 0, 0, 1)
  const charge = clamp(hover.charge || 0, 0, 1)
  output.radius = clamp(width * 0.12, 74, 205)
  output.throat = 0.62 - charge * 0.42
  output.depth = Math.min(clamp(height * 0.5, 64, 190), Math.max(0, height - hover.y - 14)) * held * (0.09 + charge * 0.91)
  output.pull = held * (0.12 + charge * 0.63)
  output.charge = charge * held
  return output
}

// Keep the original hero's vanishing point and spacing at every viewport size.
export function createHeroGridLines(width, height) {
  const spacing = width < 700 ? 6 : 10
  const lines = []
  // Three subdivisions are revealed only around a charged well. They share
  // the same perspective as the normal grid, so the funnel contains an actual
  // connected wire mesh rather than a few isolated bent horizontal lines.
  for (let column = 0; column <= 88; column += 1) {
    const endX = (-960 + column * 40) / 1600 * width
    const startX = width * 0.5 + (endX - width * 0.5) * 0.4
    const steps = Math.max(18, Math.ceil(Math.hypot(endX - startX, height) / spacing))
    const points = Array.from({ length: steps + 1 }, (_, index) => {
      const progress = index / steps
      return { x: startX + (endX - startX) * progress, y: height * progress }
    })
    lines.push({ points, column: true, opacity: 1, detail: column % 4 !== 0 })
  }
  const rows = [0, 24, 56, 95, 143, 201, 271, 355, 455]
  for (let rowIndex = 0; rowIndex <= 32; rowIndex += 1) {
    const index = Math.floor(rowIndex / 4)
    const fraction = (rowIndex % 4) / 4
    const row = rows[index] + ((rows[index + 1] ?? rows[index]) - rows[index]) * fraction
    const steps = Math.max(20, Math.ceil(width / spacing))
    const points = Array.from({ length: steps + 1 }, (_, step) => ({
      x: step / steps * width, y: row / 455 * height
    }))
    lines.push({ points, column: false, opacity: 0.35 + rowIndex / 4 * 0.075, detail: rowIndex % 4 !== 0 })
  }
  return lines
}

// Coordinates are CSS pixels. Hover is a small local bend. A hold adds a
// tapered 3D depression with a narrow throat and inward tension at its rim.
// The portrait and page content never enter this drawing surface.
export function deformHeroGridPoint(point, hover, ripples, now, width, height, output = {}) {
  let offsetX = 0
  let offsetY = 0
  const edgeFade = Math.min(1, Math.max(0, point.y / 16), Math.max(0, (height - point.y) / 12))
  if (hover.strength > 0.001) {
    const dx = point.x - hover.x
    const dy = point.y - hover.y
    const held = clamp(hover.holdStrength || 0, 0, 1)
    const charge = clamp(hover.charge || 0, 0, 1)
    const radius = clamp(width * 0.12, 74, 205)
    const distance = Math.hypot(dx, dy / 0.64) / radius
    const influence = Math.exp(-distance * distance * 2) * hover.strength
    offsetX -= dx * 0.115 * influence
    offsetY += (radius * 0.068 - dy * 0.075) * influence
    if (held > 0.001) {
      const throat = 0.62 - charge * 0.42
      const rim = Math.pow(clamp(1 - distance / 1.55, 0, 1), 2)
      const funnel = rim / (1 + Math.pow(distance / throat, 1.65))
      const tension = held * (0.12 + charge * 0.63) * Math.exp(-distance * distance * 1.45)
      const depth = Math.min(clamp(height * 0.5, 64, 190), Math.max(0, height - hover.y - 14)) * held * (0.09 + charge * 0.91)
      offsetX -= dx * tension
      offsetY += depth * funnel - dy * tension * 0.3
    }
  }
  for (const ripple of ripples) {
    const age = now - ripple.started
    if (age < 0 || age >= (ripple.lifetime ?? HERO_GRID_RIPPLE_LIFETIME)) continue
    const dx = point.x - ripple.x
    const dy = point.y - ripple.y
    const distance = Math.hypot(dx, dy)
    const charge = clamp(ripple.charge || 0, 0, 1)
    const speed = clamp(width * 0.25, 180, 430) * (ripple.reach || 1)
    const phase = distance - age * speed
    const envelope = Math.exp(-Math.pow(phase / (62 + charge * 34), 2)) * Math.exp(-age * (1.05 - charge * 0.5))
    const wave = Math.sin(phase / (16 + charge * 8)) * envelope * clamp(height * 0.028, 5, 10) * (ripple.strength || 1)
    offsetY += wave
    if (distance > 1) offsetX += dx / distance * wave * 0.3
    if (charge >= HERO_GRID_FULL_CHARGE && age >= ripple.glitchStart) {
      // A finite banded chromatic tear, restricted to the floor bitmap.
      const fade = Math.min(1, (ripple.lifetime - age) / 0.16)
      const band = Math.floor(point.y / Math.max(10, height / 18))
      const tick = Math.floor((age - ripple.glitchStart) * 15)
      const tear = Math.sin(band * 17.17 + tick * 3.61)
      if (Math.abs(tear) > 0.62) offsetX += tear * clamp(width * 0.011, 4, 18) * fade
      offsetY += Math.sin(band * 5.21 + tick * 2.41) * 2 * fade
    }
  }
  // Several charged releases can overlap. Keep that combined energy inside
  // the grid's visual band even under repeated input.
  output.x = point.x + clamp(offsetX, -width * 0.09, width * 0.09) * edgeFade
  const verticalLimit = clamp(height * 0.55, 66, 210)
  output.y = point.y + clamp(offsetY, -verticalLimit, verticalLimit) * edgeFade
  return output
}
