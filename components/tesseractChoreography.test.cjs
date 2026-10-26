const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const source = readFileSync(join(__dirname, 'tesseractChoreography.js'), 'utf8')
const modulePromise = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('the palm charges before the tesseract is visible and emergence settles at its anchor', async () => {
  const api = await modulePromise
  const first = api.sampleTesseractEmergence(0)
  const palmOnly = api.sampleTesseractEmergence(0.55)
  const rising = api.sampleTesseractEmergence(1.3)
  const settled = api.sampleTesseractEmergence(api.TESSERACT_EMERGENCE_SECONDS)
  assert.equal(first.visible, false)
  assert.equal(first.handGlow, 0)
  assert.ok(palmOnly.handGlow > 0.8)
  assert.equal(palmOnly.visible, false)
  assert.equal(palmOnly.scale, 0)
  assert.ok(rising.visible && rising.y > -1.65 && rising.y < 0)
  assert.ok(rising.scale > 0 && rising.scale < 1.1)
  assert.equal(settled.scale, 1)
  assert.equal(settled.y, 0)
  assert.equal(settled.ready, true)
})

test('active time freezes during pause and resume never replays emergence or skips an action', async () => {
  const api = await modulePromise
  const choreography = api.createTesseractChoreography(true, () => 0)
  for (let frame = 0; frame < 90; frame += 1) api.stepTesseractChoreography(choreography, 1 / 60)
  const midIntroduction = JSON.stringify(choreography)
  api.stepTesseractChoreography(choreography, 120, {active: false})
  assert.equal(JSON.stringify(choreography), midIntroduction)
  for (let frame = 0; frame < 500; frame += 1) api.stepTesseractChoreography(choreography, 1 / 60)
  assert.equal(choreography.phase, 'ready')
  assert.equal(choreography.action.type, 'ascension')
  const activeAction = JSON.stringify(choreography)
  api.stepTesseractChoreography(choreography, 120, {active: false})
  assert.equal(JSON.stringify(choreography), activeAction)
  const before = choreography.action.elapsed
  api.stepTesseractChoreography(choreography, 120)
  assert.ok(choreography.action.elapsed - before <= 0.051)
  assert.equal(choreography.phase, 'ready')
})

test('random selection allows immediate repeats and any jump while waiting for emergence', async () => {
  const api = await modulePromise
  // Three RNG samples per completed action: selection, seed, next idle delay.
  const rolls = [0, 0.4, 0.2, 0, 0.3, 0.2, 0.99, 0.1, 0.2, 0.3, 0.1, 0.2, 0.7, 0.1, 0.2]
  let roll = 0
  const choreography = api.createTesseractChoreography(true, () => rolls[roll++] ?? 0)
  const observed = []
  let previous = null
  for (let frame = 0; frame < 8000; frame += 1) {
    api.stepTesseractChoreography(choreography, 1 / 60)
    const type = choreography.action?.type || null
    if (type && type !== previous) {
      observed.push(type)
      assert.ok(choreography.elapsed >= api.TESSERACT_EMERGENCE_SECONDS)
    }
    previous = type
  }
  assert.deepEqual(observed.slice(0, 5), ['ascension', 'ascension', 'reconfigure', 'orbit', 'compression'])
})

test('interaction interrupts without resetting emergence and autonomous motion resumes after release', async () => {
  const api = await modulePromise
  const choreography = api.createTesseractChoreography(true, () => 0)
  for (let frame = 0; frame < 500; frame += 1) api.stepTesseractChoreography(choreography, 1 / 60)
  assert.equal(choreography.action.type, 'ascension')
  const time = choreography.action.elapsed
  api.stepTesseractChoreography(choreography, 1 / 60, {interacting: true})
  assert.equal(choreography.action.elapsed, time)
  assert.ok(choreography.action.weight > 0.99)
  for (let frame = 0; frame < 24; frame += 1) api.stepTesseractChoreography(choreography, 1 / 60, {interacting: true})
  assert.ok(choreography.action.weight > 0 && choreography.action.weight < 0.6)
  for (let frame = 0; frame < 600; frame += 1) api.stepTesseractChoreography(choreography, 1 / 60, {interacting: true})
  assert.equal(choreography.action, null)
  assert.equal(choreography.phase, 'ready')
  for (let frame = 0; frame < 300; frame += 1) api.stepTesseractChoreography(choreography, 1 / 60)
  assert.equal(choreography.action.type, 'ascension')
})

