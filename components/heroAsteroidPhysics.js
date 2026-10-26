// CSS-pixel coordinates keep the orthographic rocks and DOM drag targets aligned.
// Near and far rocks inhabit separate depth planes, each with a bounded pool.
export const HERO_DEBRIS_LIMIT = 32

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const length = (x, y) => Math.hypot(x, y)

export function asteroidRandom(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

function sample(simulation, body, offset) {
  return simulation.random(simulation.seed + body.id * 97.3 + body.generation * 173.7 + offset)
}

function setAppearance(simulation, body, initial = false) {
  body.identity = `${simulation.foreground ? 'near' : 'far'}-${body.id}-${body.generation}`
  // A bounded prebuilt form bank lets replacements change shape without
  // generating/discarding a detailed mesh during an animation frame.
  body.geometryForm = (body.id + body.generation * 3) % simulation.geometryFormCount
  body.geometrySeed = simulation.seed + body.geometryForm * 5.2
  body.depth = 0.2 + sample(simulation, body, 1) * 0.8
  body.visualRadius = body.baseVisualRadius * (initial ? 1 : 0.82 + sample(simulation, body, 2) * 0.34)
  // The deformed source mesh sits inside its unit sphere.
  body.radius = Math.max(7, body.visualRadius * 0.79)
  body.shape = [0.9 + sample(simulation, body, 3) * 0.22, 0.87 + sample(simulation, body, 4) * 0.25, 0.85 + sample(simulation, body, 5) * 0.22]
  body.rotation = [sample(simulation, body, 6) * 6.28, sample(simulation, body, 7) * 6.28, sample(simulation, body, 8) * 6.28]
  body.spin = [(sample(simulation, body, 9) - 0.5) * 0.12, 0.025 + sample(simulation, body, 10) * 0.055, (sample(simulation, body, 11) - 0.5) * 0.07]
}

function driftSpeed(simulation, body) {
  const scale = clamp(simulation.width / 1417, 0.45, 1.5)
  if (simulation.foreground) return (9 + sample(simulation, body, 12) * 10) * scale * simulation.speedScale
  // Most rocks drift slowly. A rare faster arrival can produce a natural impact.
  const fast = sample(simulation, body, 13) > 0.95
  const speed = fast ? 180 + sample(simulation, body, 14) * 180 : 9 + sample(simulation, body, 14) * 22
  // Keep rare fast impacts possible on phones as well as wide displays.
  return speed * (fast ? Math.max(0.85, scale) : scale) * (0.65 + body.depth * 0.45) * simulation.speedScale
}

function foregroundFloor(simulation, body) {
  if(body.highPass)return simulation.height*(.15+sample(simulation,body,81)*.4)
  return Math.max(simulation.height * 0.9 + body.visualRadius * 0.72, simulation.height * 0.82 + body.visualRadius)
}

function enterNewRock(simulation, body) {
  // Reuse the GPU/DOM slot, never the destroyed asteroid's identity or geometry.
  body.generation += 1
  setAppearance(simulation, body)
  body.highPass=simulation.foreground&&sample(simulation,body,80)<simulation.rareForegroundChance
  const speed = driftSpeed(simulation, body)
  const side = simulation.foreground ? (body.id + body.generation) % 2 : (body.id + body.generation) % 3
  const margin = body.visualRadius * 1.3 + 18
  if (simulation.foreground) {
    body.x = side === 0 ? -margin : simulation.width + margin
    body.y = foregroundFloor(simulation, body) + sample(simulation, body, 15) * body.visualRadius * 0.18
    body.vx = side === 0 ? speed : -speed
    body.vy = (sample(simulation, body, 16) - 0.5) * 1.6
  } else if (side === 2) {
    body.x = simulation.width * (0.08 + sample(simulation, body, 15) * 0.86)
    body.y = -margin
    body.vx = (sample(simulation, body, 16) - 0.5) * speed * 0.6
    body.vy = speed
  } else {
    body.x = side === 0 ? -margin : simulation.width + margin
    body.y = simulation.height * (0.04 + sample(simulation, body, 15) * (side === 0 ? 0.43 : 0.68))
    body.vx = side === 0 ? speed : -speed
    body.vy = (sample(simulation, body, 16) - 0.5) * speed * 0.4
  }
  body.active = true
  body.grabbed = false
  body.entered = false
  body.spawnTime = simulation.time
  body.replacementAt = Infinity
  body.retiredReason = null
  body.userEnergyUntil = 0
  simulation.arrivalCount += 1
}

function retireBody(simulation, body, reason) {
  body.active = false
  body.grabbed = false
  body.retiredReason = reason
  // The empty interval is intentional. Another rock later arrives offscreen.
  body.replacementAt = simulation.time + (reason === 'crushed' ? 6 : 2.5) + sample(simulation, body, 30) * 5
}

export function createHeroAsteroidSimulation(width, height, foreground = false, options = {}) {
  const mobile = width <= 1100
  const desktopScale = Math.min(width / 1417, height / 792)
  const layout = foreground
    ? mobile
      ? [[-0.055, 1.015, width * 0.49], [1.045, 1.025, width * 0.39]]
      : [[0.025, 1.105, 190 * desktopScale], [0.965, 1.025, 245 * desktopScale]]
    : mobile
      ? [[0.015, 0.105, width * 0.112], [0.995, 0.13, width * 0.075], [0.64, 0.258, width * 0.048], [0.94, 0.222, width * 0.053], [0.017, 0.455, width * 0.034], [0.37, 0.061, width * 0.018], [0.79, 0.053, width * 0.014]]
      : [[0.054, 0.005, 66 * desktopScale], [0.454, 0.133, 46 * desktopScale], [0.921, 0.128, 74 * desktopScale], [0.655, 0.283, 20 * desktopScale], [0.78, 0.425, 38 * desktopScale], [0.214, 0.405, 39 * desktopScale], [0.374, 0.565, 24 * desktopScale]]
  const simulation = {
    width, height, foreground, mobile, time: 0, crushCount: 0, arrivalCount: 0,
    random: options.random || asteroidRandom, seed: options.seed ?? 9.8,
    geometryFormCount: foreground ? 4 : 7,
    rareForegroundChance:options.rareForegroundChance||0,
    speedScale:Number.isFinite(options.speedScale)?clamp(options.speedScale,0,3):1,
    interactionUntil: 0, drag: null, debris: [], bodies: []
  }
  const count=Number.isFinite(options.count)?clamp(Math.floor(options.count),0,12):layout.length
  simulation.bodies = Array.from({length:count},(_,id)=>{
    const [initialX,y,radius]=layout[id%layout.length]
    const x=id<layout.length?initialX:(id+.5)/count
    const body = {
      id, generation: 0, baseVisualRadius: radius*(Number.isFinite(options.sizeScale)?clamp(options.sizeScale,.2,3):1),
      x: x * width, y: y * height, active: true, grabbed: false,
      entered: true, replacementAt: Infinity, retiredReason: null,
      spawnTime: -1, userEnergyUntil: 0
    }
    setAppearance(simulation, body, true)
    body.highPass=foreground&&sample(simulation,body,80)<simulation.rareForegroundChance
    const speed = driftSpeed(simulation, body)
    body.vx = (id % 2 === 0 ? 1 : -1) * speed
    body.vy = (sample(simulation, body, 16) - 0.5) * speed * (foreground ? 0.12 : 0.45)
    if (foreground) body.y = body.highPass?foregroundFloor(simulation,body):Math.max(body.y, foregroundFloor(simulation, body))
    return body
  })
  return simulation
}

export function blastVisibleAsteroids(simulation){
  let count=0
  for(const body of simulation.bodies){
    if(!body.active||body.x+body.visualRadius<0||body.x-body.visualRadius>simulation.width||body.y+body.visualRadius<0||body.y-body.visualRadius>simulation.height)continue
    if(simulation.drag?.id===body.id)releaseHeroAsteroidDrag(simulation,false)
    crushBody(simulation,body,{vx:body.vx+600,vy:body.vy+200},0,0);count++
  }
  simulation.interactionUntil=simulation.time+3
  return count
}

export function beginHeroAsteroidDrag(simulation, id, x, y) {
  const body = simulation.bodies[id]
  if (!body?.active || simulation.drag) return false
  simulation.drag = {id, x: body.x, y: body.y, offsetX: x - body.x, offsetY: y - body.y, releaseVX: 0, releaseVY: 0, lastMoveTime: -1}
  body.grabbed = true
  body.vx = 0
  body.vy = 0
  body.userEnergyUntil = simulation.time + 1.5
  simulation.interactionUntil = simulation.time + 9
  return true
}

export function moveHeroAsteroidDrag(simulation, x, y) {
  const drag = simulation.drag
  if (!drag) return
  const body = simulation.bodies[drag.id]
  drag.x = clamp(x - drag.offsetX, -body.radius * 0.7, simulation.width + body.radius * 0.7)
  drag.y = clamp(y - drag.offsetY, -body.radius * 0.7, simulation.height + body.radius * 0.7)
  simulation.interactionUntil = simulation.time + 9
  body.userEnergyUntil = simulation.time + 1.5
}

export function releaseHeroAsteroidDrag(simulation, preserveVelocity = true) {
  const drag = simulation.drag
  if (!drag) return
  const body = simulation.bodies[drag.id]
  body.grabbed = false
  const recent = simulation.time - drag.lastMoveTime < 0.14
  body.vx = preserveVelocity && recent ? drag.releaseVX * 0.85 : 0
  body.vy = preserveVelocity && recent ? drag.releaseVY * 0.85 : 0
  body.userEnergyUntil = simulation.time + 1.1
  simulation.interactionUntil = simulation.time + 9
  simulation.drag = null
}

function crushBody(simulation, victim, attacker, nx, ny) {
  retireBody(simulation, victim, 'crushed')
  simulation.crushCount += 1
  const impact = Math.min(800, length(attacker.vx - victim.vx, attacker.vy - victim.vy))
  const amount = simulation.mobile ? 12 : 18
  const seed = victim.geometrySeed + simulation.crushCount * 2.7
  for (let index = 0; index < amount; index += 1) {
    const angle = index / amount * Math.PI * 2 + simulation.random(seed + index) * 0.55
    const speed = 40 + simulation.random(seed + index + 10) * (impact * 0.45 + 70)
    const random = simulation.random(seed + index + 20)
    simulation.debris.push({
      x: victim.x + Math.cos(angle) * victim.radius * random * 0.6,
      y: victim.y + Math.sin(angle) * victim.radius * random * 0.6,
      vx: Math.cos(angle) * speed + nx * impact * 0.13,
      vy: Math.sin(angle) * speed + ny * impact * 0.13,
      radius: Math.max(2, victim.visualRadius * (0.045 + random * 0.12)),
      angle, spin: (random - 0.5) * 7, born: simulation.time, life: 1.35 + random * 0.65
    })
  }
  if (simulation.debris.length > HERO_DEBRIS_LIMIT) simulation.debris.splice(0, simulation.debris.length - HERO_DEBRIS_LIMIT)
}

function solveCollisions(simulation) {
  const {bodies} = simulation
  for (let i = 0; i < bodies.length; i += 1) {
    const a = bodies[i]
    if (!a.active) continue
    for (let j = i + 1; j < bodies.length; j += 1) {
      const b = bodies[j]
      if (!b.active) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distance = length(dx, dy)
      const limit = a.radius + b.radius
      if (distance >= limit) continue
      const nx = distance > 0.0001 ? dx / distance : 1
      const ny = distance > 0.0001 ? dy / distance : 0
      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (-relative > Math.max(130, Math.min(420, simulation.width * 0.23))) {
        // Impact speed alone decides: natural collisions and deliberate throws
        // use the same physics. The held rock survives a forceful drag.
        const victim = a.grabbed ? b : b.grabbed ? a : a.radius < b.radius ? a : b
        crushBody(simulation, victim, victim === a ? b : a, nx, ny)
        if (victim === a) break
        continue
      }
      const invA = a.grabbed ? 0 : 1 / (a.radius * a.radius)
      const invB = b.grabbed ? 0 : 1 / (b.radius * b.radius)
      const total = invA + invB || 1
      const penetration = limit - distance + 0.05
      a.x -= nx * penetration * invA / total
      a.y -= ny * penetration * invA / total
      b.x += nx * penetration * invB / total
      b.y += ny * penetration * invB / total
      if (relative < 0) {
        const impulse = -1.72 * relative / total
        a.vx -= impulse * invA * nx
        a.vy -= impulse * invA * ny
        b.vx += impulse * invB * nx
        b.vy += impulse * invB * ny
      }
    }
  }
}

function steerAwayFromCopy(simulation, body, step) {
  // Keep the autonomous stream above the buttons. User-driven rocks remain
  // freely draggable; the copy/buttons also sit above this background layer.
  if (body.userEnergyUntil > simulation.time) return
  const left = simulation.width * 0.03
  const right = simulation.width * 0.56
  const top = simulation.height * (simulation.mobile ? 0.58 : 0.6)
  const bottom = simulation.height * 0.85
  const reach = body.visualRadius + 24
  if (body.x > left - reach && body.x < right + reach && body.y > top - reach && body.y < bottom + reach) {
    body.vy -= 35 * clamp((body.y - (top - reach)) / reach, 0, 1) * step
  }
}

export function stepHeroAsteroids(simulation, elapsed, reducedMotion = false) {
  const dt = clamp(Number.isFinite(elapsed) ? elapsed : 0, 0, 0.05)
  if (dt === 0) return
  const moving = !reducedMotion || simulation.interactionUntil > simulation.time || simulation.drag
  // During reduced motion, undisturbed rocks stay put.
  if (!moving) { simulation.time += dt; return }
  const maxSpeed = Math.max(1, ...simulation.bodies.filter(body => body.active).map(body => body.grabbed ? 2600 : Math.min(2600, length(body.vx, body.vy))))
  const smallestRadius = Math.max(1, Math.min(...simulation.bodies.map(body => body.radius)))
  // A substep covers at most 38% of the smallest radius: fast drags cannot tunnel.
  const substeps = Math.max(1, Math.ceil(dt * 120), Math.ceil(maxSpeed * dt / (smallestRadius * 0.38)))
  const step = dt / substeps
  const dragBody = simulation.drag ? simulation.bodies[simulation.drag.id] : null
  const dragDX = dragBody ? simulation.drag.x - dragBody.x : 0
  const dragDY = dragBody ? simulation.drag.y - dragBody.y : 0
  const dragDistance = length(dragDX, dragDY)
  const dragSpeed = Math.min(2600, dragDistance / dt)
  for (let substep = 0; substep < substeps; substep += 1) {
    simulation.time += step
    for (const body of simulation.bodies) {
      if (!body.active) {
        if (simulation.time >= body.replacementAt) enterNewRock(simulation, body)
        else continue
      }
      if (body.grabbed && simulation.drag?.id === body.id) {
        const dx = simulation.drag.x - body.x
        const dy = simulation.drag.y - body.y
        const distance = length(dx, dy)
        const travel = Math.min(distance, dragSpeed * step)
        body.vx = distance > 0.01 ? dx / distance * travel / step : 0
        body.vy = distance > 0.01 ? dy / distance * travel / step : 0
        if (travel > 0.001) {
          simulation.drag.releaseVX = body.vx
          simulation.drag.releaseVY = body.vy
          simulation.drag.lastMoveTime = simulation.time
        }
      } else if (simulation.foreground) {
        // A soft lower-band guide, never a spring back to a fixed x/y home.
        // After a drag the rock eases down so it cannot permanently mask content.
        const floor = foregroundFloor(simulation, body)
        if (body.y < floor) body.vy += ((floor - body.y) * 0.65 - body.vy * 1.1) * step
        else body.vy *= Math.exp(-0.14 * step)
      } else steerAwayFromCopy(simulation, body, step)
      const speed = length(body.vx, body.vy)
      if (speed > 2600) { body.vx *= 2600 / speed; body.vy *= 2600 / speed }
      body.x += body.vx * step
      body.y += body.vy * step
      body.rotation[0] += (body.spin[0] + body.vy * 0.00012) * step
      body.rotation[1] += (body.spin[1] + body.vx * 0.00012) * step
      body.rotation[2] += body.spin[2] * step
      const radius = body.visualRadius
      if (body.x + radius > 0 && body.x - radius < simulation.width && body.y + radius > 0 && body.y - radius < simulation.height) body.entered = true
      if (body.entered && !body.grabbed && (body.x + radius < -24 || body.x - radius > simulation.width + 24 || body.y + radius < -24 || body.y - radius > simulation.height + 24)) retireBody(simulation, body, 'exited')
    }
    solveCollisions(simulation)
    for (const fragment of simulation.debris) {
      fragment.x += fragment.vx * step
      fragment.y += fragment.vy * step
      fragment.vx *= Math.exp(-0.7 * step)
      fragment.vy *= Math.exp(-0.7 * step)
      fragment.angle += fragment.spin * step
    }
    simulation.debris = simulation.debris.filter(fragment => simulation.time - fragment.born < fragment.life)
  }
}
