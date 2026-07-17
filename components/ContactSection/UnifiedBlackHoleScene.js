import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import ActiveFrameLoop from '../ActiveFrameLoop'
import {
  BLACK_HOLE_LAYER_DEFAULTS,
  BLACK_HOLE_PRODUCTION_TUNING
} from './blackHoleLabConfig'
import {
  blackHoleFragmentShader,
  blackHoleVertexShader,
  gravitationalDustFragmentShader,
  gravitationalDustVertexShader
} from './unifiedBlackHoleShaders'

export const CONTACT_QUALITY = {
  desktop: {
    dpr: [0.75, 0.95],
    shaderQuality: 0.82,
    scale: 0.9,
    center: [0.56, 0.5],
    dust: 480,
    asteroids: 5,
    pointScale: 11,
    roll: -0.135,
    diskTilt: -0.46,
    orbitSpeedScale: 0.19,
    spinSpeedScale: 0.42
  },
  tablet: {
    dpr: [0.85, 1],
    shaderQuality: 0.66,
    scale: 0.94,
    center: [0.54, 0.5],
    dust: 330,
    asteroids: 4,
    pointScale: 10.5,
    roll: 0,
    diskTilt: -0.34,
    orbitSpeedScale: 1,
    spinSpeedScale: 1
  },
  mobile: {
    dpr: [1, 1.2],
    shaderQuality: 0.52,
    scale: 1.04,
    center: [0.5, 0.49],
    dust: 220,
    asteroids: 3,
    pointScale: 10,
    roll: 0,
    diskTilt: -0.34,
    orbitSpeedScale: 1,
    spinSpeedScale: 1
  }
}

const DIAGNOSTIC_DATA_KEYS = [
  'contactAnimation',
  'contactQuality',
  'contactPhase',
  'contactFrame',
  'contactTime',
  'contactFps',
  'contactFrameTime',
  'contactCssSize',
  'contactBufferSize',
  'contactTextures',
  'contactGeometries',
  'contactPrograms',
  'contactDrawCalls',
  'contactTriangles',
  'contactReadinessEpoch',
  'contactRenderer',
  'contactComposerCount',
  'contactContextState',
  'independentAsteroids',
  'independentAsteroidInteraction',
  'independentAsteroid0',
  'independentAsteroid1',
  'independentAsteroid2',
  'independentAsteroid3',
  'independentAsteroid4'
]

const getAnimationDiagnostic = (phase, active) => {
  if (phase === 'CONTEXT_LOST') return 'context-lost'
  if (phase === 'RESTORING') return 'restoring'
  if (phase === 'FAILED') return 'failed'
  return active ? 'running' : 'paused'
}

const createRawColor = (hex, fallback) => {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) {
    return new THREE.Color(...fallback)
  }
  const value = Number.parseInt(hex.slice(1), 16)
  return new THREE.Color(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  )
}

