const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const source = readFileSync(join(__dirname, 'heroGridMath.js'), 'utf8')
const math = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('responsive visibility uses current bounds after a mobile floor exits and re-enters the viewport', async () => {
  const { isHeroGridInViewport } = await math
  const desktop = { left: 0, top: 450, right: 1600, bottom: 900, width: 1600, height: 450 }
  const intermediate = { left: 0, top: 700, right: 390, bottom: 880, width: 390, height: 180 }
  const mobile = { left: 0, top: 658, right: 390, bottom: 844, width: 390, height: 186 }
  assert.equal(isHeroGridInViewport(desktop, 1600, 900), true)
  assert.equal(isHeroGridInViewport(intermediate, 390, 600), false)
  // A queued exit from the intermediate viewport cannot override these bounds.
  assert.equal(isHeroGridInViewport(mobile, 390, 844), true)
  assert.equal(isHeroGridInViewport({ ...mobile, top: -200, bottom: -14 }, 390, 844), false)
  assert.equal(isHeroGridInViewport({ ...mobile, width: 0 }, 390, 844), false)
})

test('idle grid preserves the original vanishing point, rows, and straight lines', async () => {
  const api = await math
  const lines = api.createHeroGridLines(1600, 455).filter(line => !line.detail)
  assert.equal(lines.length, 32)
  assert.deepEqual(lines[0].points[0], { x: 96, y: 0 })
  assert.deepEqual(lines[0].points.at(-1), { x: -960, y: 455 })
  assert.deepEqual(lines.at(-1).points.at(-1), { x: 1600, y: 455 })
  const point = { x: 750, y: 230 }
  assert.deepEqual(api.deformHeroGridPoint(point, { strength: 0 }, [], 10, 1600, 455), point)
})

test('hover bends only a small local area and leaves the horizon and near edge anchored', async () => {
  const { deformHeroGridPoint } = await math
  const hover = { x: 800, y: 250, strength: 1 }
  const center = deformHeroGridPoint({ x: 800, y: 250 }, hover, [], 0, 1600, 455)
  assert.ok(center.y > 250 && center.y < 266)
  const far = deformHeroGridPoint({ x: 0, y: 250 }, hover, [], 0, 1600, 455)
  assert.ok(Math.abs(far.x) < 0.0001 && Math.abs(far.y - 250) < 0.0001)
  assert.deepEqual(deformHeroGridPoint({ x: 800, y: 0 }, hover, [], 0, 1600, 455), { x: 800, y: 0 })
  assert.deepEqual(deformHeroGridPoint({ x: 800, y: 455 }, hover, [], 0, 1600, 455), { x: 800, y: 455 })
})

test('click wave travels outward and decays without leaving permanent deformation', async () => {
  const api = await math
  const point = { x: 1000, y: 250 }
  const ripple = { x: 800, y: 250, started: 0 }
  const idle = { strength: 0 }
  const early = api.deformHeroGridPoint(point, idle, [ripple], 0.03, 1600, 455)
  const arrived = api.deformHeroGridPoint(point, idle, [ripple], 0.4, 1600, 455)
  assert.ok(Math.abs(arrived.y - point.y) > Math.abs(early.y - point.y) + 1)
  const expired = api.deformHeroGridPoint(point, idle, [ripple], api.HERO_GRID_RIPPLE_LIFETIME, 1600, 455)
  assert.deepEqual(expired, point)
})

test('mobile and desktop deformations stay bounded and finite under multiple clicks', async () => {
  const api = await math
  for (const [width, height] of [[390, 180], [2048, 420]]) {
    const hover = { x: width * 0.5, y: height * 0.5, strength: 1 }
    const ripples = Array.from({ length: api.HERO_GRID_RIPPLE_LIMIT }, (_, index) => ({
      x: width * (0.3 + index * 0.1), y: height * 0.5, started: index * 0.08
    }))
    for (const line of api.createHeroGridLines(width, height)) {
      for (const point of line.points) {
        const transformed = api.deformHeroGridPoint(point, hover, ripples, 0.6, width, height)
        assert.ok(Number.isFinite(transformed.x) && Number.isFinite(transformed.y))
        assert.ok(Math.abs(transformed.x - point.x) < 30)
        assert.ok(Math.abs(transformed.y - point.y) < 45)
      }
    }
  }
})

