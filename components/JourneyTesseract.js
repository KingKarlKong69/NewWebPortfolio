import { useFrame, useThree } from '@react-three/fiber'
import { createRef, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import HeroTesseractModel from './HeroTesseractModel'

const MODEL_REF_NAMES = [
  'outerCubeRef', 'middleCubeRef', 'innerCubeRef', 'innerGroupRef', 'coreRef',
  'ringARef', 'ringBRef', 'ringCRef', 'pulseRef',
  'outerMaterialRef', 'middleMaterialRef', 'innerMaterialRef', 'coreMaterialRef',
  'ringAMaterialRef', 'ringBMaterialRef', 'ringCMaterialRef',
  'outerEdgeMaterialRef', 'middleEdgeMaterialRef', 'innerEdgeMaterialRef'
]
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback
const clamp01 = (value) => THREE.MathUtils.clamp(finite(value, 0), 0, 1)
const PARTICLE_COUNT = 128
const particleVertexShader = `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uHeight;
  uniform float uCharge;
  uniform float uAscent;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vLight;
  void main() {
    float life = fract(aSeed.x + uTime * (0.23 + uCharge * 0.30 + uAscent * 0.95));
    float angle = aSeed.y * 6.283185 + uTime * (0.25 + aSeed.z * 0.55);
    float radius = uHeight * (0.009 + life * 0.019) * (0.4 + uCharge * 0.6);
    vec3 local = vec3(
      cos(angle) * radius * (0.45 + aSeed.w * 0.55),
      sin(angle * 1.21 + aSeed.z * 5.0) * radius,
      sin(angle * 0.73) * radius * 0.5
    );
    // On ascent, short-lived points trail just beneath the moving object.
    // They remain individual particles, without a beam or persistent line.
    vec3 wake = vec3(
      (sin(angle) + sin(angle * 1.7) * 0.25) * uHeight * 0.008 * (0.25 + life * 0.7),
      -uHeight * (0.008 + life * 0.11),
      cos(angle * 1.3) * uHeight * 0.003
    );
    local = mix(local, wake, smoothstep(0.0, 0.06, uAscent));
    vAlpha = smoothstep(0.0, 0.07, life) * (1.0 - smoothstep(0.62, 1.0, life));
    vLight = aSeed.w;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(local, 1.0);
    gl_PointSize = (1.1 + aSeed.z * 1.5 + uCharge * 0.5) * uPixelRatio;
  }
`
const particleFragmentShader = `
  uniform float uOpacity;
  varying float vAlpha;
  varying float vLight;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    if (radius >= 1.0) discard;
    float feather = exp(-radius * radius * 4.5) * (1.0 - smoothstep(0.65, 1.0, radius));
    vec3 color = mix(vec3(0.22, 0.79, 1.0), vec3(0.84, 0.97, 1.0), vLight);
    gl_FragColor = vec4(color, feather * vAlpha * uOpacity);
  }
`

// A controlled placement of the actual Hero model. Only its scene choreography
// changes; all nested cubes, edge overlays, energy core and rings are shared.
export default function JourneyTesseract({ frameRef }) {
  const viewport = useThree((state) => state.viewport)
  const gl = useThree((state) => state.gl)
  const rootRef = useRef()
  const rotatingRef = useRef()
  const modelRef = useRef()
  const materialsRef = useRef(null)
  const modelRefs = useMemo(() => Object.fromEntries(MODEL_REF_NAMES.map((name) => [name, createRef()])), [])
  const white = useMemo(() => new THREE.Color('#E9FEFF'), [])
  const neonRed=useMemo(()=>new THREE.Color('#ff173d'),[])
  const spinRef=useRef(0)
  const chargeRef=useRef(0)
  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const seeds = new Float32Array(PARTICLE_COUNT * 4)
    for (let index = 0; index < seeds.length; index += 1) {
      const random = Math.sin((index + 1) * 127.1 + 311.7) * 43758.5453
      seeds[index] = random - Math.floor(random)
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
    return geometry
  }, [])
  const particleUniforms = useMemo(() => ({
    uOpacity: {value: 0},
    uTime: {value: 0},
    uHeight: {value: 1},
    uCharge: {value: 0},
    uAscent: {value: 0},
    uPixelRatio: {value: 1}
  }), [])
  useEffect(() => () => particleGeometry.dispose(), [particleGeometry])

  useFrame((_, frameDelta) => {
    const frame = frameRef.current
    if (!rootRef.current || !frame) return
    const opacity = clamp01(frame.coreOpacity)
    rootRef.current.visible = opacity > 0.001
    if (!rootRef.current.visible) return

    const dt = Math.min(frameDelta, 0.05)
    const elapsed = finite(frame.elapsed, 0)
    chargeRef.current+=(clamp01(frame.coreCharge)-chargeRef.current)*(1-Math.exp(-dt*9))
    const charge = chargeRef.current
    const absorption = clamp01(frame.absorption)
    const ascend = clamp01(frame.ascend)
    const targetSpeed=Math.max(finite(frame.spinSpeed,0),finite(frame.carouselSpeed,0)*4)
    spinRef.current+=(targetSpeed-spinRef.current)*(1-Math.exp(-dt*7))
    const speed = THREE.MathUtils.clamp(spinRef.current, 0, 32)
    const height = viewport.height
    rootRef.current.position.set(
      (finite(frame.coreX, 0.5) - 0.5) * viewport.width,
      (0.5 - finite(frame.coreY, 0.5)) * height,
      0
    )
    // The original outer ring has a diameter of 10.4 model units. Its full
    // The larger core occupies the actual hollow center of the photo cylinder.
    const modelScale = height * 0.30 / 10.4 * Math.max(0, finite(frame.coreScale, 1))
    rotatingRef.current.scale.setScalar(modelScale)
    const resistance = charge * charge * (1 - Math.min(1, speed / 6))
    rotatingRef.current.position.set(
      Math.sin(elapsed * 43) * height * 0.0012 * resistance,
      Math.sin(elapsed * 37 + 1.1) * height * 0.0007 * resistance,
      0
    )
    rotatingRef.current.rotation.y += dt * 0.35 * (1 + speed)
    rotatingRef.current.rotation.x += dt * (Math.sin(elapsed * 0.5) * 0.3 + speed * 0.42)
    rotatingRef.current.rotation.z += dt * Math.cos(elapsed * 0.4) * 0.2

    const inner = modelRefs.innerGroupRef.current
    if (inner) {
      inner.rotation.y -= dt * 0.25 * (1 + speed * 0.55)
      inner.rotation.x -= dt * 0.15
      inner.scale.setScalar(1 + Math.sin(elapsed) * 0.04 - charge * 0.17)
    }
    const rings = [modelRefs.ringARef.current, modelRefs.ringBRef.current, modelRefs.ringCRef.current]
    const ringEnergy = 1 + speed * 3
    if (rings[0]) {
      rings[0].rotation.z += dt * 0.11 * ringEnergy
      rings[0].rotation.x += dt * 0.03 * (1 + speed * 2)
    }
    if (rings[1]) {
      rings[1].rotation.y -= dt * 0.075 * ringEnergy
      rings[1].rotation.z += dt * 0.02 * (1 + speed)
    }
    if (rings[2]) {
      rings[2].rotation.x += dt * 0.06 * ringEnergy
      rings[2].rotation.y += dt * 0.035 * (1 + speed * 2)
    }
    if (modelRefs.coreRef.current) modelRefs.coreRef.current.scale.setScalar(0.3 * (1 - charge * 0.12))

    // Cache every actual shared material, including the two small inner rings,
    // so visibility/charging never leaves a partially faded model behind.
    if (!materialsRef.current && modelRef.current) {
      const materials = []
      modelRef.current.traverse((object) => {
        const material = object.material
        if (!material) return
        // Rear photo surfaces draw before this core; front surfaces draw after
        // it. Depth testing keeps the tesseract inside the same 3D cylinder.
        object.renderOrder = 0
        material.depthTest = true
        material.depthWrite = false
        const energy = material === modelRefs.coreMaterialRef.current || object.geometry?.type === 'TorusGeometry'
        materials.push({material, energy, opacity: material.opacity, color: material.color?.clone(), emissive: material.emissive?.clone(), intensity: material.emissiveIntensity})
      })
      materialsRef.current = materials
    }
    materialsRef.current?.forEach((base) => {
      const material = base.material
      // Keep the Hero's translucent cube faces at their original opacity.
      // Charge lives in the energy core and rings, never a solid white box.
      material.opacity = base.opacity * opacity
      const energy = charge
      const chargedColor=frame.finalCharge?neonRed:white
      if (base.color) material.color.copy(base.color).lerp(chargedColor, energy*.95)
      if (base.emissive) {
        material.emissive.copy(base.emissive).lerp(chargedColor, energy*.98)
        material.emissiveIntensity = base.intensity + energy*(base.energy?3.5:1.8)
      }
    })

    particleUniforms.uTime.value = elapsed
    particleUniforms.uHeight.value = height
    particleUniforms.uCharge.value = charge
    particleUniforms.uAscent.value = ascend
    particleUniforms.uPixelRatio.value = Math.min(2, gl.getPixelRatio())
    particleUniforms.uOpacity.value = opacity * Math.max(charge * 0.28, absorption * 0.16, ascend * 0.9)
  })

  return <group ref={rootRef} visible={false}>
    <ambientLight intensity={0.6} color="#ffffff" />
    <directionalLight intensity={1.0} position={[8, 8, 8]} color="#00DDFF" />
    <pointLight intensity={2.0} position={[-8, -8, 8]} color="#0099FF" distance={50} />
    <pointLight intensity={1.5} position={[0, 0, 0]} color="#00FFFF" distance={10} />

    <group ref={rotatingRef}>
      <group ref={modelRef}><HeroTesseractModel modelRefs={modelRefs} /></group>
    </group>
    <points geometry={particleGeometry} frustumCulled={false} renderOrder={0}>
      <shaderMaterial uniforms={particleUniforms} transparent blending={THREE.AdditiveBlending}
        depthWrite={false} depthTest={true} toneMapped={false} vertexShader={particleVertexShader} fragmentShader={particleFragmentShader} />
    </points>
  </group>
}