function RaymarchedBlackHole({
  active,
  reducedMotion,
  pointerRef,
  settings,
  manualTime,
  resetToken
}) {
  const materialRef = useRef(null)
  const elapsedRef = useRef(0)
  const smoothedPointerRef = useRef(new THREE.Vector2())
  const {viewport, size, gl} = useThree()
  const drawingBufferRef = useRef(new THREE.Vector2())
  const tuning = settings.tuning

  const uniformsRef = useRef(null)
  if (!uniformsRef.current) {
    uniformsRef.current = {
      uTime: {value: 0},
      uMotion: {value: reducedMotion ? 0.18 : tuning.motionSpeed},
      uQuality: {value: settings.shaderQuality},
      uScale: {value: settings.scale},
      uHorizonScale: {value: tuning.horizonScale},
      uLensingStrength: {value: tuning.lensingStrength},
      uRotationSpeed: {value: tuning.rotationSpeed},
      uNoiseSpeed: {value: tuning.noiseSpeed},
      uGasDensity: {value: tuning.gasDensity},
      uDiskThickness: {value: tuning.diskThickness},
      uCloudScale: {value: tuning.cloudScale},
      uFineDetail: {value: tuning.fineDetail},
      uFilamentStrength: {value: tuning.filamentStrength},
      uCloudBreakup: {value: tuning.cloudBreakup},
      uForegroundThickness: {value: tuning.foregroundThickness},
      uForegroundBreakup: {value: tuning.foregroundBreakup},
      uGasDevelopment: {value: tuning.gasDevelopment},
      uPhotonGlow: {value: tuning.photonGlow},
      uPhotonThickness: {value: tuning.photonThickness},
      uEquatorialGlow: {value: tuning.equatorialGlow},
      uExposure: {value: tuning.exposure},
      uHotColorBoost: {value: tuning.hotColorBoost},
      uPointerStrength: {value: tuning.pointerStrength},
      uShowBackground: {value: settings.layers.background ? 1 : 0},
      uShowDisk: {value: settings.layers.raymarchedGas ? 1 : 0},
      uShowForeground: {value: settings.layers.foregroundGas ? 1 : 0},
      uShowPhotonRing: {value: settings.layers.photonRing ? 1 : 0},
      uShowEquatorial: {value: settings.layers.equatorialCurrent ? 1 : 0},
      uShowLensing: {value: settings.layers.lensing ? 1 : 0},
      uDebugView: {value: settings.debugView || 0},
      uResolution: {value: new THREE.Vector2(1, 1)},
      uCenter: {value: new THREE.Vector2(...settings.center)},
      uPointer: {value: new THREE.Vector2()},
      uOuterColor: {value: createRawColor(
        tuning.outerColor,
        [0.18, 0.045, 0.012]
      )},
      uMiddleColor: {value: createRawColor(
        tuning.middleColor,
        [1, 0.28, 0.045]
      )},
      uHotColor: {value: createRawColor(
        tuning.hotColor,
        [1.55, 1.08, 0.66]
      )}
    }
  }
  const uniforms = uniformsRef.current

  useEffect(() => {
    uniforms.uMotion.value = reducedMotion ? 0.18 : tuning.motionSpeed
    uniforms.uQuality.value = settings.shaderQuality
    uniforms.uScale.value = settings.scale
    uniforms.uHorizonScale.value = tuning.horizonScale
    uniforms.uLensingStrength.value = tuning.lensingStrength
    uniforms.uRotationSpeed.value = tuning.rotationSpeed
    uniforms.uNoiseSpeed.value = tuning.noiseSpeed
    uniforms.uGasDensity.value = tuning.gasDensity
    uniforms.uDiskThickness.value = tuning.diskThickness
    uniforms.uCloudScale.value = tuning.cloudScale
    uniforms.uFineDetail.value = tuning.fineDetail
    uniforms.uFilamentStrength.value = tuning.filamentStrength
    uniforms.uCloudBreakup.value = tuning.cloudBreakup
    uniforms.uForegroundThickness.value = tuning.foregroundThickness
    uniforms.uForegroundBreakup.value = tuning.foregroundBreakup
    uniforms.uGasDevelopment.value = tuning.gasDevelopment
    uniforms.uPhotonGlow.value = tuning.photonGlow
    uniforms.uPhotonThickness.value = tuning.photonThickness
    uniforms.uEquatorialGlow.value = tuning.equatorialGlow
    uniforms.uExposure.value = tuning.exposure
    uniforms.uHotColorBoost.value = tuning.hotColorBoost
    uniforms.uPointerStrength.value = tuning.pointerStrength
    uniforms.uShowBackground.value = settings.layers.background ? 1 : 0
    uniforms.uShowDisk.value = settings.layers.raymarchedGas ? 1 : 0
    uniforms.uShowForeground.value = settings.layers.foregroundGas ? 1 : 0
    uniforms.uShowPhotonRing.value = settings.layers.photonRing ? 1 : 0
    uniforms.uShowEquatorial.value = settings.layers.equatorialCurrent ? 1 : 0
    uniforms.uShowLensing.value = settings.layers.lensing ? 1 : 0
    uniforms.uDebugView.value = settings.debugView || 0
    uniforms.uCenter.value.set(...settings.center)
    uniforms.uOuterColor.value.copy(createRawColor(
      tuning.outerColor,
      [0.18, 0.045, 0.012]
    ))
    uniforms.uMiddleColor.value.copy(createRawColor(
      tuning.middleColor,
      [1, 0.28, 0.045]
    ))
    uniforms.uHotColor.value.copy(createRawColor(
      tuning.hotColor,
      [1.55, 1.08, 0.66]
    ))
  }, [reducedMotion, settings, tuning, uniforms])

  useEffect(() => {
    elapsedRef.current = 0
    uniforms.uTime.value = 0
  }, [resetToken, uniforms])

  useEffect(() => {
    const drawingBuffer = gl.getDrawingBufferSize(drawingBufferRef.current)
    uniforms.uResolution.value.set(drawingBuffer.x, drawingBuffer.y)
  }, [gl, size.height, size.width, uniforms])

  useFrame((_, delta) => {
    const material = materialRef.current
    if (!material) return
    const safeDelta = Math.min(Math.max(delta, 0), 1 / 30)
    if (active && !Number.isFinite(manualTime)) elapsedRef.current += safeDelta
    material.uniforms.uTime.value = Number.isFinite(manualTime)
      ? manualTime
      : elapsedRef.current
    material.uniforms.uMotion.value = reducedMotion ? 0.18 : tuning.motionSpeed
    smoothedPointerRef.current.x = THREE.MathUtils.damp(
      smoothedPointerRef.current.x,
      reducedMotion ? 0 : pointerRef.current.x,
      2.4,
      safeDelta
    )
    smoothedPointerRef.current.y = THREE.MathUtils.damp(
      smoothedPointerRef.current.y,
      reducedMotion ? 0 : pointerRef.current.y,
      2.4,
      safeDelta
    )
    material.uniforms.uPointer.value.copy(smoothedPointerRef.current)
  })

  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={blackHoleVertexShader}
        fragmentShader={blackHoleFragmentShader}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function createDustGeometry(count) {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const orbits = new Float32Array(count * 4)
  const variations = new Float32Array(count * 4)

  let seed = 0x84f10a3d
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  for (let index = 0; index < count; index += 1) {
    const radiusBias = Math.pow(random(), 0.72)
    const radius = 0.96 + radiusBias * 3.38
    const heat = 1 - THREE.MathUtils.smoothstep(radius, 0.95, 4.34)
    positions[index * 3] = 0
    positions[index * 3 + 1] = 0
    positions[index * 3 + 2] = 0
    orbits[index * 4] = radius
    orbits[index * 4 + 1] = random() * Math.PI * 2
    orbits[index * 4 + 2] = (0.46 + random() * 0.82) * (random() > 0.08 ? 1 : -1)
    orbits[index * 4 + 3] = (random() - 0.5) * (0.07 + radius * 0.022)
    variations[index * 4] = random() * 0.24
    variations[index * 4 + 1] = (random() - 0.5) * 0.075
    variations[index * 4 + 2] = 0.85 + Math.pow(random(), 2.6) * 3.4
    variations[index * 4 + 3] = THREE.MathUtils.clamp(heat * 0.78 + random() * 0.28, 0, 1)
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aOrbit', new THREE.BufferAttribute(orbits, 4))
  geometry.setAttribute('aVariation', new THREE.BufferAttribute(variations, 4))
  return geometry
}

function GravitationalDust({
  active,
  reducedMotion,
  settings,
  position,
  manualTime,
  resetToken
}) {
  const materialRef = useRef(null)
  const elapsedRef = useRef(0)
  const geometry = useMemo(() => createDustGeometry(settings.dust), [settings.dust])
  const uniforms = useMemo(() => ({
    uTime: {value: 0},
    uMotion: {value: reducedMotion ? 0.18 : 1},
    uPointScale: {value: settings.pointScale},
    uTilt: {value: settings.diskTilt},
    uRoll: {value: settings.roll},
    uBrightness: {value: settings.tuning.dustBrightness}
  }), [reducedMotion, settings.diskTilt, settings.pointScale, settings.roll, settings.tuning.dustBrightness])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    elapsedRef.current = 0
    if (materialRef.current) materialRef.current.uniforms.uTime.value = 0
  }, [resetToken])

  useFrame((_, delta) => {
    if (!materialRef.current) return
    const safeDelta = Math.min(Math.max(delta, 0), 1 / 30)
    if (active && !Number.isFinite(manualTime)) elapsedRef.current += safeDelta
    materialRef.current.uniforms.uTime.value = Number.isFinite(manualTime)
      ? manualTime
      : elapsedRef.current
  })

  return (
    <points geometry={geometry} position={position} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={gravitationalDustVertexShader}
        fragmentShader={gravitationalDustFragmentShader}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

function createAsteroidGeometry() {
  // Extra subdivisions preserve an irregular rock silhouette without exposing
  // the low-poly facets that were visible at desktop scale.
  const sourceGeometry = new THREE.IcosahedronGeometry(1, 3)
  const position = sourceGeometry.attributes.position
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const distortion = 0.82 + Math.sin(x * 7.1 + y * 11.3 + z * 5.7) * 0.1 + Math.sin((x - z) * 13.7) * 0.055
    position.setXYZ(index, x * distortion, y * distortion, z * distortion)
  }
  position.needsUpdate = true
  const geometry = mergeVertices(sourceGeometry, 0.0001)
  sourceGeometry.dispose()
  geometry.computeVertexNormals()
  return geometry
}

function createAsteroidOrbits(count) {
  let seed = 0x9e3779b9
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  return Array.from({length: count}, (_, index) => ({
    baseRadius: 2.15 + random() * 2.35,
    eccentricity: 0.08 + random() * 0.27,
    phase: random() * Math.PI * 2,
    speed: (0.18 + random() * 0.22) * (index % 4 === 0 ? -1 : 1),
    inclination: (random() - 0.5) * 0.38,
    verticalOffset: (random() - 0.5) * 0.28,
    scale: 0.08 + random() * 0.11,
    rotation: new THREE.Vector3(random() * Math.PI, random() * Math.PI, random() * Math.PI),
    angularVelocity: new THREE.Vector3(0.16 + random() * 0.2, 0.12 + random() * 0.16, 0.1 + random() * 0.2)
  }))
}

function WarpedAsteroids({active, reducedMotion, count, position, settings}) {
  const meshRef = useRef(null)
  const geometry = useMemo(createAsteroidGeometry, [])
  const orbits = useMemo(() => createAsteroidOrbits(count), [count])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const elapsedRef = useRef(0)

  useEffect(() => () => geometry.dispose(), [geometry])

  useEffect(() => {
    if (!meshRef.current) return
    orbits.forEach((_, index) => {
      color.set(index % 3 === 0 ? '#8aa0a8' : index % 3 === 1 ? '#536979' : '#3f5362')
      meshRef.current.setColorAt(index, color)
    })
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  }, [color, orbits])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const safeDelta = Math.min(Math.max(delta, 0), 1 / 30)
    if (active) elapsedRef.current += safeDelta * (reducedMotion ? 0.22 : 1)
    const time = elapsedRef.current

    orbits.forEach((orbit, index) => {
      const meanAngle = orbit.phase + time * orbit.speed * settings.orbitSpeedScale
      const radius = orbit.baseRadius * (1 - orbit.eccentricity * orbit.eccentricity) /
        Math.max(0.4, 1 + orbit.eccentricity * Math.cos(meanAngle))
      const gravitySpeed = 1 + 0.72 / Math.pow(Math.max(1.1, radius), 1.5)
      const angle = orbit.phase + time * orbit.speed * gravitySpeed * settings.orbitSpeedScale
      const nextRadius = orbit.baseRadius * (1 - orbit.eccentricity * orbit.eccentricity) /
        Math.max(0.4, 1 + orbit.eccentricity * Math.cos(angle))

      const x = Math.cos(angle) * nextRadius
      const z = Math.sin(angle) * nextRadius
      const y = Math.sin(angle * 1.13 + orbit.phase) * orbit.inclination + orbit.verticalOffset
      const tilt = settings.diskTilt
      const tiltedY = Math.cos(tilt) * y - Math.sin(tilt) * z
      const tiltedZ = Math.sin(tilt) * y + Math.cos(tilt) * z
      const rollCos = Math.cos(settings.roll)
      const rollSin = Math.sin(settings.roll)
      const rolledX = rollCos * x - rollSin * tiltedY
      const rolledY = rollSin * x + rollCos * tiltedY
      const projectedRadius = Math.hypot(rolledX, rolledY)
      const behind = tiltedZ < 0
      const lensing = behind ? Math.max(0, 1 - projectedRadius / 2.55) * 0.44 : 0

      dummy.position.set(
        rolledX * (1 + lensing),
        rolledY * (1 + lensing) + Math.sign(rolledY || 1) * lensing * 0.18,
        0.22 + Math.max(-0.3, tiltedZ * 0.08)
      )
      orbit.rotation.addScaledVector(
        orbit.angularVelocity,
        safeDelta * settings.spinSpeedScale * (active ? 1 : 0)
      )
      dummy.rotation.set(
        orbit.rotation.x,
        orbit.rotation.y,
        orbit.rotation.z
      )
      const proximityGlow = 1 + Math.max(0, 2.2 - nextRadius) * 0.18
      dummy.scale.setScalar(orbit.scale * proximityGlow)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, null, count]} position={position} frustumCulled={false} renderOrder={3}>
      <meshStandardMaterial
        vertexColors
        roughness={0.78}
        metalness={0.08}
        emissive="#132a35"
        emissiveIntensity={0.22}
        depthWrite={false}
      />
    </instancedMesh>
  )
}

