import { useFBO } from '@react-three/drei/core/useFBO'
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber'
import { BlendFunction, BloomEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing'
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import ActiveFrameLoop from '../ActiveFrameLoop'
import {
  SURGE_PHASE,
  advanceSurge,
  beginSurge,
  clampVectorLength,
  createSurgeState,
  finiteVector,
  seededValue,
  smoothStep
} from './blackHoleSimulation'
import {
  accretionFragmentShader,
  accretionVertexShader,
  lensingArcFragmentShader,
  lensingCompositeFragmentShader,
  lensingCompositeVertexShader,
  nebulaFragmentShader,
  nebulaVertexShader,
  orbitalParticleFragmentShader,
  orbitalParticleVertexShader,
  photonRingFragmentShader,
  starFragmentShader,
  starVertexShader
} from './contactShaders'

export const CONTACT_QUALITY = {
  desktop: {
    stars: 820,
    dust: 170,
    ejections: 18,
    asteroids: 7,
    dpr: [1, 1.3],
    blackHoleScale: 0.94,
    shaderQuality: 1,
    lensing: 1,
    fboScale: 0.6,
    bloom: 0.24,
    position: [2.05, -0.16, 0]
  },
  tablet: {
    stars: 520,
    dust: 100,
    ejections: 0,
    asteroids: 5,
    dpr: [1, 1.16],
    blackHoleScale: 0.84,
    shaderQuality: 0.72,
    lensing: 0.58,
    fboScale: 0.44,
    bloom: 0.12,
    position: [1.45, -0.08, 0]
  },
  mobile: {
    stars: 440,
    dust: 82,
    ejections: 0,
    asteroids: 5,
    dpr: [1.25, 1.5],
    blackHoleScale: 1.04,
    shaderQuality: 0.66,
    lensing: 0.56,
    fboScale: 0.58,
    bloom: 0.05,
    position: [0.08, -0.02, 0]
  }
}

const ASTEROID_LAYOUT = [
  {position: [2.5, -2.18, 2.55], rotation: [0.4, 1.1, 0.2], scale: 0.44, depth: 1.35},
  {position: [1.72, 2.02, 1.35], rotation: [1.2, 0.2, 0.8], scale: 0.29, depth: 0.9},
  {position: [-4.35, -2.45, 2.15], rotation: [0.2, 1.7, 1.1], scale: 0.38, depth: 1.05},
  {position: [4.65, 0.88, -0.3], rotation: [1.9, 0.7, 0.1], scale: 0.25, depth: 0.56},
  {position: [-3.8, 2.25, -0.7], rotation: [0.9, 1.2, 2.1], scale: 0.2, depth: 0.42},
  {position: [2.95, -3.05, -1.1], rotation: [0.1, 2.3, 0.5], scale: 0.17, depth: 0.34},
  {position: [4.15, 2.05, -1.75], rotation: [1.6, 0.4, 1.9], scale: 0.13, depth: 0.24}
]

const BLACK_HOLE_CENTER_Z = 0.42
const ABSORPTION_RADIUS = 0.7
const MAX_FRAME_DELTA = 1 / 30
const DRAG_SPEED_LIMIT = 3.4
const ASTEROID_SPEED_LIMIT = 1.28
const SURGE_SPEED_LIMIT = 8.5
const ZERO_VECTOR = new THREE.Vector3()
const CAMERA_FORWARD = new THREE.Vector3()
const DRAG_POINT = new THREE.Vector3()
const DIAGNOSTIC_DATA_KEYS = [
  'contactAnimation',
  'contactQuality',
  'contactPhase',
  'contactFrame',
  'contactTime',
  'contactRenderer',
  'contactComposerCount',
  'contactContextState',
  'contactCssSize',
  'contactBufferSize',
  'contactTextures',
  'contactGeometries',
  'contactPrograms',
  'contactDrawCalls',
  'contactTriangles',
  'contactReadinessEpoch',
  'surgePhase',
  'surgeGeneration',
  'asteroidDragging'
]

function getAnimationDiagnostic(phase, active) {
  if (phase === 'CONTEXT_LOST') return 'context-lost'
  if (phase === 'RESTORING') return 'restoring'
  if (phase === 'INITIALIZING') return 'initializing'
  if (phase === 'FAILED') return 'failed'
  return active ? 'running' : 'paused'
}

function AnimationLifecycle({ active, quality, phase, surgeRef, interactionRef }) {
  const invalidate = useThree((state) => state.invalidate)
  const gl = useThree((state) => state.gl)
  const timelineFrameRef = useRef(0)

  useEffect(() => {
    invalidate()
    gl.domElement.dataset.contactAnimation = getAnimationDiagnostic(phase, active)
    gl.domElement.dataset.contactQuality = quality
    gl.domElement.dataset.contactPhase = phase
    gl.domElement.dataset.surgePhase = surgeRef.current.phase
    timelineFrameRef.current = performance.now()
  }, [active, gl, invalidate, phase, quality, surgeRef])

  useEffect(() => () => {
    gl.domElement.style.cursor = ''
    gl.domElement.style.touchAction = ''
    DIAGNOSTIC_DATA_KEYS.forEach((key) => delete gl.domElement.dataset[key])
  }, [gl])

  useFrame((_, delta) => {
    if (!active) return
    const now = performance.now()
    const timelineDelta = timelineFrameRef.current > 0 ? Math.min((now - timelineFrameRef.current) / 1000, 1.25) : delta
    timelineFrameRef.current = now
    const safeDelta = Math.min(Math.max(delta, 0), 0.25)
    surgeRef.current.visualTime += safeDelta
    const phaseChanged = advanceSurge(surgeRef.current, Math.max(0, timelineDelta))
    if (phaseChanged) {
      gl.domElement.dataset.surgePhase = surgeRef.current.phase
      if (surgeRef.current.phase === SURGE_PHASE.IDLE && interactionRef.current.cursorOwner === 'surge') {
        interactionRef.current.cursorOwner = null
        gl.domElement.style.cursor = ''
      }
    }
  }, -3)

  return null
}

function createRandom(seed) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function useCompositionMotion({ active, reducedMotion, pointerRef, surgeRef }) {
  const motionRef = useRef({x: 0, y: 0, rotation: 0.24})

  useFrame((state, delta) => {
    const pointerX = reducedMotion ? 0 : pointerRef.current.x
    const pointerY = reducedMotion ? 0 : pointerRef.current.y
    const idle = active && !reducedMotion ? Math.sin(surgeRef.current.visualTime * 0.17) * 0.009 : 0
    const motion = motionRef.current
    motion.x = THREE.MathUtils.damp(motion.x, pointerX * 0.065, 2.8, delta)
    motion.y = THREE.MathUtils.damp(motion.y, pointerY * 0.045, 2.8, delta)
    motion.rotation = THREE.MathUtils.damp(motion.rotation, 0.24 + idle - pointerX * 0.008, 2.3, delta)
  })

  return motionRef
}

function CompositionGroup({ basePosition, motionRef, scale, children }) {
  const groupRef = useRef(null)

  useFrame(() => {
    if (!groupRef.current) return
    const motion = motionRef.current
    groupRef.current.position.set(basePosition[0] + motion.x, basePosition[1] + motion.y, basePosition[2])
    groupRef.current.rotation.z = motion.rotation
  })

  return <group ref={groupRef} position={basePosition} rotation-z={0.24} scale={scale}>{children}</group>
}

function SpaceBackground({ count, active, reducedMotion, pointerRef, surgeRef }) {
  const pointsRef = useRef(null)
  const materialRef = useRef(null)
  const geometry = useMemo(() => {
    const random = createRandom(8137)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const palette = ['#dffcff', '#74dfff', '#ffffff', '#9f8cff']

    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() - 0.5) * 18
      positions[index * 3 + 1] = (random() - 0.5) * 11
      positions[index * 3 + 2] = -1.4 - random() * 10
      const color = new THREE.Color(palette[Math.floor(random() * palette.length)])
      colors.set(color.toArray(), index * 3)
      sizes[index] = 0.68 + Math.pow(random(), 4) * 3.2
      phases[index] = random() * Math.PI * 2
    }

    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    nextGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    nextGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    return nextGeometry
  }, [count])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    if (materialRef.current && active) {
      materialRef.current.uniforms.uTime.value = surgeRef.current.visualTime
    }
    if (!pointsRef.current) return
    pointsRef.current.rotation.y = THREE.MathUtils.damp(pointsRef.current.rotation.y, reducedMotion ? 0 : pointerRef.current.x * 0.022, 2.1, delta)
    pointsRef.current.rotation.x = THREE.MathUtils.damp(pointsRef.current.rotation.x, reducedMotion ? 0 : pointerRef.current.y * 0.016, 2.1, delta)
  })

  const uniforms = useMemo(() => ({uTime: {value: 0}, uMotion: {value: reducedMotion ? 0.18 : 1}}), [reducedMotion])

  return (
    <points ref={pointsRef} geometry={geometry} position={[0, 0, -0.5]}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={starVertexShader}
        fragmentShader={starFragmentShader}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

function NebulaLayer({ active, reducedMotion, shaderQuality, surgeRef }) {
  const materialRef = useRef(null)
  const uniforms = useMemo(() => ({
    uTime: {value: 0},
    uMotion: {value: reducedMotion ? 0.16 : 1},
    uQuality: {value: shaderQuality}
  }), [reducedMotion, shaderQuality])

  useFrame(() => {
    if (materialRef.current && active) {
      materialRef.current.uniforms.uTime.value = surgeRef.current.visualTime
    }
  })

  return (
    <mesh position={[0.75, 0.08, -5.1]} scale={[9.4, 6.4, 1]} renderOrder={-3}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={nebulaVertexShader}
        fragmentShader={nebulaFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

function PlasmaLayer({
  active,
  reducedMotion,
  pointerRef,
  surgeRef,
  shaderQuality,
  layer,
  positionY = 0,
  positionZ,
  intensity,
  opacity,
  flowSpeed,
  noiseScale,
  distortion,
  seed,
  scale,
  renderOrder,
  colors,
  surgeOnly = false
}) {
  const meshRef = useRef(null)
  const materialRef = useRef(null)
  const palette = useMemo(() => ({
    core: new THREE.Color(colors[0]),
    mid: new THREE.Color(colors[1]),
    edge: new THREE.Color(colors[2]),
    warmCore: new THREE.Color('#ffd59a'),
    warmMid: new THREE.Color('#ff4b0a'),
    warmEdge: new THREE.Color('#a30b25')
  }), [colors])
  const uniforms = useMemo(() => ({
    uTime: {value: 0},
    uMotion: {value: reducedMotion ? 0.2 : 1},
    uWarp: {value: layer < 1.5 ? 0.72 : 0.35},
    uIntensity: {value: intensity},
    uFlowSpeed: {value: flowSpeed},
    uNoiseScale: {value: noiseScale},
    uDistortion: {value: distortion},
    uOpacity: {value: surgeOnly ? 0 : opacity},
    uLayer: {value: layer},
    uQuality: {value: shaderQuality},
    uSeed: {value: seed},
    uSurge: {value: 0},
    uWarmth: {value: 0},
    uFlowBoost: {value: 1},
    uBeamingAngle: {value: -0.28},
    uColorCore: {value: palette.core.clone()},
    uColorMid: {value: palette.mid.clone()},
    uColorEdge: {value: palette.edge.clone()},
    uPointer: {value: new THREE.Vector2()}
  }), [distortion, flowSpeed, intensity, layer, noiseScale, opacity, palette, reducedMotion, seed, shaderQuality, surgeOnly])

  useFrame(() => {
    const surge = surgeRef.current
    const layerVisible = !surgeOnly || surge.intensity > 0.001
    if (meshRef.current) meshRef.current.visible = layerVisible
    if (!layerVisible || !materialRef.current) return
    const uniformsRef = materialRef.current.uniforms
    if (active) uniformsRef.uTime.value = surge.visualTime
    uniformsRef.uSurge.value = surge.intensity
    uniformsRef.uWarmth.value = surge.warmth
    uniformsRef.uFlowBoost.value = reducedMotion ? 1 + (surge.flow - 1) * 0.35 : surge.flow
    uniformsRef.uBeamingAngle.value = -0.26 + Math.sin(surge.visualTime * 0.11) * 0.16
    uniformsRef.uOpacity.value = surgeOnly ? opacity * surge.intensity * (reducedMotion ? 0.48 : 1) : opacity
    const paletteWarmth = Math.min(
      1,
      surge.warmth * surge.intensity * (reducedMotion ? 0.58 : 1)
    )
    uniformsRef.uColorCore.value.copy(palette.core).lerp(palette.warmCore, paletteWarmth * 0.74)
    uniformsRef.uColorMid.value.copy(palette.mid).lerp(palette.warmMid, Math.min(1, paletteWarmth * 1.25))
    uniformsRef.uColorEdge.value.copy(palette.edge).lerp(palette.warmEdge, paletteWarmth * 0.55)
    uniformsRef.uPointer.value.set(pointerRef.current.x, pointerRef.current.y)
  })

  return (
    <mesh
      ref={meshRef}
      position={[0, positionY, positionZ]}
      scale={scale}
      renderOrder={renderOrder}
      visible={!surgeOnly}
      frustumCulled={false}
    >
      <planeGeometry args={[2, 2, 32, 16]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={accretionVertexShader}
        fragmentShader={accretionFragmentShader}
        transparent
        depthWrite={false}
        depthTest
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

function RearLensingArc({ active, reducedMotion, shaderQuality, surgeRef, crisp = false }) {
  const materialRef = useRef(null)
  const uniforms = useMemo(() => ({
    uTime: {value: 0},
    uMotion: {value: reducedMotion ? 0.2 : 1},
    uQuality: {value: shaderQuality},
    uSurge: {value: 0},
    uWarmth: {value: 0}
  }), [reducedMotion, shaderQuality])

  useFrame(() => {
    if (!materialRef.current) return
    const uniformsRef = materialRef.current.uniforms
    if (active) uniformsRef.uTime.value = surgeRef.current.visualTime
    uniformsRef.uSurge.value = surgeRef.current.intensity
    uniformsRef.uWarmth.value = surgeRef.current.warmth
  })

  return (
    <mesh position-z={crisp ? -0.46 : -0.74} scale={crisp ? [1.42, 1.42, 1] : [1.48, 1.48, 1]} renderOrder={2} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={nebulaVertexShader}
        fragmentShader={lensingArcFragmentShader}
        transparent
        depthWrite={false}
        depthTest
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

function PhotonRing({ active, reducedMotion, shaderQuality, surgeRef }) {
  const materialRef = useRef(null)
  const uniforms = useMemo(() => ({
    uTime: {value: 0},
    uMotion: {value: reducedMotion ? 0.22 : 1},
    uQuality: {value: shaderQuality},
    uSurge: {value: 0},
    uWarmth: {value: 0}
  }), [reducedMotion, shaderQuality])

  useFrame(() => {
    if (!materialRef.current) return
    const uniformsRef = materialRef.current.uniforms
    if (active) uniformsRef.uTime.value = surgeRef.current.visualTime
    uniformsRef.uSurge.value = surgeRef.current.intensity
    uniformsRef.uWarmth.value = surgeRef.current.warmth
  })

  return (
    <mesh position-z={1.54} scale={[1.19, 1.19, 1]} renderOrder={7} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={nebulaVertexShader}
        fragmentShader={photonRingFragmentShader}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

function OrbitalParticles({ count, active, reducedMotion, surgeRef }) {
  const materialRef = useRef(null)
  const geometry = useMemo(() => {
    const random = createRandom(441)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const angles = new Float32Array(count)
    const radii = new Float32Array(count)
    const speeds = new Float32Array(count)
    const depths = new Float32Array(count)
    const thicknesses = new Float32Array(count)
    const phases = new Float32Array(count)
    const sizes = new Float32Array(count)

    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2
      const radius = 1.25 + Math.pow(random(), 0.64) * 4.2
      angles[index] = angle
      radii[index] = radius
      speeds[index] = (0.22 + random() * 0.09) / Math.sqrt(radius)
      depths[index] = -0.85 + random() * 2.15
      thicknesses[index] = random()
      phases[index] = random() * Math.PI * 2
      sizes[index] = 0.7 + Math.pow(random(), 2.2) * 1.6
      const color = new THREE.Color(index % 13 === 0 ? '#b68cff' : index % 5 === 0 ? '#ffffff' : '#39e8ff')
      colors.set(color.toArray(), index * 3)
    }

    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    nextGeometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))
    nextGeometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1))
    nextGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    nextGeometry.setAttribute('aDepth', new THREE.BufferAttribute(depths, 1))
    nextGeometry.setAttribute('aThickness', new THREE.BufferAttribute(thicknesses, 1))
    nextGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    nextGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    return nextGeometry
  }, [count])
  const uniforms = useMemo(() => ({
    uTime: {value: 0},
    uMotion: {value: reducedMotion ? 0.2 : 1},
    uFlow: {value: 1},
    uWarmth: {value: 0},
    uSurge: {value: 0}
  }), [reducedMotion])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    if (!materialRef.current) return
    const surge = surgeRef.current
    if (active) materialRef.current.uniforms.uTime.value = surge.visualTime
    materialRef.current.uniforms.uFlow.value = reducedMotion ? 1 + (surge.flow - 1) * 0.3 : surge.flow
    materialRef.current.uniforms.uWarmth.value = surge.warmth
    materialRef.current.uniforms.uSurge.value = surge.intensity
  })

  return (
    <points geometry={geometry} position-z={0.5} renderOrder={9} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={orbitalParticleVertexShader}
        fragmentShader={orbitalParticleFragmentShader}
        transparent
        vertexColors
        depthWrite={false}
        depthTest
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

function EnergyEjections({ count, active, reducedMotion, surgeRef }) {
  const linesRef = useRef(null)
  const materialRef = useRef(null)
  const idleColor = useMemo(() => new THREE.Color('#ffffff'), [])
  const warmColor = useMemo(() => new THREE.Color('#ff8b2c'), [])
  const geometry = useMemo(() => {
    const random = createRandom(7219)
    const positions = new Float32Array(count * 6)
    const colors = new Float32Array(count * 6)

    for (let index = 0; index < count; index += 1) {
      const direction = index % 6 === 0 ? -1 : 1
      const x = direction * (1.7 + random() * 4.2)
      const y = (random() - 0.5) * (0.48 + Math.abs(x) * 0.08)
      const z = 1.28 + random() * 0.24
      const length = 0.035 + Math.pow(random(), 1.8) * 0.14
      const lift = direction * (0.018 + random() * 0.042)
      const color = new THREE.Color(index % 9 === 0 ? '#b88dff' : index % 4 === 0 ? '#f3ffff' : '#4ce8ff')
      const offset = index * 6
      positions.set([x, y, z, x + direction * length, y + lift, z], offset)
      colors.set([...color.toArray(), ...color.toArray()], offset)
    }

    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return nextGeometry
  }, [count])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    if (!materialRef.current) return
    const surge = surgeRef.current
    const pulse = active ? Math.sin(surge.visualTime * 0.56) * 0.06 : 0
    materialRef.current.opacity = 0.13 + pulse * 0.5 + surge.intensity * 0.1
    materialRef.current.color.copy(idleColor).lerp(warmColor, surge.warmth * 0.45)
    if (linesRef.current && active && !reducedMotion) linesRef.current.rotation.z += Math.min(delta, 0.05) * 0.021 * surge.flow
  })

  return (
    <lineSegments ref={linesRef} geometry={geometry} renderOrder={10}>
      <lineBasicMaterial
        ref={materialRef}
        vertexColors
        transparent
        opacity={0.13}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </lineSegments>
  )
}

function EventHorizon({ interactionRef, surgeRef }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => () => {
    if (interactionRef.current.cursorOwner === 'horizon') {
      interactionRef.current.cursorOwner = null
      gl.domElement.style.cursor = ''
    }
  }, [gl, interactionRef])

  const handleActivate = (event) => {
    event.stopPropagation()
    if (event.delta > 6 || performance.now() < interactionRef.current.blockSurgeUntil) return
    if (!beginSurge(surgeRef.current)) return

    interactionRef.current.releaseDrag?.({preserveVelocity: false})
    interactionRef.current.blockSurgeUntil = performance.now() + 180
    gl.domElement.dataset.surgePhase = SURGE_PHASE.CHARGING
    gl.domElement.dataset.surgeGeneration = String(surgeRef.current.generation)
    gl.domElement.style.cursor = 'progress'
    interactionRef.current.cursorOwner = 'surge'
  }

  const handlePointerOver = (event) => {
    event.stopPropagation()
    if (surgeRef.current.phase !== SURGE_PHASE.IDLE || interactionRef.current.dragging) return
    interactionRef.current.cursorOwner = 'horizon'
    gl.domElement.style.cursor = 'pointer'
  }

  const handlePointerOut = () => {
    if (interactionRef.current.cursorOwner !== 'horizon') return
    interactionRef.current.cursorOwner = null
    gl.domElement.style.cursor = ''
  }

  return (
    <mesh
      position-z={BLACK_HOLE_CENTER_Z}
      renderOrder={5}
      onClick={handleActivate}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <sphereGeometry args={[0.94, 72, 48]} />
      <meshBasicMaterial color="#000000" transparent opacity={1} depthWrite toneMapped={false} />
    </mesh>
  )
}

function SurgePulse({ active, reducedMotion, surgeRef }) {
  const meshRef = useRef(null)
  const materialRef = useRef(null)
  const coolColor = useMemo(() => new THREE.Color('#63efff'), [])
  const warmColor = useMemo(() => new THREE.Color('#ff6a18'), [])

  useFrame(() => {
    if (!meshRef.current || !materialRef.current) return
    const surge = surgeRef.current
    if (!active || surge.phase === SURGE_PHASE.IDLE) {
      meshRef.current.visible = false
      return
    }

    const earlyAbsorption = surge.phase === SURGE_PHASE.ABSORBING ? Math.max(0, 1 - surge.absorption * 4) : 0
    const pulse = surge.phase === SURGE_PHASE.CHARGING
      ? Math.sin(surge.charge * Math.PI)
      : Math.sin(earlyAbsorption * Math.PI) * earlyAbsorption
    const motionScale = reducedMotion ? 0.42 : 1
    meshRef.current.visible = pulse > 0.002
    meshRef.current.scale.setScalar(1 + pulse * 0.62 * motionScale)
    materialRef.current.opacity = pulse * 0.2 * motionScale
    materialRef.current.color.copy(coolColor).lerp(warmColor, surge.warmth)
  })

  return (
    <mesh ref={meshRef} position-z={1.61} renderOrder={11} visible={false} frustumCulled={false}>
      <ringGeometry args={[0.98, 1.015, 112]} />
      <meshBasicMaterial
        ref={materialRef}
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

function SurgeLight({ surgeRef }) {
  const lightRef = useRef(null)
  const coolColor = useMemo(() => new THREE.Color('#53e9ff'), [])
  const warmColor = useMemo(() => new THREE.Color('#ff802b'), [])

  useFrame(() => {
    if (!lightRef.current) return
    const surge = surgeRef.current
    lightRef.current.intensity = surge.intensity * 17
    lightRef.current.color.copy(coolColor).lerp(warmColor, surge.warmth)
  })

  return <pointLight ref={lightRef} position={[0.3, 0.05, 3.4]} intensity={0} distance={8} decay={2} />
}

function RearBlackHole({ active, reducedMotion, pointerRef, shaderQuality, surgeRef }) {
  return (
    <>
      <PlasmaLayer
        active={active}
        reducedMotion={reducedMotion}
        pointerRef={pointerRef}
        surgeRef={surgeRef}
        shaderQuality={shaderQuality}
        layer={0}
        positionZ={-0.92}
        intensity={0.74}
        opacity={0.68}
        flowSpeed={0.14}
        noiseScale={1.2}
        distortion={0.82}
        seed={0.7}
        scale={[7.25, 4.55, 1]}
        renderOrder={0}
        colors={['#dffcff', '#147db5', '#35256f']}
      />
      <PlasmaLayer
        active={active}
        reducedMotion={reducedMotion}
        pointerRef={pointerRef}
        surgeRef={surgeRef}
        shaderQuality={shaderQuality}
        layer={1}
        positionZ={-0.72}
        intensity={1.16}
        opacity={0.88}
        flowSpeed={0.31}
        noiseScale={1.82}
        distortion={0.72}
        seed={2.1}
        scale={[6.75, 4.08, 1]}
        renderOrder={1}
        colors={['#ffffff', '#36dff4', '#3c32a0']}
      />
      <RearLensingArc active={active} reducedMotion={reducedMotion} shaderQuality={shaderQuality} surgeRef={surgeRef} />
    </>
  )
}

function FrontBlackHole({ active, reducedMotion, pointerRef, shaderQuality, particleCount, ejectionCount, includeCrispArc, interactionRef, surgeRef }) {
  return (
    <>
      {includeCrispArc && (
        <RearLensingArc active={active} reducedMotion={reducedMotion} shaderQuality={shaderQuality} surgeRef={surgeRef} crisp />
      )}
      <EventHorizon interactionRef={interactionRef} surgeRef={surgeRef} />

      <PhotonRing active={active} reducedMotion={reducedMotion} shaderQuality={shaderQuality} surgeRef={surgeRef} />
      <SurgePulse active={active} reducedMotion={reducedMotion} surgeRef={surgeRef} />
      <SurgeLight surgeRef={surgeRef} />

      <PlasmaLayer
        active={active}
        reducedMotion={reducedMotion}
        pointerRef={pointerRef}
        surgeRef={surgeRef}
        shaderQuality={shaderQuality}
        layer={2}
        positionY={-0.3}
        positionZ={1.54}
        intensity={1.3}
        opacity={0.9}
        flowSpeed={0.52}
        noiseScale={2.38}
        distortion={0.58}
        seed={4.6}
        scale={[6.65, 3.98, 1]}
        renderOrder={8}
        colors={['#ffffff', '#68edff', '#4545c7']}
      />
      <PlasmaLayer
        active={active}
        reducedMotion={reducedMotion}
        pointerRef={pointerRef}
        surgeRef={surgeRef}
        shaderQuality={shaderQuality}
        layer={3}
        positionY={-0.25}
        positionZ={1.58}
        intensity={1.48}
        opacity={0.74}
        flowSpeed={0.74}
        noiseScale={2.75}
        distortion={0.42}
        seed={8.2}
        scale={[6.48, 3.82, 1]}
        renderOrder={9}
        colors={['#ffffff', '#8af8ff', '#7552dc']}
      />
      <PlasmaLayer
        active={active}
        reducedMotion={reducedMotion}
        pointerRef={pointerRef}
        surgeRef={surgeRef}
        shaderQuality={shaderQuality}
        layer={3}
        positionY={-0.255}
        positionZ={1.62}
        intensity={1.42}
        opacity={0.82}
        flowSpeed={0.92}
        noiseScale={2.9}
        distortion={0.46}
        seed={12.7}
        scale={[6.5, 3.84, 1]}
        renderOrder={10}
        colors={['#fff4d2', '#ff7b24', '#b5231f']}
        surgeOnly
      />
      <OrbitalParticles count={particleCount} active={active} reducedMotion={reducedMotion} surgeRef={surgeRef} />
      {ejectionCount > 0 && <EnergyEjections count={ejectionCount} active={active} reducedMotion={reducedMotion} surgeRef={surgeRef} />}
    </>
  )
}

function RearEnvironment({ active, reducedMotion, pointerRef, settings, motionRef, surgeRef }) {
  return (
    <>
      <fog attach="fog" args={['#01040a', 8, 20]} />
      <SpaceBackground count={settings.stars} active={active} reducedMotion={reducedMotion} pointerRef={pointerRef} surgeRef={surgeRef} />
      <NebulaLayer active={active} reducedMotion={reducedMotion} shaderQuality={settings.shaderQuality} surgeRef={surgeRef} />
      <CompositionGroup basePosition={settings.position} motionRef={motionRef} scale={settings.blackHoleScale}>
        <RearBlackHole
          active={active}
          reducedMotion={reducedMotion}
          pointerRef={pointerRef}
          shaderQuality={settings.shaderQuality}
          surgeRef={surgeRef}
        />
      </CompositionGroup>
    </>
  )
}

function LensedRearPass({ active, reducedMotion, pointerRef, settings, motionRef, surgeRef }) {
  const materialRef = useRef(null)
  const rearScene = useMemo(() => new THREE.Scene(), [])
  const { camera, gl, size } = useThree()
  const pixelRatio = Math.min(gl.getPixelRatio(), 1.3)
  const targetWidth = Math.max(192, Math.floor(size.width * pixelRatio * settings.fboScale))
  const targetHeight = Math.max(128, Math.floor(size.height * pixelRatio * settings.fboScale))
  const renderTarget = useFBO(targetWidth, targetHeight, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.UnsignedByteType
  })
  const projectedCenter = useMemo(() => new THREE.Vector3(), [])
  const projectedEdge = useMemo(() => new THREE.Vector3(), [])
  const uniforms = useMemo(() => ({
    uTexture: {value: renderTarget.texture},
    uCenter: {value: new THREE.Vector2(0.5, 0.5)},
    uAspect: {value: Math.max(size.width, 1) / Math.max(size.height, 1)},
    uHorizonRadius: {value: 0.08},
    uStrength: {value: settings.lensing},
    uSurge: {value: 0},
    uChromaticAberration: {value: 0.035 * settings.shaderQuality}
  }), [renderTarget.texture, settings.lensing, size.height, size.width])

  useFrame(() => {
    if (!active) return
    const previousTarget = gl.getRenderTarget()
    gl.setRenderTarget(renderTarget)
    gl.clear(true, false, false)
    gl.render(rearScene, camera)
    gl.setRenderTarget(previousTarget)

    if (!materialRef.current) return
    const motion = motionRef.current
    const centerX = settings.position[0] + motion.x
    const centerY = settings.position[1] + motion.y
    const centerZ = settings.position[2] + BLACK_HOLE_CENTER_Z * settings.blackHoleScale
    const worldRadius = 0.94 * settings.blackHoleScale
    projectedCenter.set(centerX, centerY, centerZ).project(camera)
    projectedEdge.set(centerX + worldRadius, centerY, centerZ).project(camera)
    const aspect = Math.max(size.width, 1) / Math.max(size.height, 1)
    const projectedRadius = Math.max(0.001, Math.abs(projectedEdge.x - projectedCenter.x) * 0.5 * aspect)
    materialRef.current.uniforms.uCenter.value.set(projectedCenter.x * 0.5 + 0.5, projectedCenter.y * 0.5 + 0.5)
    materialRef.current.uniforms.uAspect.value = aspect
    materialRef.current.uniforms.uHorizonRadius.value = projectedRadius
    materialRef.current.uniforms.uSurge.value = surgeRef.current.intensity
  }, -1)

  return (
    <>
      {createPortal(
        <RearEnvironment
          active={active}
          reducedMotion={reducedMotion}
          pointerRef={pointerRef}
          settings={settings}
          motionRef={motionRef}
          surgeRef={surgeRef}
        />,
        rearScene
      )}
      <mesh renderOrder={-20} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={lensingCompositeVertexShader}
          fragmentShader={lensingCompositeFragmentShader}
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

function makeAsteroidGeometry() {
  const source = new THREE.IcosahedronGeometry(1, 3)
  const positions = source.attributes.position

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const coarse = Math.sin(x * 3.7 + y * 5.3 - z * 4.1) * 0.09
    const medium = Math.sin(x * 11.2 - y * 8.4 + z * 7.7) * 0.045
    const fine = Math.sin((x + y + z) * 24.0) * 0.018
    const displacement = 0.88 + coarse + medium + fine
    positions.setXYZ(index, x * displacement, y * displacement, z * displacement)
  }

  positions.needsUpdate = true
  source.deleteAttribute('normal')
  source.deleteAttribute('uv')
  const geometry = mergeVertices(source, 0.0001)
  source.dispose()
  geometry.computeVertexNormals()
  return geometry
}

function createAsteroidBodies(count, compact, center) {
  const layout = compact
    ? [ASTEROID_LAYOUT[3], ASTEROID_LAYOUT[4], ASTEROID_LAYOUT[6], ASTEROID_LAYOUT[5], ASTEROID_LAYOUT[2]].slice(0, count)
    : ASTEROID_LAYOUT.slice(0, count)

  return layout.map((asteroid, index) => {
    const position = new THREE.Vector3(
      center.x + asteroid.position[0] * (compact ? 0.68 : 1),
      center.y + asteroid.position[1] * (compact ? 0.88 : 1),
      asteroid.position[2]
    )
    const offset = position.clone().sub(center)
    const tangent = new THREE.Vector3(-offset.y, offset.x, 0).normalize()
    const inward = offset.clone().normalize().multiplyScalar(-1)
    const mode = index % 3 === 0 ? 'orbit' : index % 3 === 1 ? 'infall' : 'drift'
    const orbitSpeed = 0.12 + seededValue(index + 2.3) * 0.12
    const velocity = tangent.multiplyScalar(orbitSpeed)

    if (mode === 'infall') velocity.addScaledVector(inward, 0.035)
    if (mode === 'drift') velocity.multiplyScalar(0.4).add(new THREE.Vector3(index % 2 ? -0.045 : 0.05, 0.018, -0.01))

    return {
      index,
      mode,
      position,
      spawnPosition: position.clone(),
      velocity,
      rotation: new THREE.Vector3(...asteroid.rotation),
      angularVelocity: new THREE.Vector3(
        0.13 + seededValue(index + 4.1) * 0.18,
        0.1 + seededValue(index + 8.7) * 0.16,
        (index % 2 ? -1 : 1) * (0.08 + seededValue(index + 11.2) * 0.12)
      ),
      baseScale: asteroid.scale * (compact ? 0.96 : 1),
      shape: new THREE.Vector3(
        0.84 + seededValue(index + 13.4) * 0.32,
        0.72 + seededValue(index + 17.6) * 0.34,
        0.8 + seededValue(index + 21.8) * 0.3
      ),
      depth: asteroid.depth,
      gravityResponse: 0.72 + seededValue(index + 27.3) * 0.58,
      active: true,
      grabbed: false,
      absorbScale: 0,
      surgeGeneration: 0,
      surgeStart: position.clone(),
      surgeStartRadius: 1,
      surgeStartAngle: 0,
      surgeTurns: 1,
      surgeDelay: 0,
      respawnGeneration: 0,
      respawnAt: Number.POSITIVE_INFINITY,
      cycle: 0
    }
  })
}

function respawnAsteroid(body, center, compact) {
  body.cycle += 1
  const seed = body.index * 19.7 + body.cycle * 7.13
  const fromRight = seededValue(seed) > 0.5
  const width = compact ? 4.6 : 6.5
  body.position.set(
    center.x + (fromRight ? width : -width),
    center.y + (seededValue(seed + 1.7) - 0.5) * (compact ? 4.6 : 6.8),
    0.4 + seededValue(seed + 3.1) * 2.2
  )
  body.spawnPosition.copy(body.position)
  const offset = body.position.clone().sub(center)
  const inward = offset.normalize().multiplyScalar(0.055 + seededValue(seed + 4.4) * 0.055)
  const tangent = new THREE.Vector3(-offset.y, offset.x, 0).normalize().multiplyScalar((fromRight ? -1 : 1) * 0.08)
  body.velocity.copy(inward).multiplyScalar(-1).add(tangent)
  body.rotation.set(seededValue(seed + 5.6) * Math.PI, seededValue(seed + 6.8) * Math.PI, seededValue(seed + 8.2) * Math.PI)
  body.active = true
  body.grabbed = false
  body.absorbScale = 0
  body.respawnAt = Number.POSITIVE_INFINITY
}

function AsteroidField({ count, active, reducedMotion, pointerRef, interactionRef, surgeRef, compact, blackHolePosition }) {
  const meshRef = useRef(null)
  const hitMeshRef = useRef(null)
  const trailRef = useRef(null)
  const trailMaterialRef = useRef(null)
  const colorsReadyRef = useRef(false)
  const simulationTimeRef = useRef(0)
  const dragRef = useRef({
    instanceId: null,
    pointerId: null,
    captureTarget: null,
    plane: new THREE.Plane(),
    offset: new THREE.Vector3(),
    parallax: new THREE.Vector3(),
    lastPosition: new THREE.Vector3(),
    releaseVelocity: new THREE.Vector3(),
    lastTime: 0
  })
  const finishDragRef = useRef(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const center = useMemo(() => new THREE.Vector3(blackHolePosition[0], blackHolePosition[1], BLACK_HOLE_CENTER_Z), [blackHolePosition])
  const geometry = useMemo(makeAsteroidGeometry, [])
  const hitGeometry = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#465964',
    roughness: 0.82,
    metalness: 0.08,
    emissive: '#092536',
    emissiveIntensity: 0.56,
    flatShading: false,
    vertexColors: true
  }), [])
  const hitMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    colorWrite: false,
    toneMapped: false
  }), [])
  const bodies = useMemo(() => createAsteroidBodies(count, compact, center), [center, compact, count])
  const trailPositions = useMemo(() => new Float32Array(count * 6), [count])
  const trailGeometry = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
    return nextGeometry
  }, [trailPositions])
  const temp = useMemo(() => ({
    toCenter: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    acceleration: new THREE.Vector3(),
    desired: new THREE.Vector3(),
    steering: new THREE.Vector3(),
    visual: new THREE.Vector3(),
    previous: new THREE.Vector3(),
    trail: new THREE.Vector3(),
    coolColor: new THREE.Color('#6f8793'),
    altColor: new THREE.Color('#536a78'),
    selectedColor: new THREE.Color('#b9f8ff')
  }), [])
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)

  const setInstanceColor = (instanceId, selected) => {
    if (!meshRef.current || instanceId == null) return
    const color = selected ? temp.selectedColor : instanceId % 3 === 0 ? temp.coolColor : temp.altColor
    meshRef.current.setColorAt(instanceId, color)
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  }

  const finishDrag = ({pointerId = null, preserveVelocity = true} = {}) => {
    const drag = dragRef.current
    if (drag.instanceId == null || (pointerId != null && drag.pointerId !== pointerId)) return
    const body = bodies[drag.instanceId]
    const captureTarget = drag.captureTarget
    const capturedPointer = drag.pointerId
    const releasedId = drag.instanceId

    drag.instanceId = null
    drag.pointerId = null
    drag.captureTarget = null
    if (body) {
      body.grabbed = false
      if (preserveVelocity) body.velocity.copy(drag.releaseVelocity).multiplyScalar(0.72)
      else body.velocity.set(0, 0, 0)
      clampVectorLength(body.velocity, DRAG_SPEED_LIMIT)
    }
    setInstanceColor(releasedId, false)
    interactionRef.current.dragging = false
    interactionRef.current.blockSurgeUntil = performance.now() + 180
    interactionRef.current.cursorOwner = null
    gl.domElement.style.cursor = ''
    gl.domElement.style.touchAction = ''
    gl.domElement.dataset.asteroidDragging = 'false'

    try {
      if (captureTarget?.hasPointerCapture?.(capturedPointer)) captureTarget.releasePointerCapture(capturedPointer)
    } catch {
      // Pointer capture can already be released by the browser during cancellation.
    }
  }
  finishDragRef.current = finishDrag

  useEffect(() => {
    interactionRef.current.releaseDrag = (options) => finishDragRef.current?.(options)
    const handlePointerCancel = (event) => finishDragRef.current?.({pointerId: event.pointerId, preserveVelocity: false})
    const handleLostCapture = (event) => finishDragRef.current?.({pointerId: event.pointerId, preserveVelocity: true})
    gl.domElement.addEventListener('pointercancel', handlePointerCancel)
    gl.domElement.addEventListener('lostpointercapture', handleLostCapture)

    return () => {
      finishDragRef.current?.({preserveVelocity: false})
      if (interactionRef.current.releaseDrag) interactionRef.current.releaseDrag = null
      gl.domElement.removeEventListener('pointercancel', handlePointerCancel)
      gl.domElement.removeEventListener('lostpointercapture', handleLostCapture)
    }
  }, [gl, interactionRef])

  useLayoutEffect(() => {
    colorsReadyRef.current = false
    meshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    hitMeshRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    return () => finishDrag({preserveVelocity: false})
  }, [bodies])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => hitGeometry.dispose(), [hitGeometry])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => hitMaterial.dispose(), [hitMaterial])
  useEffect(() => () => trailGeometry.dispose(), [trailGeometry])

  const handlePointerDown = (event) => {
    const instanceId = event.instanceId
    const body = bodies[instanceId]
    if (instanceId == null || !body?.active || surgeRef.current.phase !== SURGE_PHASE.IDLE) return

    event.stopPropagation()
    const drag = dragRef.current
    camera.getWorldDirection(CAMERA_FORWARD)
    drag.plane.setFromNormalAndCoplanarPoint(CAMERA_FORWARD, event.point)
    if (!event.ray.intersectPlane(drag.plane, DRAG_POINT)) return

    const parallaxScale = reducedMotion ? 0 : body.depth
    drag.parallax.set(pointerRef.current.x * 0.18 * parallaxScale, pointerRef.current.y * 0.14 * parallaxScale, 0)
    drag.offset.copy(body.position).add(drag.parallax).sub(DRAG_POINT)
    drag.lastPosition.copy(body.position)
    drag.releaseVelocity.set(0, 0, 0)
    drag.lastTime = performance.now()
    drag.instanceId = instanceId
    drag.pointerId = event.pointerId
    drag.captureTarget = event.target
    body.grabbed = true
    interactionRef.current.dragging = true
    interactionRef.current.cursorOwner = 'asteroid'
    gl.domElement.style.cursor = 'grabbing'
    gl.domElement.style.touchAction = 'none'
    gl.domElement.dataset.asteroidDragging = 'true'
    setInstanceColor(instanceId, true)

    try {
      event.target.setPointerCapture?.(event.pointerId)
    } catch {
      gl.domElement.setPointerCapture?.(event.pointerId)
      drag.captureTarget = gl.domElement
    }
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (drag.instanceId == null || drag.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (!event.ray.intersectPlane(drag.plane, DRAG_POINT)) return

    const body = bodies[drag.instanceId]
    const now = performance.now()
    const sampleDelta = Math.max(0.008, Math.min(0.08, (now - drag.lastTime) / 1000))
    temp.previous.copy(body.position)
    body.position.copy(DRAG_POINT).add(drag.offset).sub(drag.parallax)
    body.position.x = THREE.MathUtils.clamp(body.position.x, center.x - 7, center.x + 7)
    body.position.y = THREE.MathUtils.clamp(body.position.y, center.y - 4.5, center.y + 4.5)
    body.position.z = THREE.MathUtils.clamp(body.position.z, -0.4, 3.4)
    temp.trail.copy(body.position).sub(temp.previous).divideScalar(sampleDelta)
    drag.releaseVelocity.lerp(temp.trail, 0.42)
    clampVectorLength(drag.releaseVelocity, DRAG_SPEED_LIMIT)
    drag.lastPosition.copy(body.position)
    drag.lastTime = now
  }

  const handlePointerUp = (event) => {
    if (dragRef.current.instanceId == null) return
    event.stopPropagation()
    finishDragRef.current?.({pointerId: event.pointerId, preserveVelocity: true})
  }

  const handlePointerOver = (event) => {
    const body = bodies[event.instanceId]
    if (!body?.active || interactionRef.current.dragging || surgeRef.current.phase !== SURGE_PHASE.IDLE) return
    event.stopPropagation()
    interactionRef.current.cursorOwner = 'asteroid'
    gl.domElement.style.cursor = 'grab'
  }

  const handlePointerOut = () => {
    if (interactionRef.current.dragging || interactionRef.current.cursorOwner !== 'asteroid') return
    interactionRef.current.cursorOwner = null
    gl.domElement.style.cursor = ''
  }

  useFrame((_, frameDelta) => {
    if (!meshRef.current) return
    const delta = Math.min(Math.max(frameDelta, 0), MAX_FRAME_DELTA)
    const surge = surgeRef.current
    const idleMotionScale = reducedMotion ? 0.28 : 1
    const physicsDelta = delta * (surge.phase === SURGE_PHASE.IDLE ? idleMotionScale : 1)
    if (active) simulationTimeRef.current += Math.min(Math.max(frameDelta, 0), 0.25)

    if (!colorsReadyRef.current) {
      bodies.forEach((_, index) => setInstanceColor(index, false))
      colorsReadyRef.current = true
    }

    let trailsVisible = false
    bodies.forEach((body, index) => {
      if (!body.active) {
        if (
          surge.phase === SURGE_PHASE.IDLE &&
          surge.completedGeneration > 0 &&
          body.respawnGeneration !== surge.completedGeneration
        ) {
          body.respawnGeneration = surge.completedGeneration
          body.respawnAt = simulationTimeRef.current + 0.55 + index * 0.48
        }
        if (surge.phase === SURGE_PHASE.IDLE && simulationTimeRef.current >= body.respawnAt) {
          respawnAsteroid(body, center, compact)
          setInstanceColor(index, false)
        }
      }

      if (body.active && surge.phase !== SURGE_PHASE.IDLE && body.surgeGeneration !== surge.generation) {
        body.surgeGeneration = surge.generation
        body.surgeStart.copy(body.position)
        temp.toCenter.copy(body.position).sub(center)
        body.surgeStartRadius = Math.max(temp.toCenter.length(), 0.8)
        body.surgeStartAngle = Math.atan2(temp.toCenter.y, temp.toCenter.x)
        body.surgeTurns = 0.72 + seededValue(index + surge.generation * 3.7) * 0.88
        body.surgeDelay = seededValue(index + surge.generation * 8.1) * 0.17
      }

      body.absorbScale = 0
      if (body.active && !body.grabbed && active) {
        temp.toCenter.copy(center).sub(body.position)
        const distanceSq = Math.max(temp.toCenter.lengthSq(), 0.18)
        const distance = Math.sqrt(distanceSq)
        temp.acceleration.copy(temp.toCenter).normalize()
        const gravity = Math.min(0.34, 0.24 * body.gravityResponse / (distanceSq + 0.55)) * surge.gravity
        temp.acceleration.multiplyScalar(gravity)
        temp.tangent.set(-temp.toCenter.y, temp.toCenter.x, 0).normalize()

        if (surge.phase === SURGE_PHASE.ABSORBING || surge.phase === SURGE_PHASE.DECAYING) {
          const delayedProgress = (surge.absorption - body.surgeDelay) / Math.max(0.2, 1 - body.surgeDelay)
          const absorption = smoothStep(delayedProgress)
          const turns = body.surgeTurns * (reducedMotion ? 0.28 : 1)
          const angle = body.surgeStartAngle + turns * Math.PI * 2 * absorption
          const targetRadius = THREE.MathUtils.lerp(body.surgeStartRadius, 0.18, Math.pow(absorption, 1.28))
          temp.desired.set(
            center.x + Math.cos(angle) * targetRadius,
            center.y + Math.sin(angle) * targetRadius,
            THREE.MathUtils.lerp(body.surgeStart.z, center.z, absorption)
          )
          temp.acceleration.addScaledVector(temp.tangent, (1 - absorption) * 0.38)
          temp.steering.copy(temp.desired).sub(body.position).multiplyScalar(3.8 + absorption * 16)
          temp.acceleration.add(temp.steering)
          body.velocity.addScaledVector(temp.acceleration, physicsDelta)
          clampVectorLength(body.velocity, SURGE_SPEED_LIMIT)
          body.position.addScaledVector(body.velocity, physicsDelta)
          const steering = 1 - Math.exp(-(1.8 + absorption * 11) * physicsDelta)
          body.position.lerp(temp.desired, steering)
          if (surge.absorption > 0.985) body.position.lerp(center, 1 - Math.exp(-90 * Math.max(physicsDelta, 1 / 60)))
          body.absorbScale = smoothStep(Math.max(absorption * 0.88, 1 - distance / 1.4))
          trailsVisible = trailsVisible || absorption > 0.35
        } else {
          const orbitForce = body.mode === 'orbit' ? 0.052 : body.mode === 'infall' ? 0.022 : 0.008
          temp.acceleration.addScaledVector(temp.tangent, orbitForce * body.gravityResponse)
          body.velocity.addScaledVector(temp.acceleration, physicsDelta)
          body.velocity.multiplyScalar(Math.exp(-0.045 * physicsDelta))
          clampVectorLength(body.velocity, ASTEROID_SPEED_LIMIT)
          body.position.addScaledVector(body.velocity, physicsDelta)

          temp.toCenter.copy(body.position).sub(center)
          const nextDistance = temp.toCenter.length()
          if (nextDistance < 1.12) {
            temp.toCenter.normalize()
            body.position.copy(center).addScaledVector(temp.toCenter, 1.12)
            const inwardSpeed = body.velocity.dot(temp.toCenter)
            if (inwardSpeed < 0) body.velocity.addScaledVector(temp.toCenter, -inwardSpeed)
            temp.tangent.set(-temp.toCenter.y, temp.toCenter.x, 0).normalize()
            body.velocity.addScaledVector(temp.tangent, 0.08)
          }

          const horizontalLimit = compact ? 5.5 : 7.2
          if (Math.abs(body.position.x - center.x) > horizontalLimit || Math.abs(body.position.y - center.y) > 4.5) {
            respawnAsteroid(body, center, compact)
          }
        }

        finiteVector(body.position, body.spawnPosition)
        finiteVector(body.velocity, ZERO_VECTOR)
        if (body.position.distanceTo(center) <= ABSORPTION_RADIUS && surge.phase !== SURGE_PHASE.IDLE) {
          body.active = false
          body.velocity.set(0, 0, 0)
          body.absorbScale = 1
          body.respawnAt = Number.POSITIVE_INFINITY
        }

        body.rotation.addScaledVector(body.angularVelocity, physicsDelta * (surge.phase === SURGE_PHASE.IDLE ? 1 : surge.flow))
      }

      const parallaxScale = reducedMotion || body.grabbed ? 0 : body.depth
      temp.visual.copy(body.position)
      temp.visual.x += pointerRef.current.x * 0.18 * parallaxScale
      temp.visual.y += pointerRef.current.y * 0.14 * parallaxScale
      dummy.position.copy(temp.visual)
      dummy.rotation.set(body.rotation.x, body.rotation.y, body.rotation.z)
      const visibleScale = body.active ? Math.max(0.02, 1 - body.absorbScale * 0.94) : 0
      const stretch = reducedMotion ? 0 : body.absorbScale * 1.45
      dummy.scale.set(
        body.baseScale * body.shape.x * visibleScale * (1 + stretch),
        body.baseScale * body.shape.y * visibleScale * (1 - body.absorbScale * 0.36),
        body.baseScale * body.shape.z * visibleScale * (1 - body.absorbScale * 0.5)
      )
      if (body.grabbed) dummy.scale.multiplyScalar(1.045)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)

      const hitScale = body.active ? (compact ? 2.45 : 1.62) : 0
      dummy.scale.set(
        body.baseScale * body.shape.x * hitScale,
        body.baseScale * body.shape.y * hitScale,
        body.baseScale * body.shape.z * hitScale
      )
      dummy.updateMatrix()
      hitMeshRef.current?.setMatrixAt(index, dummy.matrix)

      const offset = index * 6
      trailPositions[offset] = temp.visual.x
      trailPositions[offset + 1] = temp.visual.y
      trailPositions[offset + 2] = temp.visual.z
      temp.trail.copy(body.velocity)
      if (temp.trail.lengthSq() > 0.0001) temp.trail.normalize()
      const trailLength = body.active && surge.phase !== SURGE_PHASE.IDLE ? 0.12 + body.absorbScale * 0.66 : 0
      trailPositions[offset + 3] = temp.visual.x - temp.trail.x * trailLength
      trailPositions[offset + 4] = temp.visual.y - temp.trail.y * trailLength
      trailPositions[offset + 5] = temp.visual.z - temp.trail.z * trailLength
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    if (hitMeshRef.current) hitMeshRef.current.instanceMatrix.needsUpdate = true
    trailGeometry.attributes.position.needsUpdate = true
    if (trailRef.current) trailRef.current.visible = trailsVisible && surge.phase !== SURGE_PHASE.IDLE
    if (trailMaterialRef.current) {
      trailMaterialRef.current.opacity = reducedMotion ? surge.intensity * 0.08 : surge.intensity * 0.34
      trailMaterialRef.current.color.setRGB(1, 0.37 + (1 - surge.warmth) * 0.42, 0.12 + (1 - surge.warmth) * 0.64)
    }
  })

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, count]}
        frustumCulled={false}
        renderOrder={12}
      />
      <instancedMesh
        ref={hitMeshRef}
        args={[hitGeometry, hitMaterial, count]}
        frustumCulled={false}
        renderOrder={14}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
      <lineSegments ref={trailRef} geometry={trailGeometry} visible={false} frustumCulled={false} renderOrder={13}>
        <lineBasicMaterial
          ref={trailMaterialRef}
          color="#ff9440"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>
    </>
  )
}

