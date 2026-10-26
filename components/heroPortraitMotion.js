const clamp = value => Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0))

// The same transform carries the photo, its light, trails, and the hand anchor.
// Time is active scene time so returning from another tab cannot jump the pose.
export function sampleHeroPortraitMotion(pointerX, pointerY, elapsed, compact = false, output = {}) {
  const x = clamp(pointerX)
  const y = clamp(pointerY)
  const phase = elapsed * Math.PI * 2 / 7.8
  output.idleY = Math.sin(phase) * (compact ? 2.2 : 3.6)
  output.x = x * (compact ? 4 : 8)
  output.y = y * (compact ? 2.5 : 4) + output.idleY
  output.rotateX = -y * (compact ? 0.8 : 1.35)
  output.rotateY = x * (compact ? 1.25 : 2.2)
  output.rotateZ = x * (compact ? 0.16 : 0.28) + Math.sin(phase) * 0.055
  return output
}
