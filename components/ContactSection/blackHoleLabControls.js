const control = (key, label, min, max, step, defaultValue, help) => Object.freeze({
  key, label, min, max, step, defaultValue, ...(help ? {help} : {})
})
const toggle = (key, label, defaultValue = 1, help) => Object.freeze({
  ...control(key, label, 0, 1, 1, defaultValue, help), kind: 'toggle'
})

const localMaterialGroups = [
  ['disk', 'Disk'], ['upper', 'Upper arc'], ['lower', 'Lower arc']
].map(([prefix, label]) => ({
  id: `${prefix}Material`, category: 'blackhole', label: `${label} filaments & turbulence`, controls: [
    ['FilamentDensity', 'Filament density', .25],
    ['FilamentContrast', 'Filament contrast', 0],
    ['TurbulenceStrength', 'Turbulence strength', 0],
    ['TurbulenceScale', 'Turbulence scale', .25],
    ['GrainStrength', 'Grain strength', 0],
    ['FineDetail', 'Fine detail', 0],
    ['FlowSpeed', 'Flow speed', 0]
  ].map(([suffix, name, min]) => control(`${prefix}${suffix}`, `${name} multiplier`, min, 2, .05, 1,
    `Multiplies the general ${name.toLowerCase()} setting for the ${label.toLowerCase()}. 1 inherits the general setting.`))
}))

export const LAB_PRESET_VERSION = 3
export const LAB_CATEGORIES = Object.freeze([
  {id: 'blackhole', label: 'Black hole'},
  {id: 'universe', label: 'Universe'},
  {id: 'curvature', label: 'Curvature'}
].map(Object.freeze))

