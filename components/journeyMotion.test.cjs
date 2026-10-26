const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync, readdirSync, existsSync } = require('node:fs')
const { join } = require('node:path')

const loadModule = name => import(`data:text/javascript;base64,${Buffer.from(
  readFileSync(join(__dirname, name), 'utf8'),
).toString('base64')}`)
const motion = loadModule('journeyMotion.js')
const memories = loadModule('journeyMemories.js')
const openingAt = async position => (await motion).sampleJourney(position / .30)

test('the supplied memory manifest includes every actual photo in natural numerical order', async () => {
  const { JOURNEY_MEMORIES: entries } = await memories
  assert.deepEqual(entries.map(entry => entry.year), [2022, 2023, 2024, 2025, 2026])
  assert.deepEqual(entries.map(entry => entry.images.length), [4, 4, 6, 7, 13])
  assert.equal(Object.isFrozen(entries), true)
  for (const entry of entries) {
    assert.equal(Object.isFrozen(entry), true)
    assert.equal(Object.isFrozen(entry.images), true)
    const directory = join(__dirname, '..', 'public', 'memory-folder', `${entry.year}-Memory`)
    const files = readdirSync(directory).filter(file => /\.(jpe?g|png|webp|avif)$/i.test(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    assert.deepEqual(entry.images.map(path => path.split('/').pop()), files)
    for (const path of entry.images) assert.equal(existsSync(join(__dirname, '..', 'public', path)), true, path)
  }
})

test('the memory titles, descriptions and journey introduction retain the supplied narrative', async () => {
  const { JOURNEY_MEMORIES: entries, JOURNEY_INTRO: intro } = await memories
  assert.deepEqual(entries.map(entry => entry.title), [
    'The Foundation', 'Finding My Ground', 'Falling for the Web',
    'From Ideas to Architecture', 'Beyond the Code',
  ])
  assert.deepEqual(entries.map(entry => entry.description), [
    'First year brought uncertainty and a slow start, with programming fundamentals still taking shape.',
    'Second year marked a shift from struggling with the basics to building confidence and independence.',
    'Third year sparked a passion for web development, turning ideas into something tangible and meaningful.',
    'Fourth year brought a bigger perspective — connecting ideas, understanding systems, and thinking beyond individual tasks.',
    'Graduation marked the beginning of a new chapter, exploring AI-native development and the thinking behind intelligent systems.',
  ])
  assert.equal(intro, 'From learning programming fundamentals at Bulacan State University - Bustos Campus to building full-stack systems, my path has been shaped by research, collaboration, and a drive to create meaningful digital products.')
})

test('the vortex finishes before the Journey title settles and its introductory typing completes', async () => {
  assert.equal((await openingAt(0)).vortex, 0)
  assert.equal((await openingAt(0)).introTitleOpacity, 0)
  assert.ok((await openingAt(.04)).vortex > 0)
  assert.equal((await openingAt(.085)).vortex, 1)
  assert.equal((await openingAt(.16)).introTitleScale, 1)
  assert.equal((await openingAt(.14)).introTyping, 0)
  const middle = await openingAt(.19)
  assert.ok(middle.introTyping > 0 && middle.introTyping < 1)
  assert.equal((await openingAt(.23)).introTyping, 1)
  assert.equal((await openingAt(.23)).introTitleOpacity, 1)
  assert.ok((await openingAt(.26)).introTitleX < 0)
  assert.equal((await openingAt(.28)).introTitleOpacity, 0)
})

test('the original core enters from above and settles at the viewport center for its gesture gate', async () => {
  assert.equal((await openingAt(.25)).coreOpacity, 0)
  const descending = await openingAt(.275)
  assert.ok(descending.coreOpacity > 0 && descending.coreOpacity < 1)
  assert.ok(descending.coreY < .5)
  assert.equal(descending.coreX, .5)
  const settled = await openingAt(.30)
  assert.equal(settled.coreX, .5)
  assert.ok(Math.abs(settled.coreY - .5) < 1e-12)
  assert.equal(settled.coreOpacity, 1)
  assert.equal(settled.coreScale, 1)
  assert.equal(settled.coreCharge, 0, 'scrolling the opening alone cannot start the charge')
  assert.equal(settled.stage, 0)
  assert.equal(settled.introTitleOpacity, 0)
})

test('the rail has one readable introduction stop and five centered carousel destinations', async () => {
  const { sampleJourney: sample, JOURNEY_STOPS: stops } = await motion
  assert.equal(stops.length, 6)
  assert.equal(Object.isFrozen(stops), true)
  assert.equal(sample(stops[0]).introTitleOpacity, 1)
  assert.equal(sample(stops[0]).introTyping, 1)
  stops.slice(1).forEach(progress => {
    const scene = sample(progress)
    assert.equal(progress, 1)
    assert.equal(scene.coreX, .5)
    assert.ok(Math.abs(scene.coreY - .5) < 1e-12)
    assert.equal(scene.coreOpacity, 1)
  })
})

test('backward scrolling reconstructs exactly the same opening and supports reusable output', async () => {
  const { sampleJourney: sample } = await motion
  const forward = Array.from({ length: 1001 }, (_, frame) => sample(frame / 1000))
  const output = {}
  for (let frame = 1000; frame >= 0; frame -= 1) {
    assert.equal(sample(frame / 1000, output), output)
    assert.deepEqual(output, forward[frame])
  }
})

test('invalid inputs stay safe and visual opening channels remain finite and bounded', async () => {
  const { sampleJourney: sample } = await motion
  for (const invalid of [undefined, null, '0.5', {}, NaN, -Infinity, -9]) assert.deepEqual(sample(invalid), sample(0))
  for (const overflow of [Infinity, 9]) assert.deepEqual(sample(overflow), sample(1))
  for (let frame = 0; frame <= 3000; frame += 1) {
    const state = sample(frame / 3000)
    assert.ok(Object.values(state).every(Number.isFinite))
    for (const field of ['vortex', 'vortexLight', 'journeyOpacity', 'introTitleOpacity', 'introTyping', 'introOpacity', 'titleExit', 'coreOpacity', 'coreCharge']) {
      assert.ok(state[field] >= 0 && state[field] <= 1, `${field} = ${state[field]}`)
    }
  }
})

test('the vortex, typography and core move continuously across every opening boundary', async () => {
  const { sampleJourney: sample } = await motion
  const boundaries = [0, .005, .045, .075, .08, .085, .09, .10, .105, .15, .16, .23, .235, .26, .28, .295, .30]
  const fields = ['vortex', 'vortexLight', 'introTitleScale', 'introTitleOpacity', 'introTitleX', 'introTyping', 'introOpacity', 'coreX', 'coreY', 'coreOpacity', 'coreScale', 'coreCharge']
  for (const boundary of boundaries) {
    const before = sample(boundary / .30 - 1e-7)
    const after = sample(boundary / .30 + 1e-7)
    for (const field of fields) assert.ok(Math.abs(before[field] - after[field]) < .001, `${field} discontinuity at ${boundary}`)
  }
})
