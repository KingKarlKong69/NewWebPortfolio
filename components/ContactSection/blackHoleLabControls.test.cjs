const assert = require('node:assert/strict')
const {test} = require('node:test')
const {readFileSync} = require('node:fs')
const {join} = require('node:path')
const source = readFileSync(join(__dirname, 'blackHoleLabControls.js'), 'utf8')
const controls = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const newControlSpecs = {
  noiseFactor: [0, .1, .0001, 0],
  grainScale: [.5, 3, .05, 1],
  coreEdgeWarmth: [0, 1, .01, .35],
  coreEdgeWidth: [.01, .3, .005, .08],
  upperDepth: [0, .35, .005, .09],
  lowerDepth: [0, .35, .005, .06],
  upperJunctionBlend: [0, 1, .05, .8],
  lowerJunctionBlend: [0, 1, .05, .8]
}
const localSuffixes = ['FilamentDensity', 'FilamentContrast', 'TurbulenceStrength', 'TurbulenceScale', 'GrainStrength', 'FineDetail', 'FlowSpeed']
for (const prefix of ['disk', 'upper', 'lower']) {
  for (const suffix of localSuffixes) {
    newControlSpecs[`${prefix}${suffix}`] = [['FilamentDensity', 'TurbulenceScale'].includes(suffix) ? .25 : 0, 2, .05, 1]
  }
}

test('every control has one bounded default; quality presets affect only rendering controls', async () => {
  const {LAB_CONTROLS, LAB_DEFAULTS, LAB_GROUPS, LAB_LEGACY_CONTROLS, LAB_PRESETS, sanitizeLabValue} = await controls
  assert.equal(new Set(LAB_CONTROLS.map(entry => entry.key)).size, LAB_CONTROLS.length)
  assert.equal(LAB_GROUPS.flatMap(group => group.controls).length + LAB_LEGACY_CONTROLS.length, LAB_CONTROLS.length)
  assert.ok(LAB_GROUPS.every(group => ['blackhole', 'universe', 'curvature'].includes(group.category)))
  assert.equal(LAB_GROUPS.flatMap(group => group.controls).some(entry => entry.key === 'foregroundThickness'), false)
  assert.equal(LAB_DEFAULTS.foregroundThickness, 1)
  for (const entry of LAB_CONTROLS) {
    assert.ok(entry.min < entry.max && entry.step > 0)
    assert.equal(sanitizeLabValue(entry.key, entry.defaultValue), entry.defaultValue)
    assert.equal(LAB_DEFAULTS[entry.key], entry.defaultValue)
    assert.equal(sanitizeLabValue(entry.key, -1e100), entry.min)
    assert.equal(sanitizeLabValue(entry.key, 1e100), entry.max)
  }
  for (const preset of Object.values(LAB_PRESETS)) {
    assert.deepEqual(Object.keys(preset.values).sort(), ['edgeSmoothing', 'filamentDetail', 'noiseDetail', 'pixelRatio'])
    for (const [key, value] of Object.entries(preset.values)) assert.equal(sanitizeLabValue(key, value), value)
  }
  assert.ok(Object.isFrozen(LAB_DEFAULTS) && Object.isFrozen(LAB_GROUPS[0].controls))
})

test('numeric drafts preserve last valid value while complete entries clamp and snap', async () => {
  const {sanitizeLabValue} = await controls
  for (const draft of ['', ' ', '-', '+', '.', '0.', '1e', '1e-', 'NaN', 'Infinity', '0x20', '1,2', '1px', null, {}, [], true, NaN, Infinity]) {
    assert.equal(sanitizeLabValue('coreRadius', draft, .61), .61, String(draft))
  }
  assert.equal(sanitizeLabValue('coreRadius', ' .625 '), .63)
  assert.equal(sanitizeLabValue('noiseDetail', '2.6'), 3)
  assert.equal(sanitizeLabValue('coreRadius', '9e1'), .8)
  assert.equal(sanitizeLabValue('edgeSoftness', '.012'), .012)
  assert.equal(sanitizeLabValue('missing', 1), undefined)
  assert.equal(sanitizeLabValue('coreRadius', 'bad', NaN), .52)
})

