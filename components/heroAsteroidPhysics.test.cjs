const assert = require('node:assert/strict')
const {test} = require('node:test')
const {readFileSync} = require('node:fs')
const {join} = require('node:path')

const source = readFileSync(join(__dirname, 'heroAsteroidPhysics.js'), 'utf8')
const physics = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('footer rare foreground band is sampled per arrival, while count, size and speed honor presets',async()=>{
  const {createHeroAsteroidSimulation:create,stepHeroAsteroids:step}=await physics
  const high=create(1400,800,true,{random:()=>.04,rareForegroundChance:.05,count:5,speedScale:0,sizeScale:1.5})
  assert.equal(high.bodies.length,5)
  high.bodies.forEach(body=>{assert.equal(body.highPass,true);assert.ok(body.y<800*.6);assert.equal(Math.abs(body.vx),0)})
  const low=create(1400,800,true,{random:()=>.06,rareForegroundChance:.05})
  low.bodies.forEach(body=>assert.equal(body.highPass,false))
  const choices=low.bodies.map(body=>body.highPass)
  for(let i=0;i<30;i++)step(low,.016)
  assert.deepEqual(low.bodies.map(body=>body.highPass),choices,'idle frames cannot reroll a spawn band')
})
test('blast destroys visible rocks once, leaves queued offscreen rocks alone and replaces after a gap',async()=>{
  const {createHeroAsteroidSimulation:create,blastVisibleAsteroids:blast,stepHeroAsteroids:step}=await physics
  const sim=create(1400,800,false)
  sim.bodies.forEach((body,i)=>{body.x=i===0?-1000:200+i*150;body.y=200})
  assert.equal(blast(sim),sim.bodies.length-1)
  assert.equal(sim.bodies[0].active,true)
  assert.equal(blast(sim),0,'no duplicate blast damage')
  assert.ok(sim.debris.length>0)
  const identities=sim.bodies.map(body=>body.identity)
  for(let i=0;i<240;i++)step(sim,1/60)
  assert.deepEqual(sim.bodies.slice(1).map(body=>body.identity),identities.slice(1),'no immediate respawn')
})

async function isolated(radius = 20, x2 = 180) {
  const api = await physics
  const simulation = api.createHeroAsteroidSimulation(600, 400, false, {random: () => 0.5})
  simulation.bodies = simulation.bodies.slice(0, 2).map((body, index) => ({
    ...body, x: index ? x2 : 100, y: 100, vx: 0, vy: 0,
    radius, visualRadius: radius, baseVisualRadius: radius, spin: [0, 0, 0]
  }))
  return {api, simulation}
}

function advance(api, simulation, duration, reducedMotion = false) {
  for (let frame = 0; frame < Math.ceil(duration * 60); frame += 1) api.stepHeroAsteroids(simulation, 1 / 60, reducedMotion)
}

test('ambient travel follows a direction rather than oscillating around a home', async () => {
  const {api, simulation} = await isolated(20, 500)
  const body = simulation.bodies[0]
  body.vx = 20
  body.vy = 2
  advance(api, simulation, 3)
  assert.ok(Math.abs(body.x - 160) < 0.001)
  assert.ok(Math.abs(body.y - 106) < 0.001)
  assert.equal(Object.hasOwn(body, 'homeX'), false)
})

test('gentle collisions bounce without crushing or creating debris', async () => {
  const {api, simulation} = await isolated(20, 139)
  simulation.bodies[0].vx = 30
  simulation.bodies[1].vx = -30
  api.stepHeroAsteroids(simulation, 1 / 60)
  assert.equal(simulation.crushCount, 0)
  assert.equal(simulation.debris.length, 0)
  assert.ok(simulation.bodies[0].vx < 0)
  assert.ok(simulation.bodies[1].vx > 0)
})

test('a fast natural collision crushes without a user-energy flag', async () => {
  const {api, simulation} = await isolated()
  simulation.bodies[0].vx = 500
  simulation.bodies[1].vx = -500
  api.stepHeroAsteroids(simulation, 0.05)
  assert.equal(simulation.crushCount, 1)
  assert.equal(simulation.bodies.filter(body => !body.active).length, 1)
  assert.ok(simulation.debris.length > 0 && simulation.debris.length <= api.HERO_DEBRIS_LIMIT)
})

