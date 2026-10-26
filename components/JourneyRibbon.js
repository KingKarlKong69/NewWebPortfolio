import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  positiveModulo, RIBBON_PANEL_COUNT, MOSAIC_CORE_X, MOSAIC_CORE_Y,
  MOSAIC_CENTER_X, MOSAIC_CENTER_Y, MOSAIC_RADIUS, MOSAIC_FOCAL_RADIUS,
  MOSAIC_ROLL, ribbonTransform, sampleRibbonFormation, sampleRibbonPanel,
} from './journeyRibbonMath'

const COLUMNS = 28
const ROWS = 16
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback

const panoramaVertex = `
  uniform vec2 uViewport;
  uniform float uAngle;
  uniform float uAngularWidth;
  uniform float uRowY;
  uniform float uPanelHeight;
  uniform vec2 uTilt;
  uniform vec2 uOffset;
  uniform vec3 uCenter;
  uniform vec3 uFormationCenter;
  uniform float uFormationScale;
  uniform float uFormationTwist;
  vec3 rotateAround(vec3 offset, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(c * offset.x - s * offset.y, s * offset.x + c * offset.y, offset.z);
  }
  vec3 panoramaPoint(vec2 at) {
    float angle = uAngle + at.x * uAngularWidth;
    float radius = uViewport.x * ${MOSAIC_RADIUS.toFixed(4)};
    float x = sin(angle) * radius;
    float y = (${MOSAIC_CENTER_Y.toFixed(4)} - uRowY + at.y * uPanelHeight) * uViewport.y;
    // The tesseract occupies Z=0 inside this closed cylinder. Its near and far
    // halves straddle that depth instead of placing the entire ring behind it.
    float z = cos(angle) * radius;
    float pitchedY = y * cos(uTilt.x) - z * sin(uTilt.x);
    float pitchedZ = y * sin(uTilt.x) + z * cos(uTilt.x);
    float yawedX = x * cos(uTilt.y) + pitchedZ * sin(uTilt.y);
    float yawedZ = -x * sin(uTilt.y) + pitchedZ * cos(uTilt.y);
    float rolledX = yawedX * ${Math.cos(MOSAIC_ROLL).toFixed(8)} - pitchedY * ${Math.sin(MOSAIC_ROLL).toFixed(8)};
    float rolledY = yawedX * ${Math.sin(MOSAIC_ROLL).toFixed(8)} + pitchedY * ${Math.cos(MOSAIC_ROLL).toFixed(8)};
    float focal = radius * ${MOSAIC_FOCAL_RADIUS.toFixed(4)};
    float perspective = focal / (focal - yawedZ);
    return vec3(
      rolledX * perspective + (${MOSAIC_CENTER_X.toFixed(4)} + uOffset.x - 0.5) * uViewport.x,
      rolledY * perspective + (0.5 - ${MOSAIC_CENTER_Y.toFixed(4)} - uOffset.y) * uViewport.y,
      yawedZ
    );
  }
`

const surfaceVertex = `
  ${panoramaVertex}
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 target = panoramaPoint(position.xy);
    vec3 formed = uFormationCenter + rotateAround(target - uCenter, uFormationTwist) * uFormationScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(formed, 1.0);
  }
`

const commonFragment = `
  uniform sampler2D uMap;
  uniform float uImageAspect;
  uniform float uPanelAspect;
  uniform float uOpacity;
  uniform float uBrightness;
  varying vec2 vUv;
  float roundedEdge(vec2 at) {
    vec2 p = (at - 0.5) * vec2(uPanelAspect, 1.0);
    vec2 q = abs(p) - vec2(uPanelAspect * 0.5 - 0.085, 0.415);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.085;
  }
  vec2 coveredUv(vec2 at, float aspect) {
    vec2 scale = aspect > uPanelAspect
      ? vec2(uPanelAspect / aspect, 1.0)
      : vec2(1.0, aspect / uPanelAspect);
    return (at - 0.5) * scale + 0.5;
  }
  vec3 photographAt(vec2 at) {
    return texture2D(uMap, coveredUv(at, uImageAspect)).rgb * uBrightness;
  }
  float cellRandom(vec2 cell) {
    return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float peelStart(vec2 at) {
    vec2 cell = floor(at * vec2(28.0, 16.0));
    float edge = min(min(at.x, 1.0 - at.x), min(at.y, 1.0 - at.y));
    return 0.035 + edge * 0.72 + cellRandom(cell) * 0.12;
  }
`

