import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { createTimeline } from 'animejs'
import { useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import ActiveFrameLoop from './ActiveFrameLoop'
import HeroTesseractModel from './HeroTesseractModel'
import { useActiveNavSection } from './navigationState'
import {
  constrainTesseractToHand,
  constrainTesseractDrag,
  createTesseractInteraction,
  beginTesseractDrag,
  moveTesseractDrag,
  releaseTesseractDrag,
  stepTesseractInteraction,
  createTesseractChoreography,
  interruptTesseractChoreography,
  sampleTesseractEmergence,
  sampleTesseractPlayfulOrbit,
  sampleTesseractSubjectOrbit,
  stepTesseractChoreography,
  TESSERACT_ACTION_DURATIONS
} from './tesseractChoreography'

const colorThemes = [
  {
    outer: '#00D9FF',
    secondary: '#0099FF',
    inner: '#0055FF',
    core: '#00FFFF',
    ringA: '#00E5FF',
    ringB: '#0099FF',
    ringC: '#00FFDD'
  },
  {
    outer: '#A855F7',
    secondary: '#7C3AED',
    inner: '#4F46E5',
    core: '#E879F9',
    ringA: '#C084FC',
    ringB: '#818CF8',
    ringC: '#F0ABFC'
  },
  {
    outer: '#22C55E',
    secondary: '#14B8A6',
    inner: '#0EA5E9',
    core: '#A7F3D0',
    ringA: '#34D399',
    ringB: '#2DD4BF',
    ringC: '#7DD3FC'
  },
  {
    outer: '#F59E0B',
    secondary: '#F97316',
    inner: '#EF4444',
    core: '#FDE68A',
    ringA: '#FBBF24',
    ringB: '#FB923C',
    ringC: '#FDBA74'
  }
]

const angryTheme = {
  outer: '#FF001C',
  secondary: '#D50015',
  inner: '#79000B',
  core: '#FF0719',
  ringA: '#FF001C',
  ringB: '#D60013',
  ringC: '#F00018'
}

const fireTheme = {
  outer: '#FF6A13', secondary: '#FF8A19', inner: '#F44310',
  core: '#FFF0B1', ringA: '#FFB13B', ringB: '#FF671C', ringC: '#FFD271'
}

const overclockThemes = [
  { outer: '#A855F7', secondary: '#7C3AED', inner: '#4C1D95', core: '#E9D5FF', ringA: '#C084FC', ringB: '#A855F7', ringC: '#E879F9' },
  { outer: '#FACC15', secondary: '#EAB308', inner: '#A16207', core: '#FEF3C7', ringA: '#FDE047', ringB: '#FBBF24', ringC: '#FCD34D' },
  { outer: '#22C55E', secondary: '#16A34A', inner: '#166534', core: '#BBF7D0', ringA: '#4ADE80', ringB: '#34D399', ringC: '#86EFAC' },
  { outer: '#2563EB', secondary: '#0EA5E9', inner: '#1E40AF', core: '#BFDBFE', ringA: '#60A5FA', ringB: '#38BDF8', ringC: '#93C5FD' },
  { outer: '#EF4444', secondary: '#DC2626', inner: '#991B1B', core: '#FECACA', ringA: '#F87171', ringB: '#FB7185', ringC: '#FCA5A5' }
]

const TESSERACT_BASE_SCALE = 0.252
const TESSERACT_HOVER_SCALE = 0.94
const TESSERACT_LIMIT_SCALE = 1.12
const TESSERACT_COMPRESSION_SCALE = 0.78
const PULSE_BASE_SCALE = 1
const PULSE_FULL_TESSERACT_SCALE = 2.42

const easeInOut = (value) => value * value * (3 - 2 * value)
const clamp01 = (value) => THREE.MathUtils.clamp(value, 0, 1)
const mix = THREE.MathUtils.lerp
const createAnimeSignal = () => ({
  glow: 1,
  spin: 0,
  ring: 0,
  x: 0,
  y: 0,
  z: 0,
  compress: 0,
  spread: 0,
  pulse: 0
})
const idleAnimeSignal = createAnimeSignal()
const navModeProfiles = {
  home: { colorIndex: 0, glow: 1.18, spin: 0.75, ring: 1.2, x: 0, y: 0, z: 0, compress: 0, spread: 0.08, pulse: 0.34 },
  about: { colorIndex: 1, glow: 1.28, spin: 0.9, ring: 1.5, x: -0.14, y: 0.1, z: 0.08, compress: 0.08, spread: 0.16, pulse: 0.38 },
  skills: { colorIndex: 2, glow: 1.55, spin: 1.35, ring: 2.55, x: 0.12, y: 0.08, z: 0.02, compress: 0, spread: 0.72, pulse: 0.6 },
  projects: { colorIndex: 3, glow: 1.45, spin: 1.75, ring: 2.15, x: 0.18, y: -0.04, z: -0.08, compress: 0.02, spread: 0.42, pulse: 0.5 },
  services: { colorIndex: 1, glow: 1.5, spin: 1.15, ring: 2.75, x: -0.04, y: 0.04, z: 0.1, compress: 0.5, spread: 0.18, pulse: 0.64 },
  contact: { colorIndex: 0, glow: 1.38, spin: 1.05, ring: 2, x: 0.26, y: 0.02, z: 0, compress: 0, spread: 0.26, pulse: 0.44 }
}

const resetAnimeSignal = (signal) => {
  Object.assign(signal, createAnimeSignal())
}

const motionBlurGhosts = [0, 1, 2, 3, 4]
const orbitalTrailSamples = Array.from({length: 22}, (_, index) => index)

// Two complete miniature cores, not dots or isolated rings. Their monochrome
// materials are independent of the color cycling of the original tesseract.
function PlayfulTwins({frameRef, groupRef, compact}) {
  const pairRef = useRef()
  const twinsRef = useRef([])
  const particlesRef = useRef()
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3))
    return result
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame((_, delta) => {
    const frame = frameRef.current
    if (!pairRef.current || !frame || !groupRef.current) return
    pairRef.current.visible = frame.split > 0.001 || frame.particles > 0.001
    if (!pairRef.current.visible) return
    pairRef.current.position.copy(groupRef.current.position)
    const dt = Math.min(delta, 0.05)
    twinsRef.current.forEach((twin, index) => {
      if (!twin) return
      const sign = index === 0 ? 1 : -1
      twin.position.set(frame.x * sign, frame.y * sign, frame.z * sign)
      twin.scale.setScalar(0.2 * frame.split * (compact ? 1.3 : 1))
      twin.rotation.x += dt * frame.spin * sign * 0.47
      twin.rotation.y += dt * frame.spin * sign
      twin.rotation.z += dt * 0.6 * sign
    })
    const positions = geometry.attributes.position.array
    for (let index = 0; index < 48; index += 1) {
      const seed = index * 2.399963
      const sign = index % 2 === 0 ? 1 : -1
      const drift = ((frame.elapsed * 0.8 + index / 48) % 1)
      const radius = 0.08 + drift * 0.27
      positions[index * 3] = frame.x * sign + Math.cos(seed + frame.elapsed * 3) * radius
      positions[index * 3 + 1] = frame.y * sign + Math.sin(seed + frame.elapsed * 2) * radius
      positions[index * 3 + 2] = frame.z * sign + Math.sin(seed) * radius
    }
    geometry.attributes.position.needsUpdate = true
    particlesRef.current.material.opacity = frame.particles * 0.62
  })
  return <group ref={pairRef} visible={false}>
    {['#FFFDF2', '#BFC3CB'].map((color, index) => <group key={color} ref={(node) => { twinsRef.current[index] = node }}>
      <group scale={TESSERACT_BASE_SCALE}>
        {[3.5, 2.4, 1.5].map((size) => <mesh key={size} scale={size}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.95} toneMapped={false} depthWrite={false} />
        </mesh>)}
        <mesh scale={0.32}><icosahedronGeometry args={[1, 2]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
        {[0, 1, 2].map((ring) => <mesh key={ring} rotation={ring === 1 ? [Math.PI / 2.5, 0, 0] : ring === 2 ? [0, Math.PI / 3, 0] : [0, 0, 0]}>
          <torusGeometry args={[4 + ring * 0.5, 0.21, 10, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.94} toneMapped={false} depthWrite={false} />
        </mesh>)}
      </group>
    </group>)}
    <points ref={particlesRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#F5F5EF" size={0.035} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </points>
  </group>
}

function SubjectOrbitTrail({host, trailRefs}) {
  if (!host) return null
  return createPortal(<>
    {['back', 'front'].map((layer) => (
      <div key={layer} aria-hidden="true" data-core-trail={layer} style={{position: 'absolute', inset: 0, zIndex: layer === 'back' ? 0 : 3, pointerEvents: 'none'}}>
        {orbitalTrailSamples.map((index) => (
          <i key={index} ref={(node) => { trailRefs.current[layer][index] = node }} style={{
            position: 'absolute', left: 0, top: 0, width: 18, height: 18, margin: -9,
            borderRadius: '50%', opacity: 0, pointerEvents: 'none',
            background: 'radial-gradient(circle, #fff4c5 0%, #ffaf42 14%, #ff6a135f 34%, #ff5a101a 58%, transparent 74%)',
            boxShadow: '0 0 10px #ff6a1328', willChange: 'transform, opacity'
          }} />
        ))}
      </div>
    ))}
  </>, host)
}

function StarField() {
  const starsRef = useRef()
  const geometry = useMemo(() => {
    const positions = []

    for (let index = 0; index < 500; index += 1) {
      const angle = index * 2.399963
      const radius = 10 + (index % 80) * 0.55
      const height = -12 + ((index * 37) % 240) * 0.1

      positions.push(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius - 18
      )
    }

    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return starGeometry
  }, [])

  useFrame((_, dt) => {
    if (starsRef.current) starsRef.current.rotation.y += dt * 0.01
  })

  return (
    <points ref={starsRef} geometry={geometry}>
      <pointsMaterial
        color="#7DD3FC"
        size={0.045}
        transparent
        opacity={0.42}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function GatheringEnergy({ choreographyRef, active, reducedMotion }) {
  const pointsRef = useRef()
  const introRef = useRef({})
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3))
    return result
  }, [])
  const uniforms = useMemo(() => ({
    uOpacity: { value: 0 },
    uColor: { value: new THREE.Color('#97EDFF') }
  }), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    if (!pointsRef.current || !active || reducedMotion) {
      if (pointsRef.current) pointsRef.current.visible = false
      return
    }
    const time = choreographyRef.current.elapsed
    const intro = sampleTesseractEmergence(time, introRef.current)
    pointsRef.current.visible = intro.gathering > 0.005
    if (!pointsRef.current.visible) return

    const positions = geometry.attributes.position.array
    for (let index = 0; index < 48; index += 1) {
      const seed = ((index * 37) % 47) / 47
      const travel = (time * 0.8 + seed) % 1
      const angle = index * 2.399963 + time * 3.2
      const radius = (0.4 + seed * 0.65) * (1 - travel)
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = -1.65 + (intro.y + 1.65) * travel + Math.sin(angle) * radius * 0.23
      positions[index * 3 + 2] = Math.sin(angle) * radius * 0.5
    }
    geometry.attributes.position.needsUpdate = true
    uniforms.uOpacity.value = intro.gathering * 0.85
  })

  return (
    <points ref={pointsRef} geometry={geometry} visible={false} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = 35.0 / max(1.0, -viewPosition.z);
          }
        `}
        fragmentShader={`
          uniform float uOpacity;
          uniform vec3 uColor;
          void main() {
            float distanceToCenter = length(gl_PointCoord - vec2(0.5)) * 2.0;
            float glow = pow(max(0.0, 1.0 - distanceToCenter), 1.7);
            gl_FragColor = vec4(uColor, glow * uOpacity);
          }
        `}
      />
    </points>
  )
}

function RotatingTesseract({ hovered, activation, pointerRef, colorIndex, navSignal, clickSignal, anchored, active, reducedMotion, interactingRef, interactionRef, choreographyRef, containerRef, handGlowRef, bloomRef, portraitSceneRef, orbitalTrailRefs, viewportRef, hitTargetRef, twinHitRefs, invalidateRef }) {
  const renderSize = useThree((state) => state.size)
  const camera = useThree((state) => state.camera)
  const setDpr = useThree((state) => state.setDpr)
  const invalidate = useThree((state) => state.invalidate)
  const compact = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  const viewportScaleRef = useRef(1)
  const hitPointRef = useRef(new THREE.Vector3())
  useEffect(() => {
    invalidateRef.current = invalidate
    return () => { invalidateRef.current = null }
  }, [invalidate, invalidateRef])
  const emergenceRef = useRef()
  const introRef = useRef({})
  const localMotionRef = useRef({})
  const subjectOrbitRef = useRef({})
  const playfulOrbitRef = useRef({})
  const playfulFrameRef = useRef({split: 0, particles: 0})
  const trailPointRef = useRef({})
  const subjectTravelRef = useRef({x: 0, y: 0, scale: 1, behind: false, recoveringFromBack: false})
  const lightColorRef = useRef(new THREE.Color())
  const lastDiagnosticTimeRef = useRef(-1)
  const groupRef = useRef()
  const innerGroupRef = useRef()
  const outerCubeRef = useRef()
  const middleCubeRef = useRef()
  const innerCubeRef = useRef()
  const coreRef = useRef()
  const ringARef = useRef()
  const ringBRef = useRef()
  const ringCRef = useRef()
  const pulseRef = useRef()
  const motionBlurRefs = useRef([])
  const motionBlurMaterialsRef = useRef([])
  const outerMaterialRef = useRef()
  const middleMaterialRef = useRef()
  const innerMaterialRef = useRef()
  const coreMaterialRef = useRef()
  const ringAMaterialRef = useRef()
  const ringBMaterialRef = useRef()
  const ringCMaterialRef = useRef()
  const outerEdgeMaterialRef = useRef()
  const middleEdgeMaterialRef = useRef()
  const innerEdgeMaterialRef = useRef()
  const spinBoostRef = useRef(0)
  const rageBoostRef = useRef(0)
  const ringSurgeRef = useRef(0)
  const targetScaleRef = useRef(new THREE.Vector3(1, 1, 1))
  const materialColorRef = useRef(new THREE.Color())
  const overclockColorRef = useRef(new THREE.Color())
  const nextOverclockColorRef = useRef(new THREE.Color())
  const lastActivationRef = useRef(activation)
  const theme = colorThemes[colorIndex % colorThemes.length]
  const setMotionBlurMaterial = (ghostIndex, materialIndex) => (material) => {
    if (!motionBlurMaterialsRef.current[ghostIndex]) {
      motionBlurMaterialsRef.current[ghostIndex] = []
    }

    motionBlurMaterialsRef.current[ghostIndex][materialIndex] = material
  }

  useFrame((_, frameDelta) => {
    const pointer = pointerRef.current
    const interaction = stepTesseractInteraction(interactionRef.current, frameDelta, active && !reducedMotion)
    const angry = interaction.phase === 'charging' || interaction.phase === 'burst'
    const limitCharge = interaction.charge * 3
    const choreography = stepTesseractChoreography(choreographyRef.current, frameDelta, {
      active,
      reducedMotion,
      interacting: interactingRef.current || angry
    })
    const intro = sampleTesseractEmergence(choreography.elapsed, introRef.current)
    const time = reducedMotion ? 0 : choreography.elapsed
    const dt = active && !reducedMotion ? Math.min(frameDelta, 0.05) : 0
    const autonomousAction = choreography.action
    if (!autonomousAction) interaction.ownsTravel = false
    const actionWeight = autonomousAction?.weight ?? 1
    const actionEnvelope = autonomousAction
      ? THREE.MathUtils.smoothstep(autonomousAction.elapsed, 0, 0.5)
        * (1 - THREE.MathUtils.smoothstep(autonomousAction.elapsed, TESSERACT_ACTION_DURATIONS[autonomousAction.type] - 0.6, TESSERACT_ACTION_DURATIONS[autonomousAction.type])) * actionWeight
      : 0

    if (emergenceRef.current) {
      emergenceRef.current.visible = intro.visible
      emergenceRef.current.position.y = intro.y
      emergenceRef.current.scale.setScalar(intro.scale)
    }
    if (containerRef.current && (Math.abs(choreography.elapsed - lastDiagnosticTimeRef.current) > 0.1 || !active)) {
      containerRef.current.dataset.corePhase = choreography.phase
      containerRef.current.dataset.coreAction = autonomousAction?.type || 'idle'
      containerRef.current.dataset.coreElapsed = choreography.elapsed.toFixed(2)
      containerRef.current.dataset.coreActionTime = (autonomousAction?.elapsed || 0).toFixed(2)
      lastDiagnosticTimeRef.current = choreography.elapsed
    }
    if (!active && !reducedMotion) return

    if (lastActivationRef.current !== activation) {
      spinBoostRef.current = 1.85
      lastActivationRef.current = activation
    }

    spinBoostRef.current = Math.max(0, spinBoostRef.current - dt * 2.4)
    rageBoostRef.current = Math.max(0, rageBoostRef.current - dt * 2.8)
    ringSurgeRef.current = Math.max(0, ringSurgeRef.current - dt * 0.28)
    const boost = spinBoostRef.current
    const rageBoost = rageBoostRef.current
    const ringSurge = ringSurgeRef.current > 1
      ? 2 - ringSurgeRef.current
      : ringSurgeRef.current
    const hoverEnergy = hovered ? 1.18 : 1
    const chargeSpin = THREE.MathUtils.smoothstep(limitCharge, 0.1, 3) * 52
    const burstSpin = rageBoost * 18
    const surgeSpin = THREE.MathUtils.smoothstep(ringSurge, 0, 1) * 46
    const actionType = autonomousAction?.type
    const actionTime = autonomousAction?.elapsed || 0
    const actionSeed = autonomousAction?.seed || 0
    const overclockIndex = Math.floor(actionTime * 4.5 + actionSeed) % overclockThemes.length
    const overclockBlend = easeInOut((actionTime * 4.5 + actionSeed) % 1)
    const overclockTheme = overclockThemes[overclockIndex]
    const nextOverclockTheme = overclockThemes[(overclockIndex + 1) % overclockThemes.length]
    const activeTheme = { ...theme }
    const playful = playfulFrameRef.current
    playful.split = 0
    playful.particles = 0
    let autoSpin = 0
    let autoRingSpin = 0
    let autoGlow = 1
    let autoX = 0
    let autoY = 0
    let autoZ = 0
    let compressionScale = 1
    let reconfigureSpread = 0
    let pulseOpacity = 0
    let expressionScale = hovered ? TESSERACT_HOVER_SCALE : 1
    let pulseSphereScale = PULSE_BASE_SCALE
    let motionBlurStrength = 0
    const navChoreo = navSignal || idleAnimeSignal
    const clickChoreo = clickSignal || idleAnimeSignal
    const choreoGlow = (navChoreo.glow - 1) + (clickChoreo.glow - 1)

    autoGlow += choreoGlow
    autoSpin += navChoreo.spin + clickChoreo.spin
    autoRingSpin += navChoreo.ring + clickChoreo.ring
    autoX += navChoreo.x + clickChoreo.x
    autoY += navChoreo.y + clickChoreo.y
    autoZ += navChoreo.z + clickChoreo.z
    compressionScale *= Math.max(0.58, 1 - clickChoreo.compress * 0.45)
    reconfigureSpread += navChoreo.spread + clickChoreo.spread
    pulseOpacity += navChoreo.pulse + clickChoreo.pulse
    const baseline = {autoGlow, autoSpin, autoRingSpin, autoX, autoY, autoZ, compressionScale, reconfigureSpread, pulseOpacity, expressionScale, pulseSphereScale}

    if (actionType === 'ascension') {
      const subjectOrbit = sampleTesseractSubjectOrbit(actionTime, subjectOrbitRef.current)
      autoGlow += subjectOrbit.glow
      autoSpin += subjectOrbit.spin
      autoRingSpin += subjectOrbit.ringSpin
      // Charging remains exactly over the hand. The wide journey belongs to
      // the portrait plane below, outside this local camera and hand clamp.
      autoX = 0
      autoY = 0
      autoZ = 0
      Object.keys(activeTheme).forEach((key) => {
        activeTheme[key] = overclockColorRef.current.set(theme[key]).lerp(nextOverclockColorRef.current.set(fireTheme[key]), subjectOrbit.fire).getStyle()
      })
    }

    if (actionType === 'orbit') {
      const playfulOrbit = sampleTesseractPlayfulOrbit(actionTime, playfulOrbitRef.current)
      const shake = playfulOrbit.shake * actionWeight
      autoX += Math.sin(actionTime * 91) * 0.11 * shake
      autoY += Math.cos(actionTime * 79) * 0.095 * shake
      autoZ += Math.sin(actionTime * 87) * 0.04 * shake
      autoSpin += playfulOrbit.spin * playfulOrbit.amount
      autoRingSpin += playfulOrbit.amount * 9 + shake * 16
      autoGlow += 0.7 * playfulOrbit.amount + shake
      expressionScale *= playfulOrbit.scale
      Object.assign(playful, playfulOrbit, {split: playfulOrbit.split * actionWeight, particles: playfulOrbit.particles * actionWeight, x: playfulOrbit.x * actionWeight, y: playfulOrbit.y * actionWeight, z: playfulOrbit.z * actionWeight, elapsed: actionTime})
      Object.keys(activeTheme).forEach((key) => {
        activeTheme[key] = overclockColorRef.current.set(activeTheme[key]).lerp(nextOverclockColorRef.current.set('#FFFDF2'), playfulOrbit.white * actionWeight).getStyle()
      })
    }

    if (actionType === 'compression') {
      const compress = 1 - easeInOut(clamp01(actionTime / 0.22))
      const held = actionTime < 1.5 ? 1 : 1 - easeInOut(clamp01((actionTime - 1.5) / 0.32))
      const sphereIntro = easeInOut(clamp01(actionTime / 0.75))
      const overclock = clamp01((actionTime - 1.55) / 0.35) * (1 - clamp01((actionTime - 7.2) / 0.8))

      compressionScale = Math.max(0.18, compress + held * 0.18)
      if (actionTime > 1.5) compressionScale = mix(0.22, 1.08, easeInOut(clamp01((actionTime - 1.5) / 0.28)))
      expressionScale *= mix(1, TESSERACT_COMPRESSION_SCALE, sphereIntro * (1 - overclock * 0.35))
      autoGlow += held * 1.8 + overclock * 1.1
      autoSpin += held * 2 + overclock * 10
      autoRingSpin += held * 10 + overclock * 24
      pulseOpacity = sphereIntro * (held * 0.48 + overclock * (0.24 + Math.sin(time * 10) * 0.08))
      pulseSphereScale = mix(PULSE_BASE_SCALE, PULSE_FULL_TESSERACT_SCALE, sphereIntro) * (1 + overclock * 0.08 + Math.sin(time * 8.5) * pulseOpacity * 0.04)

      if (overclock > 0) {
        Object.keys(activeTheme).forEach((key) => {
          activeTheme[key] = overclockColorRef.current.set(overclockTheme[key]).lerp(nextOverclockColorRef.current.set(nextOverclockTheme[key]), overclockBlend).getStyle()
        })
      }
    }

    if (actionType === 'reconfigure') {
      const separate = easeInOut(clamp01(actionTime / 0.85))
      const reassemble = easeInOut(clamp01((actionTime - 3.5) / 0.95))

      reconfigureSpread = separate * (1 - reassemble)
      autoGlow += reconfigureSpread * 0.7
      autoSpin += reconfigureSpread * 1.4
      autoRingSpin += reconfigureSpread * 8
    }

    // Keep the interrupted action at its exact frame while its contribution
    // fades. This includes split geometry, scale, color, rings and the big lap.
    autoGlow = mix(baseline.autoGlow, autoGlow, actionWeight)
    autoSpin = mix(baseline.autoSpin, autoSpin, actionWeight)
    autoRingSpin = mix(baseline.autoRingSpin, autoRingSpin, actionWeight)
    autoX = mix(baseline.autoX, autoX, actionWeight)
    autoY = mix(baseline.autoY, autoY, actionWeight)
    autoZ = mix(baseline.autoZ, autoZ, actionWeight)
    compressionScale = mix(baseline.compressionScale, compressionScale, actionWeight)
    reconfigureSpread = mix(baseline.reconfigureSpread, reconfigureSpread, actionWeight)
    pulseOpacity = mix(baseline.pulseOpacity, pulseOpacity, actionWeight)
    expressionScale = mix(baseline.expressionScale, expressionScale, actionWeight)
    pulseSphereScale = mix(baseline.pulseSphereScale, pulseSphereScale, actionWeight)
    Object.keys(activeTheme).forEach((key) => {
      activeTheme[key] = overclockColorRef.current.set(theme[key]).lerp(nextOverclockColorRef.current.set(activeTheme[key]), actionWeight).lerp(materialColorRef.current.set(angryTheme[key]), interaction.red).getStyle()
    })
    const resistancePulse = angry ? Math.pow(0.5 + Math.sin(time * (8 + interaction.charge * 13)) * 0.5, 2) : 0
    autoGlow += interaction.red * (0.8 + resistancePulse * 2)

    const subjectOrbit = actionType === 'ascension' ? subjectOrbitRef.current : null
    const scene = portraitSceneRef.current
    if (anchored && scene) {
      const travel = subjectTravelRef.current
      const targetX = (subjectOrbit && !interaction.ownsTravel ? subjectOrbit.x * scene.width * actionWeight : 0) + interaction.x
      const targetY = (subjectOrbit && !interaction.ownsTravel ? subjectOrbit.y * scene.height * actionWeight : 0) + interaction.y
      const targetScale = subjectOrbit ? mix(1, subjectOrbit.scale, actionWeight) : 1
      // An autonomous lap follows its exact timeline. If the visitor catches
      // the moving core, its interrupted position eases back to the palm.
      const follow = subjectOrbit && !autonomousAction.stopping || reducedMotion ? 1 : 1 - Math.exp(-(interaction.phase === 'dragging' || interaction.phase === 'charging' ? 24 : 12) * dt)
      travel.x = mix(travel.x, targetX, follow)
      travel.y = mix(travel.y, targetY, follow)
      travel.scale = mix(travel.scale, targetScale, follow)
      if (Math.abs(travel.x) + Math.abs(travel.y) < 0.01) {
        travel.x = 0
        travel.y = 0
      }
      if (autonomousAction?.stopping && travel.behind) travel.recoveringFromBack = true
      let depthOpacity = 1
      if (travel.recoveringFromBack && autonomousAction?.stopping) {
        const stopTime = autonomousAction.stopElapsed
        // The opaque portrait is the occluder. Switching layers in its middle
        // would pop the core into view, so change depth only during this short
        // invisible interval and then rematerialize as it returns to the hand.
        depthOpacity = stopTime < 0.3 ? 1 - THREE.MathUtils.smoothstep(stopTime, 0, 0.28)
          : THREE.MathUtils.smoothstep(stopTime, 0.35, 0.85)
        travel.behind = stopTime < 0.3
      } else {
        travel.recoveringFromBack = false
        travel.behind = subjectOrbit ? subjectOrbit.behind : false
      }
      if (viewportRef.current) viewportRef.current.style.opacity = String(depthOpacity)
      scene.visualX = travel.x
      scene.visualY = travel.y
      scene.anchor.style.transform = `translate3d(${travel.x.toFixed(2)}px, ${travel.y.toFixed(2)}px, 0) scale(${travel.scale.toFixed(4)})`
      scene.anchor.style.zIndex = travel.behind ? '0' : '3'
      containerRef.current.dataset.coreOrbitDepth = travel.behind ? 'behind' : 'front'
      containerRef.current.dataset.coreOrbitAngle = (subjectOrbit?.angle || 0).toFixed(4)

      orbitalTrailSamples.forEach((index) => {
        const point = sampleTesseractSubjectOrbit(actionTime - (index + 1) * 0.028, trailPointRef.current)
        const opacity = subjectOrbit && point.orbiting
          ? subjectOrbit.trail * Math.pow(1 - index / orbitalTrailSamples.length, 1.35) * 0.86 * actionWeight : 0
        const transform = `translate3d(${(scene.anchorX + point.x * scene.width).toFixed(2)}px, ${(scene.anchorY + point.y * scene.height).toFixed(2)}px, 0) scale(${((scene.coreWidth / 280) * point.scale * (1.2 - index * 0.024)).toFixed(3)})`
        const front = orbitalTrailRefs.current.front[index]
        const back = orbitalTrailRefs.current.back[index]
        if (front) {
          front.style.transform = transform
          front.style.opacity = point.behind ? '0' : String(opacity)
        }
        if (back) {
          back.style.transform = transform
          back.style.opacity = point.behind ? String(opacity * 0.7) : '0'
        }
      })

      const lightHex = lightColorRef.current.set(activeTheme.ringA).getHex()
      const lightEnergy = reducedMotion ? 0.06 : Math.min(1.3,
        actionEnvelope * (0.55 + Math.max(0, autoGlow - 1) * 0.25)
        + interaction.red * (0.36 + resistancePulse * 0.3)
        + (intro.ready ? 0.055 : intro.handGlow * 0.68))
      scene.portrait.style.setProperty('--core-light-r', String((lightHex >> 16) & 255))
      scene.portrait.style.setProperty('--core-light-g', String((lightHex >> 8) & 255))
      scene.portrait.style.setProperty('--core-light-b', String(lightHex & 255))
      scene.portrait.style.setProperty('--core-light-energy', String(lightEnergy * (travel.behind ? 0.58 : 1)))
      scene.portrait.style.setProperty('--core-light-x', `${((scene.anchorX + travel.x) / scene.width * 100).toFixed(2)}%`)
      scene.portrait.style.setProperty('--core-light-y', `${((scene.anchorY + travel.y) / scene.height * 100).toFixed(2)}%`)
      scene.portrait.dataset.coreLightAction = actionType || choreography.phase
      containerRef.current.style.setProperty('--core-glow-r', String((lightHex >> 16) & 255))
      containerRef.current.style.setProperty('--core-glow-g', String((lightHex >> 8) & 255))
      containerRef.current.style.setProperty('--core-glow-b', String(lightHex & 255))
      // The expensive wider drawing surface is only used for the brief angry
      // expansion. Camera compensation preserves the core's normal pixel size.
      const wideViewport = interaction.charge > 0.84 || interaction.phase === 'burst'
      const viewportScale = wideViewport ? 6 : 1
      if (viewportRef.current && viewportScaleRef.current !== viewportScale) {
        viewportScaleRef.current = viewportScale
        viewportRef.current.style.width = `${viewportScale * 100}%`
        viewportRef.current.style.height = `${viewportScale * 100}%`
        viewportRef.current.style.left = `${(1 - viewportScale) * 50}%`
        viewportRef.current.style.top = `${(1 - viewportScale) * 50}%`
      }
      const actualScale = renderSize.width / scene.coreWidth
      const cameraDistance = 8 * Math.max(1, actualScale)
      if (Math.abs(camera.position.z - cameraDistance) > 0.01) {
        camera.position.z = cameraDistance
        camera.updateProjectionMatrix()
        setDpr(Math.min(window.devicePixelRatio || 1, wideViewport ? 1 : 1.5, 2200 / Math.max(renderSize.width, 1)))
      }
      if (hitTargetRef.current) {
        const targetSize = 52 * Math.max(0.2, expressionScale)
        hitTargetRef.current.style.width = `${targetSize}%`
        hitTargetRef.current.style.height = `${targetSize}%`
        hitTargetRef.current.style.left = `${50 - targetSize / 2}%`
        hitTargetRef.current.style.top = `${50 - targetSize / 2}%`
        hitTargetRef.current.style.pointerEvents = playful.split > 0.5 ? 'none' : 'auto'
      }
      twinHitRefs.current.forEach((target, index) => {
        if (!target) return
        const visible = playful.split > 0.15
        target.style.pointerEvents = visible ? 'auto' : 'none'
        if (!visible || !groupRef.current) return
        const sign = index === 0 ? 1 : -1
        const point = hitPointRef.current.set(
          groupRef.current.position.x + playful.x * sign,
          groupRef.current.position.y + playful.y * sign,
          groupRef.current.position.z + playful.z * sign
        ).project(camera)
        // Each tiny core has its own tight target; the empty area between the
        // pair remains available to the floor and other hero interactions.
        const targetSize = 13 * Math.max(0.45, playful.split)
        target.style.width = `${targetSize}%`
        target.style.height = `${targetSize}%`
        target.style.left = `${(point.x * 0.5 + 0.5) * 100 - targetSize / 2}%`
        target.style.top = `${(-point.y * 0.5 + 0.5) * 100 - targetSize / 2}%`
      })
      containerRef.current.dataset.coreAngerCount = String(interaction.angerCount)
      containerRef.current.dataset.coreInteraction = interaction.phase
      containerRef.current.dataset.coreCharge = interaction.charge.toFixed(3)
      containerRef.current.dataset.corePlayfulPhase = actionType === 'orbit' ? playful.phase : 'idle'
      containerRef.current.dataset.coreTwins = playful.split > 0.01 ? '2' : '0'
    }
    if (handGlowRef.current) handGlowRef.current.style.opacity = String((subjectOrbit?.orbiting ? 0 : intro.handGlow) * (hovered ? 0.85 : 0.72) + (subjectOrbit?.orbiting ? 0 : actionEnvelope * 0.17))
    if (bloomRef.current) bloomRef.current.style.opacity = String(intro.bloom * (hovered ? 1 : 0.68) + actionEnvelope * (actionType === 'ascension' ? 0.56 : 0.2))

    reconfigureSpread = Math.min(reconfigureSpread, 1.15)
    pulseOpacity = Math.min(pulseOpacity, 0.95)
    motionBlurStrength = Math.min(motionBlurStrength, 1)

    const ringEnergy = 1 + chargeSpin + burstSpin + surgeSpin + autoRingSpin

    if (groupRef.current) {
      groupRef.current.visible = playful.split < 0.999
      const attractionX = hovered ? pointer.x * 0.45 : 0
      const attractionY = hovered ? pointer.y * 0.35 : 0
      const shakeStrength = angry && !reducedMotion ? 0.09 + rageBoost * 0.2 : 0
      const shakeX = Math.sin(time * 58) * shakeStrength
      const shakeY = Math.cos(time * 51) * shakeStrength * 0.7
      const targetX = attractionX + shakeX + autoX + (!anchored ? interaction.x : 0)
      const targetY = Math.sin(time * 0.5) * (anchored ? 0.08 : 0.3) + attractionY + shakeY + autoY + (!anchored ? interaction.y : 0)
      const localMotion = anchored
        ? constrainTesseractToHand(targetX, targetY, autoZ, localMotionRef.current)
        : {x: targetX, y: targetY, z: autoZ}
      const smoothing = reducedMotion ? 1 : 1 - Math.exp(-(angry ? 28 : actionType ? 10 : 5) * dt)

      groupRef.current.rotation.y += dt * 0.35 * (1 + boost + rageBoost * 3.5 + autoSpin) * hoverEnergy
      groupRef.current.rotation.x += Math.sin(time * 0.5) * dt * 0.3 * hoverEnergy + rageBoost * dt * 1.2 + autoSpin * dt * 0.42
      groupRef.current.rotation.z += Math.cos(time * 0.4) * dt * 0.2

      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, localMotion.x, smoothing)
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, localMotion.y, smoothing)
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, localMotion.z, smoothing)

      const limitStretch = mix(1, TESSERACT_LIMIT_SCALE, THREE.MathUtils.smoothstep(limitCharge, 0.12, 1.8))
      const targetScale = interaction.phase === 'burst' ? interaction.scale : expressionScale * limitStretch
      targetScaleRef.current.set(targetScale, targetScale, targetScale)
      groupRef.current.scale.lerp(targetScaleRef.current, reducedMotion || interaction.phase === 'burst' ? 1 : angry ? 0.42 : 0.14)
      if (containerRef.current) containerRef.current.dataset.coreVisualScale = groupRef.current.scale.x.toFixed(3)
    }

    if (innerGroupRef.current) {
      innerGroupRef.current.rotation.y -= dt * 0.25 * (1 + boost * 0.55 + autoSpin * 0.55)
      innerGroupRef.current.rotation.x -= dt * 0.15 * hoverEnergy
      const innerPulse = 1 + Math.sin(time * hoverEnergy) * 0.08
      innerGroupRef.current.scale.setScalar(innerPulse * compressionScale)
    }

    if (outerCubeRef.current) {
      outerCubeRef.current.position.set(reconfigureSpread * 1.15, reconfigureSpread * 0.7, 0)
      outerCubeRef.current.rotation.y += dt * reconfigureSpread * 1.7
      outerCubeRef.current.rotation.x += dt * reconfigureSpread * 0.8
      outerCubeRef.current.rotation.x = THREE.MathUtils.lerp(outerCubeRef.current.rotation.x, 0, (1 - reconfigureSpread) * 0.16)
      outerCubeRef.current.rotation.y = THREE.MathUtils.lerp(outerCubeRef.current.rotation.y, 0, (1 - reconfigureSpread) * 0.16)
      outerCubeRef.current.rotation.z = THREE.MathUtils.lerp(outerCubeRef.current.rotation.z, 0, (1 - reconfigureSpread) * 0.16)
    }

    if (middleCubeRef.current) {
      middleCubeRef.current.position.set(-reconfigureSpread * 1, -reconfigureSpread * 0.4, reconfigureSpread * 0.3)
      middleCubeRef.current.rotation.x -= dt * reconfigureSpread * 1.4
      middleCubeRef.current.rotation.z += dt * reconfigureSpread
      middleCubeRef.current.rotation.x = THREE.MathUtils.lerp(middleCubeRef.current.rotation.x, 0, (1 - reconfigureSpread) * 0.16)
      middleCubeRef.current.rotation.y = THREE.MathUtils.lerp(middleCubeRef.current.rotation.y, 0, (1 - reconfigureSpread) * 0.16)
      middleCubeRef.current.rotation.z = THREE.MathUtils.lerp(middleCubeRef.current.rotation.z, 0, (1 - reconfigureSpread) * 0.16)
    }

    if (innerCubeRef.current) {
      innerCubeRef.current.position.set(0, reconfigureSpread * 1.05, -reconfigureSpread * 0.4)
      innerCubeRef.current.rotation.y -= dt * reconfigureSpread * 2
      innerCubeRef.current.rotation.x = THREE.MathUtils.lerp(innerCubeRef.current.rotation.x, 0, (1 - reconfigureSpread) * 0.16)
      innerCubeRef.current.rotation.y = THREE.MathUtils.lerp(innerCubeRef.current.rotation.y, 0, (1 - reconfigureSpread) * 0.16)
      innerCubeRef.current.rotation.z = THREE.MathUtils.lerp(innerCubeRef.current.rotation.z, 0, (1 - reconfigureSpread) * 0.16)
    }

    if (coreRef.current) {
      const corePulse = 1 + (autoGlow - 1) * 0.18 + Math.sin(time * 7) * pulseOpacity * 0.18
      coreRef.current.scale.setScalar(0.3 * corePulse)
    }

    if (ringARef.current) {
      ringARef.current.rotation.z += dt * 0.11 * hoverEnergy * ringEnergy
      ringARef.current.rotation.x += dt * 0.03 * (1 + chargeSpin * 0.8 + burstSpin)
      ringARef.current.scale.setScalar(1 + interaction.red * (resistancePulse - 0.4) * 0.22)
    }

    if (ringBRef.current) {
      ringBRef.current.rotation.y -= dt * 0.075 * hoverEnergy * ringEnergy
      ringBRef.current.rotation.z += dt * 0.02 * (1 + chargeSpin + burstSpin)
      ringBRef.current.scale.setScalar(1 - interaction.red * (resistancePulse - 0.5) * 0.24)
    }

    if (ringCRef.current) {
      ringCRef.current.rotation.x += dt * 0.06 * hoverEnergy * ringEnergy
      ringCRef.current.rotation.y += dt * 0.035 * (1 + chargeSpin * 0.9 + burstSpin)
      ringCRef.current.scale.setScalar(1 + interaction.red * Math.sin(time * 17) * 0.14)
    }

    if (pulseRef.current) {
      pulseRef.current.scale.setScalar(pulseSphereScale)
      pulseRef.current.material.opacity = pulseOpacity
    }

    motionBlurRefs.current.forEach((ghost, index) => {
      if (!ghost) return

      const depth = index + 1
      const opacity = motionBlurStrength * ((compact ? 0.15 : 0.32) / depth)
      ghost.visible = opacity > 0.01
      ghost.position.x = Math.sin(actionSeed + depth * 1.7) * motionBlurStrength * 0.04 * depth
      ghost.position.y = -0.42 * depth * (1 + motionBlurStrength * 0.9)
      ghost.position.z = -0.04 * depth
      ghost.rotation.x = -motionBlurStrength * depth * 0.025
      ghost.rotation.y = motionBlurStrength * depth * 0.045
      ghost.rotation.z = Math.sin(actionSeed + depth) * motionBlurStrength * 0.018
      ghost.scale.set(
        1 + motionBlurStrength * depth * 0.025,
        1 + motionBlurStrength * (0.24 + depth * 0.13),
        1 - motionBlurStrength * Math.min(0.18, depth * 0.018)
      )

      motionBlurMaterialsRef.current[index]?.forEach((material, materialIndex) => {
        if (!material) return

        const materialFade = materialIndex < 3 ? 1 : 0.78
        material.opacity = opacity * materialFade
      })
    })

    const materialTargets = [
      [outerMaterialRef.current, activeTheme.outer, 2.0, 0.22],
      [middleMaterialRef.current, activeTheme.secondary, 1.8, 0.18],
      [innerMaterialRef.current, activeTheme.inner, 1.9, 0.16],
      [coreMaterialRef.current, activeTheme.core, 3.5, 0.45],
      [ringAMaterialRef.current, activeTheme.ringA, 2.8, 0.75],
      [ringBMaterialRef.current, activeTheme.ringB, 2.4, 0.7],
      [ringCMaterialRef.current, activeTheme.ringC, 2.2, 0.65]
    ]

    materialTargets.forEach(([material, color, intensity, opacity]) => {
      if (!material) return
      materialColorRef.current.set(color)
      material.color.lerp(materialColorRef.current, reducedMotion ? 1 : 0.08)
      material.emissive.lerp(materialColorRef.current, reducedMotion ? 1 : 0.08)
      material.emissiveIntensity = (hovered ? intensity + 0.9 : intensity) * autoGlow
      material.opacity = (opacity + Math.min(0.22, (autoGlow - 1) * 0.08)) * (1 - playful.split)
    })
    ;[
      [outerEdgeMaterialRef.current, activeTheme.ringA],
      [middleEdgeMaterialRef.current, activeTheme.secondary],
      [innerEdgeMaterialRef.current, activeTheme.ringA]
    ].forEach(([material, color]) => {
      if (material) {
        material.color.lerp(materialColorRef.current.set(color), reducedMotion ? 1 : 0.12)
        material.opacity = 0.9 * (1 - playful.split)
      }
    })
  }, -10)

  return (
    <group ref={emergenceRef} visible={!anchored || reducedMotion} scale={anchored && !reducedMotion ? 0 : 1}>
    <group ref={groupRef}>
      <group scale={TESSERACT_BASE_SCALE * (compact ? 1.3 : 1)}>
        {motionBlurGhosts.map((ghostIndex) => (
        <group
          key={`motion-blur-ghost-${ghostIndex}`}
          ref={(node) => {
            motionBlurRefs.current[ghostIndex] = node
          }}
          visible={false}
        >
          <mesh scale={3.5}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              ref={setMotionBlurMaterial(ghostIndex, 0)}
              color={theme.ringA}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              wireframe
            />
          </mesh>

          <mesh scale={2.4}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              ref={setMotionBlurMaterial(ghostIndex, 1)}
              color={theme.secondary}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              wireframe
            />
          </mesh>

          <mesh scale={1.5}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              ref={setMotionBlurMaterial(ghostIndex, 2)}
              color={theme.inner}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              wireframe
            />
          </mesh>

          <mesh scale={1} rotation={[0, 0, 0]}>
            <torusGeometry args={[4, 0.18, 20, 80]} />
            <meshBasicMaterial
              ref={setMotionBlurMaterial(ghostIndex, 3)}
              color={theme.ringA}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>

          <mesh scale={1} rotation={[Math.PI / 2.5, 0, 0]}>
            <torusGeometry args={[4.5, 0.16, 20, 80]} />
            <meshBasicMaterial
              ref={setMotionBlurMaterial(ghostIndex, 4)}
              color={theme.ringB}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      <HeroTesseractModel theme={theme} hovered={hovered} modelRefs={{
        outerCubeRef, middleCubeRef, innerCubeRef, innerGroupRef, coreRef,
        ringARef, ringBRef, ringCRef, pulseRef,
        outerMaterialRef, middleMaterialRef, innerMaterialRef, coreMaterialRef,
        ringAMaterialRef, ringBMaterialRef, ringCMaterialRef,
        outerEdgeMaterialRef, middleEdgeMaterialRef, innerEdgeMaterialRef
      }} />
      </group>
    </group>
    <PlayfulTwins frameRef={playfulFrameRef} groupRef={groupRef} compact={compact} />
    </group>
  )
}

export default function TechCore({ onHoverChange, anchored = false }) {
  const { activeSection } = useActiveNavSection()
  const reduceMotion = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const [activation, setActivation] = useState(0)
  const [colorIndex, setColorIndex] = useState(0)
  const pointerRef = useRef({ x: 0, y: 0 })
  const [canvasMounted, setCanvasMounted] = useState(false)
  const [canvasInView, setCanvasInView] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [mobileQuality, setMobileQuality] = useState(false)
  const [portraitHost, setPortraitHost] = useState(null)
  const containerRef = useRef()
  const handGlowRef = useRef()
  const bloomRef = useRef()
  const portraitSceneRef = useRef(null)
  const interactionRef = useRef(null)
  if (!interactionRef.current) interactionRef.current = createTesseractInteraction()
  const viewportRef = useRef()
  const hitTargetRef = useRef()
  const twinHitRefs = useRef([])
  const invalidateRef = useRef(null)
  const suppressClickRef = useRef(false)
  const orbitalTrailRefs = useRef({front: [], back: []})
  const choreographyRef = useRef(null)
  if (!choreographyRef.current) choreographyRef.current = createTesseractChoreography(anchored)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const dragOriginRef = useRef({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const dragLockedRef = useRef(false)
  const interactingRef = useRef(false)
  const navSignalRef = useRef(createAnimeSignal())
  const clickSignalRef = useRef(createAnimeSignal())
  const navTimelineRef = useRef()
  const clickTimelineRef = useRef()
  const capturedPointerRef = useRef(null)

  useEffect(() => {
    if (!anchored) return undefined
    const container = containerRef.current
    const portrait = container?.closest('[data-hero-portrait]')
    const anchor = container?.closest('[data-hero-core]')
    if (!portrait || !anchor) return undefined
    setPortraitHost(portrait)
    const measure = () => {
      const width = portrait.clientWidth
      const height = portrait.clientHeight
      if (!width || !height || !anchor.offsetWidth) return
      portraitSceneRef.current = {
        portrait, anchor, width, height,
        coreWidth: anchor.offsetWidth,
        anchorX: anchor.offsetLeft + anchor.offsetWidth / 2,
        anchorY: anchor.offsetTop + anchor.offsetHeight / 2
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(portrait)
    observer.observe(anchor)
    measure()
    return () => {
      observer.disconnect()
      portraitSceneRef.current = null
      anchor.style.removeProperty('transform')
      anchor.style.removeProperty('z-index')
      for (const property of ['r', 'g', 'b', 'energy', 'x', 'y']) portrait.style.removeProperty(`--core-light-${property}`)
      delete portrait.dataset.coreLightAction
    }
  }, [anchored])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const hero = anchored ? container.closest('#home') : null
    const target = hero || container
    const updateVisibility = () => {
      const rect = target.getBoundingClientRect()
      const margin = window.innerHeight * 0.35
      const active = hero?.dataset.aboutCovered !== 'true' && rect.width > 0 && rect.height > 0 &&
        rect.bottom > -margin && rect.top < window.innerHeight + margin && rect.right > 0 && rect.left < window.innerWidth
      setCanvasInView(active)
      if (active) setCanvasMounted(true)
    }
    // About can cover an intersecting sticky Hero. Read its live flag for
    // every notification so a delayed IO entry cannot wake the hidden core.
    const observer = new IntersectionObserver(updateVisibility, {rootMargin: '35% 0px', threshold: 0.01})
    observer.observe(target)
    hero?.addEventListener('hero:scene-visibility', updateVisibility)
    window.addEventListener('resize', updateVisibility, {passive: true})
    updateVisibility()
    return () => {
      observer.disconnect()
      hero?.removeEventListener('hero:scene-visibility', updateVisibility)
      window.removeEventListener('resize', updateVisibility)
    }
  }, [anchored])

  useEffect(() => {
    const handleVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 639px)')
    const handleMobileQuality = () => setMobileQuality(mobileQuery.matches)
    handleMobileQuality()
    mobileQuery.addEventListener('change', handleMobileQuality)
    return () => mobileQuery.removeEventListener('change', handleMobileQuality)
  }, [])

  const canvasActive = canvasInView && pageVisible && !reduceMotion

  useEffect(() => {
    if (canvasInView && pageVisible) return
    // A lost/hidden page must not leave a held pointer or resistance charge.
    // The autonomous scene clock itself stays paused.
    draggingRef.current = false
    dragLockedRef.current = false
    interactingRef.current = false
    if (capturedPointerRef.current !== null && containerRef.current?.hasPointerCapture(capturedPointerRef.current)) {
      containerRef.current.releasePointerCapture(capturedPointerRef.current)
    }
    capturedPointerRef.current = null
    setHovered(false)
    onHoverChange?.(false)
    suppressClickRef.current = true
    clickTimelineRef.current?.revert()
    resetAnimeSignal(clickSignalRef.current)
    const completedAnger = interactionRef.current.angerCount
    Object.assign(interactionRef.current, createTesseractInteraction(), {angerCount: completedAnger})
    pointerRef.current = {x: 0, y: 0}
  }, [canvasInView, pageVisible])

  useEffect(() => {
    return () => {
      navTimelineRef.current?.revert()
      clickTimelineRef.current?.revert()
    }
  }, [])

  const cancelAutonomousAction = () => {
    interruptTesseractChoreography(choreographyRef.current)
  }

  const triggerClickChoreography = () => {
    clickTimelineRef.current?.revert()
    resetAnimeSignal(clickSignalRef.current)

    clickTimelineRef.current = createTimeline({
      defaults: { ease: 'outCubic' }
    })
      .add(clickSignalRef.current, {
        glow: 1.12,
        spin: 2.2,
        ring: 3.4,
        spread: 0,
        pulse: 0,
        duration: 240,
        ease: 'outExpo'
      })
      .add(clickSignalRef.current, {
        glow: 1.06,
        spin: 0.85,
        ring: 1.25,
        spread: 0,
        pulse: 0,
        duration: 430,
        ease: 'outCubic'
      })
      .add(clickSignalRef.current, {
        glow: 1,
        spin: 0,
        ring: 0,
        spread: 0,
        pulse: 0,
        duration: 920,
        ease: 'inOutSine'
      })
  }

  useEffect(() => {
    if (!canvasActive) {
      navTimelineRef.current?.revert()
      resetAnimeSignal(navSignalRef.current)
      return undefined
    }

    const profile = navModeProfiles[activeSection] || navModeProfiles.home

    navTimelineRef.current?.revert()
    resetAnimeSignal(navSignalRef.current)
    setColorIndex(profile.colorIndex)

    navTimelineRef.current = createTimeline({
      defaults: { ease: 'outCubic' }
    })
      .add(navSignalRef.current, {
        glow: profile.glow,
        spin: profile.spin,
        ring: profile.ring,
        x: profile.x,
        y: profile.y,
        z: profile.z,
        compress: profile.compress,
        spread: profile.spread,
        pulse: profile.pulse,
        duration: 680,
        ease: 'outExpo'
      })
      .add(navSignalRef.current, {
        glow: 1,
        spin: 0,
        ring: 0,
        x: 0,
        y: 0,
        z: 0,
        compress: 0,
        spread: 0,
        pulse: 0,
        duration: 1420,
        ease: 'inOutSine'
      })
  }, [activeSection, canvasActive])

  const canInteract = () => canvasInView && pageVisible &&
    (!anchored || containerRef.current?.closest('#home')?.dataset.aboutCovered !== 'true')

  const updatePointer = (event) => {
    if (!canInteract()) return
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return

    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
    const y = -(((event.clientY - bounds.top) / bounds.height - 0.5) * 2)

    pointerRef.current = {
      x: THREE.MathUtils.clamp(x, -1, 1),
      y: THREE.MathUtils.clamp(y, -1, 1)
    }
  }

  const dodgePointer = (clientX, clientY) => {
    if (!canInteract()) return
    const scene = portraitSceneRef.current
    const interaction = interactionRef.current
    if (!scene || interaction.angerCount < 3) return
    const bounds = scene.portrait.getBoundingClientRect()
    const x = (clientX - bounds.left) / bounds.width * scene.width - scene.anchorX
    const y = (clientY - bounds.top) / bounds.height * scene.height - scene.anchorY
    let dx = interaction.x - x
    let dy = interaction.y - y
    const distance = Math.hypot(dx, dy)
    if (distance > scene.coreWidth * 0.42) return
    if (distance < 1) { dx = Math.sin(interaction.elapsed + 1); dy = -1 }
    const length = Math.hypot(dx, dy)
    const leap = scene.width * 0.22
    const point = constrainTesseractDrag(interaction.x + dx / length * leap, interaction.y + dy / length * leap,
      scene.width, scene.height, scene.anchorX, scene.anchorY)
    interaction.x = point.x
    interaction.y = point.y
    interaction.phase = 'dodging'
    interaction.elapsed = 0
    cancelAutonomousAction()
  }

  useEffect(() => {
    if (!anchored) return undefined
    const dodge = (event) => {
      if (!canvasActive || interactionRef.current.angerCount < 3) return
      dodgePointer(event.clientX, event.clientY)
    }
    window.addEventListener('pointermove', dodge, {passive: true})
    return () => window.removeEventListener('pointermove', dodge)
  }, [anchored, canvasActive])

  const handlePointerDown = (event) => {
    if (!canInteract()) return
    if (choreographyRef.current.phase !== 'ready') return
    interactingRef.current = true
    cancelAutonomousAction()
    updatePointer(event)
    suppressClickRef.current = false
    if (!beginTesseractDrag(interactionRef.current)) {
      suppressClickRef.current = true
      dodgePointer(event.clientX, event.clientY)
      invalidateRef.current?.()
      return
    }
    const scene = portraitSceneRef.current
    if (anchored && scene) {
      interactionRef.current.x = scene.visualX || 0
      interactionRef.current.y = scene.visualY || 0
      // The captured position already contains the autonomous lap's offset.
      // Keep only the remaining visual effects of the interrupted action.
      interactionRef.current.ownsTravel = true
    }
    dragLockedRef.current = false
    draggingRef.current = true
    dragStartRef.current = { x: event.clientX, y: event.clientY }
    dragOriginRef.current = {x: interactionRef.current.x, y: interactionRef.current.y}
    capturedPointerRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    invalidateRef.current?.()
  }

  const handlePointerMove = (event) => {
    if (!canInteract()) return
    if (choreographyRef.current.phase !== 'ready') return
    interactingRef.current = true
    if (!hovered) {
      setHovered(true)
      onHoverChange?.(true)
    }
    updatePointer(event)

    if (interactionRef.current.angerCount >= 3) {
      dodgePointer(event.clientX, event.clientY)
      return
    }

    if (!draggingRef.current || dragLockedRef.current) return
    if (Math.hypot(event.clientX - dragStartRef.current.x, event.clientY - dragStartRef.current.y) > 5) suppressClickRef.current = true

    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return

    const scene = portraitSceneRef.current
    if (anchored && scene) {
      const portraitBounds = scene.portrait.getBoundingClientRect()
      const x = dragOriginRef.current.x + (event.clientX - dragStartRef.current.x) / portraitBounds.width * scene.width
      const y = dragOriginRef.current.y + (event.clientY - dragStartRef.current.y) / portraitBounds.height * scene.height
      moveTesseractDrag(interactionRef.current, constrainTesseractDrag(x, y, scene.width, scene.height, scene.anchorX, scene.anchorY))
    } else {
      const x = dragOriginRef.current.x + ((event.clientX - dragStartRef.current.x) / bounds.width) * 5
      const y = dragOriginRef.current.y - ((event.clientY - dragStartRef.current.y) / bounds.height) * 5
      const distance = Math.hypot(x, y)
      const amount = distance > 2.3 ? 2.3 / distance : 1
      moveTesseractDrag(interactionRef.current, {x: x * amount, y: y * amount, limited: distance > 2.3})
    }
    invalidateRef.current?.()
  }

  const handlePointerUp = (event) => {
    if (!canInteract()) return
    if (interactionRef.current.phase === 'charging' || interactionRef.current.phase === 'burst') suppressClickRef.current = true
    draggingRef.current = false
    dragLockedRef.current = false
    interactingRef.current = event.pointerType === 'touch' || event.type === 'pointercancel' ? false : hovered
    if (!interactingRef.current) {
      setHovered(false)
      onHoverChange?.(false)
    }
    releaseTesseractDrag(interactionRef.current)
    if (reduceMotion) {
      Object.assign(interactionRef.current, createTesseractInteraction(), {angerCount: interactionRef.current.angerCount})
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    capturedPointerRef.current = null
    invalidateRef.current?.()
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full cursor-pointer overflow-visible"
      style={{touchAction: 'none', pointerEvents: anchored ? 'none' : 'auto'}}
      data-core-phase={reduceMotion ? 'ready' : anchored ? 'waiting' : 'ready'}
      data-core-action="idle"
      data-core-elapsed="0.00"
      onPointerEnter={(event) => {
        if (!canInteract()) return
        if (choreographyRef.current.phase !== 'ready') return
        interactingRef.current = true
        cancelAutonomousAction()
        setHovered(true)
        onHoverChange?.(true)
        updatePointer(event)
        dodgePointer(event.clientX, event.clientY)
      }}
      onPointerLeave={() => {
        if (draggingRef.current && capturedPointerRef.current !== null) return
        interactingRef.current = false
        setHovered(false)
        onHoverChange?.(false)
        pointerRef.current = { x: 0, y: 0 }
        if (interactionRef.current.phase !== 'dodging') releaseTesseractDrag(interactionRef.current)
        draggingRef.current = false
        dragLockedRef.current = false
        capturedPointerRef.current = null
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => {
        if (!canInteract()) return
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        if (choreographyRef.current.phase !== 'ready') return
        if (interactionRef.current.angerCount >= 3 || interactionRef.current.phase === 'burst') return
        setActivation((value) => value + 1)
        setColorIndex((value) => value + 1)
        if (!reduceMotion) triggerClickChoreography()
      }}
    >
      <div ref={viewportRef} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {canvasMounted && <Canvas
        className="!overflow-visible"
        style={{pointerEvents: anchored ? 'none' : 'auto'}}
        camera={{ position: [0, 0, 8], fov: 45 }}
        dpr={mobileQuality ? [1.35, 1.75] : [1, 1.5]}
        frameloop="demand"
        gl={{
          antialias: true,
          alpha: true
        }}
      >
        <ActiveFrameLoop active={canvasActive} />
        {/* Stars background */}
        {!anchored && <StarField />}
        {anchored && <GatheringEnergy choreographyRef={choreographyRef} active={canvasActive} reducedMotion={reduceMotion} />}

        {/* Lighting setup */}
        <ambientLight intensity={0.6} color="#ffffff" />
        <directionalLight intensity={1.0} position={[8, 8, 8]} color="#00DDFF" />
        <pointLight intensity={2.0} position={[-8, -8, 8]} color="#0099FF" distance={50} />
        <pointLight intensity={1.5} position={[0, 0, 0]} color="#00FFFF" distance={10} />

        {/* Main tesseract */}
        <RotatingTesseract
          hovered={hovered}
          activation={activation}
          pointerRef={pointerRef}
          colorIndex={colorIndex}
          navSignal={navSignalRef.current}
          clickSignal={clickSignalRef.current}
          anchored={anchored}
          active={canvasActive}
          reducedMotion={reduceMotion}
          interactingRef={interactingRef}
          interactionRef={interactionRef}
          choreographyRef={choreographyRef}
          containerRef={containerRef}
          handGlowRef={handGlowRef}
          bloomRef={bloomRef}
          portraitSceneRef={portraitSceneRef}
          orbitalTrailRefs={orbitalTrailRefs}
          viewportRef={viewportRef}
          hitTargetRef={hitTargetRef}
          twinHitRefs={twinHitRefs}
          invalidateRef={invalidateRef}
        />
      </Canvas>}
      </div>

      {anchored && <div ref={hitTargetRef} aria-hidden="true" data-core-hit-target="true" style={{position: 'absolute', top: '24%', left: '24%', width: '52%', height: '52%', borderRadius: '50%', pointerEvents: 'auto', touchAction: 'none'}} />}
      {anchored && [0, 1].map((index) => <div key={index} ref={(node) => { twinHitRefs.current[index] = node }} aria-hidden="true" data-core-hit-target={`twin-${index}`} style={{position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, borderRadius: '50%', pointerEvents: 'none', touchAction: 'none'}} />)}

      {/* These two composited layers share the same active-time clock as the
          core, so the palm lights first and never flashes before hydration. */}
      <div
        ref={handGlowRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0,
          background: 'radial-gradient(ellipse 32% 20% at 50% 75%, rgba(255,249,225,0.95) 0%, rgba(var(--core-glow-r, 87),var(--core-glow-g, 221),var(--core-glow-b, 255),0.55) 26%, rgba(var(--core-glow-r, 26),var(--core-glow-g, 182),var(--core-glow-b, 255),0.17) 58%, transparent 100%)',
          mixBlendMode: 'screen',
          filter: 'blur(7px)',
          willChange: 'opacity'
        }}
      />

      <div
        ref={bloomRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0,
          background: 'radial-gradient(circle at center, rgba(255,249,225,0.4) 0%, rgba(var(--core-glow-r, 63),var(--core-glow-g, 216),var(--core-glow-b, 255),0.24) 22%, rgba(var(--core-glow-r, 52),var(--core-glow-g, 172),var(--core-glow-b, 255),0.08) 45%, transparent 70%)',
          mixBlendMode: 'screen',
          willChange: 'opacity'
        }}
      />
      {anchored && <SubjectOrbitTrail host={portraitHost} trailRefs={orbitalTrailRefs} />}
    </div>
  )
}
