const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const source = readFileSync(join(__dirname, 'skillsTerrainMath.js'), 'utf8')
const mathPromise = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('the terrain bands meet without a sky gap before, during and after mountain discovery', async () => {
  const { skillsTerrainBandHeightAtTravel: height } = await mathPromise
  for (const travel of [-70,-52,-24,0,38,126,214,302,352,455,940,1382]) {
    for (let x = -230; x <= 1530; x += 2.75) {
      for (const [z, back, front] of [[-150,'distant','secondary'],[-88,'secondary','primary'],[-22,'primary','foreground']]) {
        assert.ok(Math.abs(height(x,z,back,travel)-height(x,z,front,travel)) < 1e-9, `${back}/${front} seam at ${x},${z} during ${travel}`)
        const epsilon = 1e-5
        assert.ok(Math.abs(height(x,z-epsilon,back,travel)-height(x,z+epsilon,front,travel)) < .001, 'shared edge stays continuous on both sides')
      }
    }
  }
})

test('entry has no primary mountain and discovered masses remain intact through the final exit', async () => {
  const { skillsTerrainHeightAtTravel: height, skillsTerrainBaseHeight: base, skillsTerrainHeight: full } = await mathPromise
  for (let x = -110; x <= 510; x += 5) for (let z = -88; z <= 28; z += 4) {
    assert.equal(height(x,z,-70),base(x,z))
    assert.ok(Math.abs(height(x,z,455)-full(x,z)) < 1e-9)
    assert.equal(height(x,z,455),height(x,z,1382), 'the tenfold exit never collapses discovered terrain')
  }
  for (const center of [0,88,176,264,352]) {
    const x = center + 15, z = -49
    let previous = -Infinity
    const forward = []
    for (let i = 0; i <= 100; i++) {
      const value = height(x,z,center-50+i*.55)
      assert.ok(value >= previous - 1e-9)
      previous = value; forward.push(value)
    }
    for (let i = 100; i >= 0; i--) assert.equal(height(x,z,center-50+i*.55),forward[i])
  }
})

test('the foreground builds by coherent portions rather than revealing every fragment at once', async () => {
  const { skillsTerrainBuildDelay: delay, smooth } = await mathPromise
  const points = []
  for (let x = -110; x <= -20; x += 5) for (let z = -22; z <= 28; z += 5) {
    const at = delay(x,z,-22,28,'foreground')
    assert.ok(Math.abs(at-delay(x+1,z,-22,28,'foreground')) < .01, 'neighbouring portions share a smooth reveal front')
    points.push(at)
  }
  const visible = formation => points.filter(at => smooth(formation,at,at+.2) > .012).length
  assert.equal(visible(.4),0)
  assert.ok(visible(.65)>0 && visible(.65)<points.length)
  assert.equal(visible(1),points.length)
})