const surfaceFragment = `
  ${commonFragment}
  uniform float uFormation;
  uniform float uAbsorption;
  void main() {
    float distance = roundedEdge(vUv);
    float mask = 1.0 - smoothstep(-0.018, 0.004, distance);
    float front = clamp(uFormation * 1.31 - vUv.x * 0.21, 0.0, 1.0);
    float assembled = smoothstep(0.68, 0.96, front);
    float peeled = smoothstep(peelStart(vUv), peelStart(vUv) + 0.035, uAbsorption);
    float alpha = mask * assembled * (1.0 - peeled) * uOpacity;
    if (alpha < 0.012) discard;
    vec3 photograph = photographAt(vUv);
    // The image remains the entire surface; this is a soft edge emission,
    // without a separate opaque frame or an empty glass letterbox.
    float rim = exp(-abs(distance + 0.018) * 65.0);
    vec3 edgeColor = mix(vec3(0.20, 0.76, 1.0), vec3(0.58, 0.35, 1.0), vUv.x);
    float innerShadow = (1.0 - smoothstep(-0.07, -0.012, distance)) * 0.025;
    vec3 color = photograph * (1.0 - innerShadow) + edgeColor * rim * 0.38;
    color = mix(color, edgeColor * 1.12, rim * 0.22);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`

const fragmentsVertex = `
  ${panoramaVertex}
  attribute vec2 aCell;
  attribute float aSeed;
  uniform vec3 uCore;
  uniform float uFormation;
  uniform float uAbsorption;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vRim;
  void main() {
    vec2 cellSize = vec2(1.0 / 28.0, 1.0 / 16.0);
    vUv = aCell + uv * cellSize;
    vec3 center = panoramaPoint(aCell + cellSize * 0.5 - 0.5);
    vec3 quad = panoramaPoint(vUv - 0.5) - center;
    float formation = clamp(uFormation * 1.31 - aCell.x * 0.21, 0.0, 1.0);
    float edge = min(min(aCell.x, 1.0 - aCell.x), min(aCell.y, 1.0 - aCell.y));
    float peelAt = 0.035 + edge * 0.72 + aSeed * 0.12;
    float absorb = clamp((uAbsorption - peelAt) / 0.52, 0.0, 1.0);
    float pull = absorb * absorb * (3.0 - 2.0 * absorb);

    // A textured head-to-tail stream curls out of the core and settles into
    // the exact bent surface. Each fragment retains its photograph's UV.
    vec3 formedOffset = rotateAround(center - uCenter, uFormationTwist);
    vec3 formed = uFormationCenter + formedOffset * uFormationScale;
    formed.z += sin(formation * 3.14159265) * uViewport.y * (0.005 + aSeed * 0.008);
    vec3 formedQuad = rotateAround(quad, uFormationTwist) * uFormationScale;

    // Edge-first peeling bends a small piece away, then curls it into the
    // core. This keeps recognizable photo colors and spatial continuity.
    vec3 pulled = uCore + rotateAround(center - uCore, pull * (5.0 + aSeed * 3.5)) * (1.0 - pull);
    pulled.z += sin(absorb * 3.14159265) * uViewport.y * (0.006 + aSeed * 0.035);
    vec3 pulledQuad = rotateAround(quad, absorb * (4.0 + aSeed * 5.0));
    pulledQuad *= 1.0 - pull * 0.94;
    bool absorbing = uAbsorption > 0.0001;
    vec3 finalPosition = absorbing ? pulled + pulledQuad : formed + formedQuad;
    float formAlpha = smoothstep(0.015, 0.12, formation) * (1.0 - smoothstep(0.68, 0.96, formation));
    float absorbAlpha = smoothstep(0.0, 0.06, absorb) * (1.0 - smoothstep(0.86, 1.0, absorb));
    vAlpha = absorbing ? absorbAlpha : formAlpha;
    vRim = absorbing ? sin(absorb * 3.14159265) : sin(formation * 3.14159265);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
  }
`

const fragmentsFragment = `
  ${commonFragment}
  varying float vAlpha;
  varying float vRim;
  void main() {
    float mask = 1.0 - smoothstep(-0.012, 0.004, roundedEdge(vUv));
    float alpha = mask * vAlpha * uOpacity;
    if (alpha < 0.012) discard;
    vec3 color = photographAt(vUv);
    color += vec3(0.10, 0.37, 0.50) * vRim * 0.10;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`

function makeFragments() {
  const quad = new THREE.PlaneGeometry(1, 1)
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.index = quad.index.clone()
  geometry.setAttribute('position', quad.attributes.position.clone())
  geometry.setAttribute('uv', quad.attributes.uv.clone())
  const cells = new Float32Array(COLUMNS * ROWS * 2)
  const seeds = new Float32Array(COLUMNS * ROWS)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLUMNS; x++) {
      const index = y * COLUMNS + x
      cells[index * 2] = x / COLUMNS
      cells[index * 2 + 1] = y / ROWS
      const random = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
      seeds[index] = random - Math.floor(random)
    }
  }
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2))
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  geometry.instanceCount = COLUMNS * ROWS
  quad.dispose()
  return geometry
}

