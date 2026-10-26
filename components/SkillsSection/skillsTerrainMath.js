// Fixed coordinates and seeded noise keep assembly and reverse travel identical.
export const SKILLS_MOUNTAIN_CENTERS = [0, 88, 176, 264, 352]
export const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
export const smooth = (value, start, end) => {
  const t = clamp01((value - start) / (end - start))
  return t * t * (3 - 2 * t)
}
const fract = value => value - Math.floor(value)
export const skillsHash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7 + 71.83) * 43758.5453123)
export function skillsNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = skillsHash(ix, iy), b = skillsHash(ix + 1, iy)
  const c = skillsHash(ix, iy + 1), d = skillsHash(ix + 1, iy + 1)
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
}
export const skillsRidge = (x, z) => 1 - Math.abs(skillsNoise(x, z) * 2 - 1)
const peak = (x, z, px, pz, sx, sz) => Math.exp(-(((x - px) / sx) ** 2 + ((z - pz) / sz) ** 2))
const HEIGHTS = [17, 19.5, 24, 19, 22]
const WIDTHS = [19, 24, 17, 28, 18]

// One height field is shared by ground, mountain meshes, markers and the route.
// The five authored masses control composition; noise adds repeatable erosion.
export function skillsTerrainBaseHeight(x, z) {
  const warp = (skillsNoise(x * .045, z * .045) - .5) * 9
  const large = skillsRidge((x + warp) * .09, z * .075)
  const folded = skillsRidge(x * .29 + z * .11, z * .23 - x * .06)
  const near = smooth(z, -64, 20)
  const shelf = peak(x, z, 38, -9, 18, 10)
  const rock = large ** 3 * (.75 + near * 1.2) + folded ** 3 * (.35 + near * .8) +
    skillsNoise(x * .91, z * .83) * (.13 + near * .28) +
    skillsRidge(x * 1.12 + large * 2.7, z * .97) ** 5 * near * .3
  // A low, continuous foreground carries the route even beyond the final peak.
  return .12 + rock * (1 - shelf * .62)
}

export function skillsMountainReveal(x, travel) {
  const center = Math.max(0, Math.min(4, Math.round((x - 15) / 88))) * 88
  return smooth(travel, center - 42, center - 8)
}

export function skillsTerrainHeight(x, z) {
  const warp = (skillsNoise(x * .045, z * .045) - .5) * 9
  const large = skillsRidge((x + warp) * .09, z * .075)
  let mountains = 0
  for (let index = 0; index < SKILLS_MOUNTAIN_CENTERS.length; index++) {
    const center = SKILLS_MOUNTAIN_CENTERS[index]
    const localX = x - center - 15, localZ = z + 49 + (index % 2) * 4
    const tent = Math.max(0, 1 - Math.abs(localX) / WIDTHS[index] - Math.abs(localZ) / 29)
    const spineZ = localZ + (skillsNoise(x * .19, index * 7.3) - .5) * 8
    const spine = Math.exp(-Math.abs(spineZ) / 4.8) * Math.max(0, 1 - Math.abs(localX) / WIDTHS[index])
    mountains += (peak(x, z, center + 15, -49 - (index % 2) * 4, WIDTHS[index], 21) * .47 +
      tent ** .85 * .58 + spine * (.2 + skillsRidge(x * .31, index * 3.1) ** 2 * .24)) * HEIGHTS[index]
    mountains += peak(x, z, center - 15, -72, 20, 20) * (7 + index * .6)
    mountains += peak(x, z, center + 41, -65, 18, 17) * (8.7 + index * .7)
  }
  const ending = 1 - smooth(x, 382, 432) * .88
  return skillsTerrainBaseHeight(x, z) + mountains * (.58 + large * .48) * .89 * ending
}

export const skillsTerrainHeightAtTravel = (x, z, travel) => {
  const base = skillsTerrainBaseHeight(x, z)
  return base + (skillsTerrainHeight(x, z) - base) * skillsMountainReveal(x, travel)
}

export function skillsDistantHeight(x, z, band = 'distant') {
  const n = skillsRidge(x * .025 + skillsNoise(x * .009, z * .01) * 1.7, z * .032)
  const folds = skillsRidge(x * .075 + z * .014, z * .051)
  const amplitude = band === 'distant' ? 17 : 12
  const ending = 1 - smooth(x, 410, 490) * .75
  return (.6 + n ** 2.7 * amplitude + folds ** 3 * 4.5) * ending
}

// Every terrain band meets the exact same height field at its shared edge.
// Broad blend shoulders preserve the silhouettes without detached strips or
// vertical skirts. The base variant also meets the undiscovered entry ground.
export function skillsTerrainBandHeight(x, z, band, baseOnly = false) {
  if (band === 'primary' || band === 'foreground') {
    return baseOnly ? skillsTerrainBaseHeight(x, z) : skillsTerrainHeight(x, z)
  }
  const secondary = skillsDistantHeight(x, z, 'secondary')
  if (band === 'secondary') {
    const blend = smooth(z, -116, -88)
    if (blend === 0) return secondary
    const ground = baseOnly ? skillsTerrainBaseHeight(x, z) : skillsTerrainHeight(x, z)
    return secondary + (ground - secondary) * blend
  }
  const distant = skillsDistantHeight(x, z, 'distant')
  const blend = smooth(z, -184, -150)
  return distant + (secondary - distant) * blend
}

export const skillsTerrainBandHeightAtTravel = (x, z, band, travel) => {
  const base = skillsTerrainBandHeight(x, z, band, true)
  const full = skillsTerrainBandHeight(x, z, band)
  return base + (full - base) * skillsMountainReveal(x, travel)
}

export function skillsTerrainBuildDelay(x, z, zStart, zEnd, band) {
  const bandDelay = band === 'distant' ? .025 : band === 'secondary' ? .14 : band === 'primary' ? .27 : .5
  return bandDelay + smooth(x, -115, 10) * .085 + smooth(z, zStart, zEnd) * .095 +
    skillsNoise(x * .05, z * .05) * .035
}
