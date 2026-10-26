import * as THREE from 'three'
import {TextGeometry} from 'three/examples/jsm/geometries/TextGeometry.js'
import {toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const SERVICE_TEXT_PITCH = -.18
export const SERVICE_TEXT_YAW = -.045
export const SERVICE_TEXT_FINISH = [
  {color:'#f5f6f8', metalness:.08, roughness:.30, clearcoat:.16, clearcoatRoughness:.32, envMapIntensity:.65},
  {color:'#aeb9c9', metalness:.14, roughness:.38, clearcoat:.10, clearcoatRoughness:.38, envMapIntensity:.65},
  {color:'#e3e8ef', metalness:.12, roughness:.27, clearcoat:.20, clearcoatRoughness:.30, envMapIntensity:.8}
]

export function createServiceTextGeometry(font, text, width, releaseOffset = 0) {
  const depth = .46
  const raw = new TextGeometry(text, {
    font, size:2, depth, curveSegments:24,
    bevelEnabled:true, bevelThickness:.09, bevelSize:.075, bevelSegments:8
  })
  const glyphData = new Float32Array(raw.getAttribute('position').count * 2)
  // A glyph's cap/side groups share one reading-order rank; holes remain part
  // of the glyph's connected shape. This phrase consists of uppercase glyphs.
  for (let shape = 0; shape < raw.groups.length / 2; shape++) {
    const groups = raw.groups.slice(shape * 2, shape * 2 + 2)
    let minX = Infinity, maxX = -Infinity
    for (const group of groups) for (let i = group.start; i < group.start + group.count; i++) {
      const x = raw.getAttribute('position').getX(i)
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    }
    for (const group of groups) for (let i = group.start; i < group.start + group.count; i++) {
      glyphData[i * 2] = releaseOffset + shape
      glyphData[i * 2 + 1] = (raw.getAttribute('position').getX(i) - minX) / Math.max(.0001, maxX - minX)
    }
  }
  raw.setAttribute('aGlyphData', new THREE.BufferAttribute(glyphData, 2))
  // The helper hashes positions to .01 units. Temporarily magnify the geometry
  // so adjacent fine bevel rings are not accidentally treated as one vertex.
  raw.scale(100, 100, 100)
  toCreasedNormals(raw, Math.PI / 3)
  raw.scale(.01, .01, .01)

  // ExtrudeGeometry combines bevels and sidewalls in material slot 1. Separate
  // them, then batch triangles into THREE groups (not one draw per edge).
  const buckets = [[], [], []]
  const position = raw.getAttribute('position')
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  for (const group of raw.groups) {
    for (let vertex = group.start; vertex < group.start + group.count; vertex += 3) {
      a.fromBufferAttribute(position, vertex)
      b.fromBufferAttribute(position, vertex + 1).sub(a)
      c.fromBufferAttribute(position, vertex + 2).sub(a)
      // Closed typeface contours can emit zero-area triangles at their seam.
      if (b.cross(c).lengthSq() < 1e-18) continue
      const z = (position.getZ(vertex) + position.getZ(vertex + 1) + position.getZ(vertex + 2)) / 3
      const material = group.materialIndex === 0 ? 0 : z < -1e-5 || z > depth + 1e-5 ? 2 : 1
      buckets[material].push(vertex)
    }
  }
  const geometry = new THREE.BufferGeometry()
  const vertexCount = buckets.reduce((count, bucket) => count + bucket.length * 3, 0)
  for (const [name, attribute] of Object.entries(raw.attributes)) {
    const values = new attribute.array.constructor(vertexCount * attribute.itemSize)
    let offset = 0
    for (const bucket of buckets) {
      for (const vertex of bucket) {
        const start = vertex * attribute.itemSize
        const count = 3 * attribute.itemSize
        values.set(attribute.array.subarray(start, start + count), offset)
        offset += count
      }
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized))
  }
  let start = 0
  buckets.forEach((bucket, material) => {
    const count = bucket.length * 3
    if (count) geometry.addGroup(start, count, material)
    start += count
  })
  // Surface sampling carries the same glyph activation and material palette.
  geometry.setAttribute('uv', geometry.getAttribute('aGlyphData'))
  const colors = new Float32Array(vertexCount * 3)
  for (const group of geometry.groups) {
    const color = new THREE.Color(SERVICE_TEXT_FINISH[group.materialIndex].color)
    for (let i = group.start; i < group.start + group.count; i++) {
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  raw.dispose()
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  const scale = width / Math.max(.0001, bounds.max.x - bounds.min.x)
  geometry.translate(-(bounds.min.x + bounds.max.x) / 2,
    -(bounds.min.y + bounds.max.y) / 2, -(bounds.min.z + bounds.max.z) / 2)
  geometry.scale(scale, scale, scale)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function getServicesPixelRatio(width, height, deviceRatio = 1, qualityCap = 1.5, maxDimension = 8192) {
  const w = Math.max(1, Number.isFinite(width) ? width : 1)
  const h = Math.max(1, Number.isFinite(height) ? height : 1)
  return Math.min(
    Math.max(.1, Number.isFinite(deviceRatio) ? deviceRatio : 1),
    Math.max(.1, Number.isFinite(qualityCap) ? qualityCap : 1.5),
    Math.sqrt(3500000 / (w * h)), Math.max(1, maxDimension) / Math.max(w, h)
  )
}
