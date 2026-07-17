export const BLACK_HOLE_RESTORED_TUNING = Object.freeze({
  blackHoleScale: 1,
  raymarchQuality: 0.82,
  centerX: 0.56,
  centerY: 0.5,
  horizonScale: 1,
  lensingStrength: 1,
  motionSpeed: 1,
  rotationSpeed: 1,
  noiseSpeed: 1,
  gasDensity: 1,
  diskThickness: 1,
  cloudScale: 1,
  fineDetail: 1,
  filamentStrength: 1,
  cloudBreakup: 0,
  foregroundThickness: 1,
  foregroundBreakup: 0,
  gasDevelopment: 0,
  photonGlow: 1,
  photonThickness: 1,
  equatorialGlow: 1,
  exposure: 1,
  dustBrightness: 1,
  pointerStrength: 1,
  outerColor: '#2e0b03',
  middleColor: '#ff470b',
  hotColor: '#ffb06b',
  hotColorBoost: 1.55
})

export const BLACK_HOLE_PRODUCTION_TUNING = Object.freeze({
  ...BLACK_HOLE_RESTORED_TUNING,
  raymarchQuality: 0.74,
  lensingStrength: 1.8,
  motionSpeed: 0.98,
  rotationSpeed: 1.37,
  noiseSpeed: 0.82,
  gasDensity: 0.9,
  diskThickness: 1.61,
  cloudScale: 0.86,
  fineDetail: 1.19,
  filamentStrength: 1.07,
  cloudBreakup: 0.85,
  foregroundThickness: 0.47,
  foregroundBreakup: 0.11,
  gasDevelopment: 1,
  photonGlow: 2.5,
  photonThickness: 1.19,
  equatorialGlow: 2.2,
  exposure: 1.07,
  dustBrightness: 0.19,
  outerColor: '#1f45db',
  middleColor: '#ee00ff',
  hotColor: '#a75c1b',
  hotColorBoost: 1.68
})

export const BLACK_HOLE_GAS_DEVELOPMENT_TUNING = Object.freeze({
  ...BLACK_HOLE_RESTORED_TUNING,
  gasDensity: 1.08,
  diskThickness: 1.18,
  cloudScale: 0.86,
  fineDetail: 0.72,
  filamentStrength: 1.18,
  cloudBreakup: 0.58,
  foregroundThickness: 1.34,
  foregroundBreakup: 0.72,
  gasDevelopment: 1,
  photonGlow: 1.08,
  photonThickness: 0.9,
  equatorialGlow: 0.58,
  exposure: 1.04,
  dustBrightness: 1.12,
  noiseSpeed: 0.62,
  hotColorBoost: 1.42
})

export const BLACK_HOLE_PERFORMANCE_TUNING = Object.freeze({
  ...BLACK_HOLE_GAS_DEVELOPMENT_TUNING,
  raymarchQuality: 0.48,
  gasDensity: 0.94,
  fineDetail: 0.46,
  filamentStrength: 0.88,
  dustBrightness: 0.72,
  photonGlow: 0.92,
  exposure: 0.94
})

export const BLACK_HOLE_LAYER_DEFAULTS = Object.freeze({
  background: true,
  raymarchedGas: true,
  foregroundGas: true,
  photonRing: true,
  equatorialCurrent: true,
  dust: true,
  boundAsteroids: true,
  independentAsteroids: true,
  lensing: true
})

export const BLACK_HOLE_LAB_PRESETS = Object.freeze({
  restored: {
    label: 'Restored Original',
    description: 'The exact restored Contact renderer before gas refinement.',
    tuning: BLACK_HOLE_RESTORED_TUNING,
    layers: BLACK_HOLE_LAYER_DEFAULTS
  },
  gas: {
    label: 'Gas Development',
    description: 'Fragmented clouds, filaments and fine dust replace the flat translucent sheet.',
    tuning: BLACK_HOLE_GAS_DEVELOPMENT_TUNING,
    layers: BLACK_HOLE_LAYER_DEFAULTS
  },
  performance: {
    label: 'Performance',
    description: 'A lighter diagnostic preset for comparing motion and stability.',
    tuning: BLACK_HOLE_PERFORMANCE_TUNING,
    layers: BLACK_HOLE_LAYER_DEFAULTS
  }
})

export const cloneBlackHolePreset = (presetKey = 'gas') => {
  const preset = BLACK_HOLE_LAB_PRESETS[presetKey] || BLACK_HOLE_LAB_PRESETS.gas
  return {
    tuning: {...preset.tuning},
    layers: {...preset.layers}
  }
}