test('new material and shape controls have the specified bounds, defaults and independent groups', async () => {
  const {LAB_CONTROLS, LAB_DEFAULTS, LAB_GROUPS, sanitizeLabValues} = await controls
  const material = LAB_GROUPS.find(group => group.id === 'material')
  assert.equal(material.label, 'General filaments & turbulence')
  assert.ok(material.controls.some(entry => entry.key === 'noiseFactor'))
  assert.ok(material.controls.some(entry => entry.key === 'grainScale'))
  for (const [key, spec] of Object.entries(newControlSpecs)) {
    const entry = LAB_CONTROLS.find(entry => entry.key === key)
    assert.ok(entry, key)
    assert.deepEqual([entry.min, entry.max, entry.step, entry.defaultValue], spec, key)
    assert.equal(LAB_DEFAULTS[key], spec[3], key)
    assert.equal(LAB_GROUPS.filter(group => group.controls.some(entry => entry.key === key)).length, 1, key)
  }
  for (const [groupId, keys] of [
    ['horizon', ['coreEdgeWarmth', 'coreEdgeWidth']],
    ['upper', ['upperDepth', 'upperJunctionBlend']],
    ['lower', ['lowerDepth', 'lowerJunctionBlend']]
  ]) {
    const group = LAB_GROUPS.find(group => group.id === groupId)
    for (const key of keys) assert.ok(group.controls.some(entry => entry.key === key), key)
  }
  const globals = {filamentDensity: 237, filamentContrast: .73, noiseStrength: 1.32, noiseScale: 7.1, fineGrain: .31, rotationSpeed: -1.25, noiseFactor: .0123, grainScale: 1.75}
  const inherited = sanitizeLabValues(globals)
  for (const [key, value] of Object.entries(globals)) assert.equal(inherited[key], value, key)
  for (const prefix of ['disk', 'upper', 'lower']) {
    const group = LAB_GROUPS.find(group => group.id === `${prefix}Material`)
    assert.equal(group.category, 'blackhole')
    assert.deepEqual(group.controls.map(entry => entry.key), localSuffixes.map(suffix => `${prefix}${suffix}`))
    for (const entry of group.controls) {
      assert.equal(inherited[entry.key], 1, `${entry.key} stays neutral when general settings change`)
      assert.match(entry.help, /1 inherits the general setting/)
    }
  }
})

test('group resets preserve tuned globals, other local groups and shape controls independently', async () => {
  const {LAB_CONTROLS, LAB_DEFAULTS, LAB_PRESETS, resetLabGroupValues, sanitizeLabValues} = await controls
  const tuned = Object.freeze(Object.fromEntries(LAB_CONTROLS.map(entry => [entry.key, entry.defaultValue === entry.min ? entry.max : entry.min])))
  const resetKeys = {
    material: ['filamentDensity', 'filamentContrast', 'noiseScale', 'noiseStrength', 'noiseFactor', 'broadTurbulence', 'fineGrain', 'grainScale', 'rotationSpeed'],
    diskMaterial: localSuffixes.map(suffix => `disk${suffix}`),
    upperMaterial: localSuffixes.map(suffix => `upper${suffix}`),
    lowerMaterial: localSuffixes.map(suffix => `lower${suffix}`),
    upper: ['upperThickness', 'upperDepth', 'upperJunctionBlend', 'outerSpread', 'upperHeight', 'upperBrightness', 'upperEmphasis'],
    lower: ['lowerThickness', 'lowerDepth', 'lowerJunctionBlend', 'lowerHeight', 'lowerBrightness', 'lowerVisibility'],
    horizon: ['coreRadius', 'edgeSoftness', 'coreDarkness', 'coreEdgeWarmth', 'coreEdgeWidth']
  }
  for (const [groupId, keys] of Object.entries(resetKeys)) {
    const reset = resetLabGroupValues(tuned, groupId)
    assert.notEqual(reset, tuned)
    for (const entry of LAB_CONTROLS) {
      assert.equal(reset[entry.key], keys.includes(entry.key) ? LAB_DEFAULTS[entry.key] : tuned[entry.key], `${groupId}: ${entry.key}`)
      assert.notEqual(tuned[entry.key], LAB_DEFAULTS[entry.key], `source remains tuned: ${entry.key}`)
    }
  }
  for (const preset of Object.values(LAB_PRESETS)) {
    const changed = sanitizeLabValues(preset.values, tuned)
    for (const key of Object.keys(newControlSpecs)) assert.equal(changed[key], tuned[key], key)
  }
  assert.throws(() => resetLabGroupValues(tuned, 'unknown'), /Unknown lab control group/)
})

