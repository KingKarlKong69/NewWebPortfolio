import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader'

const cyan = '#00E5FF'
const blue = '#4F8CFF'
const purple = '#8B5CF6'
const whiteHot = '#FFFFFF'
const LOGO_MODEL_SCALE = 0.9

function createRadialGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  const transparentEdge = inner.replace(/rgba\(([^)]+),\s*1\)/, 'rgba($1,0)')
  gradient.addColorStop(0, inner)
  gradient.addColorStop(0.18, inner.replace(/,1\)$/, ',0.85)'))
  gradient.addColorStop(0.34, inner.replace(/,1\)$/, ',0.36)'))
  gradient.addColorStop(0.5, inner.replace(/,1\)$/, ',0.08)'))
  gradient.addColorStop(0.62, transparentEdge)
  gradient.addColorStop(1, outer)
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function createTaperedBeamTexture({
  top = 'rgba(0,229,255,0.95)',
  middle = 'rgba(255,255,255,1)',
  bottom = 'rgba(139,92,246,0.92)',
  glow = 'rgba(0,229,255,0.8)',
  core = false
} = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 768
  const context = canvas.getContext('2d')
  const center = canvas.width / 2
  const height = canvas.height

  const drawTaper = (width, alpha, blur) => {
    const shoulder = core ? 48 : 74
    const lowerShoulder = height - shoulder
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, top)
    gradient.addColorStop(0.46, middle)
    gradient.addColorStop(0.64, middle)
    gradient.addColorStop(1, bottom)

    context.save()
    context.globalAlpha = alpha
    context.shadowColor = glow
    context.shadowBlur = blur
    context.fillStyle = gradient
    context.beginPath()
    context.moveTo(center, 0)
    context.lineTo(center + width * 0.52, shoulder)
    context.lineTo(center + width * 0.36, lowerShoulder)
    context.lineTo(center, height)
    context.lineTo(center - width * 0.36, lowerShoulder)
    context.lineTo(center - width * 0.52, shoulder)
    context.closePath()
    context.fill()
    context.restore()
  }

  drawTaper(core ? 6 : 34, core ? 0.72 : 0.18, core ? 12 : 32)
  drawTaper(core ? 4 : 20, core ? 0.9 : 0.26, core ? 8 : 22)
  drawTaper(core ? 2 : 8, core ? 1 : 0.54, core ? 4 : 12)

  context.save()
  context.globalAlpha = core ? 0.95 : 0.36
  context.shadowColor = 'rgba(255,255,255,0.95)'
  context.shadowBlur = core ? 14 : 20
  context.strokeStyle = 'rgba(255,255,255,0.95)'
  context.lineWidth = core ? 2.6 : 1.4
  context.beginPath()
  context.moveTo(center, 8)
  context.lineTo(center, height - 8)
  context.stroke()
  context.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

function createContinuousBeamTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 768
  const context = canvas.getContext('2d')
  const image = context.createImageData(canvas.width, canvas.height)
  const center = canvas.width / 2

  for (let y = 0; y < canvas.height; y += 1) {
    const v = y / (canvas.height - 1)
    const tipFade = Math.min(1, Math.min(v, 1 - v) / 0.09)
    const bodyHeat = Math.exp(-Math.pow((v - 0.5) / 0.44, 2))
    const coreWaist = 0.72 + bodyHeat * 1.08
    const topCool = 1 - Math.min(1, v * 1.2)
    const purpleMix = Math.max(0, (v - 0.52) / 0.48)

    for (let x = 0; x < canvas.width; x += 1) {
      const dx = Math.abs(x - center)
      const core = Math.exp(-Math.pow(dx / (2.8 * coreWaist), 2))
      const innerGlow = Math.exp(-Math.pow(dx / (10.5 * coreWaist), 2)) * 0.68
      const outerGlow = Math.exp(-Math.pow(dx / (28 * coreWaist), 2)) * 0.34
      const alpha = Math.min(1, (core * 0.94 + innerGlow + outerGlow) * tipFade * (0.68 + bodyHeat * 0.48))
      const whiteMix = Math.min(0.84, core * 0.72 + bodyHeat * 0.26)
      const cyanMix = Math.max(0, 1 - purpleMix) * (0.78 + topCool * 0.22)
      const blueMix = 0.42 + bodyHeat * 0.34

      let r = 0 * cyanMix + 79 * blueMix + 139 * purpleMix
      let g = 229 * cyanMix + 140 * blueMix + 92 * purpleMix
      let b = 255

      r = r * (1 - whiteMix) + 255 * whiteMix
      g = g * (1 - whiteMix) + 255 * whiteMix
      b = b * (1 - whiteMix) + 255 * whiteMix

      const offset = (y * canvas.width + x) * 4
      image.data[offset] = Math.min(255, r)
      image.data[offset + 1] = Math.min(255, g)
      image.data[offset + 2] = Math.min(255, b)
      image.data[offset + 3] = Math.min(255, alpha * 255)
    }
  }

  context.putImageData(image, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

function createExtrudedShape(points, depth = 0.13) {
  const shape = new THREE.Shape()
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  })
  shape.closePath()

  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.026,
    bevelSize: 0.024,
    bevelSegments: 3
  })
}