const INDEPENDENT_ASTEROID_LAYOUT = [
  {position: [0.08, 0.28, 1.4], velocity: [0.055, -0.018, 0], scale: 0.16, phase: 0.3},
  {position: [0.2, 0.14, 1.55], velocity: [0.038, 0.026, 0], scale: 0.2, phase: 1.7},
  {position: [0.34, 0.22, 1.45], velocity: [-0.035, -0.014, 0], scale: 0.14, phase: 2.8},
  {position: [0.31, -0.08, 1.6], velocity: [-0.048, 0.016, 0], scale: 0.18, phase: 4.2},
  {position: [0.12, -0.22, 1.5], velocity: [-0.03, -0.024, 0], scale: 0.22, phase: 5.4}
]

function IndependentAsteroid({
  index,
  config,
  geometry,
  active,
  reducedMotion,
  blackHolePosition,
  bodiesRef
}) {
  const groupRef = useRef(null)
  const rockRef = useRef(null)
  const materialRef = useRef(null)
  const {camera, gl, size, viewport} = useThree()
  const velocityRef = useRef(new THREE.Vector3(...config.velocity))
  const pulseRef = useRef(0)
  const dragRef = useRef({
    active: false,
    pointerId: null,
    moved: false,
    plane: new THREE.Plane(),
    offset: new THREE.Vector3(),
    point: new THREE.Vector3(),
    previous: new THREE.Vector3(),
    lastTime: 0,
    captureTarget: null
  })
  const baseScaleRef = useRef(config.scale)
  const projectedRef = useRef(new THREE.Vector3())

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    group.position.set(
      viewport.width * config.position[0],
      viewport.height * config.position[1],
      config.position[2]
    )
  }, [config.position, viewport.height, viewport.width])

  useEffect(() => () => {
    if (gl.domElement.style.cursor === 'grab' || gl.domElement.style.cursor === 'grabbing') {
      gl.domElement.style.cursor = ''
    }
  }, [gl])

  useEffect(() => {
    bodiesRef.current[index] = {
      groupRef,
      velocityRef,
      dragRef,
      radius: config.scale * 0.88,
      mass: Math.max(0.001, Math.pow(config.scale, 3))
    }
    return () => {
      bodiesRef.current[index] = null
    }
  }, [bodiesRef, config.scale, index])

  const finishDrag = useCallback((pointerId) => {
    const drag = dragRef.current
    if (!drag.active || (pointerId != null && drag.pointerId !== pointerId)) return
    drag.active = false
    drag.pointerId = null
    gl.domElement.dataset.independentAsteroidInteraction = drag.moved ? 'released' : 'clicked'
    gl.domElement.style.cursor = ''
    gl.domElement.style.touchAction = ''
    const captureTarget = drag.captureTarget || gl.domElement
    try {
      if (pointerId != null) captureTarget.releasePointerCapture?.(pointerId)
    } catch {
      // Pointer capture may already be released by the browser.
    }
    drag.captureTarget = null
    if (!drag.moved) pulseRef.current = 0.42
  }, [gl])

  useEffect(() => {
    const handleGlobalPointerEnd = (event) => finishDrag(event.pointerId)
    const handleWindowBlur = () => finishDrag(null)
    window.addEventListener('pointerup', handleGlobalPointerEnd, true)
    window.addEventListener('pointercancel', handleGlobalPointerEnd, true)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerEnd, true)
      window.removeEventListener('pointercancel', handleGlobalPointerEnd, true)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [finishDrag])

  useFrame((_, delta) => {
    const group = groupRef.current
    const rock = rockRef.current
    if (!group || !rock) return
    const safeDelta = Math.min(Math.max(delta, 0), 1 / 30)
    if (!active) return

    const drag = dragRef.current
    if (!drag.active && !reducedMotion) {
      group.position.addScaledVector(velocityRef.current, safeDelta)
      group.position.y += Math.sin(performance.now() * 0.00018 + config.phase) * safeDelta * 0.018

      // The asteroids sit in front of the shader plane, so perspective makes
      // their projected travel larger than their world-space travel. These
      // tighter limits keep the complete rock visible when it rebounds.
      const xLimit = viewport.width * 0.39
      const yLimit = viewport.height * 0.36
      if (Math.abs(group.position.x) > xLimit) {
        group.position.x = THREE.MathUtils.clamp(group.position.x, -xLimit, xLimit)
        velocityRef.current.x *= -1
      }
      if (Math.abs(group.position.y) > yLimit) {
        group.position.y = THREE.MathUtils.clamp(group.position.y, -yLimit, yLimit)
        velocityRef.current.y *= -1
      }

      const dx = group.position.x - blackHolePosition[0]
      const dy = group.position.y - blackHolePosition[1]
      const distance = Math.hypot(dx, dy)
      if (distance < 1.62) {
        const push = (1.62 - distance) * 0.045
        velocityRef.current.x += (dx / Math.max(0.01, distance)) * push
        velocityRef.current.y += (dy / Math.max(0.01, distance)) * push
      }
      velocityRef.current.clampLength(0.02, 0.12)
    }

    rock.rotation.x += safeDelta * (0.08 + config.phase * 0.006)
    rock.rotation.y += safeDelta * (0.11 + config.phase * 0.004)
    pulseRef.current = THREE.MathUtils.damp(pulseRef.current, 0, 5.2, safeDelta)
    group.scale.setScalar(baseScaleRef.current * (1 + pulseRef.current))
    projectedRef.current.copy(group.position).project(camera)
    gl.domElement.dataset[`independentAsteroid${index}`] = `${(
      (projectedRef.current.x * 0.5 + 0.5) * size.width
    ).toFixed(1)},${(
      (-projectedRef.current.y * 0.5 + 0.5) * size.height
    ).toFixed(1)}`
  })

  const handlePointerDown = (event) => {
    if (!active) return
    event.stopPropagation()
    const group = groupRef.current
    if (!group) return
    const drag = dragRef.current
    drag.active = true
    drag.pointerId = event.pointerId
    drag.moved = false
    drag.lastTime = performance.now()
    drag.previous.copy(group.position)
    drag.plane.set(new THREE.Vector3(0, 0, 1), -group.position.z)
    if (event.ray.intersectPlane(drag.plane, drag.point)) {
      drag.offset.copy(group.position).sub(drag.point)
    } else {
      drag.offset.set(0, 0, 0)
    }
    velocityRef.current.set(0, 0, 0)
    gl.domElement.dataset.independentAsteroidInteraction = 'dragging'
    gl.domElement.style.cursor = 'grabbing'
    gl.domElement.style.touchAction = 'none'
    try {
      const captureTarget = event.target?.setPointerCapture ? event.target : gl.domElement
      captureTarget.setPointerCapture?.(event.pointerId)
      drag.captureTarget = captureTarget
    } catch {
      drag.captureTarget = null
      // The global pointer-end listeners still prevent a sticky drag if pointer
      // capture is unavailable in a browser or input device.
    }
  }

  const handlePointerMove = (event) => {
    const group = groupRef.current
    const drag = dragRef.current
    if (!group || !drag.active || drag.pointerId !== event.pointerId) return
    event.stopPropagation()
    if (!event.ray.intersectPlane(drag.plane, drag.point)) return
    const now = performance.now()
    const sampleDelta = Math.max(0.008, Math.min(0.08, (now - drag.lastTime) / 1000))
    drag.previous.copy(group.position)
    group.position.copy(drag.point).add(drag.offset)
    group.position.x = THREE.MathUtils.clamp(group.position.x, -viewport.width * 0.39, viewport.width * 0.39)
    group.position.y = THREE.MathUtils.clamp(group.position.y, -viewport.height * 0.36, viewport.height * 0.36)
    velocityRef.current.copy(group.position).sub(drag.previous).divideScalar(sampleDelta).clampLength(0, 0.38)
    drag.moved = drag.moved || group.position.distanceToSquared(drag.previous) > 0.00004
    drag.lastTime = now
    gl.domElement.dataset.independentAsteroidInteraction = 'moving'
  }

  return (
    <group
      ref={groupRef}
      position={[
        viewport.width * config.position[0],
        viewport.height * config.position[1],
        config.position[2]
      ]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        event.stopPropagation()
        finishDrag(event.pointerId)
      }}
      onPointerCancel={(event) => finishDrag(event.pointerId)}
      onLostPointerCapture={(event) => finishDrag(event.pointerId)}
      onPointerOver={(event) => {
        if (dragRef.current.active) return
        event.stopPropagation()
        gl.domElement.style.cursor = 'grab'
        if (materialRef.current) materialRef.current.emissiveIntensity = 0.42
      }}
      onPointerOut={() => {
        if (dragRef.current.active) return
        gl.domElement.style.cursor = ''
        if (materialRef.current) materialRef.current.emissiveIntensity = 0.16
      }}
    >
      <mesh ref={rockRef} geometry={geometry} dispose={null} renderOrder={5}>
        <meshStandardMaterial
          ref={materialRef}
          color="#405766"
          roughness={0.82}
          metalness={0.06}
          emissive="#174052"
          emissiveIntensity={0.16}
          depthWrite={false}
        />
      </mesh>
      <mesh renderOrder={6}>
        <sphereGeometry args={[1.65, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  )
}

