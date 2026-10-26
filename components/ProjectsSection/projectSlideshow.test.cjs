const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const controller = import(`data:text/javascript;base64,${Buffer.from(
  readFileSync(join(__dirname, 'projectSlideshow.js'), 'utf8'),
).toString('base64')}`)
const selection = (projectIndex = 0, imageCount = 3, playing = true) => ({ projectIndex, imageCount, playing })
const frames = (advance, state, seconds, options) => {
  let result
  const steps = Math.round(seconds * 60)
  for (let index = 0; index < steps; index += 1) result = advance(state, 1 / 60, options)
  return result
}

test('a screenshot holds for 4.5 seconds, dissolves for 1.5 seconds, then holds the next image', async () => {
  const { createProjectSlideshow: create, advanceProjectSlideshow: advance } = await controller
  const state = create()
  assert.equal(advance(state, 0, selection()).nextWakeMs, 4500)
  const held = advance(state, 4.4, selection())
  assert.equal(held.currentIndex, 0)
  assert.equal(held.mix, 0)
  assert.ok(Math.abs(held.nextWakeMs - 100) < 1e-6)
  assert.equal(held.needsFrame, false)
  const start = advance(state, 0.1, selection())
  assert.equal(start.phase, 'transition')
  assert.equal(start.mix, 0)
  assert.equal(start.nextWakeMs, 0)
  assert.equal(start.needsFrame, true)
  const middle = frames(advance, state, 0.75, selection())
  assert.ok(Math.abs(middle.mix - 0.5) < 1e-8)
  assert.equal(middle.currentIndex, 0)
  assert.equal(middle.nextIndex, 1)
  const finished = frames(advance, state, 0.75, selection())
  assert.equal(finished.currentIndex, 1)
  assert.equal(finished.mix, 0)
  assert.equal(finished.nextWakeMs, 4500)
  assert.equal(finished.needsFrame, false)
})

test('scrolling freezes a fractional dissolve and resuming excludes the paused wall time', async () => {
  const { createProjectSlideshow: create, advanceProjectSlideshow: advance } = await controller
  const state = create()
  advance(state, 0, selection())
  advance(state, 4.5, selection())
  const before = frames(advance, state, 0.5, selection())
  const paused = advance(state, 120, selection(0, 3, false))
  assert.equal(paused.mix, before.mix)
  assert.equal(paused.nextWakeMs, Infinity)
  assert.equal(paused.needsFrame, false)
  const resumed = advance(state, 120, selection())
  assert.equal(resumed.mix, before.mix)
  assert.ok(advance(state, 1 / 60, selection()).mix > before.mix)
})

test('returning to a prior project restores its own screenshot and remaining hold', async () => {
  const { createProjectSlideshow: create, advanceProjectSlideshow: advance } = await controller
  const state = create()
  advance(state, 0, selection(0))
  const first = advance(state, 2, selection(0))
  advance(state, 90, selection(1, 5))
  advance(state, 4.5, selection(1, 5))
  frames(advance, state, 1.5, selection(1, 5))
  const second = advance(state, 1, selection(1, 5))
  assert.equal(second.currentIndex, 1)
  const restoredFirst = advance(state, 90, selection(0))
  assert.equal(restoredFirst.currentIndex, 0)
  assert.equal(restoredFirst.nextWakeMs, first.nextWakeMs)
  const restoredSecond = advance(state, 90, selection(1, 5))
  assert.equal(restoredSecond.currentIndex, second.currentIndex)
  assert.equal(restoredSecond.nextWakeMs, second.nextWakeMs)
})

test('a delayed dwell wake still begins a visible dissolve and stalled frames cannot skip images', async () => {
  const { createProjectSlideshow: create, advanceProjectSlideshow: advance } = await controller
  const state = create()
  advance(state, 0, selection())
  const delayed = advance(state, 600, selection())
  assert.equal(delayed.currentIndex, 0)
  assert.equal(delayed.nextIndex, 1)
  assert.equal(delayed.phase, 'transition')
  assert.equal(delayed.mix, 0)
  const stalled = advance(state, 600, selection())
  assert.equal(stalled.currentIndex, 0)
  assert.ok(stalled.mix > 0 && stalled.mix < 0.02)
})