test('fine noise precision survives sanitizing and all new controls reject invalid preset values', async () => {
  const {LAB_DEFAULTS, LAB_PRESET_VERSION, parseLabPreset, sanitizeLabValue} = await controls
  for (let tick = 0; tick <= 1000; tick++) {
    const value = tick / 10000
    assert.equal(sanitizeLabValue('noiseFactor', value), value)
    assert.equal(sanitizeLabValue('noiseFactor', value.toFixed(4)), value)
  }
  assert.equal(sanitizeLabValue('noiseFactor', '.01234'), .0123)
  assert.equal(sanitizeLabValue('noiseFactor', '.01236'), .0124)
  assert.equal(sanitizeLabValue('noiseFactor', '9.99e-2'), .0999)
  assert.equal(sanitizeLabValue('noiseFactor', '1e-', .0123), .0123)
  assert.equal(sanitizeLabValue('upperDepth', '.137'), .135)
  assert.equal(sanitizeLabValue('coreEdgeWidth', '.127'), .125)
  const fallback = Object.freeze({...LAB_DEFAULTS, noiseFactor: .0987, upperFlowSpeed: .35})
  for (const [key, [min, max, step]] of Object.entries(newControlSpecs)) {
    for (const value of [min - step, max + step, null, true, [], {}, 'unfinished', 'Infinity']) {
      assert.throws(() => parseLabPreset(JSON.stringify({version: LAB_PRESET_VERSION, values: {coreRadius: .7, [key]: value}}), fallback), /finite number/, `${key}: ${value}`)
    }
    assert.equal(sanitizeLabValue(key, -100), min, key)
    assert.equal(sanitizeLabValue(key, 100), max, key)
  }
  assert.equal(fallback.coreRadius, LAB_DEFAULTS.coreRadius)
  assert.equal(fallback.noiseFactor, .0987)
  assert.equal(fallback.upperFlowSpeed, .35)
  assert.throws(() => parseLabPreset('{"version":2,"values":{"noiseFactor":0.2}}', fallback), /finite number/)
})

test('universe and curvature switches remain numeric flags and reject fractional preset values', async () => {
  const {LAB_CONTROLS, LAB_DEFAULTS, LAB_PRESET_VERSION, parseLabPreset, sanitizeLabValue} = await controls
  const flags = LAB_CONTROLS.filter(entry => entry.kind === 'toggle')
  assert.ok(flags.length >= 12)
  for (const entry of flags) {
    assert.ok(entry.defaultValue === 0 || entry.defaultValue === 1)
    assert.equal(sanitizeLabValue(entry.key, .1), 0)
    assert.equal(sanitizeLabValue(entry.key, .9), 1)
    for (const version of [1, 2, LAB_PRESET_VERSION]) {
      assert.throws(() => parseLabPreset(JSON.stringify({version, values:{[entry.key]:.4}})), /finite number/)
    }
  }
  const disabled = {...LAB_DEFAULTS, universeEnabled:0, curvatureEnabled:0, curveForeground:1}
  assert.deepEqual(parseLabPreset(JSON.stringify({version:2, values:disabled})), disabled)
  assert.equal(sanitizeLabValue('movingCount', 260.4), 260)
  assert.equal(sanitizeLabValue('asteroidCount', 900), 12)
})