function ResponsiveCamera({ quality }) {
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)

  useLayoutEffect(() => {
    if (!camera.isPerspectiveCamera) return
    const nextFov = quality === 'mobile' ? 44 : 37
    if (camera.fov === nextFov) return
    camera.fov = nextFov
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, quality])

  return null
}

function ContactRenderPipeline({
  bloom,
  quality,
  phase,
  surgeRef,
  readinessEpochRef,
  onReady,
  onStable,
  onError
}) {
  const { gl, scene, camera, size, invalidate } = useThree()
  const pipelineRef = useRef(null)
  const frameCountRef = useRef(0)
  const observedEpochRef = useRef(-1)
  const readyEpochRef = useRef(-1)
  const stableEpochRef = useRef(-1)
  const stableStartRef = useRef(0)
  const errorEpochRef = useRef(-1)
  const drawingBufferSizeRef = useRef(new THREE.Vector2())
  const callbacksRef = useRef({onReady, onStable, onError})
  callbacksRef.current = {onReady, onStable, onError}

  const ensurePipeline = useCallback(() => {
    const current = pipelineRef.current
    if (current && !current.disposed) return current

    const rendererAutoClear = gl.autoClear
    const composer = new EffectComposer(gl, {
      depthBuffer: true,
      stencilBuffer: false,
      multisampling: 0,
      frameBufferType: THREE.HalfFloatType
    })
    const renderPass = new RenderPass(scene, camera)
    const bloomEffect = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      mipmapBlur: true,
      intensity: bloom,
      luminanceThreshold: 1.18,
      luminanceSmoothing: 0.16,
      radius: 0.58
    })
    const effectPass = new EffectPass(camera, bloomEffect)
    composer.addPass(renderPass)
    composer.addPass(effectPass)
    composer.setSize(Math.max(size.width, 1), Math.max(size.height, 1), false)

    const next = {
      composer,
      renderPass,
      effectPass,
      bloomEffect,
      rendererAutoClear,
      disposed: false
    }
    pipelineRef.current = next
    gl.domElement.dataset.contactRenderer = 'composer'
    gl.domElement.dataset.contactComposerCount = '1'
    return next
  }, [bloom, camera, gl, scene, size.height, size.width])

  const disposePipeline = useCallback(() => {
    const pipeline = pipelineRef.current
    if (!pipeline || pipeline.disposed) return
    pipeline.disposed = true
    pipeline.composer.dispose()
    gl.autoClear = pipeline.rendererAutoClear
    gl.domElement.dataset.contactComposerCount = '0'
    if (pipelineRef.current === pipeline) pipelineRef.current = null
  }, [gl])

  useEffect(() => () => disposePipeline(), [disposePipeline])

  useEffect(() => {
    const pipeline = bloom > 0 ? ensurePipeline() : pipelineRef.current
    if (pipeline && !pipeline.disposed) {
      const bloomEnabled = bloom > 0
      pipeline.bloomEffect.intensity = bloom
      pipeline.effectPass.enabled = bloomEnabled
      pipeline.effectPass.renderToScreen = bloomEnabled
      pipeline.renderPass.renderToScreen = !bloomEnabled
      gl.domElement.dataset.contactRenderer = bloomEnabled ? 'composer-bloom' : 'composer-direct'
    } else {
      gl.domElement.dataset.contactRenderer = 'direct'
      gl.domElement.dataset.contactComposerCount = '0'
    }
    invalidate()
  }, [bloom, ensurePipeline, gl, invalidate])

  useEffect(() => {
    const pipeline = pipelineRef.current
    if (!pipeline || pipeline.disposed) return
    pipeline.composer.setSize(Math.max(size.width, 1), Math.max(size.height, 1), false)
    invalidate()
  }, [invalidate, size.height, size.width])

  useFrame((_, delta) => {
    const epoch = readinessEpochRef.current
    if (observedEpochRef.current !== epoch) {
      observedEpochRef.current = epoch
      frameCountRef.current = 0
      stableStartRef.current = performance.now()
      errorEpochRef.current = -1
    }

    const info = gl.info
    const previousAutoReset = info.autoReset

    try {
      // Aggregate every scene and post-processing pass into one frame sample.
      info.autoReset = false
      info.reset()
      const pipeline = pipelineRef.current
      if (pipeline && !pipeline.disposed) {
        const bloomEnabled = bloom > 0
        pipeline.bloomEffect.intensity = bloom
        pipeline.effectPass.enabled = bloomEnabled
        pipeline.effectPass.renderToScreen = bloomEnabled
        pipeline.renderPass.renderToScreen = !bloomEnabled
        pipeline.composer.render(delta)
      } else {
        gl.setRenderTarget(null)
        gl.render(scene, camera)
      }

      const context = gl.getContext()
      if (context?.isContextLost?.()) return
      gl.domElement.dataset.contactContextState = 'ok'

      frameCountRef.current += 1
      const frameCount = frameCountRef.current
      if (frameCount === 1 || frameCount % 120 === 0) {
        const canvas = gl.domElement
        const drawingBuffer = gl.getDrawingBufferSize(drawingBufferSizeRef.current)
        canvas.dataset.contactAnimation = getAnimationDiagnostic(phase, phase === 'RUNNING')
        canvas.dataset.contactQuality = quality
        canvas.dataset.contactPhase = phase
        canvas.dataset.contactFrame = String(frameCount)
        canvas.dataset.contactTime = surgeRef.current.visualTime.toFixed(2)
        canvas.dataset.contactCssSize = `${Math.round(size.width)}x${Math.round(size.height)}`
        canvas.dataset.contactBufferSize = `${Math.round(drawingBuffer.x)}x${Math.round(drawingBuffer.y)}`
        canvas.dataset.contactTextures = String(info.memory.textures)
        canvas.dataset.contactGeometries = String(info.memory.geometries)
        canvas.dataset.contactPrograms = String(info.programs?.length || 0)
        canvas.dataset.contactDrawCalls = String(info.render.calls)
        canvas.dataset.contactTriangles = String(info.render.triangles)
        canvas.dataset.contactReadinessEpoch = String(epoch)
        canvas.dataset.surgePhase = surgeRef.current.phase
      }

      if (readyEpochRef.current !== epoch) {
        readyEpochRef.current = epoch
        callbacksRef.current.onReady?.({epoch, frame: frameCount})
      }

      if (
        stableEpochRef.current !== epoch &&
        frameCount > 1 &&
        performance.now() - stableStartRef.current >= 5000
      ) {
        stableEpochRef.current = epoch
        callbacksRef.current.onStable?.({epoch, frame: frameCount})
      }
    } catch (error) {
      if (errorEpochRef.current === epoch) return
      errorEpochRef.current = epoch
      gl.domElement.dataset.contactAnimation = 'render-error'
      callbacksRef.current.onError?.(error)
    } finally {
      info.autoReset = previousAutoReset
    }
  }, 1)

  return null
}