function optimizedPhoto(source) {
  return `/_next/image?url=${encodeURIComponent(source)}&w=1080&q=80`
}

function useMemoryTextures(memory) {
  const texturesRef = useRef([])
  const placeholder = useMemo(() => {
    const texture = new THREE.DataTexture(new Uint8Array([6, 11, 15, 255]), 1, 1)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }, [])
  useEffect(() => {
    let disposed = false
    const allocated = []
    const loader = new THREE.TextureLoader()
    texturesRef.current = memory.images.map(() => placeholder)
    memory.images.forEach((source, index) => {
      const receive = texture => {
        allocated.push(texture)
        if (disposed) { texture.dispose(); return }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = true
        texture.anisotropy = 2
        texture.userData.memorySource = source
        texturesRef.current[index] = texture
      }
      loader.load(optimizedPhoto(source), receive, undefined, () => {
        // An optimized-image service can be unavailable in a static preview.
        // Keep the same supplied image as the fallback, never a substitute.
        if (!disposed) loader.load(source, receive)
      })
    })
    return () => {
      disposed = true
      allocated.forEach(texture => texture.dispose())
      texturesRef.current = []
    }
  }, [memory, placeholder])
  useEffect(() => () => placeholder.dispose(), [placeholder])
  return { texturesRef, placeholder }
}

function RibbonPanel({ index, frameRef, memory, texturesRef, placeholder, surfaceGeometry, fragmentGeometry, visiblePanelsRef }) {
  const panelRef = useRef(null)
  const fragmentRef = useRef(null)
  const viewport = useThree(state => state.viewport)
  const resources = useMemo(() => {
    const createUniforms = () => ({
      uMap: { value: placeholder }, uImageAspect: { value: 1 }, uBrightness: { value: 1 },
      uPanelAspect: { value: 1.78 }, uViewport: { value: new THREE.Vector2() },
      uAngle: { value: 0 }, uAngularWidth: { value: 1 }, uRowY: { value: .25 },
      uPanelHeight: { value: .2 }, uCenter: { value: new THREE.Vector3() },
      uTilt: { value: new THREE.Vector2() }, uOffset: { value: new THREE.Vector2() },
      uFormationCenter: { value: new THREE.Vector3() }, uFormationScale: { value: 0 },
      uFormationTwist: { value: 0 }, uOpacity: { value: 0 }, uFormation: { value: 0 },
      uAbsorption: { value: 0 }, uCore: { value: new THREE.Vector3() },
    })
    const surface = new THREE.ShaderMaterial({
      uniforms: createUniforms(), vertexShader: surfaceVertex, fragmentShader: surfaceFragment,
      transparent: true, depthWrite: true, side: THREE.DoubleSide, toneMapped: false,
    })
    const fragments = new THREE.ShaderMaterial({
      uniforms: createUniforms(), vertexShader: fragmentsVertex, fragmentShader: fragmentsFragment,
      transparent: true, depthWrite: true, side: THREE.DoubleSide, toneMapped: false,
    })
    return { surface, fragments, pose: {}, formation: {}, transform: {} }
  }, [placeholder])
  useEffect(() => () => {
    resources.surface.dispose()
    resources.fragments.dispose()
  }, [resources])

  useFrame(() => {
    const panel = panelRef.current
    const pieces = fragmentRef.current
    const frame = frameRef.current
    if (!panel || !pieces || !frame) return
    const opacity = clamp(frame.carouselOpacity)
    panel.visible = opacity > .001
    pieces.visible = opacity > .001
    if (!panel.visible) return
    const rotation = finite(frame.rotation)
    const pose = sampleRibbonPanel(index, rotation, resources.pose, viewport.width / viewport.height, frame)
    const transform = ribbonTransform(frame, resources.transform)
    const formationProgress = Number.isFinite(frame.formation) ? frame.formation : 1
    const formation = sampleRibbonFormation(pose, index, formationProgress, frame.coreX, frame.coreY, resources.formation)
    const absorption = clamp(frame.absorption)
    const photo = positiveModulo(pose.photoStep, Math.max(1, memory.images.length))
    const readyTexture = at => {
      const candidate = texturesRef.current[at]
      return candidate?.userData.memorySource === memory.images[at] ? candidate : null
    }
    const currentReady = readyTexture(photo)
    const texture = currentReady || placeholder
    const textureAspect = map => {
      const image = map.image
      return (image?.naturalWidth || image?.width || 1) / (image?.naturalHeight || image?.height || 1)
    }
    // The physical curved surface's aspect drives cover, not its foreshortened
    // screen rectangle. End tiles therefore retain natural photo perspective.
    const panelAspect = MOSAIC_RADIUS * viewport.width * pose.angularWidth / (pose.panelHeight * viewport.height)
    for (const material of [resources.surface, resources.fragments]) {
      const uniforms = material.uniforms
      uniforms.uMap.value = texture
      uniforms.uImageAspect.value = textureAspect(texture)
      uniforms.uBrightness.value = pose.brightness
      uniforms.uPanelAspect.value = panelAspect
      uniforms.uViewport.value.set(viewport.width, viewport.height)
      uniforms.uTilt.value.set(transform.pitch, transform.yaw)
      uniforms.uOffset.value.set(transform.offsetX, transform.offsetY)
      uniforms.uAngle.value = pose.angle
      uniforms.uAngularWidth.value = pose.angularWidth
      uniforms.uRowY.value = pose.rowY
      uniforms.uPanelHeight.value = pose.panelHeight
      uniforms.uCenter.value.set((pose.x - .5) * viewport.width, (.5 - pose.y) * viewport.height, pose.z * viewport.height)
      uniforms.uFormationCenter.value.set(
        (formation.x - .5) * viewport.width, (.5 - formation.y) * viewport.height,
        pose.z * viewport.height * formation.scale,
      )
      uniforms.uFormationScale.value = formation.scale
      uniforms.uFormationTwist.value = formation.twist
      uniforms.uOpacity.value = opacity * pose.opacity
      uniforms.uFormation.value = formation.local
      uniforms.uAbsorption.value = absorption
      uniforms.uCore.value.set(
        (finite(frame.coreX, MOSAIC_CORE_X) - .5) * viewport.width,
        (.5 - finite(frame.coreY, MOSAIC_CORE_Y)) * viewport.height,
        0,
      )
    }
    visiblePanelsRef.current[index] = {
      source: texture.userData.memorySource || null,
      photo,
      dominance: pose.dominance * opacity * formation.local,
    }
    // Both representations share geometry, UVs and a peel threshold. Only the
    // small instanced quads animate once a photo breaks apart.
    pieces.visible = opacity > .001 && (formation.local < .999 || absorption > .001)
    // Shader-displaced meshes all have a shared Object3D origin. Supply their
    // actual depth for transparent sorting: rear < tesseract(0) < near.
    panel.renderOrder = pose.z < 0 ? -100 + Math.round(pose.z * 10) : 100 + Math.round(pose.z * 10)
    pieces.renderOrder = panel.renderOrder + .1
  }, -2)

  return <>
    <mesh ref={panelRef} geometry={surfaceGeometry} material={resources.surface} frustumCulled={false} dispose={null} />
    <mesh ref={fragmentRef} geometry={fragmentGeometry} material={resources.fragments} frustumCulled={false} dispose={null} />
  </>
}

