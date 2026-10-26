const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const modulePromise = import(`data:text/javascript;base64,${Buffer.from(readFileSync(join(__dirname, 'journeyBackdropTransition.js'), 'utf8')).toString('base64')}`)

test('an interrupted A to B to C to A fade follows the latest front photograph without a jump', async () => {
  const { createBackdropTransition, retargetBackdropTransition, advanceBackdropTransition } = await modulePromise
  const state = createBackdropTransition('A')
  retargetBackdropTransition(state, 'B', 0)
  advanceBackdropTransition(state, 240)
  const before = state.layers.map(layer => layer.weight)
  retargetBackdropTransition(state, 'C', 240)
  assert.deepEqual(state.layers.slice(0, 2).map(layer => layer.weight), before)
  advanceBackdropTransition(state, 400)
  const interrupted = new Map(state.layers.map(layer => [layer.source, layer.weight]))
  retargetBackdropTransition(state, 'A', 400)
  assert.deepEqual(new Map(state.layers.map(layer => [layer.source, layer.weight])), interrupted)
  advanceBackdropTransition(state, 1120)
  assert.equal(state.target, 'A')
  assert.equal(state.moving, false)
  assert.deepEqual(state.layers.map(layer => [layer.source, layer.weight]), [['A', 1]])
})

test('multiple fading photographs preserve a complete normalized image rather than dimming between sources', async () => {
  const { createBackdropTransition, retargetBackdropTransition, advanceBackdropTransition, backdropLayerOpacities } = await modulePromise
  const state = createBackdropTransition('A')
  retargetBackdropTransition(state, 'B', 0)
  advanceBackdropTransition(state, 300)
  retargetBackdropTransition(state, 'C', 300)
  for (const now of [300, 350, 550, 800, 1020]) {
    advanceBackdropTransition(state, now)
    const alpha = backdropLayerOpacities(state)
    const contributions = alpha.map((value, index) => value * alpha.slice(index + 1).reduce((transmission, above) => transmission * (1 - above), 1))
    state.layers.forEach((layer, index) => assert.ok(Math.abs(layer.weight - contributions[index]) < 1e-10))
    assert.ok(Math.abs(contributions.reduce((sum, value) => sum + value, 0) - 1) < 1e-10)
  }
})

test('a new photograph starts immediately after an existing fade and completed fades release obsolete layers', async () => {
  const { createBackdropTransition, retargetBackdropTransition, advanceBackdropTransition } = await modulePromise
  const state = createBackdropTransition()
  retargetBackdropTransition(state, 'first decoded photo', 10)
  assert.equal(state.layers[0].weight, 1)
  assert.equal(state.moving, false)
  retargetBackdropTransition(state, 'second', 20)
  advanceBackdropTransition(state, 740)
  assert.equal(state.layers.length, 1)
  retargetBackdropTransition(state, 'third', 740)
  advanceBackdropTransition(state, 1100)
  assert.equal(state.target, 'third')
  assert.ok(state.layers.find(layer => layer.source === 'third').weight > 0)
  assert.equal(retargetBackdropTransition(state, 'third', 1100), false)
  advanceBackdropTransition(state, 1460)
  assert.deepEqual(state.layers.map(layer => layer.source), ['third'])
})