function ContactScene({
  active,
  reducedMotion,
  pointerRef,
  interactionRef,
  quality,
  phase,
  readinessEpochRef,
  onReady,
  onStable,
  onError
}) {
  const settings = CONTACT_QUALITY[quality]
  const surgeRef = useRef(createSurgeState())
  const motionRef = useCompositionMotion({active, reducedMotion, pointerRef, surgeRef})

  return (
    <>
      <AnimationLifecycle
        active={active}
        quality={quality}
        phase={phase}
        surgeRef={surgeRef}
        interactionRef={interactionRef}
      />
      <ResponsiveCamera quality={quality} />
      <fog attach="fog" args={['#01040a', 8, 20]} />

      {settings.lensing > 0 ? (
        <LensedRearPass
          active={active}
          reducedMotion={reducedMotion}
          pointerRef={pointerRef}
          settings={settings}
          motionRef={motionRef}
          surgeRef={surgeRef}
        />
      ) : (
        <RearEnvironment
          active={active}
          reducedMotion={reducedMotion}
          pointerRef={pointerRef}
          settings={settings}
          motionRef={motionRef}
          surgeRef={surgeRef}
        />
      )}

      <ambientLight intensity={0.14} color="#6784a4" />
      <hemisphereLight args={['#8defff', '#02050a', 0.34]} />
      <directionalLight position={[3.5, 4.5, 6]} intensity={1.7} color="#d7faff" />
      <pointLight position={[settings.position[0] + 0.1, settings.position[1] - 0.04, 3]} intensity={25} distance={9} decay={2} color="#30ddf5" />
      <pointLight position={[settings.position[0] + 3.2, settings.position[1] + 3.06, 4.8]} intensity={14} distance={6} decay={2} color="#8cefff" />
      <pointLight position={[settings.position[0] + 3.9, settings.position[1] + 1.96, 2]} intensity={7} distance={8} decay={2} color="#7558e7" />

      <CompositionGroup basePosition={settings.position} motionRef={motionRef} scale={settings.blackHoleScale}>
        <FrontBlackHole
          active={active}
          reducedMotion={reducedMotion}
          pointerRef={pointerRef}
          shaderQuality={settings.shaderQuality}
          particleCount={settings.dust}
          ejectionCount={settings.ejections}
          includeCrispArc={false}
          interactionRef={interactionRef}
          surgeRef={surgeRef}
        />
      </CompositionGroup>

      <AsteroidField
        count={settings.asteroids}
        active={active}
        reducedMotion={reducedMotion}
        pointerRef={pointerRef}
        interactionRef={interactionRef}
        surgeRef={surgeRef}
        compact={quality !== 'desktop'}
        blackHolePosition={settings.position}
      />

      <ContactRenderPipeline
        bloom={settings.bloom}
        quality={quality}
        phase={phase}
        surgeRef={surgeRef}
        readinessEpochRef={readinessEpochRef}
        onReady={onReady}
        onStable={onStable}
        onError={onError}
      />
    </>
  )
}

