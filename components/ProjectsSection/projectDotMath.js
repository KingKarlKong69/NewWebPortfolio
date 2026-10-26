const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

// Keep every dot on the same lattice after a resize. Variation comes from
// illumination rather than random placement, matching a perforated display.
export function createProjectDots(width, height, spacing = 19) {
  const dots = []
  const columns = Math.ceil(width / spacing)
  const rows = Math.ceil(height / spacing)
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const x = column * spacing + spacing / 2
      const y = row * spacing + spacing / 2
      const contour = Math.sin(x * 0.006 + Math.sin(y * 0.004) * 1.7)
      const shade = 0.5 + contour * Math.sin(y * 0.0065 - x * 0.0016) * 0.5
      dots.push({ x, y, alpha: 0.05 + shade * 0.09, radius: 0.55 + shade * 0.18 })
    }
  }
  return dots
}

export const PROJECT_DOT_WAVE_SPEED = 620

export function projectDotWaveStrength(distance, age, maximumRadius) {
  if (age < 0 || maximumRadius <= 0) return 0
  const radius = age * PROJECT_DOT_WAVE_SPEED
  // The band travels beyond the furthest corner before it disappears.
  if (radius > maximumRadius + 100) return 0
  const band = Math.exp(-(((distance - radius) / 37) ** 2))
  return band * (0.85 - clamp(radius / maximumRadius, 0, 1) * 0.47)
}

export function projectDotHoverStrength(x, y, pointerX, pointerY, elapsed, strength = 1) {
  const dx = x - pointerX
  const dy = y - pointerY
  const distanceSquared = dx * dx + dy * dy
  if (distanceSquared > 320 * 320 || strength <= 0) return 0
  const envelope = Math.exp(-distanceSquared / (2 * 105 * 105))
  // Several soft lobes pulse together, giving the cursor a cluster of dots
  // instead of painting a hard disc or moving the grid out of alignment.
  const lobe = 0.7 + Math.sin(dx * 0.025 + dy * 0.014 + elapsed * 2.4) * 0.14
    + Math.cos(dy * 0.031 - elapsed * 1.7) * 0.12
  return envelope * lobe * strength
}

export function projectDotWaveReach(x, y, width, height) {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y))
}