test('hold charge preserves taps, grows with duration, and caps after a long press', async () => {
  const api = await math
  assert.equal(api.getHeroGridHoldCharge(0.08), 0)
  assert.equal(api.getHeroGridHoldCharge(-1), 0)
  assert.equal(api.getHeroGridHoldCharge(NaN), 0)
  const medium = api.getHeroGridHoldCharge(1.5)
  assert.ok(medium > 0 && medium < api.getHeroGridHoldCharge(2.5))
  assert.equal(api.getHeroGridHoldCharge(api.HERO_GRID_HOLD_LIMIT), 1)
  assert.equal(api.getHeroGridHoldCharge(600), 1)
  assert.deepEqual(api.createHeroGridRipple(50, 60, 2, 0.05), api.createHeroGridRipple(50, 60, 2))
})

test('held gravity well pulls inward and sinks progressively while edges stay anchored', async () => {
  const api = await math
  for (const [width, height] of [[390, 180], [2048, 420]]) {
    const x = width * 0.5
    const y = height * 0.5
    const hover = { x, y, strength: 1, holdStrength: 1, charge: api.getHeroGridHoldCharge(0.4) }
    const charged = { ...hover, charge: api.getHeroGridHoldCharge(3.2) }
    const point = { x: x + Math.min(width * 0.025, 30), y }
    const shallow = api.deformHeroGridPoint(point, hover, [], 0, width, height)
    const deep = api.deformHeroGridPoint(point, charged, [], 0, width, height)
    assert.ok(deep.x < shallow.x && deep.x > x)
    assert.ok(deep.y > shallow.y + 12)
    const earlyFunnel = api.getHeroGridFunnel(hover, width, height)
    const fullFunnel = api.getHeroGridFunnel(charged, width, height)
    assert.ok(fullFunnel.depth > earlyFunnel.depth * 5)
    assert.ok(fullFunnel.throat < earlyFunnel.throat * 0.4)
    // A steep stem must emerge at the center, instead of enlarging a broad
    // Gaussian bowl: its relative half-radius depression gets narrower.
    const middle = { x: x + fullFunnel.radius * 0.5, y }
    const earlyCenter = api.deformHeroGridPoint({ x, y }, hover, [], 0, width, height).y - y
    const fullCenter = api.deformHeroGridPoint({ x, y }, charged, [], 0, width, height).y - y
    const earlyShoulder = api.deformHeroGridPoint(middle, hover, [], 0, width, height).y - y
    const fullShoulder = api.deformHeroGridPoint(middle, charged, [], 0, width, height).y - y
    assert.ok(fullShoulder / fullCenter < earlyShoulder / earlyCenter * 0.6)
    for (const edge of [0, height]) {
      assert.deepEqual(api.deformHeroGridPoint({ x, y: edge }, charged, [], 0, width, height), { x, y: edge })
    }
  }
})

test('charged release travels farther, lasts longer, and produces a stronger wave than a tap', async () => {
  const api = await math
  const tap = api.createHeroGridRipple(600, 220, 0, 0.05)
  const charged = api.createHeroGridRipple(600, 220, 0, api.HERO_GRID_HOLD_LIMIT)
  assert.ok(charged.lifetime > tap.lifetime && charged.reach > tap.reach)
  const point = { x: 900, y: 220 }
  const idle = { strength: 0 }
  const peak = ripple => {
    let maximum = 0
    for (let t = 0; t < 1.8; t += 0.015) {
      const transformed = api.deformHeroGridPoint(point, idle, [ripple], t, 1600, 455)
      maximum = Math.max(maximum, Math.abs(transformed.y - point.y))
    }
    return maximum
  }
  assert.ok(peak(charged) > peak(tap) * 2)
  const lateAge = tap.lifetime + 0.2
  const distant = { x: 600 + lateAge * 400 * charged.reach + 35, y: 220 }
  assert.deepEqual(api.deformHeroGridPoint(distant, idle, [tap], lateAge, 4000, 455), distant)
  const chargedPoint = { x: 600 + lateAge * 430 * charged.reach + 35, y: 220 }
  const lateWave = api.deformHeroGridPoint(chargedPoint, idle, [charged], lateAge, 4000, 455)
  assert.ok(Math.abs(lateWave.y - chargedPoint.y) > 1)
  assert.deepEqual(api.deformHeroGridPoint(point, idle, [charged], charged.lifetime, 1600, 455), point)
})

