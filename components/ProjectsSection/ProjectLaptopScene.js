import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import styles from './ProjectsSection.module.css'

const SCREEN_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SCREEN_FRAGMENT_SHADER = `
  uniform sampler2D uCurrentTexture;
  uniform sampler2D uNextTexture;
  uniform vec2 uCurrentResolution;
  uniform vec2 uNextResolution;
  uniform float uMixFactor;
  uniform float uTime;
  varying vec2 vUv;

  vec2 coverUv(vec2 uv, vec2 imageResolution) {
    float viewportAspect = 1.7777778;
    float imageAspect = imageResolution.x / max(imageResolution.y, 1.0);
    if (imageAspect > viewportAspect) {
      uv.x = (uv.x - 0.5) * (viewportAspect / imageAspect) + 0.5;
    } else {
      uv.y = (uv.y - 0.5) * (imageAspect / viewportAspect) + 0.5;
    }
    return uv;
  }

  void main() {
    vec2 currentUv = coverUv(vUv, uCurrentResolution);
    vec2 nextUv = coverUv(vUv, uNextResolution);
    float easedMix = smoothstep(0.0, 1.0, uMixFactor);
    float reveal = smoothstep(easedMix - 0.22, easedMix + 0.16, 1.0 - vUv.y);
    float revealInfluence = 0.24 * sin(easedMix * 3.1415926);
    float blend = clamp(mix(easedMix, reveal, revealInfluence), 0.0, 1.0);
    float glitch = sin(vUv.y * 780.0 + uTime * 28.0) * 0.0016 * sin(easedMix * 3.1415926);
    currentUv.x -= glitch;
    nextUv.x += glitch;

    vec3 currentColor = texture2D(uCurrentTexture, currentUv).rgb;
    vec3 nextColor = texture2D(uNextTexture, nextUv).rgb;
    vec3 color = mix(currentColor, nextColor, blend);
    float scanline = sin(vUv.y * 720.0) * 0.018;
    float vignette = smoothstep(0.82, 0.28, distance(vUv, vec2(0.5)));
    color = color * (0.97 + scanline) + vec3(0.0, 0.035, 0.055) * (1.0 - vignette);
    color += vec3(0.0, 0.12, 0.17) * sin(easedMix * 3.1415926) * 0.24;
    gl_FragColor = vec4(color, 1.0);
  }
`

function makeRoundedPanelGeometry(width, height, depth, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2 + safeRadius, -height / 2)
  shape.lineTo(width / 2 - safeRadius, -height / 2)
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + safeRadius)
  shape.lineTo(width / 2, height / 2 - safeRadius)
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - safeRadius, height / 2)
  shape.lineTo(-width / 2 + safeRadius, height / 2)
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - safeRadius)
  shape.lineTo(-width / 2, -height / 2 + safeRadius)
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + safeRadius, -height / 2)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(safeRadius * 0.2, depth * 0.22),
    bevelThickness: Math.min(depth * 0.18, safeRadius * 0.18),
    curveSegments: 8
  })
  geometry.translate(0, 0, -depth / 2)
  geometry.computeVertexNormals()
  return geometry
}

function RoundedPanel({ size, radius, position, rotation, children }) {
  const geometry = useMemo(
    () => makeRoundedPanelGeometry(size[0], size[1], size[2], radius),
    [radius, size]
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} position={position} rotation={rotation}>
      {children}
    </mesh>
  )
}

