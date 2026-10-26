const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const source = readFileSync(join(__dirname, 'aboutStoryMotion.js'), 'utf8')
const api = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('the entry introduces the story before revealing the blurred background title and portrait', async () => {
  const { sampleAboutStory: sample } = await api
  assert.equal(sample(0).introOpacity, 0)
  assert.equal(sample(0.06).introOpacity, 1)
  assert.equal(sample(0.06).titleOpacity, 0)
  assert.equal(sample(0.06).portraitReveal, 0)
  assert.ok(sample(0.15).titleOpacity > 0)
  assert.ok(sample(0.15).titleBlur > 0)
  assert.equal(sample(0.18).titleOpacity, 1)
  assert.equal(sample(0.18).portraitReveal, 0)
  assert.ok(sample(0.24).portraitReveal > 0)
  assert.ok(sample(0.24).portraitRise > 0)
  assert.equal(sample(0.24).portraitBrightness, 0.035)
  assert.ok(sample(0.24).portraitBlur > 0)
  assert.equal(sample(0.29).portraitRise, 0)
  assert.equal(sample(0.38).portraitBrightness, 1)
  assert.equal(sample(0.38).portraitBlur, 0)
})

test('the large title docks before the heading finishes and the portrait settles to the right', async () => {
  const { sampleAboutStory: sample } = await api
  assert.equal(sample(0.30).titleDock, 0)
  assert.ok(sample(0.35).titleDock > 0 && sample(0.35).titleDock < 1)
  assert.equal(sample(0.39).titleDock, 1)
  assert.equal(sample(0.39).firstLine, 0)
  assert.equal(sample(0.45).firstLine, 1)
  assert.equal(sample(0.45).secondLine, 0)
  assert.equal(sample(0.53).secondLine, 1)
  assert.equal(sample(0.53).portraitDock, 1)
})

test('all four portrait poses crossfade without blank frames or combined opacity spikes', async () => {
  const { sampleAboutStory: sample } = await api
  for (let frame = 0; frame <= 2000; frame += 1) {
    const state = sample(frame / 2000)
    const weights = [state.pose0Opacity, state.pose1Opacity, state.pose2Opacity, state.pose3Opacity]
    assert.ok(weights.every(weight => weight >= 0 && weight <= 1))
    assert.ok(Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-12)
  }
  assert.equal(sample(0.44).pose0Opacity, 1)
  assert.equal(sample(0.49).pose1Opacity, 1)
  assert.equal(sample(0.60).pose2Opacity, 1)
  assert.equal(sample(0.69).pose3Opacity, 1)
})

test('biography paragraphs appear in order, settle for reading, and retain the final paragraph', async () => {
  const { sampleAboutStory: sample } = await api
  for (const [progress, selected] of [[0.72, 0], [0.85, 1], [0.97, 2], [1, 2]]) {
    const state = sample(progress)
    for (let index = 0; index < 3; index += 1) {
      assert.equal(state[`bio${index}Opacity`], index === selected ? 1 : 0)
    }
    assert.equal(state[`bio${selected}Y`], 0)
  }
  assert.ok(sample(0.685).bio0Y > 0)
  assert.ok(sample(0.78).bio0Y < 0)
  assert.equal(sample(0.78).bio1Opacity, 0)
  assert.equal(sample(0.90).bio2Opacity, 0)
})

test('the cyan underline grows monotonically through the specified story milestones', async () => {
  const { sampleAboutStory: sample } = await api
  for (const [progress, length] of [[0, 0], [0.54, 0], [0.64, 0.30], [0.70, 0.42], [0.84, 0.65], [0.98, 1], [1, 1]]) {
    assert.ok(Math.abs(sample(progress).lineProgress - length) < 1e-12)
  }
  let previous = 0
  for (let frame = 0; frame <= 1000; frame += 1) {
    const length = sample(frame / 1000).lineProgress
    assert.ok(length >= previous)
    previous = length
  }
})

test('scrolling backward produces exactly the same scene states without retained animation state', async () => {
  const { sampleAboutStory: sample } = await api
  const forward = Array.from({ length: 201 }, (_, frame) => sample(frame / 200))
  const output = {}
  for (let frame = 200; frame >= 0; frame -= 1) {
    assert.equal(sample(frame / 200, output), output)
    assert.deepEqual(output, forward[frame])
  }
})

test('the progress indicator uses stable named stops and reaches the fifth stage at completion', async () => {
  const { ABOUT_STORY_STOPS: stops, sampleAboutStory: sample } = await api
  assert.deepEqual(stops, [0, 0.37, 0.61, 0.77, 0.89, 1])
  assert.equal(Object.isFrozen(stops), true)
  stops.forEach((progress, index) => {
    assert.equal(sample(progress).stage, index)
    if (index > 0) assert.equal(sample(progress - 0.000001).stage, index - 1)
  })
})

test('invalid and out-of-range progress stays finite and all visual channels remain bounded', async () => {
  const { sampleAboutStory: sample } = await api
  const start = sample(0)
  const end = sample(1)
  for (const progress of [undefined, null, NaN, -Infinity, -100]) assert.deepEqual(sample(progress), start)
  for (const progress of [Infinity, 100]) assert.deepEqual(sample(progress), end)
  for (let frame = 0; frame <= 1000; frame += 1) {
    const state = sample(frame / 1000)
    assert.ok(Object.values(state).every(Number.isFinite))
    for (const [field, value] of Object.entries(state)) {
      if (field.endsWith('Opacity') || ['heroDim', 'titleDock', 'portraitReveal', 'portraitRise', 'portraitDock', 'firstLine', 'secondLine', 'lineProgress', 'labelCyan'].includes(field)) {
        assert.ok(value >= 0 && value <= 1, `${field} = ${value}`)
      }
    }
  }
})

test('the scene channels remain continuous across every scroll transition', async () => {
  const { sampleAboutStory: sample } = await api
  const boundaries = [0, 0.035, 0.09, 0.12, 0.14, 0.16, 0.17, 0.18, 0.19, 0.22, 0.27, 0.28, 0.29, 0.30, 0.37, 0.38, 0.39, 0.44, 0.45, 0.46, 0.49, 0.53, 0.54, 0.55, 0.60, 0.61, 0.64, 0.67, 0.69, 0.70, 0.77, 0.79, 0.81, 0.84, 0.89, 0.91, 0.94, 0.98, 1]
  for (const boundary of boundaries) {
    const before = sample(boundary - 1e-7)
    const after = sample(boundary + 1e-7)
    for (const field of Object.keys(before)) {
      if (field !== 'stage') assert.ok(Math.abs(after[field] - before[field]) < 0.001, `${field} discontinuity at ${boundary}`)
    }
  }
})