export const LAB_GROUPS = Object.freeze([
  {id: 'horizon', category: 'blackhole', label: 'Event horizon', controls: [
    control('coreRadius', 'Core radius', .25, .8, .01, .52),
    control('edgeSoftness', 'Rim softness', .001, .05, .001, .003, 'Softens the authored light rim. The opaque 3D horizon uses geometric antialiasing.'),
    control('coreDarkness', 'Core darkness', 0, 1, .01, 1),
    control('coreEdgeWarmth', 'Shadow edge warmth', 0, 1, .01, .35, 'Restrained amber light at the boundary; the shadow center stays smooth and dark.'),
    control('coreEdgeWidth', 'Shadow edge width', .01, .3, .005, .08, 'Width of the optical edge tint, not a blur of the silhouette.')
  ]},
  {id: 'disk', category: 'blackhole', label: '3D accretion disk', controls: [
    control('diskInclination', 'Inclination (degrees)', 0, 65, 1, 12, '0 is edge-on. This changes the viewing angle, not the material thickness.'),
    control('diskYaw', 'Yaw (degrees)', -35, 35, 1, 0),
    control('diskThickness', 'Vertical thickness', .02, .6, .01, .12, 'Physical cross-sectional depth of the disk.'),
    control('diskExtent', 'Radial extent', .65, 1.5, .01, 1),
    control('diskDensity', 'Density / opacity', .05, 3, .05, 1),
    control('diskHeight', 'Vertical position', -.3, .3, .01, 0)
  ]},
  {id: 'gas', category: 'blackhole', label: 'Disk form & gas', controls: [
    control('diskEdgeTaper', 'Edge taper', 0, 1, .05, .9),
    control('diskEdgeSoftness', 'Edge softness', .02, .6, .01, .22),
    control('diskCloudCoverage', 'Cloud coverage', .1, 1, .05, .8),
    control('diskCloudScale', 'Cloud scale', .5, 8, .1, 2),
    control('diskClumpiness', 'Clumpiness', 0, 1, .05, .3),
    control('diskFilamentStrength', 'Filament strength', 0, 2, .05, 1),
    control('diskDustAmount', 'Dust amount', 0, 1, .05, .2),
    control('diskDisplacement', 'Surface displacement', 0, .3, .01, .08),
    control('diskFlowCoherence', 'Flow coherence', 0, 1, .05, .85, 'Higher values keep the gas in smooth, connected streams.'),
    control('diskArcBlend', 'Arc blending', 0, 1, .05, .75, 'Shares gas structure and soft illumination with the lensed arcs.')
  ]},
  {id: 'upper', category: 'blackhole', label: 'Upper lensed arc', controls: [
    control('upperThickness', 'Main thickness', .02, .32, .005, .125),
    control('upperDepth', 'Ribbon depth', 0, .35, .005, .09, 'Depth and separation of the curved lens-image sheets. Artistically approximated lensing.'),
    control('upperJunctionBlend', 'Junction blending', 0, 1, .05, .8),
    control('outerSpread', 'Outer spread', .04, .45, .01, .2),
    control('upperHeight', 'Vertical position', -.25, .25, .005, 0),
    control('upperBrightness', 'Brightness', 0, 3, .01, 1),
    control('upperEmphasis', 'Upper-arc emphasis', 0, 5, .05, 2.65)
  ]},
  {id: 'lower', category: 'blackhole', label: 'Lower returning arc', controls: [
    control('lowerThickness', 'Thickness', .01, .2, .005, .045),
    control('lowerDepth', 'Ribbon depth', 0, .35, .005, .06, 'Depth and separation of the curved lens-image sheets. Artistically approximated lensing.'),
    control('lowerJunctionBlend', 'Junction blending', 0, 1, .05, .8),
    control('lowerHeight', 'Vertical position', -.2, .3, .005, .025),
    control('lowerBrightness', 'Brightness', 0, 2.5, .05, .8),
    control('lowerVisibility', 'Visibility', 0, 1, .01, 1)
  ]},
  {id: 'material', category: 'blackhole', label: 'General filaments & turbulence', controls: [
    control('filamentDensity', 'Filament density', 20, 400, 1, 172),
    control('filamentContrast', 'Filament contrast', 0, 2, .01, 1),
    control('noiseScale', 'Noise scale', .5, 12, .1, 4.6),
    control('noiseStrength', 'Noise strength', 0, 2, .01, 1),
    control('noiseFactor', 'Noise factor', 0, .1, .0001, 0, 'Adds sandy material grain independently of turbulence. 0 removes this added grain; this approximates the reference appearance without raymarching.'),
    control('broadTurbulence', 'Broad turbulence', 0, 1.8, .01, .7),
    control('fineGrain', 'Fine grain', 0, .8, .01, .19),
    control('grainScale', 'Grain scale', .5, 3, .05, 1, 'Higher values make the sandy grains finer without increasing their strength.'),
    control('rotationSpeed', 'Rotation speed', -3, 3, .05, 1, 'Negative values reverse the material flow.')
  ]},
  ...localMaterialGroups,
  {id: 'light', category: 'blackhole', label: 'Heat & glow', controls: [
    control('copperIntensity', 'Copper intensity', 0, 2.5, .05, 1),
    control('amberIntensity', 'Amber intensity', 0, 2.5, .05, 1),
    control('whiteHotIntensity', 'White-hot intensity', 0, 2.5, .05, 1),
    control('haloStrength', 'Halo strength', 0, 5, .05, 1),
    control('exposure', 'Exposure', .2, 3, .01, 1.22),
    control('colorTemperature', 'Color temperature', -1, 1, .01, 0, 'Cooler at the left, warmer at the right.')
  ]},
  {id: 'quality', category: 'blackhole', label: 'Rendering quality', controls: [
    control('pixelRatio', 'Pixel ratio', .5, 2, .05, .9, 'Higher values render more pixels and use more GPU time.'),
    control('noiseDetail', 'Noise detail', 1, 4, 1, 3),
    control('filamentDetail', 'Filament detail', 1, 3, 1, 2),
    control('edgeSmoothing', 'Edge smoothing', .5, 2, .05, 1, 'Shader edge smoothing; does not recreate the renderer.')
  ]},
  {id: 'universe', category: 'universe', label: 'Universe', controls: [
    toggle('universeEnabled', 'Universe enabled', 1, 'Switches stars and asteroids together. Individual layer settings are kept.')
  ]},
  {id: 'distant', category: 'universe', label: 'Distant stars', controls: [
    toggle('distantEnabled', 'Distant stars enabled'),
    control('distantCount', 'Quantity', 0, 2200, 1, 1000),
    control('distantSize', 'Size', .3, 3, .1, 1),
    control('distantBrightness', 'Brightness', 0, 2, .05, .65),
    control('twinkleAmount', 'Twinkle amount', 0, 1, .05, .25),
    control('twinkleSpeed', 'Twinkle speed', 0, 4, .1, 1)
  ]},
  {id: 'moving', category: 'universe', label: 'Moving stars', controls: [
    toggle('movingEnabled', 'Moving stars enabled'),
    control('movingCount', 'Quantity', 0, 1000, 1, 260),
    control('movingSpeed', 'Travel speed', 0, .3, .005, .04),
    control('movingDirection', 'Direction (degrees)', -180, 180, 1, 0),
    control('movingDepth', 'Depth spread', 0, 2, .05, 1),
    control('movingSize', 'Size', .3, 4, .1, 1),
    control('movingBrightness', 'Brightness', 0, 2, .05, .8),
    control('movingTrail', 'Trail length', 0, 2, .05, .4)
  ]},
  {id: 'accent', category: 'universe', label: 'Accent stars', controls: [
    toggle('accentEnabled', 'Accent stars enabled'),
    control('accentCount', 'Quantity', 0, 100, 1, 62),
    control('accentSize', 'Size', .3, 3, .1, 1),
    control('accentHalo', 'Halo strength', 0, 3, .05, 1),
    control('accentViolet', 'Violet balance', 0, 1, .05, .25)
  ]},
  {id: 'glints', category: 'universe', label: 'Stellar glints', controls: [
    toggle('glintsEnabled', 'Glints enabled'),
    control('glintFrequency', 'Opportunities per second', .02, 1, .001, .167),
    control('glintProbability', 'Chance per opportunity', 0, 1, .05, .5),
    control('glintIntensity', 'Intensity', 0, 3, .05, 1),
    control('glintDuration', 'Duration (seconds)', .2, 6, .1, 2)
  ]},
  {id: 'asteroids', category: 'universe', label: 'Asteroids', controls: [
    toggle('asteroidsEnabled', 'Asteroids enabled'),
    control('asteroidCount', 'Quantity', 0, 12, 1, 5),
    control('asteroidSpeed', 'Travel speed', 0, 3, .05, 1),
    control('asteroidSize', 'Size', .2, 3, .1, 1),
    control('asteroidNearFraction', 'Near-camera fraction', 0, 1, .05, .35),
    control('foregroundBlur', 'Foreground blur', 0, 10, .5, 3.5)
  ]},
  {id: 'curvature', category: 'curvature', label: 'Localized spacetime curvature', controls: [
    toggle('curvatureEnabled', 'Curvature enabled'),
    control('curvatureRadius', 'Influence radius', .5, 3, .05, 1.4),
    control('curvatureStrength', 'Distortion strength', 0, 1.5, .05, .45),
    control('curvatureRadial', 'Radial bending', 0, 2, .05, .8),
    control('curvatureTangential', 'Tangential bending', -1, 1, .05, .25),
    control('curvatureStretch', 'Stretch amount', 0, 1, .05, .35),
    control('curvatureSoftness', 'Boundary softness', .1, 1, .05, .6)
  ]},
  {id: 'curvatureLayers', category: 'curvature', label: 'Affected depth layers', controls: [
    toggle('curveDistant', 'Distant stars'),
    toggle('curveMoving', 'Moving stars'),
    toggle('curveAccent', 'Accent stars'),
    toggle('curveAsteroids', 'Background asteroids'),
    toggle('curveForeground', 'Foreground asteroids', 0, 'Close asteroids bypass distortion by default to preserve depth.')
  ]}
].map(group => Object.freeze({...group, controls: Object.freeze(group.controls)})))