test('sanitizing records preserves fallback values and excludes arrays and unknown keys', async () => {
  const {LAB_DEFAULTS, sanitizeLabValues} = await controls
  const fallback = {...LAB_DEFAULTS, coreRadius: .65}
  const before = {...fallback}
  const result = sanitizeLabValues({exposure: '2', coreRadius: 'unfinished', noiseDetail: 9, fake: 3}, fallback)
  assert.equal(result.coreRadius, .65)
  assert.equal(result.exposure, 2)
  assert.equal(result.noiseDetail, 4)
  assert.equal(Object.hasOwn(result, 'fake'), false)
  assert.deepEqual(fallback, before)
  assert.deepEqual(sanitizeLabValues([]), LAB_DEFAULTS)
  assert.deepEqual(sanitizeLabValues(null), LAB_DEFAULTS)
  assert.deepEqual(sanitizeLabValues({}, null), LAB_DEFAULTS)
})

test('preset import is atomic, bounded and accepts only supported versions', async () => {
  const {LAB_DEFAULTS, LAB_PRESET_VERSION, parseLabPreset} = await controls
  assert.equal(LAB_PRESET_VERSION, 3)
  assert.deepEqual(parseLabPreset(JSON.stringify({version: LAB_PRESET_VERSION, values: LAB_DEFAULTS})), LAB_DEFAULTS)
  assert.deepEqual(parseLabPreset(JSON.stringify({version: 1, values: LAB_DEFAULTS})), LAB_DEFAULTS)
  const legacy = parseLabPreset('{"version":1,"values":{"foregroundThickness":0.4,"coreRadius":0.7}}', {...LAB_DEFAULTS, diskThickness:.5, movingSpeed:.2})
  assert.equal(legacy.foregroundThickness, .4)
  assert.equal(legacy.coreRadius, .7)
  assert.equal(legacy.diskThickness, LAB_DEFAULTS.diskThickness)
  assert.equal(legacy.movingSpeed, LAB_DEFAULTS.movingSpeed)
  const partial = parseLabPreset('{"coreRadius":0.7,"unknown":99,"__proto__":{"polluted":true}}')
  assert.equal(partial.coreRadius, .7)
  assert.equal(partial.exposure, LAB_DEFAULTS.exposure)
  assert.equal({}.polluted, undefined)
  assert.throws(() => parseLabPreset('{'), /valid JSON/)
  assert.throws(() => parseLabPreset('[]'), /object/)
  for (const version of [0, 4, '3', null]) {
    assert.throws(() => parseLabPreset(JSON.stringify({version, values:{coreRadius:.6}})), /Use version 1, 2 or 3/)
  }
  assert.throws(() => parseLabPreset('{"values":{"coreRadius":0.6}}'), /version/)
  assert.throws(() => parseLabPreset('{"version":1,"values":[]}'), /object/)
  assert.throws(() => parseLabPreset('{"coreRadius":0.6,"exposure":"bad"}'), /Exposure/)
  assert.throws(() => parseLabPreset('{"coreRadius":0.9}'), /Core radius/)
  assert.throws(() => parseLabPreset('{"coreRadius":null}'), /finite/)
  assert.throws(() => parseLabPreset('{"unknown":1}'), /recognized/)
  assert.throws(() => parseLabPreset(' '.repeat(32769)), /32 KB/)
  assert.throws(() => parseLabPreset('é'.repeat(17000)), /32 KB/)
})