function makeFallbackTexture(project, index) {
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 900
  const context = canvas.getContext('2d')
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#020812')
  gradient.addColorStop(0.58, '#061726')
  gradient.addColorStop(1, index % 2 === 0 ? '#171044' : '#0b2536')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.strokeStyle = 'rgba(56, 220, 255, 0.12)'
  context.lineWidth = 2
  for (let x = 80; x < canvas.width; x += 160) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, canvas.height)
    context.stroke()
  }
  for (let y = 70; y < canvas.height; y += 110) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(canvas.width, y)
    context.stroke()
  }

  context.fillStyle = project.accent
  context.shadowColor = project.accent
  context.shadowBlur = 32
  context.fillRect(92, 86, 8, 86)
  context.shadowBlur = 0

  context.fillStyle = '#e9f8ff'
  context.font = '700 66px system-ui, sans-serif'
  context.fillText(project.shortTitle.toUpperCase(), 132, 142)
  context.fillStyle = 'rgba(197, 221, 232, 0.72)'
  context.font = '500 28px ui-monospace, monospace'
  context.fillText('PROJECT PREVIEW INTERFACE', 134, 194)

  context.strokeStyle = 'rgba(103, 232, 249, 0.22)'
  context.fillStyle = 'rgba(4, 14, 28, 0.78)'
  context.lineWidth = 2
  context.beginPath()
  context.roundRect(90, 254, 1420, 520, 28)
  context.fill()
  context.stroke()

  context.fillStyle = 'rgba(103, 232, 249, 0.14)'
  context.beginPath()
  context.roundRect(135, 308, 390, 408, 18)
  context.fill()
  context.beginPath()
  context.roundRect(570, 308, 895, 180, 18)
  context.fill()
  context.beginPath()
  context.roundRect(570, 530, 424, 186, 18)
  context.fill()
  context.beginPath()
  context.roundRect(1041, 530, 424, 186, 18)
  context.fill()

  context.fillStyle = 'rgba(225, 247, 255, 0.86)'
  context.font = '600 30px system-ui, sans-serif'
  context.fillText('Screenshot asset slot', 184, 382)
  context.fillStyle = 'rgba(155, 183, 198, 0.72)'
  context.font = '400 24px system-ui, sans-serif'
  context.fillText(project.screenshot.split('/').pop(), 184, 430)
  context.fillText('Ready for the supplied PNG', 184, 474)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.userData.resolution = new THREE.Vector2(canvas.width, canvas.height)
  return texture
}

function useProjectTextures(projects) {
  const lifecycleRef = useRef(0)
  const [textureVersion, setTextureVersion] = useState(0)
  const textures = useMemo(
    () => projects.map((project, index) => makeFallbackTexture(project, index)),
    [projects]
  )

  useEffect(() => {
    const lifecycle = lifecycleRef.current + 1
    lifecycleRef.current = lifecycle
    let cancelled = false
    const loadedTextures = []
    const loader = new THREE.TextureLoader()

    projects.forEach((project, index) => {
      if (!project.screenshotAvailable) return
      loader.load(project.screenshot, (texture) => {
        if (cancelled) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = true
        texture.userData.resolution = new THREE.Vector2(texture.image.width, texture.image.height)
        textures[index].dispose()
        textures[index] = texture
        loadedTextures.push(texture)
        setTextureVersion((version) => version + 1)
      })
    })

    return () => {
      cancelled = true
      window.requestAnimationFrame(() => {
        if (lifecycleRef.current !== lifecycle) return
        textures.forEach((texture) => texture.dispose())
        loadedTextures.forEach((texture) => texture.dispose())
      })
    }
  }, [projects, textures])

  return {textures, textureVersion}
}

function resolutionFor(texture) {
  return texture?.userData?.resolution || new THREE.Vector2(1600, 900)
}

