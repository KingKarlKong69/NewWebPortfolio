import { Canvas, useFrame } from '@react-three/fiber'
import { createTimeline } from 'animejs'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import ActiveFrameLoop from './ActiveFrameLoop'
import { useActiveNavSection } from './navigationState'

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
  outer: '#FF1F3D',
  secondary: '#DC2626',
  inner: '#991B1B',
  core: '#FCA5A5',
  ringA: '#FF334E',
  ringB: '#EF4444',
  ringC: '#F87171'
}

const overclockThemes = [
  { outer: '#A855F7', secondary: '#7C3AED', inner: '#4C1D95', core: '#E9D5FF', ringA: '#C084FC', ringB: '#A855F7', ringC: '#E879F9' },
  { outer: '#FACC15', secondary: '#EAB308', inner: '#A16207', core: '#FEF3C7', ringA: '#FDE047', ringB: '#FBBF24', ringC: '#FCD34D' },
  { outer: '#22C55E', secondary: '#16A34A', inner: '#166534', core: '#BBF7D0', ringA: '#4ADE80', ringB: '#34D399', ringC: '#86EFAC' },
  { outer: '#2563EB', secondary: '#0EA5E9', inner: '#1E40AF', core: '#BFDBFE', ringA: '#60A5FA', ringB: '#38BDF8', ringC: '#93C5FD' },
  { outer: '#EF4444', secondary: '#DC2626', inner: '#991B1B', core: '#FECACA', ringA: '#F87171', ringB: '#FB7185', ringC: '#FCA5A5' }
]

const autonomousDurations = {
  ascension: 9.2,
  orbit: 9.5,
  compression: 8,
  reconfigure: 5
}

const TESSERACT_BASE_SCALE = 0.252
const TESSERACT_HOVER_SCALE = 0.94
const TESSERACT_ORBIT_SCALE = 0.5
const TESSERACT_RAGE_SCALE = 1.28
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

