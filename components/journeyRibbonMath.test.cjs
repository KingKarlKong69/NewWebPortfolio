const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const modulePromise = import(`data:text/javascript;base64,${Buffer.from(readFileSync(join(__dirname, 'journeyRibbonMath.js'), 'utf8')).toString('base64')}`)

test('all supplied photos occupy fixed panels and sparse memories repeat without empty slots', async () => {
  const { sampleRibbonPanel, positiveModulo, RIBBON_PANEL_COUNT } = await modulePromise
  for (const count of [4, 6, 7, 13]) {
    const seen = new Set()
    for (let panel = 0; panel < RIBBON_PANEL_COUNT; panel++) {
      const initial = sampleRibbonPanel(panel, 0)
      const photo = positiveModulo(initial.photoStep, count)
      seen.add(photo)
      for (const rotation of [-19, -Math.PI, -.3, .4, Math.PI, 28]) {
        const pose = sampleRibbonPanel(panel, rotation)
        assert.equal(pose.photoStep, initial.photoStep, 'a photo travels with its panel')
        assert.equal(pose.photoMix, 0, 'no texture crossfade inside a stationary slot')
        assert.ok(pose.angularWidth > 0 && pose.panelHeight > 0 && pose.opacity > 0)
      }
    }
    assert.equal(seen.size, count)
  }
})

test('dominant rendered panel and background choose the same attached photo while rotating', async () => {
  const { ribbonFrontImage, sampleRibbonPanel, positiveModulo, RIBBON_PANEL_COUNT } = await modulePromise
  for (const aspect of [1.4, 2, 2.5]) for (let angle = -12; angle <= 12; angle += .037) {
    const poses = Array.from({ length: RIBBON_PANEL_COUNT }, (_, index) => sampleRibbonPanel(index, angle, {}, aspect))
    const front = poses.reduce((best, pose) => pose.dominance > best.dominance ? pose : best)
    assert.equal(positiveModulo(front.photoStep, 13), ribbonFrontImage(angle, 13, aspect))
  }
})

test('one equal-height row closes through a full revolution with only narrow frame gutters', async () => {
  const { sampleRibbonPanel, RIBBON_PANEL_COUNT, positiveModulo } = await modulePromise
  for (const rotation of [0, .17, 2, -3.8]) {
    const poses = Array.from({ length: RIBBON_PANEL_COUNT }, (_, index) => sampleRibbonPanel(index, rotation))
      .sort((a, b) => a.angle - b.angle)
    const step = Math.PI * 2 / poses.length
    assert.ok(poses.length >= 13, 'all thirteen photos in the final memory fit the physical ring')
    assert.equal(new Set(poses.map(pose => pose.row)).size, 1, 'there is no smaller second row')
    assert.equal(new Set(poses.map(pose => pose.panelHeight)).size, 1)
    for (let index = 0; index < poses.length; index++) {
      const separation = positiveModulo(poses[(index + 1) % poses.length].angle - poses[index].angle, Math.PI * 2)
      assert.ok(Math.abs(separation - step) < 1e-12)
      assert.ok(Math.abs(poses[index].angularWidth / separation - .975) < 1e-12)
    }
  }
})

test('the hollow cylinder surrounds core depth and panels return continuously through the seam', async () => {
  const { sampleRibbonPanel, RIBBON_PANEL_COUNT, MOSAIC_CORE_Y } = await modulePromise
  const front = sampleRibbonPanel(0, 0)
  const side = sampleRibbonPanel(0, Math.PI / 2)
  const rear = sampleRibbonPanel(0, Math.PI)
  assert.ok(Math.abs(side.x - front.x) > .1)
  assert.ok(front.z > side.z && side.z > rear.z)
  assert.ok(front.z > 0 && rear.z < 0, 'the core at Z=0 is physically between near and far photographs')
  assert.ok(front.perspective > rear.perspective)
  assert.ok(front.brightness > rear.brightness)
  assert.equal(front.rowY, MOSAIC_CORE_Y)
  assert.ok(front.y > MOSAIC_CORE_Y && rear.y < MOSAIC_CORE_Y, 'pitch exposes the hollow center')
  for (let index = 0; index < RIBBON_PANEL_COUNT; index++) {
    const before = sampleRibbonPanel(index, Math.PI * 2 - 1e-7)
    const after = sampleRibbonPanel(index, 1e-7)
    for (const key of ['x', 'y', 'z']) assert.ok(Math.abs(before[key] - after[key]) < 1e-6)
    assert.equal(before.photoStep, after.photoStep)
  }
})