// One closed row of equal photo panels surrounds the core. Photos stay fixed
// to their panels while the shared angle follows idle rotation or manual drag.
export default function JourneyRibbon({ frameRef, memory, onFrontImage }) {
  const { texturesRef, placeholder } = useMemoryTextures(memory)
  const callbackRef = useRef(onFrontImage)
  const shownRef = useRef('')
  const visiblePanelsRef = useRef([])
  callbackRef.current = onFrontImage
  const geometry = useMemo(() => ({
    surface: new THREE.PlaneGeometry(1, 1, 48, 18),
    fragments: makeFragments(),
  }), [])
  useEffect(() => () => {
    geometry.surface.dispose()
    geometry.fragments.dispose()
  }, [geometry])
  useFrame(() => {
    const frame = frameRef.current
    if (!frame || clamp(frame.carouselOpacity) <= .001) return
    const front = visiblePanelsRef.current.reduce((best, panel) => panel && (!best || panel.dominance > best.dominance) ? panel : best, null)
    if (front?.source && front.dominance > .001 && shownRef.current !== front.source) {
      shownRef.current = front.source
      callbackRef.current?.(front.source, front.photo)
    }
  }, -1)
  return <group name="journey-cylindrical-memory-ribbon">
    {Array.from({ length: RIBBON_PANEL_COUNT }, (_, index) => <RibbonPanel
      key={index} index={index} frameRef={frameRef} memory={memory}
      texturesRef={texturesRef} placeholder={placeholder}
      surfaceGeometry={geometry.surface} fragmentGeometry={geometry.fragments}
      visiblePanelsRef={visiblePanelsRef}
    />)}
  </group>
}