test('reduced motion presents a static finished core and does not replay when preference changes', async () => {
  const api = await modulePromise
  const choreography = api.createTesseractChoreography()
  api.stepTesseractChoreography(choreography, 1 / 60, {reducedMotion: true})
  assert.equal(choreography.phase, 'ready')
  assert.equal(choreography.action, null)
  assert.equal(api.sampleTesseractEmergence(choreography.elapsed).scale, 1)
  api.stepTesseractChoreography(choreography, 1 / 60)
  assert.equal(choreography.phase, 'ready')
})

test('hand constraint bounds even combined autonomous and pointer movement', async () => {
  const {constrainTesseractToHand} = await modulePromise
  for (const magnitude of [-100, -1, 0, 1, 100]) {
    const point = constrainTesseractToHand(magnitude, magnitude, magnitude)
    assert.ok(point.x >= -0.78 && point.x <= 0.78)
    assert.ok(point.y >= -0.5 && point.y <= 0.85)
    assert.ok(point.z >= -0.18 && point.z <= 0.18)
  }
})

test('playful orbit shakes for 2.5 seconds, splits into tiny chasing cores and accelerates into reunion', async () => {
  const {sampleTesseractPlayfulOrbit} = await modulePromise
  assert.equal(sampleTesseractPlayfulOrbit(0).scale, 1)
  assert.ok(sampleTesseractPlayfulOrbit(1).shake > 0.99)
  assert.equal(sampleTesseractPlayfulOrbit(2.49).phase, 'shaking')
  assert.equal(sampleTesseractPlayfulOrbit(2.5).phase, 'splitting')
  const chasing = sampleTesseractPlayfulOrbit(4)
  assert.equal(chasing.phase, 'chasing')
  assert.equal(chasing.split, 1)
  assert.ok(Math.abs(chasing.scale - 0.2) < 1e-12)
  assert.ok(Math.hypot(chasing.x, chasing.y) > 0.4)
  assert.equal(chasing.white, 1)
  assert.ok(chasing.particles > 0.9)
  const earlySpeed = sampleTesseractPlayfulOrbit(9.5).angle - sampleTesseractPlayfulOrbit(9.4).angle
  const lateSpeed = sampleTesseractPlayfulOrbit(12).angle - sampleTesseractPlayfulOrbit(11.9).angle
  assert.ok(lateSpeed > earlySpeed * 3)
  const restored = sampleTesseractPlayfulOrbit(13.8)
  assert.equal(restored.split, 0)
  assert.equal(restored.scale, 1)
  assert.equal(restored.white, 0)
  assert.equal(restored.particles, 0)
})

test('drag boundary stays circular in portrait pixels across desktop and mobile', async () => {
  const {constrainTesseractDrag} = await modulePromise
  for (const width of [390, 904]) {
    const height = width * 1.25
    const anchorX = width * 0.47
    const anchorY = height * 0.544
    const centerX = width * 0.56 - anchorX
    const centerY = height * 0.56 - anchorY
    for (let angle = 0; angle < Math.PI * 2; angle += 0.13) {
      const point = constrainTesseractDrag(Math.cos(angle) * width * 4, Math.sin(angle) * width * 4, width, height, anchorX, anchorY)
      assert.ok(Math.abs(Math.hypot(point.x - centerX, point.y - centerY) - width * 0.43) < 1e-8)
      assert.equal(point.limited, true)
    }
    const resting = constrainTesseractDrag(0, 0, width, height, anchorX, anchorY)
    assert.equal(resting.limited, false)
    assert.ok(Math.abs(resting.x) + Math.abs(resting.y) < 1e-8)
  }
})