test('empty and single-image projects stay static; a loaded gallery starts with a complete dwell', async () => {
  const { createProjectSlideshow: create, advanceProjectSlideshow: advance } = await controller
  const state = create()
  const empty = advance(state, 100, selection(0, 0))
  assert.equal(empty.currentIndex, -1)
  assert.equal(empty.nextIndex, -1)
  assert.equal(empty.nextWakeMs, Infinity)
  const single = advance(state, 100, selection(0, 1))
  assert.equal(single.currentIndex, 0)
  assert.equal(single.nextIndex, 0)
  assert.equal(single.mix, 0)
  assert.equal(single.needsFrame, false)
  const loaded = advance(state, 100, selection(0, 4))
  assert.equal(loaded.currentIndex, 0)
  assert.equal(loaded.nextWakeMs, 4500)
})

test('reduced motion pauses autoplay without losing the saved screenshot or blend', async () => {
  const { createProjectSlideshow: create, advanceProjectSlideshow: advance } = await controller
  const state = create()
  advance(state, 0, selection())
  advance(state, 4.5, selection())
  const before = frames(advance, state, 0.5, selection())
  const reduced = advance(state, 100, { ...selection(), reducedMotion: true })
  assert.equal(reduced.mix, before.mix)
  assert.equal(reduced.nextWakeMs, Infinity)
  assert.equal(reduced.needsFrame, false)
  assert.equal(advance(state, 100, selection()).mix, before.mix)
})

test('changing screenshot counts keeps indices in range and retains a surviving incoming image', async () => {
  const { createProjectSlideshow: create, advanceProjectSlideshow: advance } = await controller
  const state = create()
  advance(state, 0, selection(0, 2))
  advance(state, 4.5, selection(0, 2))
  frames(advance, state, 1.5, selection(0, 2))
  advance(state, 4.5, selection(0, 2))
  const wrap = frames(advance, state, 0.5, selection(0, 2))
  assert.equal(wrap.currentIndex, 1)
  assert.equal(wrap.nextIndex, 0)
  const grown = advance(state, 0, selection(0, 4))
  assert.equal(grown.currentIndex, 1)
  assert.equal(grown.nextIndex, 0)
  assert.equal(grown.mix, wrap.mix)
  const shrunk = advance(state, 0, selection(0, 1))
  assert.equal(shrunk.currentIndex, 0)
  assert.equal(shrunk.nextIndex, 0)
  assert.equal(shrunk.mix, 0)
  assert.equal(shrunk.nextWakeMs, Infinity)
})

test('invalid elapsed input cannot advance a paused or playing slideshow', async () => {
  const { createProjectSlideshow: create, advanceProjectSlideshow: advance } = await controller
  const state = create()
  advance(state, 0, selection())
  for (const delta of [NaN, Infinity, -Infinity, -10, undefined]) {
    const result = advance(state, delta, selection())
    assert.equal(result.currentIndex, 0)
    assert.equal(result.nextWakeMs, 4500)
  }
})

test('sampling handoff textures does not change the active slideshow or resume clock', async () => {
  const { createProjectSlideshow: create, advanceProjectSlideshow: advance, peekProjectSlideshow: peek } = await controller
  const state = create()
  advance(state, 0, selection(0))
  const before = advance(state, 2, selection(0))
  const other = peek(state, 1, 5)
  assert.equal(other.currentIndex, 0)
  assert.equal(other.nextWakeMs, Infinity)
  const source = peek(state, 0, 3)
  assert.equal(source.currentIndex, before.currentIndex)
  const continued = advance(state, 1, selection(0))
  assert.equal(continued.nextWakeMs, 1500)
})