function getEllipsePoint(angle, radiusX, radiusY, wobble = 0, seed = 0) {
  const ripple = Math.sin(angle * 3.1 + seed) * wobble + Math.sin(angle * 7.6 + seed * 1.3) * wobble * 0.38
  return {
    x: Math.cos(angle) * (radiusX + ripple),
    y: Math.sin(angle) * (radiusY + ripple * 0.45),
    z: Math.sin(angle * 2 + seed) * 0.015
  }
}

function seededNoise(value) {
  return Math.abs(Math.sin(value * 12.9898) * 43758.5453) % 1
}

function createSVGGeometry(shape) {
  return new THREE.ExtrudeGeometry(shape, {
    depth: 72,
    bevelEnabled: true,
    bevelThickness: 8,
    bevelSize: 9,
    bevelSegments: 3
  })
}

function EnergyParticles({ hoverBoost, intensity = 1 }) {
  const pointsRef = useRef()
  const geometry = useMemo(() => {
    const positions = []
    const colors = []
    const colorA = new THREE.Color(cyan)
    const colorB = new THREE.Color(purple)

    for (let index = 0; index < 220; index += 1) {
      const angle = index * 2.399963
      const radius = 0.8 + ((index * 17) % 100) * 0.018
      const height = -0.7 + ((index * 29) % 150) * 0.014
      const side = index % 2 === 0 ? -1 : 1
      const color = colorA.clone().lerp(colorB, (index % 37) / 36)

      positions.push(
        Math.cos(angle) * radius + side * 0.12,
        height,
        Math.sin(angle) * radius * 0.18 - 0.35
      )
      colors.push(color.r, color.g, color.b)
    }

    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return particleGeometry
  }, [])

  useFrame((state, dt) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y += dt * 0.08
    pointsRef.current.rotation.z += dt * 0.018
    pointsRef.current.material.opacity = (0.36 + Math.sin(state.clock.elapsedTime * 1.7) * 0.08 + hoverBoost.current * 0.16) * intensity
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.028}
        transparent
        opacity={0.42}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function BeamParticles({ hoverBoost, clickBurst, intensity = 1 }) {
  const pointsRef = useRef()
  const particleData = useMemo(() => Array.from({ length: 170 }, (_, index) => {
    const r1 = seededNoise(index * 1.83 + 12.4)
    const r2 = seededNoise(index * 4.11 + 3.7)
    const r3 = seededNoise(index * 8.67 + 9.2)

    return {
      baseY: -1.48 + r1 * 2.96,
      speed: 0.34 + r2 * 0.52,
      xAmp: 0.006 + r3 * 0.03,
      z: 0.06 + (r2 - 0.5) * 0.035,
      phase: r3 * Math.PI * 2,
      colorShift: r2
    }
  }), [])

  const geometry = useMemo(() => {
    const beamGeometry = new THREE.BufferGeometry()
    beamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(particleData.length * 3).fill(0), 3))
    beamGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(particleData.length * 3).fill(1), 3))
    return beamGeometry
  }, [particleData.length])

  useFrame((state) => {
    if (!pointsRef.current) return
    const positions = pointsRef.current.geometry.attributes.position.array
    const colors = pointsRef.current.geometry.attributes.color.array
    const energy = 1 + hoverBoost.current * 0.7 + clickBurst.current * 2.2
    const cyanColor = new THREE.Color(cyan)
    const blueColor = new THREE.Color(blue)
    const purpleColor = new THREE.Color(purple)

    particleData.forEach((particle, index) => {
      const rawY = particle.baseY + state.clock.elapsedTime * particle.speed * energy
      const y = ((rawY + 1.48) % 2.96) - 1.48
      const t = THREE.MathUtils.clamp((y + 1.48) / 2.96, 0, 1)
      const centerHeat = Math.pow(Math.max(0, 1 - Math.abs(t - 0.43) * 3.1), 3)
      const lowerTint = Math.pow(Math.max(0, 1 - Math.abs(t - 0.12) * 5.2), 2) * 0.14
      const beamColor = cyanColor.clone().lerp(blueColor, t * 0.75).lerp(purpleColor, lowerTint).lerp(new THREE.Color(whiteHot), centerHeat)
      const offset = index * 3

      positions[offset] = Math.sin(state.clock.elapsedTime * 3.1 + particle.phase + y * 4.4) * particle.xAmp * (1 + clickBurst.current * 1.2)
      positions[offset + 1] = y
      positions[offset + 2] = particle.z
      colors[offset] = beamColor.r
      colors[offset + 1] = beamColor.g
      colors[offset + 2] = beamColor.b
    })

    pointsRef.current.geometry.attributes.position.needsUpdate = true
    pointsRef.current.geometry.attributes.color.needsUpdate = true
    pointsRef.current.material.opacity = (0.45 + Math.sin(state.clock.elapsedTime * 7) * 0.08 + hoverBoost.current * 0.18 + clickBurst.current * 0.36) * intensity
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.026}
        transparent
        opacity={0.48}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function BeamStreaks({ hoverBoost, clickBurst, intensity = 1 }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const streakData = useMemo(() => Array.from({ length: 44 }, (_, index) => {
    const r1 = seededNoise(index * 2.19 + 4.4)
    const r2 = seededNoise(index * 6.31 + 1.9)
    const r3 = seededNoise(index * 10.1 + 7.6)

    return {
      baseY: -1.4 + r1 * 2.8,
      speed: 0.18 + r2 * 0.34,
      x: (r2 - 0.5) * 0.055,
      z: 0.075 + (r3 - 0.5) * 0.025,
      length: 0.05 + r3 * 0.15,
      width: 0.003 + r2 * 0.005,
      phase: r1 * Math.PI * 2
    }
  }), [])

  useFrame((state) => {
    if (!meshRef.current) return
    const energy = 1 + hoverBoost.current * 0.8 + clickBurst.current * 2.1
    const cyanColor = new THREE.Color(cyan)
    const purpleColor = new THREE.Color(purple)

    streakData.forEach((streak, index) => {
      const rawY = streak.baseY + state.clock.elapsedTime * streak.speed * energy
      const y = ((rawY + 1.4) % 2.8) - 1.4
      const t = THREE.MathUtils.clamp((y + 1.4) / 2.8, 0, 1)
      const hot = Math.pow(1 - Math.abs(t - 0.31) * 4.2, 2)

      dummy.position.set(
        streak.x + Math.sin(state.clock.elapsedTime * 2.6 + streak.phase) * 0.008,
        y,
        streak.z
      )
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(streak.width * (1 + clickBurst.current * 1.2), streak.length, 1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)

      color.copy(cyanColor).lerp(purpleColor, Math.max(0, 0.38 - t) * 1.8).lerp(new THREE.Color(whiteHot), hot * 0.7)
      meshRef.current.setColorAt(index, color)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
    meshRef.current.material.opacity = (0.38 + hoverBoost.current * 0.18 + clickBurst.current * 0.42) * intensity
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, streakData.length]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.38}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}

function DiskAura({ intensity = 1 }) {
  const textures = useMemo(() => ({
    cyan: createRadialGlowTexture('rgba(0,229,255,1)'),
    purple: createRadialGlowTexture('rgba(139,92,246,1)'),
    blue: createRadialGlowTexture('rgba(79,140,255,1)')
  }), [])

  return (
    <group position={[0, 0, -0.035]}>
      <sprite position={[-0.45, -0.02, 0]} scale={[2.35, 0.42, 1]}>
        <spriteMaterial map={textures.cyan} transparent opacity={0.14 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite position={[0.58, -0.02, 0.01]} scale={[2.2, 0.42, 1]}>
        <spriteMaterial map={textures.purple} transparent opacity={0.13 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite position={[0, -0.02, -0.01]} scale={[2.8, 0.34, 1]}>
        <spriteMaterial map={textures.blue} transparent opacity={0.08 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

function ParticleAccretionCloud({
  hoverBoost,
  clickBurst,
  intensity = 1,
  count = 900,
  size = 0.018,
  front = false,
  hot = false,
  seed = 1,
  opacity = 0.42
}) {
  const pointsRef = useRef()
  const particleData = useMemo(() => Array.from({ length: count }, (_, index) => {
    const r1 = seededNoise(index + seed)
    const r2 = seededNoise(index * 2.31 + seed)
    const r3 = seededNoise(index * 5.77 + seed)
    const r4 = seededNoise(index * 9.13 + seed)
    const arm = index % 7
    const armAngle = (arm / 7) * Math.PI * 2
    const radiusNoise = Math.pow(r1, hot ? 2.4 : 0.72)
    const spiralTwist = radiusNoise * (hot ? 2.8 : 4.7)
    const armJitter = (r2 - 0.5) * (hot ? 0.18 : 0.42)
    const frontAngle = Math.PI * (1.0 + r2 * 1.0)
    const spiralAngle = armAngle + spiralTwist + armJitter + Math.sin(radiusNoise * 9.2 + seed) * 0.12
    const angle = front
      ? THREE.MathUtils.lerp(spiralAngle, frontAngle, hot ? 0.76 : 0.52)
      : spiralAngle
    const radius = hot
      ? 0.72 + radiusNoise * 0.48
      : 0.34 + radiusNoise * 1.58
    const scatter = Math.pow(r4, 1.8)

    return {
      angle,
      speed: (front ? 0.13 : 0.055) + r3 * (front ? 0.1 : 0.045),
      radiusX: radius * (1.16 + r3 * 0.28),
      radiusY: radius * (0.38 + r2 * 0.12),
      wobble: 0.026 + r3 * 0.075,
      seed: seed + index * 1.91,
      radiusNoise,
      arm,
      yScatter: (r3 - 0.5) * (hot ? 0.07 : 0.26) * (0.55 + scatter),
      zBias: front ? 0.14 + r4 * 0.12 : -0.12 - r4 * 0.18,
      opacity: (hot ? 0.72 : 0.28) + r2 * (hot ? 0.28 : 0.4),
      colorAccent: r2,
      whiteness: hot ? 0.22 + r4 * 0.42 : r3 * 0.18
    }
  }), [count, front, hot, seed])

  const geometry = useMemo(() => {
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(particleData.length * 3).fill(0), 3))
    particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(particleData.length * 3).fill(1), 3))
    return particleGeometry
  }, [particleData.length])

  useFrame((state) => {
    if (!pointsRef.current) return
    const positions = pointsRef.current.geometry.attributes.position.array
    const colors = pointsRef.current.geometry.attributes.color.array
    const energy = 1 + hoverBoost.current * 0.85 + clickBurst.current * 2.3

    particleData.forEach((particle, index) => {
      const armShear = Math.sin(state.clock.elapsedTime * 0.22 + particle.radiusNoise * 5.5 + particle.arm) * 0.055
      const angle = particle.angle + state.clock.elapsedTime * particle.speed * energy + armShear
      const breathing = 1 + Math.sin(state.clock.elapsedTime * 0.55 + particle.seed) * 0.018
      const point = getEllipsePoint(
        angle,
        particle.radiusX * breathing,
        particle.radiusY * breathing,
        particle.wobble,
        particle.seed
      )
      const sideMix = THREE.MathUtils.clamp((Math.cos(angle) + 1) / 2, 0, 1)
      const frontHeat = front ? Math.max(0, -Math.sin(angle)) : 0
      const coreHeat = hot ? 0.58 : frontHeat * 0.3
      const hotMix = THREE.MathUtils.clamp(particle.whiteness * coreHeat, 0, hot ? 0.46 : 0.16)
      const blueMix = Math.sin(particle.seed * 1.7) * 0.5 + 0.5
      const accentPulse = 0.85 + Math.sin(state.clock.elapsedTime * 1.4 + particle.seed) * 0.15
      const cyanR = 0.0
      const cyanG = 0.88
      const cyanB = 1.0
      const blueR = 0.18
      const blueG = 0.48
      const blueB = 1.0
      const purpleR = 0.62
      const purpleG = 0.28
      const purpleB = 1.0
      const magentaR = 0.95
      const magentaG = 0.2
      const magentaB = 1.0
      const coldR = cyanR * (1 - blueMix * 0.42) + blueR * blueMix * 0.42
      const coldG = cyanG * (1 - blueMix * 0.42) + blueG * blueMix * 0.42
      const coldB = cyanB
      const hotR = purpleR * (1 - particle.colorAccent * 0.32) + magentaR * particle.colorAccent * 0.32
      const hotG = purpleG * (1 - particle.colorAccent * 0.32) + magentaG * particle.colorAccent * 0.32
      const hotB = purpleB
      const baseR = coldR * (1 - sideMix) + hotR * sideMix
      const baseG = coldG * (1 - sideMix) + hotG * sideMix
      const baseB = coldB * (1 - sideMix) + hotB * sideMix
      const offset = index * 3
      positions[offset] = point.x
      positions[offset + 1] = point.y + particle.yScatter + Math.sin(state.clock.elapsedTime * 1.3 + particle.seed) * 0.006
      positions[offset + 2] = point.z + particle.zBias
      colors[offset] = (baseR * (1 - hotMix) + hotMix) * accentPulse
      colors[offset + 1] = (baseG * (1 - hotMix) + hotMix) * accentPulse
      colors[offset + 2] = (baseB * (1 - hotMix) + hotMix) * accentPulse
    })

    pointsRef.current.geometry.attributes.position.needsUpdate = true
    pointsRef.current.geometry.attributes.color.needsUpdate = true
    pointsRef.current.material.opacity = (opacity + Math.sin(state.clock.elapsedTime * 2.2 + seed) * 0.05 + clickBurst.current * 0.22) * intensity
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={size}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function OrbitingDashFragments({
  hoverBoost,
  clickBurst,
  intensity = 1,
  count = 140,
  front = false,
  hot = false,
  seed = 1,
  opacity = 0.3
}) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const fragmentData = useMemo(() => Array.from({ length: count }, (_, index) => {
    const r1 = seededNoise(index + seed)
    const r2 = seededNoise(index * 3.19 + seed)
    const r3 = seededNoise(index * 6.43 + seed)
    const r4 = seededNoise(index * 11.31 + seed)
    const arm = index % 5
    const radius = hot
      ? 0.78 + Math.pow(r1, 2.8) * 0.34
      : 0.48 + Math.pow(r1, 0.82) * 1.26
    const frontAngle = Math.PI * (1.08 + r2 * 0.84)
    const radiusNorm = THREE.MathUtils.clamp((radius - 0.48) / 1.26, 0, 1)
    const spiralAngle = (arm / 5) * Math.PI * 2 + radiusNorm * (hot ? 2.3 : 4.1) + (r2 - 0.5) * 0.38

    return {
      angle: front ? THREE.MathUtils.lerp(spiralAngle, frontAngle, hot ? 0.72 : 0.48) : spiralAngle,
      speed: (front ? 0.18 : 0.07) + r3 * (front ? 0.16 : 0.08),
      radiusX: radius * (1.12 + r3 * 0.18),
      radiusY: radius * (0.34 + r2 * 0.08),
      wobble: 0.012 + r4 * 0.045,
      seed: seed + index * 2.41,
      radiusNorm,
      arm,
      length: (hot ? 0.035 : 0.022) + r3 * (hot ? 0.07 : 0.05),
      width: (hot ? 0.0045 : 0.003) + r4 * 0.005,
      zBias: front ? 0.18 + r1 * 0.06 : -0.16 - r1 * 0.12,
      yScatter: (r4 - 0.5) * (hot ? 0.025 : 0.075),
      colorAccent: r3,
      brightness: (hot ? 0.32 : 0.18) + r1 * (hot ? 0.3 : 0.22)
    }
  }), [count, front, hot, seed])

  useFrame((state) => {
    if (!meshRef.current) return
    const energy = 1 + hoverBoost.current * 0.9 + clickBurst.current * 2.4

    fragmentData.forEach((fragment, index) => {
      const armShear = Math.sin(state.clock.elapsedTime * 0.25 + fragment.radiusNorm * 4.8 + fragment.arm) * 0.06
      const angle = fragment.angle + state.clock.elapsedTime * fragment.speed * energy + armShear
      const point = getEllipsePoint(angle, fragment.radiusX, fragment.radiusY, fragment.wobble, fragment.seed)
      const tangentX = -Math.sin(angle) * fragment.radiusX
      const tangentY = Math.cos(angle) * fragment.radiusY
      const sideMix = THREE.MathUtils.clamp((Math.cos(angle) + 1) / 2, 0, 1)
      const frontHeat = front ? Math.max(0, -Math.sin(angle)) : 0
      const whiteMix = THREE.MathUtils.clamp(fragment.brightness * (hot ? 0.62 : frontHeat * 0.28), 0, hot ? 0.42 : 0.14)
      const cyanColor = new THREE.Color(0x00e5ff)
      const blueColor = new THREE.Color(0x4f8cff)
      const purpleColor = new THREE.Color(0x8b5cf6)
      const magentaColor = new THREE.Color(0xf15cff)

      dummy.position.set(
        point.x,
        point.y + fragment.yScatter + Math.sin(state.clock.elapsedTime * 1.6 + fragment.seed) * 0.004,
        point.z + fragment.zBias
      )
      dummy.rotation.set(0, 0, Math.atan2(tangentY, tangentX))
      dummy.scale.set(fragment.length * (1 + clickBurst.current * 0.65), fragment.width, 1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(index, dummy.matrix)

      color.copy(cyanColor)
        .lerp(blueColor, (1 - sideMix) * fragment.colorAccent * 0.38)
        .lerp(purpleColor, sideMix)
        .lerp(magentaColor, sideMix * fragment.colorAccent * 0.25)
        .lerp(new THREE.Color(whiteHot), whiteMix)
      meshRef.current.setColorAt(index, color)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
    meshRef.current.material.opacity = (opacity + Math.sin(state.clock.elapsedTime * 2.6 + seed) * 0.035 + clickBurst.current * 0.18) * intensity
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}

function BackAccretionDisk({ hoverBoost, clickBurst, intensity = 1 }) {
  return (
    <group position={[0.04, -0.78, -0.38]} scale={[1.36, 0.68, 1]}>
      <DiskAura intensity={intensity} />
      <ParticleAccretionCloud hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} count={620} size={0.04} seed={73.6} opacity={0.075} />
      <ParticleAccretionCloud hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} count={1900} size={0.012} seed={2.5} opacity={0.22} />
      <ParticleAccretionCloud hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} count={820} size={0.021} seed={8.8} opacity={0.17} />
      <OrbitingDashFragments hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} count={150} seed={14.2} opacity={0.14} />
    </group>
  )
}

function FrontAccretionDisk({ hoverBoost, clickBurst, intensity = 1 }) {
  return (
    <group position={[0.04, -0.78, 0.26]} scale={[1.36, 0.68, 1]}>
      <ParticleAccretionCloud hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} count={560} size={0.05} front seed={89.2} opacity={0.13} />
      <ParticleAccretionCloud hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} count={1650} size={0.016} front seed={21.3} opacity={0.42} />
      <ParticleAccretionCloud hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} count={620} size={0.031} front hot seed={35.1} opacity={0.68} />
      <OrbitingDashFragments hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} count={220} front seed={42.9} opacity={0.4} />
      <OrbitingDashFragments hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} count={95} front hot seed={61.4} opacity={0.58} />
    </group>
  )
}

function CompactRingParticles({ hoverBoost, clickBurst, intensity = 1 }) {
  const pointsRef = useRef()
  const particleData = useMemo(() => Array.from({ length: 420 }, (_, index) => {
    const r1 = seededNoise(index * 2.17 + 5.8)
    const r2 = seededNoise(index * 4.73 + 11.2)
    const r3 = seededNoise(index * 8.91 + 2.4)
    const band = index % 3
    const baseAngle = (index / 420) * Math.PI * 2 + (r1 - 0.5) * 0.12
    const radiusX = 0.88 + band * 0.12 + (r2 - 0.5) * 0.08
    const radiusY = 0.28 + band * 0.035 + (r3 - 0.5) * 0.025

    return {
      angle: baseAngle,
      speed: 0.18 + r2 * 0.18,
      radiusX,
      radiusY,
      z: -0.02 + band * 0.045 + (r1 - 0.5) * 0.035,
      phase: r3 * Math.PI * 2,
      sizeBias: r1
    }
  }), [])

  const geometry = useMemo(() => {
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(particleData.length * 3).fill(0), 3))
    particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(particleData.length * 3).fill(1), 3))
    return particleGeometry
  }, [particleData.length])

  useFrame((state) => {
    if (!pointsRef.current) return
    const positions = pointsRef.current.geometry.attributes.position.array
    const colors = pointsRef.current.geometry.attributes.color.array
    const energy = 1 + hoverBoost.current * 0.7 + clickBurst.current * 1.8
    const cyanColor = new THREE.Color(cyan)
    const blueColor = new THREE.Color(blue)
    const purpleColor = new THREE.Color(purple)

    particleData.forEach((particle, index) => {
      const angle = particle.angle + state.clock.elapsedTime * particle.speed * energy
      const frontArc = Math.max(0, -Math.sin(angle))
      const sideMix = THREE.MathUtils.clamp((Math.cos(angle) + 1) / 2, 0, 1)
      const twinkle = 0.72 + Math.sin(state.clock.elapsedTime * 3.4 + particle.phase) * 0.28
      const color = cyanColor.clone()
        .lerp(blueColor, 0.28 + frontArc * 0.2)
        .lerp(purpleColor, sideMix * 0.55)
        .lerp(new THREE.Color(whiteHot), frontArc * 0.45)
      const offset = index * 3

      positions[offset] = Math.cos(angle) * particle.radiusX
      positions[offset + 1] = Math.sin(angle) * particle.radiusY + Math.sin(state.clock.elapsedTime * 1.8 + particle.phase) * 0.012
      positions[offset + 2] = particle.z
      colors[offset] = color.r * twinkle
      colors[offset + 1] = color.g * twinkle
      colors[offset + 2] = color.b * twinkle
    })

    pointsRef.current.geometry.attributes.position.needsUpdate = true
    pointsRef.current.geometry.attributes.color.needsUpdate = true
    pointsRef.current.material.opacity = (0.72 + hoverBoost.current * 0.16 + clickBurst.current * 0.28) * intensity
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.04}
        transparent
        opacity={0.72}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function CompactAccretionDisk({ hoverBoost, clickBurst, intensity = 1 }) {
  return (
    <group position={[0.02, -0.56, 0.18]} rotation={[Math.PI / 2.85, 0, 0]} scale={[1.18, 0.58, 1]}>
      <CompactRingParticles hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} />
      <OrbitingDashFragments hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} count={46} front seed={44.7} opacity={0.38} />
    </group>
  )
}

