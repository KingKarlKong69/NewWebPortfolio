const assert = require('node:assert/strict')
const {test} = require('node:test')
const {readFileSync} = require('node:fs')
const {join} = require('node:path')
const {pathToFileURL} = require('node:url')
const source = name => readFileSync(join(__dirname, name), 'utf8')
const loadSource = text => import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
const controls = loadSource(source('blackHoleLabControls.js'))
const factory = loadSource(source('hybridBlackHoleUniforms.js'))
const motion = loadSource(source('blackHoleMotion.js'))
const shaders = loadSource(source('hybridBlackHoleShaders.js'))
const threeURL = pathToFileURL(require.resolve('three').replace(/three\.cjs$/, 'three.module.js')).href
const geometry = loadSource(source('hybridDiskGeometry.js').replace("'three'", `'${threeURL}'`))
const angularDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b))
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('local material adapters inherit live globals, isolate regions and never change shape controls', async () => {
  const {LAB_CONTROLS} = await controls
  const {createHybridBlackHoleUniforms} = await factory
  const {uniforms, ...regions} = createHybridBlackHoleUniforms(LAB_CONTROLS)
  const shapeBefore = [uniforms.uDiskThickness.value, uniforms.uUpperThickness.value, uniforms.uLowerThickness.value]
  for (const [part, region] of Object.entries(regions)) {
    const prefix = part.replace('Uniforms', '')
    for (const suffix of ['FilamentDensity', 'FilamentContrast', 'TurbulenceStrength', 'TurbulenceScale', 'GrainStrength', 'FineDetail']) {
      assert.equal(region[`uLocal${suffix}`], uniforms[`u${prefix[0].toUpperCase()}${prefix.slice(1)}${suffix}`])
      assert.equal(region[`uLocal${suffix}`].value, 1)
    }
    assert.equal(region.uFilamentDensity, uniforms.uFilamentDensity)
    assert.equal(region.uNoiseFactor, uniforms.uNoiseFactor)
  }
  regions.upperUniforms.uLocalFilamentContrast.value = .35
  assert.equal(regions.diskUniforms.uLocalFilamentContrast.value, 1)
  assert.equal(regions.lowerUniforms.uLocalFilamentContrast.value, 1)
  uniforms.uNoiseFactor.value = .025
  assert.ok(Object.values(regions).every(region => region.uNoiseFactor.value === .025))
  assert.deepEqual([uniforms.uDiskThickness.value, uniforms.uUpperThickness.value, uniforms.uLowerThickness.value], shapeBefore)
  assert.notEqual(regions.upperUniforms.uMaterialFlowPhase, regions.diskUniforms.uMaterialFlowPhase)
})

test('fractional local flow stays continuous across forward/reverse wraps, speed edits and pauses', async () => {
  const {advanceBlackHoleMaterialPhases} = await motion
  const tau = Math.PI * 2
  const state = {lastFlow:tau - .002, disk:.1, upper:.1, lower:.1}
  const settings = {diskFlowSpeed:1, upperFlowSpeed:.65, lowerFlowSpeed:0}
  advanceBlackHoleMaterialPhases(state, .002, settings)
  near(angularDifference(state.disk, .1), .004)
  near(angularDifference(state.upper, .1), .0026)
  near(state.lower, .1)
  const paused = {...state}
  advanceBlackHoleMaterialPhases(state, .002, {...settings, upperFlowSpeed:1.8})
  assert.deepEqual(state, paused)
  advanceBlackHoleMaterialPhases(state, tau - .002, {...settings, upperFlowSpeed:1.8})
  near(angularDifference(state.upper, paused.upper), -.0072)
  advanceBlackHoleMaterialPhases(state, NaN, settings)
  assert.ok(Object.values(state).every(Number.isFinite))
})

