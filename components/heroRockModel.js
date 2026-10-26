import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { asteroidRandom } from './heroAsteroidPhysics'

// This is the footer asteroid's deformed icosahedron technique, with carved
// craters and fine mineral grain for the larger, closer hero rocks.
export function makeRockGeometry(seed, detail) {
  const source = new THREE.IcosahedronGeometry(1, detail)
  const positions = source.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const craters = Array.from({length: 11}, (_, index) => {
    const azimuth = asteroidRandom(seed + index * 3.1) * Math.PI * 2
    const z = asteroidRandom(seed + index * 3.1 + 1) * 2 - 1
    const radial = Math.sqrt(1 - z * z)
    return {
      x: Math.cos(azimuth) * radial, y: Math.sin(azimuth) * radial, z,
      width: 0.1 + asteroidRandom(seed + index * 3.1 + 2) * 0.22,
      depth: 0.04 + asteroidRandom(seed + index * 2.1 + 4) * 0.055
    }
  })
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const coarse = Math.sin(x * 3.7 + y * 5.3 - z * 4.1 + seed) * 0.09
    const medium = Math.sin(x * 11.2 - y * 8.4 + z * 7.7 + seed * 0.2) * 0.045
    const fine = Math.sin((x + y + z) * 24 + seed) * 0.018
    let displacement = 0.88 + coarse + medium + fine
    for (const crater of craters) {
      const distance = Math.hypot(x - crater.x, y - crater.y, z - crater.z) / crater.width
      displacement -= Math.exp(-distance * distance * 2.8) * crater.depth
      displacement += Math.exp(-Math.pow((distance - 0.92) * 7, 2)) * crater.depth * 0.32
    }
    positions.setXYZ(index, x * displacement, y * displacement, z * displacement)
    const mineral = 0.72 + (Math.sin(x * 34 + y * 29 - z * 43) * 0.5 + 0.5) * 0.33
    colors.set([mineral, mineral * 0.96, mineral * 0.98], index * 3)
  }
  positions.needsUpdate = true
  source.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  source.deleteAttribute('normal')
  source.deleteAttribute('uv')
  const geometry = mergeVertices(source, 0.0001)
  source.dispose()
  geometry.computeVertexNormals()
  return geometry
}

export function makeRockMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: '#70696a', roughness: 0.99, metalness: 0.015,
    vertexColors: true, emissive: '#071017', emissiveIntensity: 0.11
  })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vRockPosition;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockPosition = position;')
    shader.fragmentShader = `
      varying vec3 vRockPosition;
      float rockHash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.13, 0.37, 0.71));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float rockNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(rockHash(i), rockHash(i + vec3(1,0,0)), f.x),
                       mix(rockHash(i + vec3(0,1,0)), rockHash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(rockHash(i + vec3(0,0,1)), rockHash(i + vec3(1,0,1)), f.x),
                       mix(rockHash(i + vec3(0,1,1)), rockHash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      ${shader.fragmentShader}`
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float mineralGrain = rockNoise(vRockPosition * 39.0) * 0.52
                           + rockNoise(vRockPosition * 93.0) * 0.30
                           + rockNoise(vRockPosition * 181.0) * 0.18;
        float fissures = smoothstep(0.27, 0.42, rockNoise(vRockPosition * 19.0));
        diffuseColor.rgb *= (0.44 + mineralGrain * 1.0) * mix(0.48, 1.0, fissures);
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float grainHeight = rockNoise(vRockPosition * 67.0) * 0.7
                          + rockNoise(vRockPosition * 139.0) * 0.3;
        normal = normalize(normal - vec3(dFdx(grainHeight), dFdy(grainHeight), 0.0) * 1.4);
      `)
  }
  material.customProgramCacheKey = () => 'hero-rock-mineral-grain-v1'
  return material
}