// Read old presets without presenting projection stretch as physical thickness.
export const LAB_LEGACY_CONTROLS = Object.freeze([
  control('foregroundThickness', 'Legacy projection spread', .4, 2.5, .05, 1, 'Retained for old 2D presets only. It does not set 3D thickness.')
])
export const LAB_CONTROLS = Object.freeze([...LAB_GROUPS.flatMap(group => group.controls), ...LAB_LEGACY_CONTROLS])
const controlsByKey = new Map(LAB_CONTROLS.map(entry => [entry.key, entry]))
export const LAB_DEFAULTS = Object.freeze(Object.fromEntries(LAB_CONTROLS.map(entry => [entry.key, entry.defaultValue])))
// Older snapshots must not pick up newly tuned material or shape settings.
const v3Defaults = Object.freeze(Object.fromEntries([
  'noiseFactor', 'grainScale', 'coreEdgeWarmth', 'coreEdgeWidth',
  'upperDepth', 'lowerDepth', 'upperJunctionBlend', 'lowerJunctionBlend',
  ...localMaterialGroups.flatMap(group => group.controls.map(entry => entry.key))
].map(key => [key, LAB_DEFAULTS[key]])))

const qualityPreset = (label, pixelRatio, noiseDetail, filamentDetail, edgeSmoothing) => Object.freeze({
  label, values: Object.freeze({pixelRatio, noiseDetail, filamentDetail, edgeSmoothing})
})
export const LAB_PRESETS = Object.freeze({
  performance: qualityPreset('Performance', .65, 1, 1, 1),
  high: qualityPreset('High', .9, 3, 2, 1),
  ultra: qualityPreset('Ultra', 1.5, 4, 3, 1.25)
})

