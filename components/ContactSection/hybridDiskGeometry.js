import * as THREE from 'three'

// Tapered gas boundaries. Radius and height are deformed by uniforms, so dragging a
// shape control never allocates geometry or changes the shader program.
export function createHybridDiskGeometry(segments = 192, radialBands = 32, startAngle = 0, arc = Math.PI * 2) {
  const positions = [], radial = [], heights = [], faceLight = [], indices = []
  const vertex = (angle, radius, height, light) => {
    const index = radial.length
    positions.push(Math.cos(angle), Math.sin(angle), 0)
    radial.push(radius)
    heights.push(height)
    faceLight.push(light)
    return index
  }
  const face = (a, b, c, d, reverse = false) => {
    if (reverse) indices.push(a, c, b, b, c, d)
    else indices.push(a, b, c, b, d, c)
  }
  for (const side of [1, -1]) {
    const start = radial.length
    for (let band = 0; band <= radialBands; band++) {
      for (let segment = 0; segment <= segments; segment++) {
        vertex(startAngle + segment / segments * arc, band / radialBands, side * .5,
          side > 0 ? 1 : .76)
      }
    }
    const stride = segments + 1
    for (let band = 0; band < radialBands; band++) {
      for (let segment = 0; segment < segments; segment++) {
        const a = start + band * stride + segment
        // Radius then angle gives the top face a positive local-Z normal.
        face(a, a + stride, a + 1, a + stride + 1, side < 0)
      }
    }
  }
  // No vertical end caps: material tapers and fades away at the radial edges.
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aRadial', new THREE.Float32BufferAttribute(radial, 1))
  geometry.setAttribute('aHeight', new THREE.Float32BufferAttribute(heights, 1))
  geometry.setAttribute('aFaceLight', new THREE.Float32BufferAttribute(faceLight, 1))
  geometry.setIndex(indices)
  // The undeformed position attribute is a unit circle; supply conservative
  // bounds for shader deformation (the mesh also disables frustum culling).
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3.5)
  return geometry
}

export function createHybridGasSheetGeometry(segments = 128, radialBands = 24, startAngle = 0, arc = Math.PI * 2) {
  const geometry = createHybridDiskGeometry(segments, radialBands, startAngle, arc)
  geometry.getAttribute('aHeight').array.fill(0)
  // One sheet, drawn from either side. Additional layers share this buffer.
  geometry.setDrawRange(0, segments * radialBands * 6)
  return geometry
}

// Open curved sheets, deformed by uniforms into authored lens images. These
// have depth, but are not physical hoops or a geodesic simulation.
export function createHybridArcGeometry(segments = 160, radialBands = 40) {
  const positions = [], radial = [], heights = [], indices = []
  const stride = segments + 1
  for (const side of [-.5, .5]) {
    const start = radial.length
    for (let band = 0; band <= radialBands; band++) {
      for (let segment = 0; segment <= segments; segment++) {
        const angle = segment / segments * Math.PI
        positions.push(Math.cos(angle), Math.sin(angle), 0)
        radial.push(band / radialBands)
        heights.push(side)
      }
    }
    for (let band = 0; band < radialBands; band++) {
      for (let segment = 0; segment < segments; segment++) {
        const a = start + band * stride + segment
        indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aRadial', new THREE.Float32BufferAttribute(radial, 1))
  geometry.setAttribute('aHeight', new THREE.Float32BufferAttribute(heights, 1))
  geometry.setIndex(indices)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3.5)
  return geometry
}