function IndependentAsteroidField({active, reducedMotion, blackHolePosition}) {
  const geometry = useMemo(createAsteroidGeometry, [])
  const {gl} = useThree()
  const bodiesRef = useRef([])
  const collisionNormal = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    gl.domElement.dataset.independentAsteroids = String(INDEPENDENT_ASTEROID_LAYOUT.length)
    gl.domElement.dataset.independentAsteroidInteraction = 'idle'
    return () => {
      delete gl.domElement.dataset.independentAsteroids
      delete gl.domElement.dataset.independentAsteroidInteraction
    }
  }, [gl])

  useFrame(() => {
    const bodies = bodiesRef.current
    for (let firstIndex = 0; firstIndex < bodies.length; firstIndex += 1) {
      const first = bodies[firstIndex]
      const firstGroup = first?.groupRef.current
      if (!first || !firstGroup) continue

      for (let secondIndex = firstIndex + 1; secondIndex < bodies.length; secondIndex += 1) {
        const second = bodies[secondIndex]
        const secondGroup = second?.groupRef.current
        if (!second || !secondGroup) continue

        const dx = secondGroup.position.x - firstGroup.position.x
        const dy = secondGroup.position.y - firstGroup.position.y
        const minimumDistance = first.radius + second.radius
        const distanceSquared = dx * dx + dy * dy
        if (distanceSquared >= minimumDistance * minimumDistance) continue

        const distance = Math.max(0.0001, Math.sqrt(distanceSquared))
        collisionNormal.set(dx / distance, dy / distance, 0)
        const firstInverseMass = first.dragRef.current.active ? 0 : 1 / first.mass
        const secondInverseMass = second.dragRef.current.active ? 0 : 1 / second.mass
        const inverseMassSum = firstInverseMass + secondInverseMass

        if (inverseMassSum > 0) {
          const overlap = minimumDistance - distance
          firstGroup.position.addScaledVector(
            collisionNormal,
            -overlap * firstInverseMass / inverseMassSum
          )
          secondGroup.position.addScaledVector(
            collisionNormal,
            overlap * secondInverseMass / inverseMassSum
          )

          const relativeNormalSpeed = collisionNormal.dot(second.velocityRef.current) -
            collisionNormal.dot(first.velocityRef.current)
          if (relativeNormalSpeed < 0) {
            const restitution = 0.78
            const impulse = -(1 + restitution) * relativeNormalSpeed / inverseMassSum
            first.velocityRef.current.addScaledVector(
              collisionNormal,
              -impulse * firstInverseMass
            )
            second.velocityRef.current.addScaledVector(
              collisionNormal,
              impulse * secondInverseMass
            )
            first.velocityRef.current.clampLength(0.015, 0.22)
            second.velocityRef.current.clampLength(0.015, 0.22)
          }
        }
      }
    }
  })

  return INDEPENDENT_ASTEROID_LAYOUT.map((config, index) => (
    <IndependentAsteroid
      key={index}
      index={index}
      config={config}
      geometry={geometry}
      active={active}
      reducedMotion={reducedMotion}
      blackHolePosition={blackHolePosition}
      bodiesRef={bodiesRef}
    />
  ))
}