// Require a complete decimal entry. Empty strings, trailing decimal points and
// partially typed exponents must never become zero or NaN in a shader uniform.
const decimal = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i
const numericValue = raw => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string' || !decimal.test(raw.trim())) return null
  const value = Number(raw.trim())
  return Number.isFinite(value) ? value : null
}
const record = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const bounded = (entry, value) => {
  const clamped = Math.min(entry.max, Math.max(entry.min, value))
  const snapped = entry.min + Math.round((clamped - entry.min) / entry.step) * entry.step
  // Decimal rounding removes floating point tails before the UI and shader see them.
  return Math.min(entry.max, Math.max(entry.min, Number(snapped.toFixed(6))))
}

export function sanitizeLabValue(key, raw, previous = LAB_DEFAULTS[key]) {
  const entry = controlsByKey.get(key)
  if (!entry) return undefined
  const value = numericValue(raw)
  const last = numericValue(previous)
  return bounded(entry, value ?? last ?? entry.defaultValue)
}

export function sanitizeLabValues(source, fallback = LAB_DEFAULTS) {
  const input = record(source) ? source : {}
  const previous = record(fallback) ? fallback : LAB_DEFAULTS
  return Object.fromEntries(LAB_CONTROLS.map(entry => [entry.key,
    sanitizeLabValue(entry.key, own(input, entry.key) ? input[entry.key] : undefined,
      own(previous, entry.key) ? previous[entry.key] : entry.defaultValue)
  ]))
}

export function resetLabGroupValues(source, groupId) {
  const group = LAB_GROUPS.find(entry => entry.id === groupId)
  if (!group) throw new Error('Unknown lab control group.')
  return sanitizeLabValues(Object.fromEntries(group.controls.map(entry => [entry.key, entry.defaultValue])), source)
}

export function parseLabPreset(text, fallback = LAB_DEFAULTS) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 32768) {
    throw new Error('Preset must be JSON text smaller than 32 KB.')
  }
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error('Preset is not valid JSON.') }
  if (!record(parsed)) throw new Error('Preset must contain a values object.')
  const wrapped = own(parsed, 'values') || own(parsed, 'version')
  if (wrapped && ![1, 2, LAB_PRESET_VERSION].includes(parsed.version)) {
    throw new Error('Unsupported preset version. Use version 1, 2 or 3.')
  }
  const values = wrapped ? parsed.values : parsed
  if (!record(values)) throw new Error('Preset values must be an object.')
  let recognized = 0
  for (const entry of LAB_CONTROLS) {
    if (!own(values, entry.key)) continue
    recognized++
    const value = numericValue(values[entry.key])
    if (value === null || value < entry.min || value > entry.max || (entry.kind === 'toggle' && value !== 0 && value !== 1)) {
      throw new Error(`${entry.label} must be a finite number between ${entry.min} and ${entry.max}.`)
    }
  }
  if (!recognized) throw new Error('Preset contains no recognized lab controls.')
  const previous = wrapped && parsed.version === 1 ? LAB_DEFAULTS : fallback
  const legacy = wrapped && parsed.version < LAB_PRESET_VERSION
  return sanitizeLabValues(values, legacy ? {...(record(previous) ? previous : LAB_DEFAULTS), ...v3Defaults} : previous)
}