test('three completed anger events reach 10x and return exactly home; fourth grab is refused', async () => {
  const api = await modulePromise
  const state = api.createTesseractInteraction()
  for (let count = 0; count < 3; count += 1) {
    assert.equal(api.beginTesseractDrag(state), true)
    api.moveTesseractDrag(state, {x: 300, y: 100, limited: true})
    for (let frame = 0; frame < 180; frame += 1) api.stepTesseractInteraction(state, 1 / 60)
    // Floating point may put exactly three seconds within the next frame.
    if (state.phase !== 'burst') api.stepTesseractInteraction(state, 1 / 60)
    assert.equal(state.phase, 'burst')
    assert.equal(state.angerCount, count)
    let maximum = 1
    for (let frame = 0; frame < 60; frame += 1) {
      api.stepTesseractInteraction(state, 1 / 60)
      maximum = Math.max(maximum, state.scale)
    }
    assert.equal(maximum, 10)
    assert.equal(state.angerCount, count + 1)
    assert.equal(state.x, 0)
    assert.equal(state.y, 0)
    assert.equal(state.scale, 1)
  }
  assert.equal(api.beginTesseractDrag(state), false)
})

test('releasing before full resistance cancels anger and eases home without consuming a strike', async () => {
  const api = await modulePromise
  const state = api.createTesseractInteraction()
  api.beginTesseractDrag(state)
  api.moveTesseractDrag(state, {x: 300, y: -100, limited: true})
  for (let frame = 0; frame < 90; frame += 1) api.stepTesseractInteraction(state, 1 / 60)
  const paused = JSON.stringify(state)
  api.stepTesseractInteraction(state, 200, false)
  assert.equal(JSON.stringify(state), paused)
  api.releaseTesseractDrag(state)
  api.stepTesseractInteraction(state, 1 / 60)
  assert.ok(state.x > 295 && state.x < 300)
  for (let frame = 0; frame < 50; frame += 1) api.stepTesseractInteraction(state, 1 / 60)
  assert.equal(state.phase, 'idle')
  assert.equal(state.x, 0)
  assert.equal(state.y, 0)
  assert.equal(state.angerCount, 0)
})

test('ascension charges over the palm, becomes fully fire orange, and completes two torso laps', async () => {
  const {sampleTesseractSubjectOrbit, TESSERACT_SUBJECT_ORBIT: timing} = await modulePromise
  for (const time of [0, 1, timing.chargeEnd, timing.orbitStart]) {
    const point = sampleTesseractSubjectOrbit(time)
    assert.equal(point.x, 0)
    assert.equal(point.y, 0)
  }
  assert.equal(sampleTesseractSubjectOrbit(timing.chargeEnd).fire, 1)
  assert.ok(sampleTesseractSubjectOrbit(timing.chargeEnd).spin > 50)
  assert.ok(sampleTesseractSubjectOrbit(timing.chargeEnd).glow > 3)
  const middle = sampleTesseractSubjectOrbit((timing.orbitStart + timing.orbitEnd) / 2)
  assert.ok(Math.abs(middle.angle - Math.PI * 2) < 1e-9)
  const end = sampleTesseractSubjectOrbit(timing.orbitEnd)
  assert.ok(Math.abs(end.angle - Math.PI * 4) < 1e-9)
  assert.equal(end.x, 0)
  assert.equal(end.y, 0)
  assert.equal(end.scale, 1)
  assert.equal(end.behind, false)
  assert.equal(sampleTesseractSubjectOrbit(timing.duration).fire, 0)
})

test('subject orbit covers both sides and both depths then rejoins the hand continuously', async () => {
  const {sampleTesseractSubjectOrbit, TESSERACT_SUBJECT_ORBIT: timing} = await modulePromise
  let minX = 0, maxX = 0, rearCount = 0, frontCount = 0
  for (let time = timing.orbitStart; time < timing.orbitEnd; time += 0.01) {
    const point = sampleTesseractSubjectOrbit(time)
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    if (point.behind) rearCount += 1
    else frontCount += 1
    assert.ok(point.scale >= 0.72 && point.scale <= 1)
  }
  assert.ok(minX < -0.419 && maxX > 0.419)
  assert.ok(rearCount > 0 && frontCount > 0)
  const before = sampleTesseractSubjectOrbit(timing.orbitEnd - 0.0001)
  assert.ok(Math.abs(before.x) + Math.abs(before.y) < 1e-7)
  const after = sampleTesseractSubjectOrbit(timing.duration + 10)
  assert.equal(after.x, 0)
  assert.equal(after.y, 0)
  assert.equal(after.glow, 0)
})