function SceneDiagnostics({
  active,
  quality,
  phase,
  readinessEpochRef,
  onReady,
  onStable,
  onError,
  onDiagnostics
}) {
  const {gl, size} = useThree()
  const frameRef = useRef(0)
  const readyEpochRef = useRef(-1)
  const stableEpochRef = useRef(-1)
  const stableStartRef = useRef(0)
  const callbacksRef = useRef({onReady, onStable, onError, onDiagnostics})
  const sampleRef = useRef({time: performance.now(), frame: 0})
  const drawingBufferRef = useRef(new THREE.Vector2())
  callbacksRef.current = {onReady, onStable, onError, onDiagnostics}

  useFrame((state) => {
    try {
      const epoch = readinessEpochRef.current
      frameRef.current += 1
      const canvas = gl.domElement
      const drawingBuffer = gl.getDrawingBufferSize(drawingBufferRef.current)
      canvas.dataset.contactAnimation = getAnimationDiagnostic(phase, active)
      canvas.dataset.contactQuality = quality
      canvas.dataset.contactPhase = phase
      canvas.dataset.contactFrame = String(frameRef.current)
      canvas.dataset.contactTime = state.clock.elapsedTime.toFixed(2)
      canvas.dataset.contactCssSize = `${Math.round(size.width)}x${Math.round(size.height)}`
      canvas.dataset.contactBufferSize = `${Math.round(drawingBuffer.x)}x${Math.round(drawingBuffer.y)}`
      canvas.dataset.contactTextures = String(gl.info.memory.textures)
      canvas.dataset.contactGeometries = String(gl.info.memory.geometries)
      canvas.dataset.contactPrograms = String(gl.info.programs?.length || 0)
      canvas.dataset.contactDrawCalls = String(gl.info.render.calls)
      canvas.dataset.contactTriangles = String(gl.info.render.triangles)
      canvas.dataset.contactRenderer = 'unified-raymarch'
      canvas.dataset.contactComposerCount = '0'
      canvas.dataset.contactContextState = 'ok'
      canvas.dataset.contactReadinessEpoch = String(epoch)

      const now = performance.now()
      const sample = sampleRef.current
      if (now - sample.time >= 450) {
        const elapsed = Math.max(1, now - sample.time)
        const sampledFrames = frameRef.current - sample.frame
        const fps = sampledFrames * 1000 / elapsed
        const frameTime = sampledFrames > 0 ? elapsed / sampledFrames : 0
        canvas.dataset.contactFps = fps.toFixed(1)
        canvas.dataset.contactFrameTime = frameTime.toFixed(2)
        callbacksRef.current.onDiagnostics?.({
          fps,
          frameTime,
          frame: frameRef.current,
          elapsedTime: state.clock.elapsedTime,
          cssSize: `${Math.round(size.width)}x${Math.round(size.height)}`,
          bufferSize: `${Math.round(drawingBuffer.x)}x${Math.round(drawingBuffer.y)}`,
          textures: gl.info.memory.textures,
          geometries: gl.info.memory.geometries,
          programs: gl.info.programs?.length || 0,
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          context: 'ok',
          animation: getAnimationDiagnostic(phase, active)
        })
        sampleRef.current = {time: now, frame: frameRef.current}
      }

      if (readyEpochRef.current !== epoch) {
        readyEpochRef.current = epoch
        stableStartRef.current = performance.now()
        callbacksRef.current.onReady?.({epoch, frame: frameRef.current})
      }
      if (stableEpochRef.current !== epoch && performance.now() - stableStartRef.current > 900) {
        stableEpochRef.current = epoch
        callbacksRef.current.onStable?.({epoch, frame: frameRef.current})
      }
    } catch (error) {
      callbacksRef.current.onError?.(error)
    }
  })

  return null
}