function LaptopScreen({ textures, textureVersion, activeIndex, active, reducedMotion }) {
  const materialRef = useRef(null)
  const displayedIndexRef = useRef(0)
  const targetIndexRef = useRef(0)
  const transitionRef = useRef(1)

  const uniforms = useMemo(() => ({
    uCurrentTexture: {value: textures[0]},
    uNextTexture: {value: textures[0]},
    uCurrentResolution: {value: resolutionFor(textures[0])},
    uNextResolution: {value: resolutionFor(textures[0])},
    uMixFactor: {value: 1},
    uTime: {value: 0}
  }), [textures])

  useEffect(() => {
    const material = materialRef.current
    if (!material || targetIndexRef.current === activeIndex) return

    const currentMix = transitionRef.current
    const baseIndex = currentMix >= 0.55 ? targetIndexRef.current : displayedIndexRef.current
    displayedIndexRef.current = baseIndex
    targetIndexRef.current = activeIndex
    transitionRef.current = reducedMotion ? 1 : 0
    material.uniforms.uCurrentTexture.value = textures[baseIndex]
    material.uniforms.uNextTexture.value = textures[activeIndex]
    material.uniforms.uCurrentResolution.value = resolutionFor(textures[baseIndex])
    material.uniforms.uNextResolution.value = resolutionFor(textures[activeIndex])
    material.uniforms.uMixFactor.value = transitionRef.current

    if (reducedMotion) displayedIndexRef.current = activeIndex
  }, [activeIndex, reducedMotion, textures])

  useEffect(() => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uCurrentTexture.value = textures[displayedIndexRef.current]
    material.uniforms.uNextTexture.value = textures[targetIndexRef.current]
    material.uniforms.uCurrentResolution.value = resolutionFor(textures[displayedIndexRef.current])
    material.uniforms.uNextResolution.value = resolutionFor(textures[targetIndexRef.current])
    material.uniformsNeedUpdate = true
  }, [textureVersion, textures])

  useFrame((state, delta) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value = state.clock.elapsedTime

    if (!active || transitionRef.current >= 1) return
    transitionRef.current = Math.min(1, transitionRef.current + delta / 0.82)
    material.uniforms.uMixFactor.value = transitionRef.current
    if (transitionRef.current >= 1) displayedIndexRef.current = targetIndexRef.current
  })

  return (
    <mesh position={[0, 1.8, 0.145]}>
      <planeGeometry args={[5.7, 3.205]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={SCREEN_VERTEX_SHADER}
        fragmentShader={SCREEN_FRAGMENT_SHADER}
        toneMapped={false}
      />
    </mesh>
  )
}

