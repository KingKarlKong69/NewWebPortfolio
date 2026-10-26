const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const motion = import(`data:text/javascript;base64,${Buffer.from(
  readFileSync(join(__dirname, 'projectStoryMotion.js'), 'utf8'),
).toString('base64')}`)
const atProject = (index, local, count = 4) => 0.44 + 0.56 * (index + local) / count
const visibleScreen = state => state.screenCurrentIndex * (1 - state.screenMix) + state.screenNextIndex * state.screenMix

test('the giant PROJECTS word zooms out before spacing expands, compresses, and drops', async () => {
  const { sampleProjectStory: sample } = await motion
  assert.equal(sample(0).titleScale, 20)
  assert.ok(sample(0.04).titleScale > sample(0.1).titleScale)
  assert.equal(sample(0.15).titleScale, 1)
  assert.ok(sample(0.185).titleTracking > sample(0.16).titleTracking)
  assert.ok(sample(0.21).titleTracking < sample(0.185).titleTracking)
  assert.equal(sample(0.21).titleY, 0)
  assert.ok(sample(0.24).titleY > 0.5)
  assert.equal(sample(0.265).titleOpacity, 0)
  assert.ok(sample(0.265).titleY > 1)
})

test('the closed laptop enters from the right, fills the view, then docks and opens', async () => {
  const { sampleProjectStory: sample } = await motion
  const before = sample(0.21)
  assert.equal(before.laptopOpacity, 0)
  assert.ok(before.laptopX > 1)
  const arrival = sample(0.29)
  assert.equal(arrival.lidOpen, 0)
  assert.equal(arrival.laptopOpacity, 1)
  assert.ok(arrival.laptopX < 1)
  const closeup = sample(0.365)
  assert.ok(closeup.laptopWidth > 1)
  assert.ok(Math.abs(closeup.laptopX - 0.5) < 0.04)
  assert.equal(closeup.lidOpen, 0)
  const settled = sample(0.445)
  assert.equal(settled.laptopX, 0.715)
  assert.equal(settled.laptopY, 0.53)
  assert.equal(settled.laptopWidth, 0.54)
  assert.equal(settled.lidOpen, 1)
  assert.equal(settled.screenPower, 1)
  assert.equal(settled.copyOpacity, 0, 'the laptop opens before the first project starts revealing')
  assert.equal(settled.eyebrowReveal, 0)
  assert.deepEqual(
    ['laptopX', 'laptopY', 'laptopWidth', 'laptopRotationX', 'laptopRotationY', 'laptopRotationZ', 'lidOpen'].map(key => settled[key]),
    ['laptopX', 'laptopY', 'laptopWidth', 'laptopRotationX', 'laptopRotationY', 'laptopRotationZ', 'lidOpen'].map(key => sample(0.9)[key]),
  )
})

test('each project reveals its category, title, metadata, actions, and navigation in order', async () => {
  const { sampleProjectStory: sample } = await motion
  const stages = [
    ['eyebrowReveal', 0.16], ['titleReveal', 0.32], ['roleReveal', 0.40],
    ['stackReveal', 0.48], ['impactReveal', 0.55], ['actionsReveal', 0.63], ['navReveal', 0.66],
  ]
  for (let project = 0; project < 4; project += 1) {
    for (let stage = 0; stage < stages.length; stage += 1) {
      const [field, completeAt] = stages[stage]
      const state = sample(atProject(project, completeAt + 1e-9))
      assert.equal(state.projectIndex, project)
      assert.equal(state[field], 1)
      if (stage + 1 < stages.length) assert.ok(state[stages[stage + 1][0]] < 1)
    }
    const held = sample(atProject(project, 0.8))
    assert.equal(held.copyOpacity, 1)
    assert.equal(held.revealProgress, 1)
    stages.forEach(([field]) => assert.equal(held[field], 1))
  }
})

test('project destinations select every real project and the final state stays readable', async () => {
  const { sampleProjectStory: sample, projectStoryStop: stop, PROJECT_STORY_INTRO_END } = await motion
  assert.equal(PROJECT_STORY_INTRO_END, 0.44)
  for (const count of [1, 2, 4, 5, 8]) {
    for (let index = 0; index < count; index += 1) {
      const target = sample(stop(index, count), count)
      assert.equal(target.projectIndex, index)
      assert.equal(target.copyOpacity, 1)
      assert.equal(target.actionsReveal, 1)
      assert.equal(target.navReveal, 1)
      assert.equal(target.screenCurrentIndex, index)
      assert.equal(target.screenNextIndex, index)
    }
    const ending = sample(1, count)
    assert.equal(ending.projectIndex, count - 1)
    assert.equal(ending.copyOpacity, 1)
    assert.equal(ending.actionsReveal, 1)
    assert.equal(ending.screenPower, 1)
  }
  assert.equal(sample(stop(-1)).projectIndex, 0)
  assert.equal(sample(stop(99)).projectIndex, 3)
})

