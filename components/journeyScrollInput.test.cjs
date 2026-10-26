const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const api = import(`data:text/javascript;base64,${Buffer.from(
  readFileSync(join(__dirname, 'journeyScrollInput.js'), 'utf8'),
).toString('base64')}`)

test('wheel pixel, line and page units normalize to signed travel', async () => {
  const { normalizeJourneyWheel: normalize } = await api
  assert.equal(normalize(3), 3)
  assert.equal(normalize(3, 1), 48)
  assert.equal(normalize(-3, 1), -48)
  assert.equal(normalize(0.1, 2, 900), 90)
  assert.equal(normalize(-0.1, 2, 900), -90)
})

test('large wheel bursts are capped and invalid input is inert', async () => {
  const { normalizeJourneyWheel: normalize } = await api
  assert.equal(normalize(100000), 240)
  assert.equal(normalize(-100000), -240)
  for (const delta of [NaN, Infinity, -Infinity, undefined]) assert.equal(normalize(delta), 0)
  assert.equal(normalize(0.1, 2, NaN), 80)
})

test('precision trackpad input retains its continuous magnitude instead of emitting gesture counts', async () => {
  const { normalizeJourneyWheel: normalize } = await api
  const travel = [0.3, 1.7, 12.5, 27.3, 18.2, 7.4, 1.2]
  assert.deepEqual(travel.map(delta => normalize(delta)), travel)
  assert.equal(travel.reduce((sum, delta) => sum + normalize(delta), 0), travel.reduce((sum, delta) => sum + delta, 0))
})