function Keyboard() {
  const meshRef = useRef(null)
  const keyCount = 60

  useEffect(() => {
    const dummy = new THREE.Object3D()
    let keyIndex = 0
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 12; column += 1) {
        dummy.position.set(-2.43 + column * 0.44, -0.67 + row * 0.39, 0)
        dummy.scale.set(column === 11 ? 0.34 : 0.31, 0.24, 0.07)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(keyIndex, dummy.matrix)
        keyIndex += 1
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <instancedMesh ref={meshRef} args={[null, null, keyCount]} position={[0, 0.075, -0.28]} rotation={[-Math.PI / 2, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#263146" emissive="#071527" emissiveIntensity={0.22} metalness={0.48} roughness={0.36} />
    </instancedMesh>
  )
}

function ProceduralLaptop({ projects, activeIndex, active, reducedMotion }) {
  const rootRef = useRef(null)
  const lidRef = useRef(null)
  const {textures, textureVersion} = useProjectTextures(projects)

  useFrame((state, delta) => {
    if (!rootRef.current || !lidRef.current) return
    const motionSpeed = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.2)
    const visible = active || reducedMotion
    const targetY = visible ? 0 : -0.58
    const targetScale = visible ? 1 : 0.9
    const targetLid = visible ? -0.09 : 1.42
    const pointerX = active && !reducedMotion ? state.pointer.x * 0.055 : 0
    const pointerY = active && !reducedMotion ? state.pointer.y * 0.028 : 0
    const idle = active && !reducedMotion ? Math.sin(state.clock.elapsedTime * 0.72) * 0.025 : 0

    rootRef.current.position.y = THREE.MathUtils.lerp(rootRef.current.position.y, targetY + idle, motionSpeed)
    rootRef.current.scale.setScalar(THREE.MathUtils.lerp(rootRef.current.scale.x, targetScale, motionSpeed))
    rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, pointerX, motionSpeed)
    rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, -pointerY, motionSpeed)
    lidRef.current.rotation.x = THREE.MathUtils.lerp(lidRef.current.rotation.x, targetLid, motionSpeed)
  })

  return (
    <group ref={rootRef} position={[0, -0.58, 0]} scale={0.9} rotation={[0, -0.02, 0]}>
      <group position={[0, -0.77, 0.12]}>
        <RoundedPanel size={[6.5, 3.8, 0.24]} radius={0.14} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#343d52" emissive="#050b17" emissiveIntensity={0.08} metalness={0.78} roughness={0.26} />
        </RoundedPanel>
        <RoundedPanel size={[6.26, 3.54, 0.08]} radius={0.1} position={[0, 0.15, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#141c2c" emissive="#061328" emissiveIntensity={0.2} metalness={0.5} roughness={0.38} />
        </RoundedPanel>
        <Keyboard />
        <RoundedPanel size={[2.2, 1.02, 0.035]} radius={0.09} position={[0, 0.205, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#293348" emissive="#071527" emissiveIntensity={0.16} metalness={0.64} roughness={0.28} />
        </RoundedPanel>
        <mesh position={[0, -0.1, 1.94]}>
          <boxGeometry args={[5.2, 0.08, 0.06]} />
          <meshStandardMaterial color="#5f6b82" metalness={1} roughness={0.22} />
        </mesh>
      </group>

      <group ref={lidRef} position={[0, -0.68, -1.65]} rotation={[1.42, 0, 0]}>
        <RoundedPanel size={[6.35, 3.88, 0.18]} radius={0.16} position={[0, 1.8, 0]}>
          <meshStandardMaterial color="#171b26" metalness={0.9} roughness={0.2} />
        </RoundedPanel>
        <RoundedPanel size={[5.95, 3.46, 0.08]} radius={0.08} position={[0, 1.8, 0.062]}>
          <meshStandardMaterial color="#02050a" metalness={0.28} roughness={0.46} />
        </RoundedPanel>
        <LaptopScreen textures={textures} textureVersion={textureVersion} activeIndex={activeIndex} active={active} reducedMotion={reducedMotion} />
        <mesh position={[0, 3.61, 0.17]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color="#1a5066" />
        </mesh>
        <mesh position={[0, -0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.13, 0.13, 5.7, 24]} />
          <meshStandardMaterial color="#475267" metalness={0.96} roughness={0.2} />
        </mesh>
      </group>
    </group>
  )
}

function CameraRig() {
  const { camera, size } = useThree()

  useFrame((_, delta) => {
    const compact = size.width < 720
    const target = compact ? new THREE.Vector3(0, 2.05, 11.6) : new THREE.Vector3(0, 2.2, 10.2)
    camera.position.lerp(target, 1 - Math.exp(-delta * 4))
    camera.lookAt(0, 0.18, 0)
  })

  return null
}

function LaptopScene({ projects, activeIndex, active, reducedMotion }) {
  return (
    <>
      <CameraRig />
      <ambientLight intensity={0.52} />
      <directionalLight position={[5, 7, 7]} intensity={2.1} color="#d9f8ff" />
      <pointLight position={[0, 1.1, 3.2]} intensity={3.8} distance={6.5} color="#bfefff" />
      <pointLight position={[-5, 0, 3]} intensity={12} distance={12} color="#00d9ff" />
      <pointLight position={[5, 0, 1]} intensity={14} distance={12} color="#7c3aed" />
      <ProceduralLaptop
        projects={projects}
        activeIndex={activeIndex}
        active={active}
        reducedMotion={reducedMotion}
      />
      <mesh position={[0, -1.11, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.6, 72]} />
        <meshBasicMaterial color="#071c36" transparent opacity={0.34} depthWrite={false} />
      </mesh>
    </>
  )
}

export default function ProjectLaptopScene(props) {
  return (
    <div className={styles.laptopCanvas} aria-hidden="true">
      <Canvas
        camera={{position: [0, 2.2, 10.2], fov: 40}}
        dpr={[1, 1.55]}
        gl={{alpha: true, antialias: true, powerPreference: 'high-performance'}}
        shadows={false}
      >
        <LaptopScene {...props} />
      </Canvas>
    </div>
  )
}