test('TV transitions keep the matching screen pair through every project boundary in either direction', async () => {
  const { sampleProjectStory: sample } = await motion
  for (let boundary = 1; boundary < 4; boundary += 1) {
    const before = sample(atProject(boundary, -0.16))
    const halfway = sample(atProject(boundary, 0))
    const after = sample(atProject(boundary, 0.16))
    assert.ok(Math.abs(visibleScreen(before) - (boundary - 1)) < 1e-10)
    assert.ok(Math.abs(visibleScreen(after) - boundary) < 1e-10)
    assert.equal(halfway.screenCurrentIndex, boundary - 1)
    assert.equal(halfway.screenNextIndex, boundary)
    assert.ok(Math.abs(halfway.screenMix - 0.5) < 1e-10)
    assert.ok(halfway.screenTransition > 0.999)
    assert.ok(halfway.copyOpacity < 1e-12, 'project text only switches while hidden')
    let last = boundary - 1
    for (let step = 0; step <= 100; step += 1) {
      const state = sample(atProject(boundary, -0.17 + step * 0.0034))
      const value = visibleScreen(state)
      assert.ok(value >= last - 1e-12)
      last = value
    }
  }
})

test('reverse scrolling restores every visual channel exactly and reuses the supplied output', async () => {
  const { sampleProjectStory: sample } = await motion
  const forward = Array.from({ length: 2001 }, (_, index) => sample(index / 2000))
  const reusable = {}
  for (let index = 2000; index >= 0; index -= 1) {
    assert.equal(sample(index / 2000, 4, reusable), reusable)
    assert.deepEqual(reusable, forward[index])
  }
})

test('laptop, title, visible copy, and screen transitions remain continuous at stage boundaries', async () => {
  const { sampleProjectStory: sample } = await motion
  const boundaries = [0.035, 0.08, 0.125, 0.15, 0.155, 0.185, 0.21, 0.22, 0.242, 0.265, 0.29, 0.30, 0.33, 0.365, 0.375, 0.415, 0.43, 0.44, 0.445]
  for (let index = 1; index < 4; index += 1) {
    for (const offset of [-0.16, 0, 0.16]) boundaries.push(atProject(index, offset))
  }
  const fields = ['titleScale', 'titleTracking', 'titleY', 'titleOpacity', 'laptopX', 'laptopY', 'laptopWidth', 'laptopRotationX', 'laptopRotationY', 'laptopRotationZ', 'laptopOpacity', 'lidOpen', 'screenPower', 'dotOpacity', 'copyOpacity']
  for (const boundary of boundaries) {
    const before = sample(boundary - 1e-8)
    const after = sample(boundary + 1e-8)
    for (const field of fields) assert.ok(Math.abs(before[field] - after[field]) < 1e-4, `${field} at ${boundary}`)
    assert.ok(Math.abs(visibleScreen(before) - visibleScreen(after)) < 1e-4)
    for (const field of ['eyebrowReveal', 'titleReveal', 'roleReveal', 'stackReveal', 'impactReveal', 'actionsReveal', 'navReveal']) {
      assert.ok(Math.abs(before.copyOpacity * before[field] - after.copyOpacity * after[field]) < 1e-4, `${field} visibility at ${boundary}`)
    }
  }
})

test('invalid input stays finite and sampled values stay inside their physical ranges', async () => {
  const { sampleProjectStory: sample, projectStoryStop: stop } = await motion
  for (const value of [undefined, null, '0.5', {}, NaN, -Infinity, -3]) assert.deepEqual(sample(value), sample(0))
  for (const value of [Infinity, 3]) assert.deepEqual(sample(value), sample(1))
  for (const count of [undefined, NaN, Infinity, 0, -1, '4', {}]) {
    assert.ok(Number.isFinite(stop(NaN, count)))
    assert.ok(Object.values(sample(0.75, count)).every(Number.isFinite))
  }
  const bounded = ['titleOpacity', 'laptopOpacity', 'lidOpen', 'screenPower', 'dotOpacity', 'projectProgress', 'revealProgress', 'copyOpacity', 'eyebrowReveal', 'titleReveal', 'roleReveal', 'stackReveal', 'impactReveal', 'actionsReveal', 'navReveal', 'screenMix', 'screenTransition']
  for (let index = 0; index <= 5000; index += 1) {
    const state = sample(index / 5000)
    assert.ok(Object.values(state).every(Number.isFinite))
    bounded.forEach(field => assert.ok(state[field] >= 0 && state[field] <= 1, `${field}: ${state[field]}`))
    assert.ok(state.projectIndex >= 0 && state.projectIndex < 4)
    assert.ok(state.laptopWidth >= 0.22 && state.laptopWidth <= 1.28)
  }
})