test('390px phones allow fast natural impacts while ordinary bumps still rebound', async () => {
  const api = await physics
  const pair = () => {
    const simulation = api.createHeroAsteroidSimulation(390, 800, false, {random: () => 0.5})
    simulation.bodies = simulation.bodies.slice(0, 2).map((body, index) => ({
      ...body, x: index ? 139 : 100, y: 100, radius: 20, visualRadius: 20,
      baseVisualRadius: 20, vx: index ? -105 : 105, vy: 0, userEnergyUntil: 0
    }))
    return simulation
  }
  const fast = pair()
  api.stepHeroAsteroids(fast, 1 / 60)
  assert.equal(fast.crushCount, 1)
  assert.ok(fast.debris.length > 0)
  const gentle = pair()
  gentle.bodies[0].vx = 25
  gentle.bodies[1].vx = -25
  api.stepHeroAsteroids(gentle, 1 / 60)
  assert.equal(gentle.crushCount, 0)
  assert.equal(gentle.debris.length, 0)
  assert.ok(gentle.bodies[0].vx < 0)
  assert.ok(gentle.bodies[1].vx > 0)
})

test('speed while separating is not a crushing impact', async () => {
  const {api, simulation} = await isolated(20, 139)
  simulation.bodies[0].vx = -500
  simulation.bodies[1].vx = 500
  api.stepHeroAsteroids(simulation, 1 / 60)
  assert.equal(simulation.crushCount, 0)
})

test('forceful held impact removes the victim permanently; a new offscreen rock arrives after a gap', async () => {
  const {api, simulation} = await isolated()
  const victim = simulation.bodies[1]
  const oldIdentity = victim.identity
  const oldSeed = victim.geometrySeed
  const oldForm = victim.geometryForm
  const oldPosition = [victim.x, victim.y]
  api.beginHeroAsteroidDrag(simulation, 0, 100, 100)
  api.moveHeroAsteroidDrag(simulation, 400, 100)
  api.stepHeroAsteroids(simulation, 0.05)
  assert.equal(simulation.crushCount, 1)
  assert.equal(simulation.bodies[0].active, true)
  assert.equal(victim.active, false)
  api.releaseHeroAsteroidDrag(simulation, false)
  advance(api, simulation, 5)
  assert.equal(victim.active, false)
  assert.equal(victim.identity, oldIdentity)
  assert.equal(simulation.debris.length, 0)
  while (victim.identity === oldIdentity) api.stepHeroAsteroids(simulation, 1 / 60)
  assert.equal(victim.generation, 1)
  assert.notEqual(victim.geometrySeed, oldSeed)
  assert.notEqual(victim.geometryForm, oldForm)
  assert.notDeepEqual([victim.x, victim.y], oldPosition)
  assert.equal(victim.active, true)
  assert.ok(victim.x + victim.visualRadius < 0 || victim.x - victim.visualRadius > simulation.width || victim.y + victim.visualRadius < 0)
  assert.equal(simulation.arrivalCount, 1)
  assert.equal(simulation.bodies.length, 2)
})

test('a released hurl can crush and a fast drag cannot tunnel through a tiny rock', async () => {
  const {api, simulation} = await isolated(7, 160)
  api.beginHeroAsteroidDrag(simulation, 0, 100, 100)
  api.moveHeroAsteroidDrag(simulation, 120, 100)
  api.stepHeroAsteroids(simulation, 1 / 60)
  api.releaseHeroAsteroidDrag(simulation)
  assert.ok(simulation.bodies[0].vx > 500)
  advance(api, simulation, 0.1)
  assert.equal(simulation.crushCount, 1)
  const second = await isolated(7, 130)
  api.beginHeroAsteroidDrag(second.simulation, 0, 100, 100)
  api.moveHeroAsteroidDrag(second.simulation, 550, 100)
  api.stepHeroAsteroids(second.simulation, 0.05)
  assert.equal(second.simulation.crushCount, 1)
})

test('slow pointer samples do not misread substeps as high-speed impacts', async () => {
  const {api, simulation} = await isolated(20, 170)
  api.beginHeroAsteroidDrag(simulation, 0, 100, 100)
  for (let frame = 0; frame < 60; frame += 1) {
    api.moveHeroAsteroidDrag(simulation, 100 + (frame + 1) * 1.5, 100)
    api.stepHeroAsteroids(simulation, 1 / 60)
  }
  assert.equal(simulation.crushCount, 0)
})

test('offscreen travel exits instead of bouncing and replaces through another edge', async () => {
  const {api, simulation} = await isolated(20, 500)
  const body = simulation.bodies[0]
  body.x = simulation.width + body.visualRadius + 23
  body.vx = 100
  api.stepHeroAsteroids(simulation, 0.05)
  assert.equal(body.active, false)
  assert.equal(body.retiredReason, 'exited')
  assert.ok(body.x > simulation.width)
  assert.ok(body.vx > 0)
  const identity = body.identity
  while (body.identity === identity) api.stepHeroAsteroids(simulation, 1 / 60)
  assert.equal(body.generation, 1)
  assert.ok(body.x > simulation.width + body.visualRadius)
  assert.ok(body.vx < 0)
})