function UnifiedScene({
  active,
  reducedMotion,
  pointerRef,
  quality,
  phase,
  readinessEpochRef,
  onReady,
  onStable,
  onError,
  onDiagnostics,
  labConfig,
  debugView,
  manualTime,
  resetToken
}) {
  const baseSettings = CONTACT_QUALITY[quality]
  const {viewport} = useThree()
  const tuning = labConfig?.tuning || BLACK_HOLE_PRODUCTION_TUNING
  const layers = labConfig?.layers || BLACK_HOLE_LAYER_DEFAULTS
  const useExportedLayout = Boolean(labConfig) || quality === 'desktop'
  const settings = useMemo(() => ({
    ...baseSettings,
    shaderQuality: useExportedLayout
      ? tuning.raymarchQuality
      : baseSettings.shaderQuality,
    scale: baseSettings.scale * (useExportedLayout ? tuning.blackHoleScale : 1),
    center: useExportedLayout
      ? [tuning.centerX, tuning.centerY]
      : baseSettings.center,
    tuning,
    layers,
    debugView: debugView || 0
  }), [baseSettings, debugView, layers, tuning, useExportedLayout])
  const visualSettings = useMemo(() => ({
    ...settings,
    roll: 0,
    diskTilt: -0.34
  }), [settings])
  const sceneCenter = useMemo(() => [
    (settings.center[0] - 0.5) * viewport.width,
    (settings.center[1] - 0.5) * viewport.height,
    0.14
  ], [settings.center, viewport.height, viewport.width])

  return (
    <>
      <color attach="background" args={['#000107']} />
      <RaymarchedBlackHole
        active={active}
        reducedMotion={reducedMotion}
        pointerRef={pointerRef}
        settings={visualSettings}
        manualTime={manualTime}
        resetToken={resetToken}
      />
      <ambientLight intensity={0.3} color="#6a8190" />
      <directionalLight position={[3, 5, 6]} intensity={1.5} color="#ffd6a0" />
      <pointLight position={[sceneCenter[0] + 1.2, sceneCenter[1] + 0.3, 3]} intensity={8} distance={7} color="#ff7a21" />
      {layers.dust ? (
        <GravitationalDust
          active={active}
          reducedMotion={reducedMotion}
          settings={visualSettings}
          position={sceneCenter}
          manualTime={manualTime}
          resetToken={resetToken}
        />
      ) : null}
      {layers.boundAsteroids ? (
        <WarpedAsteroids
          active={active}
          reducedMotion={reducedMotion}
          count={settings.asteroids}
          position={sceneCenter}
          settings={settings}
        />
      ) : null}
      {quality === 'desktop' && layers.independentAsteroids ? (
        <>
          <IndependentAsteroidField
            active={active}
            reducedMotion={reducedMotion}
            blackHolePosition={sceneCenter}
          />
        </>
      ) : null}
      <SceneDiagnostics
        active={active}
        quality={quality}
        phase={phase}
        readinessEpochRef={readinessEpochRef}
        onReady={onReady}
        onStable={onStable}
        onError={onError}
        onDiagnostics={onDiagnostics}
      />
    </>
  )
}

