const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync, existsSync } = require('node:fs')
const { join, resolve, relative, sep } = require('node:path')
const THREE = require('three')

const data = import(`data:text/javascript;base64,${Buffer.from(
  readFileSync(join(__dirname, 'skillsExpeditionData.js'), 'utf8'),
).toString('base64')}`)
const publicRoot = resolve(__dirname, '../../public')
const terrain = import(`data:text/javascript;base64,${Buffer.from(
  readFileSync(join(__dirname, 'skillsTerrainMath.js'), 'utf8'),
).toString('base64')}`)

test('expedition markers resolve safe local artwork and accessible descriptions', async () => {
  const { SKILLS_CHAPTERS } = await data
  const ids = new Set()
  for (const chapter of SKILLS_CHAPTERS) {
    for (const marker of chapter.markers) {
      assert.ok(!ids.has(marker.id), `duplicate marker ID: ${marker.id}`)
      ids.add(marker.id)
      assert.ok(marker.label.trim() && marker.description.trim(), 'every marker has usable accessible content')
      assert.ok([marker.x, marker.z, marker.lift].every(Number.isFinite), 'anchors are finite world coordinates')
      assert.ok(marker.lift >= 5, `${marker.id} must clear the terrain with a readable beam`)
      if (!marker.icon) continue
      assert.match(marker.icon, /^\/(?:tech-stack-icons|strength-icons|more-icons)\/[a-z0-9-]+\.(?:svg|png|webp)$/i)
      const file = resolve(publicRoot, marker.icon.slice(1))
      assert.ok(!relative(publicRoot, file).startsWith(`..${sep}`), 'asset remains under public root')
      assert.ok(existsSync(file), `missing icon: ${marker.icon}`)
      if (!marker.icon.endsWith('.svg')) continue
      const svg = readFileSync(file, 'utf8')
      assert.match(svg, /<svg\b[^>]*viewBox=/)
      assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/|javascript:)/i,
        'logos cannot execute scripts or fetch third-party content')
    }
  }
  assert.equal(ids.size, 46)
  const strengths = SKILLS_CHAPTERS.find(chapter => chapter.id === 'strengths')
  assert.ok(strengths.markers.every(marker => /-fill\.svg$/.test(marker.icon)), 'every strength uses the filled Phosphor asset')
  const ai = SKILLS_CHAPTERS.find(chapter => chapter.id === 'ai')
  assert.equal(ai.markers.find(marker => marker.id === 'claude')?.icon, '/tech-stack-icons/claude.svg')
  const allMarkers = SKILLS_CHAPTERS.flatMap(chapter => chapter.markers)
  assert.equal(allMarkers.find(marker => marker.id === 'inertia')?.icon, '/more-icons/Inertia-icon.png')
  assert.equal(allMarkers.find(marker => marker.id === 'capacitor')?.icon, '/more-icons/capacitor-icon.png')
  assert.equal(allMarkers.find(marker => marker.id === 'office')?.icon, '/more-icons/Microsoft-office-icon.webp')
})

test('five foreground checkpoints precede their chapter mountains without contribution data', async () => {
  const module = await data
  const { SKILLS_CHAPTERS, SKILLS_CHECKPOINTS } = module
  assert.ok(!Object.hasOwn(module, 'SKILLS_ACTIVITY'), 'contribution field is removed')
  assert.deepEqual(SKILLS_CHECKPOINTS.map(checkpoint => checkpoint.id), ['solve', 'test', 'collaborate', 'ship', 'adapt'])
  for (const [index, checkpoint] of SKILLS_CHECKPOINTS.entries()) {
    assert.equal(checkpoint.chapterIndex, index)
    assert.ok(checkpoint.x < SKILLS_CHAPTERS[index].x, 'checkpoint appears before its mountain')
    assert.equal(checkpoint.z, -5, 'checkpoint is grounded in the near foreground')
    assert.ok([checkpoint.x, checkpoint.z, checkpoint.lift].every(Number.isFinite))
    assert.ok(checkpoint.title && checkpoint.subtitle)
    if (index > 0) assert.ok(checkpoint.x > SKILLS_CHECKPOINTS[index - 1].x, 'route consistently travels left to right')
  }
})

test('terrain-anchored marker hit targets remain separately selectable at desktop sizes', async () => {
  const [{ SKILLS_CHAPTERS }, { skillsTerrainHeight }] = await Promise.all([data, terrain])
  for (const [width, height] of [[1366, 768], [1101, 900], [1432, 956]]) {
    const aspect = width / height
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(
      Math.tan(THREE.MathUtils.degToRad(52) / 2) * Math.max(1, (16 / 9) / aspect),
    ))
    for (const chapter of SKILLS_CHAPTERS) {
      const camera = new THREE.PerspectiveCamera(fov, aspect, .1, 390)
      camera.position.set(chapter.x + 8, 4.7, 17)
      camera.lookAt(chapter.x + 8, 10.5, -55)
      camera.updateMatrixWorld()
      const boxes = chapter.markers.map(marker => {
        const projected = new THREE.Vector3(marker.x,
          skillsTerrainHeight(marker.x, marker.z) + marker.lift, marker.z).project(camera)
        const x = (projected.x + 1) / 2, y = (1 - projected.y) / 2
        assert.ok(x > .115 && x < .96 && y > .13 && y < .925,
          `${marker.id} must remain in the interactive viewport at ${width} x ${height}`)
        const boxWidth = 64
        return { id: marker.id, x: x * width - boxWidth / 2, y: y * height - 32, width: boxWidth, height: 64 }
      })
      for (let first = 0; first < boxes.length; first++) {
        for (let second = first + 1; second < boxes.length; second++) {
          const a = boxes[first], b = boxes[second]
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
          assert.ok(overlapX <= 0 || overlapY <= 0,
            `${a.id} and ${b.id} must remain separately selectable at ${width} x ${height}`)
        }
      }
    }
  }
})