function PlasmaBeam({ hoverBoost, clickBurst, intensity = 1 }) {
  const coreRef = useRef()
  const columnRef = useRef()
  const innerGlowRef = useRef()
  const auraRef = useRef()
  const textures = useMemo(() => ({
    whitePurple: createRadialGlowTexture('rgba(245,208,254,1)'),
    cyan: createRadialGlowTexture('rgba(0,229,255,1)'),
    blue: createRadialGlowTexture('rgba(79,140,255,1)'),
    purple: createRadialGlowTexture('rgba(139,92,246,1)'),
    beamAura: createTaperedBeamTexture({
      top: 'rgba(0,229,255,0.72)',
      middle: 'rgba(79,140,255,0.95)',
      bottom: 'rgba(139,92,246,0.72)',
      glow: 'rgba(0,229,255,0.65)'
    }),
    beamCore: createTaperedBeamTexture({
      top: 'rgba(0,229,255,1)',
      middle: 'rgba(255,255,255,1)',
      bottom: 'rgba(245,208,254,1)',
      glow: 'rgba(255,255,255,0.95)',
      core: true
    }),
    beamCyan: createTaperedBeamTexture({
      top: 'rgba(0,229,255,1)',
      middle: 'rgba(179,246,255,0.9)',
      bottom: 'rgba(79,140,255,0.58)',
      glow: 'rgba(0,229,255,0.75)'
    }),
    beamPurple: createTaperedBeamTexture({
      top: 'rgba(79,140,255,0.46)',
      middle: 'rgba(245,208,254,0.88)',
      bottom: 'rgba(139,92,246,0.95)',
      glow: 'rgba(139,92,246,0.7)'
    }),
    beamColumn: createContinuousBeamTexture()
  }), [])

  useFrame((state) => {
    const energy = intensity * (1 + hoverBoost.current * 0.7 + clickBurst.current * 1.9)
    if (coreRef.current) {
      coreRef.current.scale.x = 1 + Math.sin(state.clock.elapsedTime * 9) * 0.08 + clickBurst.current * 0.45
      coreRef.current.material.opacity = 0.86 * energy
    }
    if (columnRef.current) {
      columnRef.current.scale.x = 1 + Math.sin(state.clock.elapsedTime * 4.7) * 0.05 + clickBurst.current * 0.45
      columnRef.current.material.opacity = (0.74 + hoverBoost.current * 0.16 + clickBurst.current * 0.22) * intensity
    }
    if (innerGlowRef.current) {
      innerGlowRef.current.scale.x = 1 + Math.sin(state.clock.elapsedTime * 5.3) * 0.1 + clickBurst.current * 0.75
      innerGlowRef.current.material.opacity = (0.34 + hoverBoost.current * 0.18 + clickBurst.current * 0.28) * intensity
    }
    if (auraRef.current) {
      auraRef.current.scale.x = 0.92 + Math.sin(state.clock.elapsedTime * 2.2) * 0.05 + clickBurst.current * 0.35
      auraRef.current.material.opacity = (0.18 + hoverBoost.current * 0.08 + clickBurst.current * 0.18) * intensity
    }
  })

  return (
    <group position={[0.12, -0.06, 0.05]}>
      <sprite ref={auraRef} position={[0.01, 0.0, -0.015]} scale={[0.62, 3.02, 1]}>
        <spriteMaterial map={textures.blue} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <mesh ref={innerGlowRef} position={[0, 0, 0.035]}>
        <planeGeometry args={[0.36, 2.92]} />
        <meshBasicMaterial map={textures.beamAura} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={columnRef} position={[0, 0, 0.048]}>
        <planeGeometry args={[0.32, 3.02]} />
        <meshBasicMaterial map={textures.beamColumn} transparent opacity={0.86} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={coreRef} position={[0, 0, 0.055]}>
        <planeGeometry args={[0.062, 3.0]} />
        <meshBasicMaterial map={textures.beamCore} transparent opacity={0.76} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.021, 0.38, 0.052]}>
        <planeGeometry args={[0.11, 2.42]} />
        <meshBasicMaterial map={textures.beamCyan} transparent opacity={0.24 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.019, -0.62, 0.052]}>
        <planeGeometry args={[0.11, 2.22]} />
        <meshBasicMaterial map={textures.beamPurple} transparent opacity={0.22 * intensity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <BeamParticles hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} />
      <BeamStreaks hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} />
    </group>
  )
}