test('neutral local phases remain synchronized over long playback and lag does not produce a leap', async () => {
  const {advanceBlackHoleMotion, advanceBlackHoleMaterialPhases} = await motion
  const simulation = {time:0, flow:0, turbulence:0}
  const phases = {lastFlow:0, disk:0, upper:0, lower:0}
  for (let frame = 0; frame < 50000; frame++) {
    advanceBlackHoleMotion(simulation, .05, frame > 25000 ? -3 : 3)
    advanceBlackHoleMaterialPhases(phases, simulation.flow, {})
    assert.ok(phases.disk >= 0 && phases.disk < Math.PI * 2)
  }
  near(phases.disk, phases.upper)
  near(phases.disk, phases.lower)
  near(angularDifference(phases.disk, simulation.flow), 0)
  const old = simulation.flow
  advanceBlackHoleMotion(simulation, 1000, 3)
  near(angularDifference(simulation.flow, old), .05 * 3 * .028)
})

test('curved arc sheets have finite bounded attributes, valid triangles and disk junction endpoints', async () => {
  const {createHybridArcGeometry} = await geometry
  const mesh = createHybridArcGeometry()
  try {
    const positions = mesh.getAttribute('position')
    const radial = mesh.getAttribute('aRadial')
    const heights = mesh.getAttribute('aHeight')
    assert.equal(positions.count, radial.count)
    assert.equal(positions.count, heights.count)
    assert.ok(positions.count < 20000)
    assert.ok(mesh.index.count > 6)
    for (const index of mesh.index.array) assert.ok(index < positions.count)
    for (let i = 0; i < positions.count; i++) {
      assert.ok(Number.isFinite(positions.getX(i)) && Number.isFinite(positions.getY(i)))
      assert.ok(radial.getX(i) >= 0 && radial.getX(i) <= 1)
      assert.ok(Math.abs(heights.getX(i)) === .5)
      if (Math.abs(positions.getY(i)) < 1e-7) near(Math.abs(positions.getX(i)), 1)
    }
    assert.deepEqual([...new Set(heights.array)], [-.5, .5])
  } finally { mesh.dispose() }
})

test('front and back disk halves cover opposite sides without increasing triangle count', async () => {
  const {createHybridDiskGeometry} = await geometry
  const full = createHybridDiskGeometry()
  const far = createHybridDiskGeometry(96, 32, 0, Math.PI)
  const nearDisk = createHybridDiskGeometry(96, 32, Math.PI, Math.PI)
  try {
    assert.equal(far.index.count + nearDisk.index.count, full.index.count)
    for (const [mesh, sign] of [[far, 1], [nearDisk, -1]]) {
      const positions = mesh.getAttribute('position')
      for (let i = 0; i < positions.count; i++) assert.ok(positions.getY(i) * sign >= -1e-7)
    }
  } finally { full.dispose(); far.dispose(); nearDisk.dispose() }
})

// This checks the CPU/GLSL interface, not GPU compilation or visual quality.
test('all shader uniforms are wired and fragment varyings match their vertex stage', async () => {
  const shader = await shaders
  const {LAB_CONTROLS} = await controls
  const {createHybridBlackHoleUniforms} = await factory
  const values = createHybridBlackHoleUniforms(LAB_CONTROLS)
  const declarations = (text, kind) => [...text.matchAll(new RegExp(`${kind}\\s+\\w+\\s+([^;]+);`, 'g'))]
    .flatMap(match => match[1].split(',').map(name => name.trim()))
  for (const [part, uniformSet] of [['DISK', values.diskUniforms], ['ARC', values.upperUniforms],
    ['ARC', values.lowerUniforms], ['DUST', {...values.diskUniforms, uDiskSide:{value:1}}],
    ['CORE', values.uniforms], ['HALO', values.uniforms]]) {
    const vertex = shader[`HYBRID_${part}_VERTEX`]
    const fragment = shader[`HYBRID_${part}_FRAGMENT`]
    for (const text of [vertex, fragment]) {
      const declared = new Set(declarations(text, 'uniform'))
      for (const uniform of text.match(/\bu[A-Z]\w*/g) || []) {
        assert.ok(declared.has(uniform), `${part}: ${uniform} is undeclared`)
        assert.ok(Number.isFinite(uniformSet[uniform]?.value), `${part}: ${uniform} is unwired`)
      }
    }
    const vertexVaryings = new Set(declarations(vertex, 'varying'))
    for (const varying of declarations(fragment, 'varying')) assert.ok(vertexVaryings.has(varying), `${part}: ${varying}`)
  }
})
