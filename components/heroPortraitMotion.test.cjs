const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const source = readFileSync(join(__dirname, 'heroPortraitMotion.js'), 'utf8')
const api = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('idle pose levitates smoothly through a full cycle with no pointer input', async () => {
  const { sampleHeroPortraitMotion: sample } = await api
  const start = sample(0, 0, 0)
  const upper = sample(0, 0, 7.8 / 4)
  const lower = sample(0, 0, 7.8 * 3 / 4)
  const end = sample(0, 0, 7.8)
  assert.equal(start.y, 0)
  assert.ok(upper.y > 3 && lower.y < -3)
  assert.ok(Math.abs(end.y - start.y) < 0.0001)
  let previous = start
  for (let frame = 1; frame <= 468; frame++) {
    const next = sample(0, 0, frame / 60)
    assert.ok(Math.abs(next.y - previous.y) < 0.06)
    previous = next
  }
})

test('all diagonal pointer directions produce a bounded position and matching two-axis twist', async () => {
  const { sampleHeroPortraitMotion: sample } = await api
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    const pose = sample(x, y, 0)
    assert.equal(Math.sign(pose.x), x)
    assert.equal(Math.sign(pose.y), y)
    assert.equal(Math.sign(pose.rotateX), -y)
    assert.equal(Math.sign(pose.rotateY), x)
    assert.ok(Math.abs(pose.x) <= 8 && Math.abs(pose.y) <= 4)
    assert.ok(Math.abs(pose.rotateX) < 1.5 && Math.abs(pose.rotateY) < 2.5)
    const touch = sample(x * 100, y * 100, 0, true)
    assert.ok(Math.abs(touch.x) < Math.abs(pose.x))
    assert.ok(Math.abs(touch.rotateY) < Math.abs(pose.rotateY))
  }
})