test('foreground rocks stay in the lower band and replacements enter below the content', async () => {
  const api = await physics
  for (const width of [390, 1024, 1417]) {
    const simulation = api.createHeroAsteroidSimulation(width, width < 1101 ? 800 : 792, true)
    advance(api, simulation, 10)
    assert.ok(simulation.bodies.every(body => body.y - body.visualRadius > simulation.height * 0.75))
    const body = simulation.bodies[0]
    body.x = simulation.width + body.visualRadius + 25
    body.vx = 100
    api.stepHeroAsteroids(simulation, 0.05)
    const generation = body.generation
    while (body.generation === generation) api.stepHeroAsteroids(simulation, 1 / 60)
    assert.ok(body.x < -body.visualRadius || body.x > simulation.width + body.visualRadius)
    assert.ok(body.y - body.visualRadius > simulation.height * 0.75)
  }
})

test('released foreground rocks ease down from a dragged position', async () => {
  const api = await physics
  const simulation = api.createHeroAsteroidSimulation(1417, 792, true)
  simulation.bodies = simulation.bodies.slice(0, 1)
  const body = simulation.bodies[0]
  body.x = 700
  body.y = 350
  body.vx = 0
  body.vy = 0
  advance(api, simulation, 6)
  assert.ok(body.y - body.visualRadius > simulation.height * 0.75)
  assert.ok(Math.abs(body.x - 700) < 0.001)
})

test('reduced motion freezes ambient travel and rotation while retaining deliberate interaction', async () => {
  const {api, simulation} = await isolated()
  const before = simulation.bodies.map(body => [body.x, body.y, ...body.rotation])
  advance(api, simulation, 1, true)
  assert.deepEqual(simulation.bodies.map(body => [body.x, body.y, ...body.rotation]), before)
  api.beginHeroAsteroidDrag(simulation, 0, 100, 100)
  api.moveHeroAsteroidDrag(simulation, 115, 100)
  api.stepHeroAsteroids(simulation, 1 / 60, true)
  assert.ok(simulation.bodies[0].x > 100)
})

test('responsive boundary, deterministic random injection and bounded pools remain stable', async () => {
  const api = await physics
  for (const width of [390, 768, 1024, 1100, 1101, 1417]) {
    const background = api.createHeroAsteroidSimulation(width, 1536)
    const foreground = api.createHeroAsteroidSimulation(width, 1536, true)
    assert.equal(background.mobile, width <= 1100)
    assert.equal(foreground.mobile, width <= 1100)
    assert.equal(background.bodies.length, 7)
    assert.equal(foreground.bodies.length, 2)
    assert.ok(background.bodies.every(body => Number.isFinite(body.radius) && body.radius > 0))
  }
  const a = api.createHeroAsteroidSimulation(1417, 792, false, {seed: 12, random: () => 0.3})
  const b = api.createHeroAsteroidSimulation(1417, 792, false, {seed: 12, random: () => 0.3})
  advance(api, a, 60)
  advance(api, b, 60)
  assert.deepEqual(a.bodies, b.bodies)
  assert.equal(a.bodies.length, 7)
  assert.ok(a.debris.length <= api.HERO_DEBRIS_LIMIT)
})

test('cancellation discards velocity, invalid deltas do nothing and long resume deltas are bounded', async () => {
  const {api, simulation} = await isolated()
  api.beginHeroAsteroidDrag(simulation, 0, 100, 100)
  api.moveHeroAsteroidDrag(simulation, 140, 100)
  api.stepHeroAsteroids(simulation, 1 / 60)
  api.releaseHeroAsteroidDrag(simulation, false)
  assert.equal(simulation.drag, null)
  assert.equal(simulation.bodies[0].grabbed, false)
  assert.equal(simulation.bodies[0].vx, 0)
  assert.equal(simulation.bodies[0].vy, 0)
  const before = simulation.time
  api.stepHeroAsteroids(simulation, NaN)
  api.stepHeroAsteroids(simulation, -1)
  assert.equal(simulation.time, before)
  api.stepHeroAsteroids(simulation, 120)
  assert.ok(simulation.time - before < 0.051)
  assert.ok(simulation.bodies.every(body => [body.x, body.y, body.vx, body.vy].every(Number.isFinite)))
})
