const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, 'projectDotMath.js'), 'utf8')
const load = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('the dot lattice stays anchored through resize without changing its existing positions', async () => {
  const { createProjectDots } = await load
  const small = createProjectDots(80, 60, 20)
  const large = createProjectDots(160, 120, 20)
  for (const dot of small) {
    assert.deepEqual(large.find((candidate) => candidate.x === dot.x && candidate.y === dot.y), dot)
  }
})

test('hover forms a local pulsating cluster and leaves distant dots unchanged', async () => {
  const { projectDotHoverStrength } = await load
  const center = projectDotHoverStrength(200, 200, 200, 200, 0)
  assert.ok(center > 0.6)
  assert.ok(projectDotHoverStrength(200, 200, 200, 200, 1) !== center)
  assert.equal(projectDotHoverStrength(600, 200, 200, 200, 0), 0)
  assert.equal(projectDotHoverStrength(200, 200, 200, 200, 0, 0), 0)
})

test('click waves propagate to the farthest corner before fading out', async () => {
  const { projectDotWaveReach, projectDotWaveStrength, PROJECT_DOT_WAVE_SPEED } = await load
  const reach = projectDotWaveReach(100, 200, 1000, 700)
  assert.equal(reach, Math.hypot(900, 500))
  const distance = 620
  assert.ok(projectDotWaveStrength(distance, 1, reach) > 0.4)
  assert.ok(projectDotWaveStrength(distance, 0.5, reach) < 0.001)
  assert.ok(projectDotWaveStrength(reach, reach / PROJECT_DOT_WAVE_SPEED, reach) > 0.3)
  assert.equal(projectDotWaveStrength(reach, (reach + 101) / PROJECT_DOT_WAVE_SPEED, reach), 0)
})