export default function ContactCanvas({
  active,
  reducedMotion,
  pointerRef,
  interactionRef,
  quality,
  phase,
  onReady,
  onStable,
  onError,
  onContextLost,
  onContextRestored
}) {
  const settings = CONTACT_QUALITY[quality]
  const readinessEpochRef = useRef(0)
  const contextBindingRef = useRef(null)
  const callbacksRef = useRef({onContextLost, onContextRestored})
  const rendererOptionsRef = useRef(null)
  const cameraOptionsRef = useRef(null)
  callbacksRef.current = {onContextLost, onContextRestored}

  if (!rendererOptionsRef.current) {
    rendererOptionsRef.current = {
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    }
  }
  if (!cameraOptionsRef.current) {
    cameraOptionsRef.current = {
      position: [0, 0, 10],
      fov: quality === 'mobile' ? 44 : 37,
      near: 0.1,
      far: 40
    }
  }

  const handleCreated = useCallback(({gl, invalidate}) => {
    gl.setClearColor(0x000000, 0)
    contextBindingRef.current?.detach()
    readinessEpochRef.current += 1

    const canvas = gl.domElement
    let attached = false
    const handleLost = (event) => {
      event.preventDefault()
      interactionRef.current.releaseDrag?.({preserveVelocity: false})
      canvas.dataset.contactAnimation = 'context-lost'
      canvas.dataset.contactPhase = 'CONTEXT_LOST'
      canvas.dataset.contactContextState = 'lost'
      callbacksRef.current.onContextLost?.({
        epoch: readinessEpochRef.current,
        statusMessage: event.statusMessage || ''
      })
    }
    const handleRestored = () => {
      readinessEpochRef.current += 1
      canvas.dataset.contactAnimation = 'restoring'
      canvas.dataset.contactPhase = 'RESTORING'
      canvas.dataset.contactContextState = 'restoring'
      canvas.dataset.contactReadinessEpoch = String(readinessEpochRef.current)
      callbacksRef.current.onContextRestored?.({epoch: readinessEpochRef.current})
      invalidate()
    }
    const binding = {
      canvas,
      attach() {
        if (attached) return
        attached = true
        canvas.addEventListener('webglcontextlost', handleLost, {passive: false})
        canvas.addEventListener('webglcontextrestored', handleRestored)
      },
      detach() {
        if (!attached) return
        attached = false
        canvas.removeEventListener('webglcontextlost', handleLost)
        canvas.removeEventListener('webglcontextrestored', handleRestored)
      }
    }
    contextBindingRef.current = binding
    binding.attach()
    canvas.dataset.contactAnimation = 'initializing'
    canvas.dataset.contactPhase = 'INITIALIZING'
    canvas.dataset.contactContextState = 'ok'
    canvas.dataset.contactComposerCount = '0'
    canvas.dataset.contactReadinessEpoch = String(readinessEpochRef.current)

  }, [interactionRef])

  useEffect(() => {
    contextBindingRef.current?.attach()
    return () => {
      const binding = contextBindingRef.current
      binding?.detach()
      const canvas = binding?.canvas
      if (canvas) DIAGNOSTIC_DATA_KEYS.forEach((key) => delete canvas.dataset[key])
      if (contextBindingRef.current === binding) contextBindingRef.current = null
    }
  }, [])

  return (
    <Canvas
      camera={cameraOptionsRef.current}
      dpr={settings.dpr}
      frameloop="demand"
      gl={rendererOptionsRef.current}
      performance={{min: 0.5}}
      flat
      onPointerMissed={() => interactionRef.current.releaseDrag?.({preserveVelocity: true})}
      onCreated={handleCreated}
    >
      <ActiveFrameLoop active={active} />
      <Suspense fallback={null}>
        <ContactScene
          active={active}
          reducedMotion={reducedMotion}
          pointerRef={pointerRef}
          interactionRef={interactionRef}
          quality={quality}
          phase={phase}
          readinessEpochRef={readinessEpochRef}
          onReady={onReady}
          onStable={onStable}
          onError={onError}
        />
      </Suspense>
    </Canvas>
  )
}