export default function UnifiedBlackHoleCanvas({
  active,
  reducedMotion,
  pointerRef,
  quality,
  phase,
  onReady,
  onStable,
  onError,
  onContextLost,
  onContextRestored,
  onDiagnostics,
  labConfig = null,
  debugView = 0,
  manualTime = null,
  resetToken = 0
}) {
  const settings = CONTACT_QUALITY[quality]
  const readinessEpochRef = useRef(0)
  const contextBindingRef = useRef(null)
  const callbacksRef = useRef({onContextLost, onContextRestored})
  callbacksRef.current = {onContextLost, onContextRestored}

  const handleCreated = useCallback(({gl, invalidate}) => {
    gl.setClearColor(0x000107, 1)
    readinessEpochRef.current += 1
    const canvas = gl.domElement
    let attached = false

    const handleLost = (event) => {
      event.preventDefault()
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
    contextBindingRef.current?.detach()
    contextBindingRef.current = binding
    binding.attach()
    canvas.dataset.contactAnimation = 'initializing'
    canvas.dataset.contactPhase = 'INITIALIZING'
    canvas.dataset.contactContextState = 'ok'
    canvas.dataset.contactComposerCount = '0'
    canvas.dataset.contactReadinessEpoch = String(readinessEpochRef.current)
  }, [])

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
      camera={{position: [0, 0, 10], fov: quality === 'mobile' ? 44 : 38, near: 0.1, far: 40}}
      dpr={settings.dpr}
      frameloop="demand"
      gl={{alpha: false, antialias: true, powerPreference: 'high-performance'}}
      performance={{min: 0.55}}
      flat
      onCreated={handleCreated}
    >
      <ActiveFrameLoop active={active} />
      <Suspense fallback={null}>
        <UnifiedScene
          active={active}
          reducedMotion={reducedMotion}
          pointerRef={pointerRef}
          quality={quality}
          phase={phase}
          readinessEpochRef={readinessEpochRef}
          onReady={onReady}
          onStable={onStable}
          onError={onError}
          onDiagnostics={onDiagnostics}
          labConfig={labConfig}
          debugView={debugView}
          manualTime={manualTime}
          resetToken={resetToken}
        />
      </Suspense>
    </Canvas>
  )
}