test('tilt and hover offsets stay bounded and preserve the ring center and depth ordering', async () => {
  const { ribbonTransform, projectMosaicPoint, MOSAIC_CENTER_Y, MOSAIC_PITCH } = await modulePromise
  assert.deepEqual(ribbonTransform({ ringTiltX: Infinity, ringTiltY: NaN }), {
    pitch: MOSAIC_PITCH, yaw: 0, offsetX: 0, offsetY: 0,
  })
  const extreme = ribbonTransform({ ringTiltX: 100, ringTiltY: -100, ringOffsetX: 3, ringOffsetY: -3 })
  assert.equal(extreme.pitch, MOSAIC_PITCH + .22)
  assert.equal(extreme.yaw, -.25)
  assert.equal(extreme.offsetX, .018)
  assert.equal(extreme.offsetY, -.018)
  for (const ringTiltX of [-.22, 0, .22]) for (const ringTiltY of [-.25, 0, .25]) {
    const transform = { ringTiltX, ringTiltY, ringOffsetX: .01, ringOffsetY: -.01 }
    for (const angle of [0, .4, 1.2, Math.PI]) {
      const at = projectMosaicPoint(angle, MOSAIC_CENTER_Y, 2, {}, transform)
      const base = projectMosaicPoint(angle, MOSAIC_CENTER_Y, 2, {}, { ringTiltX, ringTiltY })
      assert.ok(Math.abs(at.x - base.x - .01) < 1e-12)
      assert.ok(Math.abs(at.y - base.y + .01) < 1e-12)
      assert.equal(at.z, base.z)
      assert.ok(Number.isFinite(at.perspective) && at.perspective > 0)
    }
    assert.ok(projectMosaicPoint(0, MOSAIC_CENTER_Y, 2, {}, transform).z > 0)
    assert.ok(projectMosaicPoint(Math.PI, MOSAIC_CENTER_Y, 2, {}, transform).z < 0)
  }
})

test('snake formation begins at the core, finishes precisely on each ribbon surface and is reversible', async () => {
  const { sampleRibbonPanel, sampleRibbonFormation, RIBBON_PANEL_COUNT } = await modulePromise
  for (let index = 0; index < RIBBON_PANEL_COUNT; index++) {
    const pose = sampleRibbonPanel(index, .23)
    const start = sampleRibbonFormation(pose, index, 0, .36, .445)
    const end = sampleRibbonFormation(pose, index, 1, .36, .445)
    assert.equal(start.x, .36)
    assert.equal(start.y, .445)
    assert.ok(Math.abs(end.x - pose.x) < 1e-12)
    assert.ok(Math.abs(end.y - pose.y) < 1e-12)
    assert.equal(end.scale, 1)
    const middle = sampleRibbonFormation(pose, index, .56, .36, .445)
    sampleRibbonFormation(pose, index, .9, .36, .445)
    assert.deepEqual(sampleRibbonFormation(pose, index, .56, .36, .445), middle)
  }
})

test('cover crops portrait and landscape photographs without letterboxing', async () => {
  const { ribbonCoverScale } = await modulePromise
  assert.deepEqual(ribbonCoverScale(2, 1), [.5, 1])
  assert.deepEqual(ribbonCoverScale(.5, 2), [1, .25])
  assert.deepEqual(ribbonCoverScale(1.75, 1.75), [1, 1])
  for (const image of [.3, .7, 1, 1.6, 2.5]) {
    const [x, y] = ribbonCoverScale(image, 1.8)
    assert.ok(x > 0 && x <= 1 && y > 0 && y <= 1)
    assert.ok(x === 1 || y === 1)
  }
})
