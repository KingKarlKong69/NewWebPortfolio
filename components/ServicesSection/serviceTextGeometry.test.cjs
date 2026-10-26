const {test} = require('node:test')
const assert = require('node:assert/strict')
const {readFileSync} = require('node:fs')
const {join} = require('node:path')
const {pathToFileURL} = require('node:url')
const url = name => pathToFileURL(require.resolve(name)).href
const threeURL = url('three').replace('three.cjs', 'three.module.js')
const moduleSource = readFileSync(join(__dirname, 'serviceTextGeometry.js'), 'utf8')
  .replace("from 'three'", `from '${threeURL}'`)
  .replace("from 'three/examples/jsm/geometries/TextGeometry.js'", `from '${url('three/examples/jsm/geometries/TextGeometry.js')}'`)
  .replace("from 'three/examples/jsm/utils/BufferGeometryUtils.js'", `from '${url('three/examples/jsm/utils/BufferGeometryUtils.js')}'`)
const helpers = import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`)

test('refined words retain their framing, finite smooth normals and three batched surface finishes', async () => {
  const {createServiceTextGeometry} = await helpers
  const {FontLoader} = await import(url('three/examples/jsm/loaders/FontLoader.js'))
  const font = new FontLoader().parse(JSON.parse(readFileSync(join(__dirname, '../../public/fonts/helvetiker_bold.typeface.json'), 'utf8')))
  for (const [word, width] of [['SERVICES',20], ['WHAT',10], ['I',.5], ['OFFER',12], ['WHAT PEOPLE SAY',25]]) {
    const geometry = createServiceTextGeometry(font, word, width)
    try {
      const bounds = geometry.boundingBox
      assert.ok(Math.abs(bounds.max.x - bounds.min.x - width) < 1e-4, word)
      for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(bounds.max[axis] + bounds.min[axis]) < 1e-4, `${word} center ${axis}`)
      assert.deepEqual(geometry.groups.map(group => group.materialIndex), [0,1,2])
      const position = geometry.getAttribute('position')
      const normal = geometry.getAttribute('normal')
      assert.equal(geometry.groups.reduce((count, group) => count + group.count, 0), position.count)
      assert.ok(geometry.boundingSphere.radius > 0)
      for (let i = 0; i < normal.count; i++) {
        assert.ok(Number.isFinite(position.getX(i)) && Number.isFinite(position.getY(i)) && Number.isFinite(position.getZ(i)))
        const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))
        assert.ok(Math.abs(length - 1) < 1e-4, `${word} normal ${i}`)
      }
    } finally { geometry.dispose() }
  }
})

test('resolution respects native density, the pixel budget, hardware limits and adaptive caps', async () => {
  const {getServicesPixelRatio: ratio} = await helpers
  assert.equal(ratio(2026,1013,1), 1)
  assert.ok(ratio(2026,1013,2) > 1)
  assert.equal(ratio(1920,1080,2,.8), .8)
  for (const [w,h] of [[1920,1080],[2560,1440],[3840,2160],[7680,4320]]) {
    const dpr = ratio(w,h,3,1.5,4096)
    assert.ok(w*h*dpr*dpr <= 3500000.001)
    assert.ok(Math.max(w,h)*dpr <= 4096.001)
    assert.ok(dpr > 0 && dpr <= 1.5)
  }
  for (const [w,h] of [[0,0],[NaN,Infinity],[-10,-20]]) assert.ok(Number.isFinite(ratio(w,h)))
})