function KLMonogram({ hoverBoost, clickBurst, intensity = 1 }) {
  const groupRef = useRef()
  const svgData = useLoader(SVGLoader, '/assets/kl-mark.svg')
  const materials = useMemo(() => {
    const makeMaterial = (color, emissive) => new THREE.MeshPhysicalMaterial({
      color,
      emissive,
      emissiveIntensity: 1.35 * intensity,
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.06,
      thickness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      reflectivity: 0.9,
      transparent: false,
      opacity: 1,
      side: THREE.DoubleSide
    })

    return {
      cyan: makeMaterial('#075985', '#0891B2'),
      blue: makeMaterial('#0B2F6B', '#1D4ED8'),
      purple: makeMaterial('#8B38FF', '#7C2DFF'),
      hot: makeMaterial('#EAFBFF', cyan),
      plasmaCyan: new THREE.MeshBasicMaterial({
        color: '#22D3EE',
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      plasmaBlue: new THREE.MeshBasicMaterial({
        color: '#38BDF8',
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      plasmaPurple: new THREE.MeshBasicMaterial({
        color: '#A855F7',
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    }
  }, [intensity])

  const logoParts = useMemo(() => {
    const mainPathIndexes = new Set(['4', '16', '22'])
    const parts = []
    const bounds = new THREE.Box3()

    svgData.paths.forEach((path) => {
      const node = path.userData?.node
      const index = node?.getAttribute('data-index')
      if (!mainPathIndexes.has(index)) return

      SVGLoader.createShapes(path).forEach((shape) => {
        const geometry = createSVGGeometry(shape)
        geometry.computeBoundingBox()
        bounds.union(geometry.boundingBox)
        parts.push({ index, geometry })
      })
    })

    const center = new THREE.Vector3()
    bounds.getCenter(center)
    const scale = 0.00134

    return parts.map((part) => {
      part.geometry.translate(-center.x, -center.y, -36)
      part.geometry.scale(scale, -scale, scale)
      part.geometry.computeVertexNormals()

      return {
        ...part,
        edgeGeometry: new THREE.EdgesGeometry(part.geometry, 24)
      }
    })
  }, [svgData])

  useFrame((state) => {
    if (!groupRef.current) return
    const hover = hoverBoost.current
    const burst = clickBurst.current
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.025
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.06

    Object.values(materials).forEach((material) => {
      if (material.isMeshPhysicalMaterial) {
        material.emissiveIntensity = (1.35 + hover * 0.75 + burst * 1.6) * intensity
        material.opacity = 1
      } else {
        const hex = material.color?.getHexString()
        material.opacity = (hex === 'a855f7' ? 0.1 : hex === '4f8cff' ? 0.14 : 0.08) + hover * 0.035 + burst * 0.06
      }
    })
  })

  return (
    <group ref={groupRef} position={[0, 0.12, 0]} scale={LOGO_MODEL_SCALE}>
      {logoParts.map((part, index) => {
        const isLowerK = part.index === '16'
        const isL = part.index === '22'
        const material = isL ? materials.purple : isLowerK ? materials.blue : materials.cyan
        const plasmaMaterial = isL ? materials.plasmaPurple : isLowerK ? materials.plasmaBlue : materials.plasmaCyan
        const edgeColor = isL ? '#F5D0FE' : isLowerK ? '#BFDBFE' : '#DDFBFF'

        return (
          <group key={`${part.index}-${index}`}>
            <mesh geometry={part.geometry} material={material} />
            <mesh geometry={part.geometry} material={plasmaMaterial} position={[0, 0, 0.14]} scale={[0.985, 0.985, 1]} />
            {isLowerK && <mesh geometry={part.geometry} material={materials.plasmaBlue} position={[0, 0, 0.2]} scale={[1.01, 1.01, 1]} />}
            <lineSegments geometry={part.edgeGeometry} position={[0, 0, 0.16]}>
              <lineBasicMaterial color={edgeColor} transparent opacity={isLowerK ? 0.96 : 0.82} blending={THREE.AdditiveBlending} />
            </lineSegments>
            <lineSegments geometry={part.edgeGeometry} position={[0, 0, 0.18]}>
              <lineBasicMaterial color={isL ? purple : isLowerK ? '#38BDF8' : cyan} transparent opacity={isLowerK ? 0.92 : 0.72} blending={THREE.AdditiveBlending} />
            </lineSegments>
          </group>
        )
      })}

    </group>
  )
}

function HolographicScene({
  hovered,
  burstToken,
  autoRotate = true,
  showParticles = true,
  showRing = true,
  showBeam = true,
  intensity = 1,
  sceneScale = 1
}) {
  const hoverBoost = useRef(0)
  const clickBurst = useRef(0)
  const lastBurst = useRef(burstToken)
  const sceneRef = useRef()

  useFrame((state, dt) => {
    hoverBoost.current = THREE.MathUtils.lerp(hoverBoost.current, hovered ? 1 : 0, 0.08)
    if (lastBurst.current !== burstToken) {
      clickBurst.current = 1
      lastBurst.current = burstToken
    }
    clickBurst.current = Math.max(0, clickBurst.current - dt * 1.8)

    if (sceneRef.current && autoRotate) {
      sceneRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.55) * 0.015
    }
  })

  return (
    <group ref={sceneRef} scale={sceneScale}>
      <ambientLight intensity={0.25} />
      <pointLight position={[-1.4, 0.4, 2.2]} intensity={2.8 * intensity} color={cyan} distance={5} />
      <pointLight position={[1.2, -0.2, 2.2]} intensity={2.4 * intensity} color={purple} distance={5} />
      {showRing && <BackAccretionDisk hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} />}
      {showBeam && <PlasmaBeam hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} />}
      <KLMonogram hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} />
      {showRing && <FrontAccretionDisk hoverBoost={hoverBoost} clickBurst={clickBurst} intensity={intensity} />}
      {showParticles && <EnergyParticles hoverBoost={hoverBoost} intensity={intensity} />}
    </group>
  )
}

export default function HolographicKLLogo({
  className = '',
  cameraDistance = 5.9,
  autoRotate = true,
  showParticles = true,
  showRing = true,
  showBeam = true,
  intensity = 1,
  sceneScale = 1,
  showMask = true,
  interactive = true,
  compact = false
}) {
  const [hovered, setHovered] = useState(false)
  const [burstToken, setBurstToken] = useState(0)
  const canvasMask = compact
    ? 'radial-gradient(ellipse at 50% 56%, #000 0%, #000 62%, rgba(0,0,0,0.76) 74%, rgba(0,0,0,0.22) 88%, transparent 100%)'
    : 'radial-gradient(circle at 50% 50%, #000 0%, #000 58%, rgba(0,0,0,0.78) 70%, rgba(0,0,0,0.24) 82%, transparent 96%)'
  const logoFilter = compact
    ? 'none'
    : 'drop-shadow(0 0 10px rgba(0,229,255,0.85)) drop-shadow(0 0 18px rgba(139,92,246,0.55))'

  return (
    <motion.div
      className={`relative h-full w-full ${className}`}
      style={{
        background: 'transparent',
        filter: logoFilter,
        WebkitMaskImage: showMask ? canvasMask : undefined,
        maskImage: showMask ? canvasMask : undefined
      }}
      onPointerEnter={() => interactive && setHovered(true)}
      onPointerLeave={() => interactive && setHovered(false)}
      onClick={() => interactive && setBurstToken((value) => value + 1)}
      aria-label="Karl Lopez holographic KL logo"
      role="img"
    >
      <Canvas
        className="!overflow-visible !bg-transparent"
        style={{ background: 'transparent' }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, cameraDistance], fov: 43 }}
        gl={{
          alpha: true,
          antialias: true,
          premultipliedAlpha: false,
          powerPreference: 'high-performance'
        }}
        onCreated={({ gl, scene }) => {
          scene.background = null
          gl.setClearAlpha(0)
          gl.setClearColor(0x000000, 0)
        }}
      >
        <HolographicScene
          hovered={hovered}
          burstToken={burstToken}
          autoRotate={autoRotate}
          showParticles={showParticles}
          showRing={showRing}
          showBeam={showBeam}
          intensity={intensity}
          sceneScale={sceneScale}
        />
      </Canvas>
    </motion.div>
  )
}