function EdgeOverlay({ scale = 1, color = '#00E5FF' }) {
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const edgeGeometry = useMemo(() => new THREE.EdgesGeometry(boxGeometry), [boxGeometry])

  return (
    <lineSegments geometry={edgeGeometry} scale={scale}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  )
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

function RotatingTesseract({ hovered, activation, pointer, dragOffset, colorIndex, angry, rageBurst, limitCharge, autonomousAction, navSignal, clickSignal }) {
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
  const spinBoostRef = useRef(0)
  const rageBoostRef = useRef(0)
  const ringSurgeRef = useRef(0)
  const targetScaleRef = useRef(new THREE.Vector3(1, 1, 1))
  const lastActivationRef = useRef(activation)
  const lastRageBurstRef = useRef(rageBurst)
  const theme = angry ? angryTheme : colorThemes[colorIndex % colorThemes.length]
  const setMotionBlurMaterial = (ghostIndex, materialIndex) => (material) => {
    if (!motionBlurMaterialsRef.current[ghostIndex]) {
      motionBlurMaterialsRef.current[ghostIndex] = []
    }

    motionBlurMaterialsRef.current[ghostIndex][materialIndex] = material
  }

  useFrame((state, dt) => {
    if (lastActivationRef.current !== activation) {
      spinBoostRef.current = 1.85
      lastActivationRef.current = activation
    }

    if (lastRageBurstRef.current !== rageBurst) {
      rageBoostRef.current = 1
      ringSurgeRef.current = 1
      lastRageBurstRef.current = rageBurst
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
    const chargeSpin = THREE.MathUtils.smoothstep(limitCharge, 1, 2) * 52
    const burstSpin = rageBoost * 18
    const surgeSpin = THREE.MathUtils.smoothstep(ringSurge, 0, 1) * 46
    const actionType = autonomousAction?.type
    const actionTime = autonomousAction ? (Date.now() - autonomousAction.startedAt) / 1000 : 0
    const actionSeed = autonomousAction?.seed || 0
    const actionDuration = actionType ? autonomousDurations[actionType] : 0
    const actionProgress = actionDuration ? clamp01(actionTime / actionDuration) : 0
    const overclockIndex = Math.floor(actionTime * 4.5 + actionSeed) % overclockThemes.length
    const overclockBlend = easeInOut((actionTime * 4.5 + actionSeed) % 1)
    const overclockTheme = overclockThemes[overclockIndex]
    const nextOverclockTheme = overclockThemes[(overclockIndex + 1) % overclockThemes.length]
    const activeTheme = { ...theme }
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

    if (actionType === 'ascension') {
      const charge = easeInOut(clamp01(actionTime / 5))
      const fastCharge = THREE.MathUtils.smoothstep(actionTime, 3.5, 5)
      const launch = easeInOut(clamp01((actionTime - 5) / 0.45))
      const reentry = easeInOut(clamp01((actionTime - 6.95) / 1.7))
      const postLaunchDecay = 1 - clamp01((actionTime - 5.1) / 0.8)
      const launchBlur = clamp01((actionTime - 4.85) / 0.35) * (1 - clamp01((actionTime - 5.75) / 0.95))

      autoGlow += charge * 1.4
      autoSpin += (charge * 5 + fastCharge * 26) * (actionTime < 5 ? 1 : Math.max(0.25, postLaunchDecay))
      autoRingSpin += (charge * 16 + fastCharge * 72) * (actionTime < 5 ? 1 : Math.max(0.12, postLaunchDecay))
      autoY = mix(0, 6.2, launch)
      if (actionTime > 5.45 && actionTime < 6.5) autoY = 6.2
      if (actionTime >= 6.5) autoY = mix(-5.8, 0, reentry)
      autoX = Math.sin(actionSeed * 8.1) * 0.18 * charge
      motionBlurStrength = actionTime > 4.65 && actionTime < 6.15
        ? launchBlur * (1 - clamp01((actionTime - 5.82) / 0.33))
        : 0
    }

    if (actionType === 'orbit') {
      const enter = easeInOut(clamp01(actionTime / 0.55))
      const exit = easeInOut(clamp01((actionTime - 8) / 1.1))
      const orbitAmount = enter * (1 - exit)
      const loopTime = actionTime * 3.15 + actionSeed
      const leap = Math.pow(Math.max(0, Math.sin(actionTime * Math.PI * 1.35)), 3)
      const dart = Math.sin(actionTime * Math.PI * 0.74 + actionSeed)
      const circleGlow = 0.5 + Math.sin(loopTime * 1.4) * 0.5

      autoX = (Math.sin(loopTime) * 1.2 + Math.sin(loopTime * 0.43) * 0.62 + dart * 0.55) * orbitAmount
      autoY = (Math.cos(loopTime * 0.84) * 0.82 + Math.sin(loopTime * 0.31) * 0.42 + leap * 1.35) * orbitAmount
      autoZ = (Math.sin(loopTime * 0.7) * 0.32 + Math.cos(loopTime * 1.15) * 0.22) * orbitAmount
      autoSpin += orbitAmount * (2.5 + leap * 2.5)
      autoRingSpin += orbitAmount * (7 + circleGlow * 9 + leap * 6)
      autoGlow += orbitAmount * (0.35 + circleGlow * 0.7 + leap * 0.55)
      expressionScale *= mix(1, TESSERACT_ORBIT_SCALE, orbitAmount)
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
      pulseOpacity = sphereIntro * (held * 0.48 + overclock * (0.24 + Math.sin(state.clock.elapsedTime * 10) * 0.08))
      pulseSphereScale = mix(PULSE_BASE_SCALE, PULSE_FULL_TESSERACT_SCALE, sphereIntro) * (1 + overclock * 0.08 + Math.sin(state.clock.elapsedTime * 8.5) * pulseOpacity * 0.04)

      if (overclock > 0) {
        Object.keys(activeTheme).forEach((key) => {
          activeTheme[key] = new THREE.Color(overclockTheme[key]).lerp(new THREE.Color(nextOverclockTheme[key]), overclockBlend).getStyle()
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

    reconfigureSpread = Math.min(reconfigureSpread, 1.15)
    pulseOpacity = Math.min(pulseOpacity, 0.95)
    motionBlurStrength = Math.min(motionBlurStrength, 1)

    const ringEnergy = 1 + chargeSpin + burstSpin + surgeSpin + autoRingSpin

    if (groupRef.current) {
      const attractionX = hovered ? pointer.x * 0.45 : 0
      const attractionY = hovered ? pointer.y * 0.35 : 0
      const shakeStrength = angry ? 0.09 + rageBoost * 0.2 : 0
      const shakeX = Math.sin(state.clock.elapsedTime * 58) * shakeStrength
      const shakeY = Math.cos(state.clock.elapsedTime * 51) * shakeStrength * 0.7
      const targetX = attractionX + dragOffset.x + shakeX + autoX
      const targetY = Math.sin(state.clock.elapsedTime * 0.5) * 0.3 + attractionY + dragOffset.y + shakeY + autoY

      groupRef.current.rotation.y += dt * 0.35 * (1 + boost + rageBoost * 3.5 + autoSpin) * hoverEnergy
      groupRef.current.rotation.x += Math.sin(state.clock.elapsedTime * 0.5) * dt * 0.3 * hoverEnergy + rageBoost * dt * 1.2 + autoSpin * dt * 0.42
      groupRef.current.rotation.z += Math.cos(state.clock.elapsedTime * 0.4) * dt * 0.2

      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, angry ? 0.38 : actionType ? 0.16 : 0.08)
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, angry ? 0.38 : actionType === 'ascension' ? 0.32 : actionType ? 0.16 : 0.08)
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, autoZ, actionType ? 0.16 : 0.08)

      const limitStretch = mix(1, TESSERACT_LIMIT_SCALE, THREE.MathUtils.smoothstep(limitCharge, 0.12, 1.8))
      const rageStretch = mix(1, TESSERACT_RAGE_SCALE, easeInOut(rageBoost))
      const targetScale = expressionScale * limitStretch * rageStretch
      targetScaleRef.current.set(targetScale, targetScale, targetScale)
      groupRef.current.scale.lerp(targetScaleRef.current, angry || rageBoost > 0 ? 0.42 : 0.14)
    }

    if (innerGroupRef.current) {
      innerGroupRef.current.rotation.y -= dt * 0.25 * (1 + boost * 0.55 + autoSpin * 0.55)
      innerGroupRef.current.rotation.x -= dt * 0.15 * hoverEnergy
      const innerPulse = 1 + Math.sin(state.clock.elapsedTime * hoverEnergy) * 0.08
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
      const corePulse = 1 + (autoGlow - 1) * 0.18 + Math.sin(state.clock.elapsedTime * 7) * pulseOpacity * 0.18
      coreRef.current.scale.setScalar(0.3 * corePulse)
    }

    if (ringARef.current) {
      ringARef.current.rotation.z += dt * 0.11 * hoverEnergy * ringEnergy
      ringARef.current.rotation.x += dt * 0.03 * (1 + chargeSpin * 0.8 + burstSpin)
    }

    if (ringBRef.current) {
      ringBRef.current.rotation.y -= dt * 0.075 * hoverEnergy * ringEnergy
      ringBRef.current.rotation.z += dt * 0.02 * (1 + chargeSpin + burstSpin)
    }

    if (ringCRef.current) {
      ringCRef.current.rotation.x += dt * 0.06 * hoverEnergy * ringEnergy
      ringCRef.current.rotation.y += dt * 0.035 * (1 + chargeSpin * 0.9 + burstSpin)
    }

    if (pulseRef.current) {
      pulseRef.current.scale.setScalar(pulseSphereScale)
      pulseRef.current.material.opacity = pulseOpacity
    }

    motionBlurRefs.current.forEach((ghost, index) => {
      if (!ghost) return

      const depth = index + 1
      const opacity = motionBlurStrength * (0.32 / depth)
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
      material.color.lerp(new THREE.Color(color), 0.08)
      material.emissive.lerp(new THREE.Color(color), 0.08)
      material.emissiveIntensity = (hovered ? intensity + 0.9 : intensity) * autoGlow
      material.opacity = opacity + Math.min(0.22, (autoGlow - 1) * 0.08)
    })
  })

  return (
    <group ref={groupRef}>
      <group scale={TESSERACT_BASE_SCALE}>
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

      {/* Outer cyan cube */}
      <mesh ref={outerCubeRef} scale={3.5}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={outerMaterialRef}
          color={theme.outer}
          emissive={theme.outer}
          emissiveIntensity={hovered ? 2.75 : 2.0}
          metalness={0.3}
          roughness={0.1}
          transparent
          opacity={0.22}
          depthWrite={false}
        />
        <EdgeOverlay scale={1.08} color={theme.ringA} />
      </mesh>

      {/* Secondary blue cube */}
      <mesh ref={middleCubeRef} scale={2.4}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={middleMaterialRef}
          color={theme.secondary}
          emissive={theme.secondary}
          emissiveIntensity={hovered ? 2.45 : 1.8}
          metalness={0.3}
          roughness={0.1}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
        <EdgeOverlay scale={1.06} color={theme.secondary} />
      </mesh>

      {/* Inner rotating group */}
      <group ref={innerGroupRef}>
        {/* Third layer blue cube */}
        <mesh ref={innerCubeRef} scale={1.5}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
          ref={innerMaterialRef}
          color={theme.inner}
          emissive={theme.inner}
          emissiveIntensity={hovered ? 2.65 : 1.9}
          metalness={0.4}
          roughness={0.08}
          transparent
          opacity={0.16}
          depthWrite={false}
        />
          <EdgeOverlay scale={1.1} color={theme.ringA} />
        </mesh>

        {/* Core energy sphere */}
        <mesh ref={coreRef} scale={0.3}>
          <icosahedronGeometry args={[1, 5]} />
          <meshStandardMaterial
            ref={coreMaterialRef}
            color={theme.core}
            emissive={theme.core}
            emissiveIntensity={hovered ? 5.2 : 3.5}
            transparent
            opacity={0.45}
          />
        </mesh>

        {/* Pulsing inner rings */}
        <mesh scale={0.5}>
          <torusGeometry args={[1, 0.08, 16, 100]} />
          <meshStandardMaterial
            color={theme.ringA}
            emissive={theme.ringA}
            emissiveIntensity={hovered ? 3.2 : 2.2}
            transparent
            opacity={0.55}
          />
        </mesh>

        <mesh scale={0.35} rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[1, 0.06, 16, 100]} />
          <meshStandardMaterial
            color={theme.ringB}
            emissive={theme.ringB}
            emissiveIntensity={hovered ? 2.9 : 2.0}
            transparent
            opacity={0.5}
          />
        </mesh>
      </group>

      {/* Holographic rings */}
      <mesh ref={ringARef} scale={1} rotation={[0, 0, 0]}>
        <torusGeometry args={[4, 0.25, 32, 100]} />
        <meshStandardMaterial
          ref={ringAMaterialRef}
          color={theme.ringA}
          emissive={theme.ringA}
          emissiveIntensity={hovered ? 3.7 : 2.8}
          metalness={0.3}
          roughness={0.4}
          transparent={true}
          opacity={0.75}
          wireframe={false}
        />
      </mesh>

      <mesh ref={ringBRef} scale={1} rotation={[Math.PI / 2.5, 0, 0]}>
        <torusGeometry args={[4.5, 0.22, 32, 100]} />
        <meshStandardMaterial
          ref={ringBMaterialRef}
          color={theme.ringB}
          emissive={theme.ringB}
          emissiveIntensity={hovered ? 3.2 : 2.4}
          metalness={0.3}
          roughness={0.5}
          transparent={true}
          opacity={0.7}
          wireframe={false}
        />
      </mesh>

      <mesh ref={ringCRef} scale={1} rotation={[0, Math.PI / 3, 0]}>
        <torusGeometry args={[5, 0.2, 32, 100]} />
        <meshStandardMaterial
          ref={ringCMaterialRef}
          color={theme.ringC}
          emissive={theme.ringC}
          emissiveIntensity={hovered ? 3.0 : 2.2}
          metalness={0.3}
          roughness={0.6}
          transparent={true}
          opacity={0.65}
          wireframe={false}
        />
      </mesh>

      <mesh ref={pulseRef} scale={1}>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial
          color="#7DD3FC"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          wireframe
        />
      </mesh>
      </group>
    </group>
  )
}

export default function TechCore({ onHoverChange }) {
  const { activeSection } = useActiveNavSection()
  const [hovered, setHovered] = useState(false)
  const [activation, setActivation] = useState(0)
  const [colorIndex, setColorIndex] = useState(0)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [angry, setAngry] = useState(false)
  const [rageBurst, setRageBurst] = useState(0)
  const [limitCharge, setLimitCharge] = useState(0)
  const [autonomousAction, setAutonomousAction] = useState(null)
  const [canvasMounted, setCanvasMounted] = useState(false)
  const [canvasActive, setCanvasActive] = useState(false)
  const containerRef = useRef()
  const dragStartRef = useRef({ x: 0, y: 0 })
  const dragOriginRef = useRef({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const dragLockedRef = useRef(false)
  const interactingRef = useRef(false)
  const autonomousActionRef = useRef(null)
  const autonomousTimeoutRef = useRef()
  const autonomousEndTimeoutRef = useRef()
  const navSignalRef = useRef(createAnimeSignal())
  const clickSignalRef = useRef(createAnimeSignal())
  const navTimelineRef = useRef()
  const clickTimelineRef = useRef()
  const capturedPointerRef = useRef(null)
  const angryTimeoutRef = useRef()
  const limitTimeoutRef = useRef()
  const limitChargeIntervalRef = useRef()
  const limitStartRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      const active = entry.isIntersecting
      setCanvasActive(active)
      if (active) setCanvasMounted(true)
    }, {rootMargin: '35% 0px', threshold: 0.01})
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(angryTimeoutRef.current)
      clearTimeout(limitTimeoutRef.current)
      clearTimeout(autonomousTimeoutRef.current)
      clearTimeout(autonomousEndTimeoutRef.current)
      clearInterval(limitChargeIntervalRef.current)
      navTimelineRef.current?.revert()
      clickTimelineRef.current?.revert()
    }
  }, [])

  useEffect(() => {
    autonomousActionRef.current = autonomousAction
  }, [autonomousAction])

  useEffect(() => {
    const actions = ['ascension', 'orbit', 'compression', 'reconfigure']

    const scheduleNextAction = () => {
      const organicDelay = 6200 + Math.random() * 2200

      autonomousTimeoutRef.current = setTimeout(() => {
        if (interactingRef.current || draggingRef.current || angry || autonomousActionRef.current) {
          scheduleNextAction()
          return
        }

        const type = actions[Math.floor(Math.random() * actions.length)]
        const action = {
          type,
          startedAt: Date.now(),
          seed: Math.random() * 100
        }

        setAutonomousAction(action)
        autonomousEndTimeoutRef.current = setTimeout(() => {
          setAutonomousAction(null)
          scheduleNextAction()
        }, autonomousDurations[type] * 1000)
      }, organicDelay)
    }

    scheduleNextAction()

    return () => {
      clearTimeout(autonomousTimeoutRef.current)
      clearTimeout(autonomousEndTimeoutRef.current)
    }
  }, [angry])

  const cancelAutonomousAction = () => {
    clearTimeout(autonomousEndTimeoutRef.current)
    setAutonomousAction(null)
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
  }, [activeSection])

  const updatePointer = (event) => {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return

    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
    const y = -(((event.clientY - bounds.top) / bounds.height - 0.5) * 2)

    setPointer({
      x: THREE.MathUtils.clamp(x, -1, 1),
      y: THREE.MathUtils.clamp(y, -1, 1)
    })
  }

  const triggerAngryReset = () => {
    clearTimeout(angryTimeoutRef.current)
    clearTimeout(limitTimeoutRef.current)
    clearInterval(limitChargeIntervalRef.current)
    limitStartRef.current = null
    setLimitCharge(0)
    dragLockedRef.current = true
    setAngry(true)
    setRageBurst((value) => value + 1)
    setDragOffset({ x: 0, y: 0 })
    draggingRef.current = false

    if (
      containerRef.current &&
      capturedPointerRef.current !== null &&
      containerRef.current.hasPointerCapture(capturedPointerRef.current)
    ) {
      containerRef.current.releasePointerCapture(capturedPointerRef.current)
    }

    angryTimeoutRef.current = setTimeout(() => {
      setAngry(false)
    }, 900)
  }

  const clearLimitCharge = () => {
    clearTimeout(limitTimeoutRef.current)
    clearInterval(limitChargeIntervalRef.current)
    limitStartRef.current = null
    setLimitCharge(0)
  }

  const startLimitCharge = () => {
    if (limitStartRef.current) return

    limitStartRef.current = Date.now()
    setLimitCharge(0)
    clearTimeout(limitTimeoutRef.current)
    clearInterval(limitChargeIntervalRef.current)
    limitChargeIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - limitStartRef.current
      setLimitCharge(THREE.MathUtils.clamp(elapsed / 1000, 0, 3))
    }, 50)
    limitTimeoutRef.current = setTimeout(triggerAngryReset, 3000)
  }

  const handlePointerDown = (event) => {
    interactingRef.current = true
    cancelAutonomousAction()
    updatePointer(event)
    dragLockedRef.current = false
    draggingRef.current = true
    clearLimitCharge()
    dragStartRef.current = { x: event.clientX, y: event.clientY }
    dragOriginRef.current = dragOffset
    capturedPointerRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    interactingRef.current = true
    updatePointer(event)

    if (!draggingRef.current || dragLockedRef.current) return

    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return

    const maxDistance = 0.72
    const nextOffset = {
      x: dragOriginRef.current.x + ((event.clientX - dragStartRef.current.x) / bounds.width) * 5,
      y: dragOriginRef.current.y - ((event.clientY - dragStartRef.current.y) / bounds.height) * 5
    }
    const distance = Math.hypot(nextOffset.x, nextOffset.y)

    if (distance >= maxDistance) {
      const limitedOffset = {
        x: (nextOffset.x / distance) * maxDistance,
        y: (nextOffset.y / distance) * maxDistance
      }

      setDragOffset(limitedOffset)
      setAngry(true)
      startLimitCharge()

      return
    }

    clearLimitCharge()
    setAngry(false)
    setDragOffset(nextOffset)
  }

  const handlePointerUp = (event) => {
    draggingRef.current = false
    dragLockedRef.current = false
    interactingRef.current = hovered
    clearLimitCharge()
    setAngry(false)
    setDragOffset({ x: 0, y: 0 })
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    capturedPointerRef.current = null
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full cursor-pointer overflow-visible"
      onPointerEnter={(event) => {
        interactingRef.current = true
        cancelAutonomousAction()
        setHovered(true)
        onHoverChange?.(true)
        updatePointer(event)
      }}
      onPointerLeave={() => {
        interactingRef.current = false
        setHovered(false)
        onHoverChange?.(false)
        setPointer({ x: 0, y: 0 })
        setDragOffset({ x: 0, y: 0 })
        clearLimitCharge()
        setAngry(false)
        draggingRef.current = false
        dragLockedRef.current = false
        capturedPointerRef.current = null
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => {
        setActivation((value) => value + 1)
        setColorIndex((value) => value + 1)
        triggerClickChoreography()
      }}
    >
      {canvasMounted && <Canvas
        className="!overflow-visible"
        camera={{ position: [0, 0, 8], fov: 45 }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{
          antialias: true,
          alpha: true
        }}
      >
        <ActiveFrameLoop active={canvasActive} />
        {/* Stars background */}
        <StarField />

        {/* Lighting setup */}
        <ambientLight intensity={0.6} color="#ffffff" />
        <directionalLight intensity={1.0} position={[8, 8, 8]} color="#00DDFF" />
        <pointLight intensity={2.0} position={[-8, -8, 8]} color="#0099FF" distance={50} />
        <pointLight intensity={1.5} position={[0, 0, 0]} color="#00FFFF" distance={10} />

        {/* Main tesseract */}
        <RotatingTesseract
          hovered={hovered}
          activation={activation}
          pointer={pointer}
          dragOffset={dragOffset}
          colorIndex={colorIndex}
          angry={angry}
          rageBurst={rageBurst}
          limitCharge={limitCharge}
          autonomousAction={autonomousAction}
          navSignal={navSignalRef.current}
          clickSignal={clickSignalRef.current}
        />
      </Canvas>}

      {/* Glow overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          opacity: autonomousAction ? 1 : hovered ? 0.9 : 0.55
        }}
        transition={{
          duration: autonomousAction ? 0.8 : 0.42,
          ease: 'easeInOut'
        }}
        style={{
          background: hovered
            ? 'radial-gradient(ellipse at center, rgba(0,229,255,0.2) 0%, rgba(139,92,246,0.13) 34%, transparent 72%)'
            : autonomousAction
              ? 'radial-gradient(ellipse at center, rgba(125,211,252,0.24) 0%, rgba(168,85,247,0.12) 32%, transparent 74%)'
              : 'radial-gradient(ellipse at center, rgba(0,229,255,0.1) 0%, transparent 70%)',
          mixBlendMode: 'screen',
          animation: hovered ? 'corePulse 1.8s ease-in-out infinite' : 'none'
        }}
      />

      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          opacity: autonomousAction ? 0.85 : hovered ? 1 : 0
        }}
        transition={{
          duration: autonomousAction ? 1.1 : 0.7,
          ease: [0.42, 0, 0.2, 1]
        }}
        style={{
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.18) 0%, rgba(0,229,255,0.11) 18%, rgba(139,92,246,0.08) 34%, transparent 58%)',
          mixBlendMode: 'screen'
        }}
      />

      <style jsx>{`
        @keyframes corePulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