test('overlapping fully charged waves remain finite and bounded at mobile and desktop sizes', async () => {
  const api = await math
  for (const [width, height] of [[390, 180], [2048, 420]]) {
    const hover = { x: width * 0.5, y: height * 0.5, strength: 1, holdStrength: 1, charge: 1 }
    const ripples = Array.from({ length: api.HERO_GRID_RIPPLE_LIMIT }, (_, i) =>
      api.createHeroGridRipple(width * (0.3 + i * 0.1), height * 0.5, i * 0.06, 20))
    for (const line of api.createHeroGridLines(width, height)) {
      for (const point of line.points) {
        const transformed = api.deformHeroGridPoint(point, hover, ripples, 0.6, width, height)
        assert.ok(Number.isFinite(transformed.x) && Number.isFinite(transformed.y))
        assert.ok(Math.abs(transformed.x - point.x) <= width * 0.09 + 0.0001)
        assert.ok(Math.abs(transformed.y - point.y) <= Math.max(66, Math.min(210, height * 0.55)) + 0.0001)
      }
    }
  }
})

test('charged well uses a connected local detail mesh without changing idle perspective', async () => {
  const api = await math
  for (const [width, height] of [[390, 180], [2048, 420]]) {
    const lines = api.createHeroGridLines(width, height)
    assert.equal(lines.filter(line => !line.detail).length, 32)
    assert.ok(lines.filter(line => line.detail).length >= 80)
    const hover = { x: width * 0.75, y: height * 0.5, strength: 1, holdStrength: 1, charge: 1 }
    const bottom = api.deformHeroGridPoint({ x: hover.x, y: hover.y }, hover, [], 0, width, height)
    assert.ok(bottom.y > hover.y + height * 0.35)
    assert.ok(bottom.y < height - 5)
    const distant = { x: 0, y: height * 0.5 }
    const transformed = api.deformHeroGridPoint(distant, hover, [], 0, width, height)
    assert.ok(Math.abs(transformed.x - distant.x) < 0.001)
    assert.ok(Math.abs(transformed.y - distant.y) < 0.001)
  }
})

test('only a fully charged release detonates and spreads neon outward before its glitch', async () => {
  const api = await math
  const tap = api.createHeroGridRipple(300, 200, 10, 0.08)
  const partial = api.createHeroGridRipple(300, 200, 10, 1.8)
  const full = api.createHeroGridRipple(300, 200, 10, api.HERO_GRID_HOLD_LIMIT)
  assert.equal(api.getHeroGridReleaseState(tap, 10.05).blast, 0)
  assert.equal(api.getHeroGridReleaseState(partial, 10.05).neonRadius, 0)
  const start = api.getHeroGridReleaseState(full, 10.05)
  const spreading = api.getHeroGridReleaseState(full, 10.6)
  assert.equal(start.phase, 'wave')
  assert.ok(start.blast > spreading.blast)
  assert.ok(spreading.neonRadius > start.neonRadius * 5)
  assert.equal(api.getHeroGridReleaseState(full, 10 + full.glitchStart - 0.001).phase, 'wave')
})

test('maximum charge glitches for exactly 1.8 seconds then returns to a straight blue idle grid', async () => {
  const api = await math
  for (const [width, height] of [[390, 180], [2048, 420]]) {
    const full = api.createHeroGridRipple(width * 0.6, height * 0.4, 0, 40, width, height)
    assert.ok(Math.abs(full.lifetime - full.glitchStart - 1.8) < 1e-12)
    assert.equal(api.getHeroGridReleaseState(full, full.glitchStart).phase, 'glitch')
    assert.equal(api.getHeroGridReleaseState(full, full.lifetime - 0.001).phase, 'glitch')
    assert.equal(api.getHeroGridReleaseState(full, full.lifetime).phase, 'complete')
    const ended = api.getHeroGridReleaseState(full, full.lifetime + 5)
    assert.equal(ended.glitch, 0)
    assert.equal(ended.blast, 0)
    assert.equal(ended.neonRadius, 0)
    const point = { x: width * 0.4, y: height * 0.6 }
    assert.deepEqual(api.deformHeroGridPoint(point, { strength: 0 }, [full], full.lifetime, width, height), point)
  }
})