test('v1 and v2 migration resets every absent new control and retains supplied legacy values', async () => {
  const {LAB_CONTROLS, LAB_DEFAULTS, parseLabPreset} = await controls
  const tuned = Object.freeze(Object.fromEntries(LAB_CONTROLS.map(entry => [entry.key, entry.defaultValue === entry.min ? entry.max : entry.min])))
  const legacyValues = Object.fromEntries(LAB_CONTROLS.filter(entry => !Object.hasOwn(newControlSpecs, entry.key)).map(entry => [entry.key, tuned[entry.key]]))
  for (const version of [1, 2]) {
    const migrated = parseLabPreset(JSON.stringify({version, values: legacyValues}), tuned)
    assert.deepEqual(migrated, {...LAB_DEFAULTS, ...legacyValues})
    for (const key of Object.keys(newControlSpecs)) {
      assert.equal(migrated[key], LAB_DEFAULTS[key], `v${version}: ${key}`)
      assert.notEqual(tuned[key], migrated[key], `migration preserves the source: ${key}`)
    }
    const partial = parseLabPreset(JSON.stringify({version, values:{coreRadius:.7}}), tuned)
    assert.equal(partial.coreRadius, .7)
    for (const key of Object.keys(newControlSpecs)) assert.equal(partial[key], LAB_DEFAULTS[key], key)
    for (const key of ['diskThickness', 'diskCloudScale', 'movingSpeed', 'curvatureStrength', 'universeEnabled', 'foregroundThickness']) {
      assert.equal(partial[key], version === 1 ? LAB_DEFAULTS[key] : tuned[key], `v${version} existing control: ${key}`)
    }
    const explicit = parseLabPreset(JSON.stringify({version, values:{noiseFactor:.0123, lowerDepth:.215, upperFlowSpeed:.4}}), tuned)
    assert.equal(explicit.noiseFactor, .0123)
    assert.equal(explicit.lowerDepth, .215)
    assert.equal(explicit.upperFlowSpeed, .4)
    assert.equal(explicit.lowerFlowSpeed, 1)
    assert.deepEqual(parseLabPreset(JSON.stringify({version, values:{coreRadius:.7}}), null), {...LAB_DEFAULTS, coreRadius:.7})
  }
})

test('v3 snapshots round-trip tuned new values and partial current presets preserve their fallback', async () => {
  const {LAB_DEFAULTS, LAB_PRESET_VERSION, parseLabPreset} = await controls
  const tuned = {...LAB_DEFAULTS,
    noiseFactor:.0123, grainScale:1.85, coreEdgeWarmth:.61, coreEdgeWidth:.135,
    upperDepth:.215, lowerDepth:.325, upperJunctionBlend:.35, lowerJunctionBlend:.65,
    diskThickness:.37, movingSpeed:.125, curvatureStrength:.85, universeEnabled:0
  }
  for (const [index, prefix] of ['disk', 'upper', 'lower'].entries()) {
    for (const suffix of localSuffixes) tuned[`${prefix}${suffix}`] = [.25, .75, 1.85][index]
  }
  tuned.diskFlowSpeed = 0
  tuned.upperGrainStrength = 0
  let result = tuned
  for (let attempt = 0; attempt < 3; attempt++) {
    result = parseLabPreset(JSON.stringify({version:LAB_PRESET_VERSION, values:result}), {...LAB_DEFAULTS, noiseFactor:.0999})
    assert.deepEqual(result, tuned)
  }
  assert.ok(Buffer.byteLength(JSON.stringify({version:LAB_PRESET_VERSION, values:tuned}, null, 2)) < 20000)
  for (const preset of [{version:LAB_PRESET_VERSION, values:{coreRadius:.7}}, {coreRadius:.7}]) {
    assert.deepEqual(parseLabPreset(JSON.stringify(preset), tuned), {...tuned, coreRadius:.7})
  }
  assert.deepEqual(parseLabPreset(JSON.stringify(tuned)), tuned)
})
