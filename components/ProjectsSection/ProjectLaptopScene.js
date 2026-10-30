import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import ActiveFrameLoop from '../ActiveFrameLoop'
import SkillsWorld from '../SkillsSection/SkillsWorld'
import { createProjectSlideshow, advanceProjectSlideshow, peekProjectSlideshow } from './projectSlideshow'
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
  uniform sampler2D uCurrentSlideTexture;
  uniform sampler2D uNextSlideTexture;
  uniform sampler2D uWorldTexture;
  uniform vec2 uWorldResolution;
  uniform float uScreenExit;
  uniform float uCosmosReveal;
  uniform vec2 uCurrentResolution;
  uniform vec2 uNextResolution;
  uniform vec2 uCurrentSlideResolution;
  uniform vec2 uNextSlideResolution;
  uniform float uCurrentSlideMix;
  uniform float uNextSlideMix;
  uniform float uChannelStrength;
  uniform float uMixFactor;
  uniform float uTime;
  uniform float uPower;
  uniform float uOpacity;
  varying vec2 vUv;

  float noise(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec2 coverUv(vec2 uv, vec2 imageResolution) {
    float viewportAspect = 5.7 / 3.205;
    float imageAspect = imageResolution.x / max(imageResolution.y, 1.0);
    if (imageAspect > viewportAspect) {
      uv.x = (uv.x - 0.5) * (viewportAspect / imageAspect) + 0.5;
    } else {
      uv.y = (uv.y - 0.5) * (imageAspect / viewportAspect) + 0.5;
    }
    return uv;
  }

  void main() {
    vec2 departingUv = vUv - vec2(0.0, uScreenExit * 1.12);
    vec2 currentUv = coverUv(departingUv, uCurrentResolution);
    vec2 nextUv = coverUv(departingUv, uNextResolution);
    float easedMix = smoothstep(0.0, 1.0, uMixFactor);
    float reveal = smoothstep(easedMix - 0.22, easedMix + 0.16, 1.0 - vUv.y);
    float revealInfluence = 0.24 * sin(easedMix * 3.1415926);
    float blend = clamp(mix(easedMix, reveal, revealInfluence), 0.0, 1.0);
    float channelNoise = pow(sin(easedMix * 3.1415926), 3.0) * uChannelStrength;
    float scanBand = step(0.87, noise(vec2(floor(vUv.y * 36.0), floor(uTime * 23.0))));
    float glitch = (sin(vUv.y * 780.0 + uTime * 28.0) * 0.0025 + scanBand * 0.025) * channelNoise;
    currentUv.x -= glitch;
    nextUv.x += glitch;

    vec2 currentSlideUv = coverUv(departingUv, uCurrentSlideResolution);
    vec2 nextSlideUv = coverUv(departingUv, uNextSlideResolution);
    currentSlideUv.x -= glitch;
    nextSlideUv.x += glitch;
    vec3 currentColor = mix(texture2D(uCurrentTexture, currentUv).rgb,
      texture2D(uCurrentSlideTexture, currentSlideUv).rgb, uCurrentSlideMix);
    vec3 nextColor = mix(texture2D(uNextTexture, nextUv).rgb,
      texture2D(uNextSlideTexture, nextSlideUv).rgb, uNextSlideMix);
    vec3 color = mix(currentColor, nextColor, blend);
    float scanline = sin(vUv.y * 720.0) * 0.002;
    float vignette = smoothstep(0.82, 0.28, distance(vUv, vec2(0.5)));
    color = color * (0.97 + scanline) + vec3(0.0, 0.035, 0.055) * (1.0 - vignette);
    color += vec3(0.0, 0.12, 0.17) * sin(easedMix * 3.1415926) * 0.24 * uChannelStrength;
    float grain = noise(floor(vUv * vec2(960.0, 540.0)) + floor(uTime * 45.0));
    color = mix(color, vec3(grain) * vec3(0.69, 0.81, 0.85), channelNoise * 0.43);
    // Keep the self-lit display readable independently of chassis lighting.
    color *= 1.04;
    float glass = pow(clamp(0.72 - vUv.x * 0.4 + vUv.y * 0.34, 0.0, 1.0), 8.0);
    color += vec3(0.022, 0.026, 0.034) * glass;
    vec3 poweredOff = vec3(0.006, 0.01, 0.018) + vec3(0.009, 0.013, 0.018) * pow(1.0 - vUv.y, 2.0);
    color = mix(poweredOff, color, clamp(uPower, 0.0, 1.0));
    float screenMask = smoothstep(0.0, 0.025, departingUv.y);
    color = mix(color, poweredOff, (1.0 - screenMask) * step(0.001, uScreenExit));
    vec3 cosmos = texture2D(uWorldTexture, coverUv(vUv, uWorldResolution)).rgb;
    color = mix(color, cosmos, uCosmosReveal);
    gl_FragColor = vec4(color, uOpacity);
    #include <colorspace_fragment>
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
    bevelSegments: 4,
    bevelSize: Math.min(safeRadius * 0.2, depth * 0.22),
    bevelThickness: Math.min(depth * 0.18, safeRadius * 0.18),
    curveSegments: 16
  })
  geometry.translate(0, 0, -depth / 2)
  geometry.computeVertexNormals()
  return geometry
}

function RoundedPanel({ size, radius, position, rotation, children }) {
  const geometry = useMemo(
    () => makeRoundedPanelGeometry(size[0], size[1], size[2], radius),
    [radius, size[0], size[1], size[2]]
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} position={position} rotation={rotation}>
      {children}
    </mesh>
  )
}

function makeFallbackTexture(project, index, anisotropy = 1) {
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
  texture.anisotropy = anisotropy
  texture.generateMipmaps = true
  texture.userData.resolution = new THREE.Vector2(canvas.width, canvas.height)
  return texture
}

function useProjectTextures(projects) {
  const gl = useThree((state) => state.gl)
  const anisotropy = useMemo(() => Math.min(8, gl.capabilities.getMaxAnisotropy()), [gl])
  const lifecycleRef = useRef(0)
  const [textureVersion, setTextureVersion] = useState(0)
  const galleries = useMemo(
    () => projects.map((project, index) => [makeFallbackTexture(project, index, anisotropy)]),
    [anisotropy, projects]
  )

  useEffect(() => {
    const lifecycle = lifecycleRef.current + 1
    lifecycleRef.current = lifecycle
    let cancelled = false
    const controller = new AbortController()
    const ownedTextures = new Set(galleries.flat())
    const loader = new THREE.TextureLoader()
    const load = url => new Promise(resolve => {
      loader.load(url, source => {
        if (cancelled) { source.dispose(); resolve(null); return }
        // A laptop display is far smaller than the source captures. Bound GPU
        // storage while preserving each image's aspect and detailed text.
        let texture = source
        const longest = Math.max(source.image.width, source.image.height)
        if (longest > 1600) {
          const canvas = document.createElement('canvas')
          const ratio = 1600 / longest
          canvas.width = Math.round(source.image.width * ratio)
          canvas.height = Math.round(source.image.height * ratio)
          const context = canvas.getContext('2d')
          context.drawImage(source.image, 0, 0, canvas.width, canvas.height)
          texture = new THREE.CanvasTexture(canvas)
          source.dispose()
        }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.anisotropy = anisotropy
        texture.generateMipmaps = true
        texture.userData.resolution = new THREE.Vector2(texture.image.width, texture.image.height)
        ownedTextures.add(texture)
        resolve(texture)
      }, undefined, () => resolve(null))
    })

    projects.forEach(async (project, index) => {
      if (project.screenshotAvailable && project.screenshot) {
        const cover = await load(project.screenshot)
        if (!cancelled && cover) {
          galleries[index][0] = cover
          setTextureVersion(version => version + 1)
        }
      }
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, { signal: controller.signal })
        const { images } = response.ok ? await response.json() : { images: [] }
        const urls = Array.isArray(images) ? [...new Set(images)].filter(url =>
          typeof url === 'string' && url.startsWith(`/projects/${project.id}/`) && url !== project.screenshot) : []
        const additional = (await Promise.all(urls.map(load))).filter(Boolean)
        if (!cancelled && additional.length) {
          galleries[index].push(...additional)
          setTextureVersion(version => version + 1)
        }
      } catch (error) {
        // The existing cover remains available when a folder is absent or a
        // request is cancelled; loading a gallery never blocks the project.
      }
    })

    return () => {
      cancelled = true
      controller.abort()
      window.requestAnimationFrame(() => {
        if (lifecycleRef.current !== lifecycle) return
        ownedTextures.forEach(texture => texture.dispose())
      })
    }
  }, [anisotropy, projects, galleries])

  return {galleries, textures: galleries.map(gallery => gallery[0]), textureVersion}
}

function resolutionFor(texture) {
  return texture?.userData?.resolution || new THREE.Vector2(1600, 900)
}

function makeLaptopProjectionResources() {
  return {
    anchor: new THREE.Vector3(),
    ray: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    depth: new THREE.Vector3(),
    fitPosition: new THREE.Vector3(),
    fitScale: 1,
    orientation: new THREE.Quaternion(),
    euler: new THREE.Euler(),
    matrix: new THREE.Matrix4(),
    scaleVector: new THREE.Vector3(),
    point: new THREE.Vector3(),
    basePoints: new Float32Array(0),
    lidPoints: new Float32Array(0),
    posePoints: new Float32Array(0),
    pose: new Float64Array(12),
    previousPose: new Float64Array(12).fill(NaN),
    bounds: {left: 0, right: 0, top: 0, bottom: 0}
  }
}

function projectedLaptopBounds(camera, resources) {
  const {fitPosition, orientation, fitScale, scaleVector, matrix, point, posePoints, bounds} = resources
  scaleVector.setScalar(fitScale)
  matrix.compose(fitPosition, orientation, scaleVector)
  bounds.left = Infinity
  bounds.right = -Infinity
  bounds.top = -Infinity
  bounds.bottom = Infinity
  for (let index = 0; index < posePoints.length; index += 3) {
    point.fromArray(posePoints, index).applyMatrix4(matrix).project(camera)
    bounds.left = Math.min(bounds.left, point.x)
    bounds.right = Math.max(bounds.right, point.x)
    bounds.bottom = Math.min(bounds.bottom, point.y)
    bounds.top = Math.max(bounds.top, point.y)
  }
  return bounds
}

function laptopAnchorFromNdc(camera, x, y, resources, output) {
  resources.ray.set(x, y, 0.5).unproject(camera).sub(camera.position)
  return output.copy(camera.position).addScaledVector(resources.ray, -camera.position.z / resources.ray.z)
}

function fitLaptopStoryPose(camera, size, motion, resources) {
  const {pose, previousPose, basePoints, lidPoints, posePoints, anchor, depth, forward} = resources
  const x = motion.laptopX ?? 0.715
  const y = motion.laptopY ?? 0.53
  const width = (motion.laptopWidth ?? 0.54) * (motion.laptopScale ?? 1)
  const lidOpen = THREE.MathUtils.clamp(motion.lidOpen ?? 1, 0, 1)
  const lidAngle = motion.lidAngle ?? THREE.MathUtils.lerp(Math.PI / 2, -0.09, lidOpen)
  pose[0] = x
  pose[1] = y
  pose[2] = width
  pose[3] = motion.laptopRotationX ?? 0.10
  pose[4] = motion.laptopRotationY ?? -0.30
  pose[5] = motion.laptopRotationZ ?? 0.065
  pose[6] = lidOpen
  pose[7] = lidAngle
  pose[8] = size.width
  pose[9] = size.height
  pose[10] = camera.fov
  pose[11] = posePoints.length
  let changed = false
  for (let index = 0; index < pose.length; index += 1) {
    if (pose[index] !== previousPose[index]) changed = true
  }
  if (!changed || !posePoints.length) return resources
  previousPose.set(pose)

  const centerY = THREE.MathUtils.lerp(-0.59, 1.08, lidOpen)
  const centerZ = THREE.MathUtils.lerp(0.155, 0.02, lidOpen)
  const cosine = Math.cos(lidAngle)
  const sine = Math.sin(lidAngle)
  let offset = 0
  for (let index = 0; index < basePoints.length; index += 3) {
    posePoints[offset++] = basePoints[index]
    posePoints[offset++] = basePoints[index + 1] - centerY
    posePoints[offset++] = basePoints[index + 2] - centerZ
  }
  for (let index = 0; index < lidPoints.length; index += 3) {
    const py = lidPoints[index + 1]
    const pz = lidPoints[index + 2]
    posePoints[offset++] = lidPoints[index]
    posePoints[offset++] = py * cosine - pz * sine - 0.30 - centerY
    posePoints[offset++] = py * sine + pz * cosine - 1.65 - centerZ
  }

  resources.orientation.setFromEuler(resources.euler.set(pose[3], pose[4], pose[5]))
  laptopAnchorFromNdc(camera, x * 2 - 1, 1 - y * 2, resources, anchor)
  resources.fitPosition.copy(anchor)
  camera.getWorldDirection(forward)
  const cameraDepth = depth.copy(anchor).sub(camera.position).dot(forward)
  const visibleWidth = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * cameraDepth * camera.aspect
  resources.fitScale = visibleWidth * width / 6.5

  // Fit the actual rounded model silhouette, including its near keyboard.
  // Nominal world-width scaling clips the base under perspective. This small
  // solve is cached while the pose is settled and makes viewport coordinates
  // refer to the visible model rather than its origin or its lid alone.
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const bounds = projectedLaptopBounds(camera, resources)
    const projectedWidth = bounds.right - bounds.left
    if (!Number.isFinite(projectedWidth) || projectedWidth <= 0) break
    resources.fitScale *= width * 2 / projectedWidth
    laptopAnchorFromNdc(camera, (bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2, resources, depth)
    resources.fitPosition.add(anchor).sub(depth)
  }
  return resources
}

function collectLaptopProjectionPoints(root, lid, resources) {
  root.updateWorldMatrix(true, true)
  const rootInverse = root.matrixWorld.clone().invert()
  const lidInverse = lid.matrixWorld.clone().invert()
  const relative = new THREE.Matrix4()
  const point = new THREE.Vector3()
  const basePoints = new Map()
  const lidPoints = new Map()
  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.userData.excludeLaptopProjection || !object.geometry?.attributes?.position) return
    let ancestor = object.parent
    let insideLid = false
    while (ancestor && ancestor !== root) {
      if (ancestor === lid) insideLid = true
      ancestor = ancestor.parent
    }
    relative.multiplyMatrices(insideLid ? lidInverse : rootInverse, object.matrixWorld)
    const positions = object.geometry.attributes.position
    const target = insideLid ? lidPoints : basePoints
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index).applyMatrix4(relative)
      const key = `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`
      if (!target.has(key)) target.set(key, [point.x, point.y, point.z])
    }
  })
  resources.basePoints = new Float32Array([...basePoints.values()].flat())
  resources.lidPoints = new Float32Array([...lidPoints.values()].flat())
  resources.posePoints = new Float32Array(resources.basePoints.length + resources.lidPoints.length)
  resources.previousPose.fill(NaN)
}

function LaptopScreen({ textures, galleries, textureVersion, activeIndex, active, reducedMotion, story, motionRef, screenRef, worldTextureRef }) {
  const materialRef = useRef(null)
  const displayedIndexRef = useRef(0)
  const targetIndexRef = useRef(0)
  const transitionRef = useRef(1)
  const slideshow = useMemo(createProjectSlideshow, [])
  const clockRef = useRef(0)
  const playingRef = useRef(false)
  const timerRef = useRef(0)
  const output = useMemo(() => ({ current: {}, next: {}, playing: {} }), [])
  const invalidate = useThree(state => state.invalidate)

  useEffect(() => {
    clockRef.current = 0
    playingRef.current = false
    invalidate()
    return () => window.clearTimeout(timerRef.current)
  }, [active, invalidate, textureVersion])

  const uniforms = useMemo(() => ({
    uCurrentTexture: {value: textures[0]},
    uNextTexture: {value: textures[0]},
    uCurrentSlideTexture: {value: textures[0]},
    uNextSlideTexture: {value: textures[0]},
    uWorldTexture: {value: textures[0]},
    uWorldResolution: {value: new THREE.Vector2(1600, 900)},
    uScreenExit: {value: 0},
    uCosmosReveal: {value: 0},
    uCurrentResolution: {value: resolutionFor(textures[0])},
    uNextResolution: {value: resolutionFor(textures[0])},
    uCurrentSlideResolution: {value: resolutionFor(textures[0])},
    uNextSlideResolution: {value: resolutionFor(textures[0])},
    uCurrentSlideMix: {value: 0},
    uNextSlideMix: {value: 0},
    uChannelStrength: {value: 1},
    uMixFactor: {value: 1},
    uTime: {value: 0},
    uPower: {value: 1},
    uOpacity: {value: 1}
  }), [galleries])

  useEffect(() => {
    const material = materialRef.current
    if (!material || story || targetIndexRef.current === activeIndex) return

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
  }, [activeIndex, reducedMotion, story, textures])

  useEffect(() => {
    const material = materialRef.current
    if (!material || story) return
    material.uniforms.uCurrentTexture.value = textures[displayedIndexRef.current]
    material.uniforms.uNextTexture.value = textures[targetIndexRef.current]
    material.uniforms.uCurrentResolution.value = resolutionFor(textures[displayedIndexRef.current])
    material.uniforms.uNextResolution.value = resolutionFor(textures[targetIndexRef.current])
    material.uniformsNeedUpdate = true
  }, [textureVersion, textures, story])

  useFrame((state, delta) => {
    const material = materialRef.current
    if (!material) return
    window.clearTimeout(timerRef.current)
    if (story) {
      const motion = motionRef?.current
      if (!motion) return
      material.uniforms.uScreenExit.value = motion.screenExit ?? 0
      material.uniforms.uCosmosReveal.value = motion.cosmosReveal ?? 0
      if (worldTextureRef?.current) {
        material.uniforms.uWorldTexture.value = worldTextureRef.current
        material.uniforms.uWorldResolution.value.set(worldTextureRef.current.image.width, worldTextureRef.current.image.height)
      }
      const currentIndex = THREE.MathUtils.clamp(Math.round(motion.screenCurrentIndex || 0), 0, textures.length - 1)
      const nextIndex = THREE.MathUtils.clamp(Math.round(motion.screenNextIndex ?? currentIndex), 0, textures.length - 1)
      const mix = currentIndex === nextIndex ? 0 : THREE.MathUtils.clamp(motion.screenMix || 0, 0, 1)
      const selected = motion.projectIndex || 0
      const now = performance.now()
      const reading = motion.projectProgress >= .66 && (selected === galleries.length - 1 || motion.projectProgress < .84)
      const playing = active && motion.active && !document.hidden && !reducedMotion
        && !(motion.skillsProgress > 0)
        && reading && !motion.scrolling && now - (motion.lastScrollAt ?? -Infinity) >= 260
        && currentIndex === nextIndex && (motion.screenPower ?? 1) > .99
      if (!playing && playingRef.current && clockRef.current && slideshow.activeProjectIndex !== null) {
        // Demand rendering sleeps during the hold. Account for its visible
        // time up to the raw scroll event before freezing the previous slot.
        const previous = slideshow.activeProjectIndex
        const pausedAt = motion.scrolling ? Math.min(now, motion.lastScrollAt) : now
        advanceProjectSlideshow(slideshow, Math.max(0, pausedAt - clockRef.current) / 1000, {
          projectIndex: previous, imageCount: galleries[previous].length, playing: true
        }, output.playing)
      }
      const elapsed = playing && playingRef.current && clockRef.current ? (now - clockRef.current) / 1000 : 0
      const playback = advanceProjectSlideshow(slideshow, elapsed, {
        projectIndex: selected, imageCount: galleries[selected].length, playing, reducedMotion
      }, output.playing)
      clockRef.current = now
      playingRef.current = playing
      const source = peekProjectSlideshow(slideshow, currentIndex, galleries[currentIndex].length, output.current)
      const target = peekProjectSlideshow(slideshow, nextIndex, galleries[nextIndex].length, output.next)
      const current = galleries[currentIndex][source.currentIndex]
      const currentSlide = galleries[currentIndex][source.nextIndex]
      const next = galleries[nextIndex][target.currentIndex]
      const nextSlide = galleries[nextIndex][target.nextIndex]
      material.uniforms.uCurrentTexture.value = current
      material.uniforms.uCurrentSlideTexture.value = currentSlide
      material.uniforms.uNextTexture.value = next
      material.uniforms.uNextSlideTexture.value = nextSlide
      material.uniforms.uCurrentResolution.value = resolutionFor(current)
      material.uniforms.uCurrentSlideResolution.value = resolutionFor(currentSlide)
      material.uniforms.uNextResolution.value = resolutionFor(next)
      material.uniforms.uNextSlideResolution.value = resolutionFor(nextSlide)
      material.uniforms.uCurrentSlideMix.value = source.mix
      material.uniforms.uNextSlideMix.value = target.mix
      material.uniforms.uChannelStrength.value = 1
      material.uniforms.uMixFactor.value = mix
      // Each project retains its precise still/dissolve while paused. Both
      // retained image pairs feed the reversible channel handoff, so even
      // scrolling during a dissolve cannot snap to a different screenshot.
      material.uniforms.uTime.value = currentIndex * 1.37 + nextIndex * 0.31 + mix * 2.7
      material.uniforms.uPower.value = THREE.MathUtils.clamp(motion.screenPower ?? 1, 0, 1)
      material.uniforms.uOpacity.value = THREE.MathUtils.clamp(motion.laptopOpacity ?? 1, 0, 1)
      state.gl.domElement.dataset.screenshotProject = String(selected)
      state.gl.domElement.dataset.screenshotIndex = String(playback.currentIndex)
      state.gl.domElement.dataset.screenshotMix = playback.mix.toFixed(4)
      state.gl.domElement.dataset.galleryPlaying = String(playback.playing)
      if (playback.needsFrame) invalidate()
      else if (Number.isFinite(playback.nextWakeMs)) {
        timerRef.current = window.setTimeout(invalidate, Math.max(1, playback.nextWakeMs))
      }
      return
    }
    material.uniforms.uTime.value = state.clock.elapsedTime

    if (!active || transitionRef.current >= 1) return
    transitionRef.current = Math.min(1, transitionRef.current + delta / 0.82)
    material.uniforms.uMixFactor.value = transitionRef.current
    if (transitionRef.current >= 1) displayedIndexRef.current = targetIndexRef.current
  })

  return (
    <mesh ref={screenRef} position={[0, 1.8, 0.145]}>
      <planeGeometry args={[5.7, 3.205]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={SCREEN_VERTEX_SHADER}
        fragmentShader={SCREEN_FRAGMENT_SHADER}
        toneMapped={false}
        transparent={story}
      />
    </mesh>
  )
}

const KEYBOARD_WIDTH = 4.65
const KEYBOARD_REAR = -1.50
const KEYBOARD_DEPTH = 1.98

function keyboardLayout() {
  const rows = [
    {z: -1.36, height: 0.18, labels: ['esc', '☀', '☀', '▦', '⌕', '◐', '◀', '▶', '▶', '♩', '−', '+', '◉', '⏻']},
    {z: -1.04, labels: ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '−', '=', 'delete'], weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.45]},
    {z: -0.70, labels: ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'], weights: [1.35, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.1]},
    {z: -0.36, labels: ['caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'return'], weights: [1.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.65]},
    {z: -0.02, labels: ['shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'shift'], weights: [2.0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.15]},
    {z: 0.32, labels: ['fn', 'control', 'option', '⌘', '', '⌘', 'option', '←', '↑ ↓', '→'], weights: [1, 1.15, 1.15, 1.45, 5.0, 1.45, 1.15, 1, 1, 1]}
  ]
  return rows.flatMap(row => {
    const weights = row.weights || row.labels.map(() => 1)
    const unit = (KEYBOARD_WIDTH - (row.labels.length - 1) * 0.045) / weights.reduce((total, value) => total + value, 0)
    let left = -KEYBOARD_WIDTH / 2
    return row.labels.map((label, index) => {
      const width = weights[index] * unit
      const key = {label, width, x: left + width / 2, z: row.z, height: row.height || 0.265}
      left += width + 0.045
      return key
    })
  })
}

function makeKeyboardLegendTexture(keys) {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const context = canvas.getContext('2d')
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#dce4ed'
  keys.forEach(key => {
    if (!key.label) return
    context.font = `500 ${key.label.length > 1 ? 19 : 29}px Arial, sans-serif`
    context.fillText(key.label, (key.x / KEYBOARD_WIDTH + 0.5) * canvas.width, (key.z - KEYBOARD_REAR) / KEYBOARD_DEPTH * canvas.height)
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function Keyboard() {
  const keyRef = useRef(null)
  const backlightRef = useRef(null)
  const keys = useMemo(keyboardLayout, [])
  const geometry = useMemo(() => makeRoundedPanelGeometry(1, 1, 0.055, 0.11), [])
  const legendTexture = useMemo(() => makeKeyboardLegendTexture(keys), [keys])

  useEffect(() => {
    const dummy = new THREE.Object3D()
    keys.forEach((key, index) => {
      dummy.position.set(key.x, -key.z, 0)
      dummy.scale.set(key.width, key.height, 1)
      dummy.updateMatrix()
      keyRef.current.setMatrixAt(index, dummy.matrix)
      dummy.scale.set(key.width + 0.018, key.height + 0.018, 0.3)
      dummy.updateMatrix()
      backlightRef.current.setMatrixAt(index, dummy.matrix)
    })
    keyRef.current.instanceMatrix.needsUpdate = true
    backlightRef.current.instanceMatrix.needsUpdate = true
    return () => {
      geometry.dispose()
      legendTexture.dispose()
    }
  }, [geometry, keys, legendTexture])

  return (
    <>
      <RoundedPanel size={[4.86, 2.17, 0.018]} radius={0.075} position={[0, 0.208, -0.47]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#171b23" roughness={0.6} metalness={0.2} />
      </RoundedPanel>
      <instancedMesh ref={backlightRef} args={[geometry, null, keys.length]} position={[0, 0.232, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#b4c5e7" transparent opacity={0.27} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={keyRef} args={[geometry, null, keys.length]} position={[0, 0.265, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#252a33" emissive="#66717f" emissiveIntensity={0.045} metalness={0.25} roughness={0.38} />
      </instancedMesh>
      <mesh position={[0, 0.305, KEYBOARD_REAR + KEYBOARD_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[KEYBOARD_WIDTH, KEYBOARD_DEPTH]} />
        <meshBasicMaterial map={legendTexture} transparent opacity={0.82} toneMapped={false} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </>
  )
}

function SpeakerGrilles() {
  const holesRef = useRef(null)
  useEffect(() => {
    const dummy = new THREE.Object3D()
    let index = 0
    for (const side of [-1, 1]) {
      for (let row = 0; row < 28; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          dummy.position.set(side * (2.54 + column * 0.065), 0.205, -1.37 + row * 0.071)
          dummy.updateMatrix()
          holesRef.current.setMatrixAt(index++, dummy.matrix)
        }
      }
    }
    holesRef.current.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={holesRef} args={[null, null, 224]}>
      <cylinderGeometry args={[0.011, 0.011, 0.008, 6]} />
      <meshStandardMaterial color="#2d333c" metalness={0.32} roughness={0.7} />
    </instancedMesh>
  )
}

function SidePorts() {
  return (
    <>
      {[-0.93, -0.40, 0.17].map((z, index) => (
        <group key={z} position={[3.258, -0.01, z]} rotation={[0, Math.PI / 2, 0]}>
          <RoundedPanel size={[index === 0 ? 0.39 : 0.24, 0.104, 0.012]} radius={0.026}>
            <meshStandardMaterial color="#76808d" metalness={0.86} roughness={0.27} />
          </RoundedPanel>
          <RoundedPanel size={[index === 0 ? 0.33 : 0.19, 0.059, 0.014]} radius={0.018} position={[0, 0, 0.008]}>
            <meshStandardMaterial color="#070a10" metalness={0.1} roughness={0.8} />
          </RoundedPanel>
        </group>
      ))}
      <mesh position={[3.27, -0.01, 0.67]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.016, 16]} />
        <meshStandardMaterial color="#0b1018" roughness={0.6} metalness={0.3} />
      </mesh>
    </>
  )
}

function ProceduralLaptop({ projects, activeIndex, active, reducedMotion, story, motionRef, screenRef, worldTextureRef, portalViewRef, glowRef }) {
  const rootRef = useRef(null)
  const geometryRef = useRef(null)
  const lidRef = useRef(null)
  const materialsRef = useRef([])
  const lastOpacityRef = useRef(-1)
  const {textures, galleries, textureVersion} = useProjectTextures(projects)
  const storyProjection = useMemo(makeLaptopProjectionResources, [])
  const portal = useMemo(() => ({center: new THREE.Vector3(), forward: new THREE.Vector3(), offset: new THREE.Vector3(), corner: new THREE.Vector3()}), [])

  useEffect(() => {
    if (!rootRef.current) return
    const materials = new Set()
    rootRef.current.traverse((object) => {
      if (!object.isMesh || !object.material) return
      const entries = Array.isArray(object.material) ? object.material : [object.material]
      entries.forEach((material) => {
        if (!material.isShaderMaterial) materials.add(material)
      })
    })
    materialsRef.current = [...materials].map((material) => {
      // Strict effects and hot reload can revisit a fully faded model. Retain
      // the material's authored opacity so reverse scroll can restore it.
      material.userData.storyOriginalOpacity ??= material.opacity
      material.userData.storyOriginalTransparent ??= material.transparent
      return { material, opacity: material.userData.storyOriginalOpacity, transparent: material.userData.storyOriginalTransparent }
    })
    lastOpacityRef.current = -1
    if (story && geometryRef.current && lidRef.current) {
      collectLaptopProjectionPoints(geometryRef.current, lidRef.current, storyProjection)
    }
  }, [story, storyProjection])

  useFrame((state, delta) => {
    if (!rootRef.current || !lidRef.current) return
    if (story) {
      const motion = motionRef?.current
      if (!motion || !geometryRef.current) {
        rootRef.current.visible = false
        return
      }
      const opacity = THREE.MathUtils.clamp(motion.laptopOpacity ?? 1, 0, 1)
      if (glowRef.current) {
        // These coordinates already describe the projected model center.
        // Keep the accent behind the chassis through the scroll choreography.
        glowRef.current.style.left = `${motion.laptopX * 100}%`
        glowRef.current.style.top = `${motion.laptopY * 100}%`
        // Leave a narrow visible halo outside the opaque screen silhouette.
        glowRef.current.style.width = `${Math.min(motion.mobile?120:78, motion.laptopWidth * 145)}%`
        glowRef.current.style.opacity = String((motion.lidOpen || 0) * opacity * (1 - (motion.portalDolly || 0)))
      }
      rootRef.current.visible = opacity > 0.001
      state.gl.domElement.dataset.laptopVisible = String(rootRef.current.visible)
      state.gl.domElement.dataset.laptopOpacity = String(opacity)
      if (!rootRef.current.visible && !(motion.portalOpacity > 0)) return

      const lidOpen = THREE.MathUtils.clamp(motion.lidOpen ?? 1, 0, 1)
      const lidAngle = motion.lidAngle ?? THREE.MathUtils.lerp(Math.PI / 2, -0.09, lidOpen)
      fitLaptopStoryPose(state.camera, state.size, motion, storyProjection)
      rootRef.current.position.copy(storyProjection.fitPosition)
      rootRef.current.scale.setScalar(storyProjection.fitScale)
      rootRef.current.rotation.set(
        motion.laptopRotationX ?? 0.10,
        motion.laptopRotationY ?? -0.30,
        motion.laptopRotationZ ?? 0.065
      )
      // The lid pivots at the back edge. Centering its changing silhouette
      // prevents opening the lid from making the whole laptop jump upward.
      geometryRef.current.position.set(0, -THREE.MathUtils.lerp(-0.59, 1.08, lidOpen), -THREE.MathUtils.lerp(0.155, 0.02, lidOpen))
      lidRef.current.rotation.x = lidAngle

      if (screenRef?.current && motion.screenCenterAlignment > 0) {
        // Fit the chassis using the reference camera, then align the display's
        // actual world-space center. Camera travel never feeds back into fit.
        rootRef.current.updateWorldMatrix(true, true)
        screenRef.current.getWorldPosition(portal.center)
        state.camera.getWorldDirection(portal.forward)
        const depth = portal.offset.copy(portal.center).sub(state.camera.position).dot(portal.forward)
        portal.offset.copy(state.camera.position).addScaledVector(portal.forward, depth).sub(portal.center)
        rootRef.current.position.addScaledVector(portal.offset, motion.screenCenterAlignment)
        rootRef.current.updateWorldMatrix(true, true)
        screenRef.current.getWorldPosition(portal.center)
        if (motion.portalDolly > 0) {
          const startDistance = portal.offset.copy(portal.center).sub(state.camera.position).dot(portal.forward)
          const tangent = Math.tan(THREE.MathUtils.degToRad(state.camera.fov * .5))
          const scale = storyProjection.fitScale
          // Cover both viewport dimensions before the portal can take over.
          // A real dolly makes the keyboard and bezel leave through perspective.
          const endDistance = Math.min(3.205 * scale / (2 * tangent), 5.7 * scale / (2 * tangent * state.camera.aspect)) * .965
          const distance = startDistance * Math.pow(endDistance / startDistance, motion.portalDolly)
          state.camera.position.addScaledVector(portal.forward, startDistance - distance)
          state.camera.updateMatrixWorld()
        }
      }
      if (portalViewRef && screenRef?.current) {
        const rect = portalViewRef.current
        rootRef.current.updateWorldMatrix(true, true)
        portal.corner.set(-2.85, -1.6025, 0).applyMatrix4(screenRef.current.matrixWorld).project(state.camera)
        rect.x = (portal.corner.x + 1) * .5
        rect.y = (portal.corner.y + 1) * .5
        portal.corner.set(2.85, 1.6025, 0).applyMatrix4(screenRef.current.matrixWorld).project(state.camera)
        rect.width = (portal.corner.x + 1) * .5 - rect.x
        rect.height = (portal.corner.y + 1) * .5 - rect.y
        state.gl.domElement.dataset.portalDolly = String(motion.portalDolly ?? 0)
        state.gl.domElement.dataset.screenBounds = [rect.x, rect.y, rect.width, rect.height].map(v => v.toFixed(5)).join(',')
      }

      if (Math.abs(opacity - lastOpacityRef.current) > 0.0001) {
        materialsRef.current.forEach(({material, opacity: originalOpacity, transparent}) => {
          material.opacity = originalOpacity * opacity
          const nextTransparent = transparent || opacity < 0.999
          if (material.transparent !== nextTransparent) {
            material.transparent = nextTransparent
            material.needsUpdate = true
          }
        })
        lastOpacityRef.current = opacity
      }
      return
    }
    const motionSpeed = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.2)
    const visible = active || reducedMotion
    const targetY = visible ? 0 : -0.58
    const targetScale = visible ? 1 : 0.9
    const targetLid = visible ? -0.09 : Math.PI / 2
    const pointerX = active && !reducedMotion ? state.pointer.x * 0.055 : 0
    const pointerY = active && !reducedMotion ? state.pointer.y * 0.028 : 0
    const idle = active && !reducedMotion ? Math.sin(state.clock.elapsedTime * 0.72) * 0.025 : 0

    rootRef.current.position.y = THREE.MathUtils.lerp(rootRef.current.position.y, targetY + idle, motionSpeed)
    rootRef.current.scale.setScalar(THREE.MathUtils.lerp(rootRef.current.scale.x, targetScale, motionSpeed))
    rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, pointerX, motionSpeed)
    rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, -pointerY, motionSpeed)
    lidRef.current.rotation.x = THREE.MathUtils.lerp(lidRef.current.rotation.x, targetLid, motionSpeed)
    if (glowRef.current) {
      const opening = THREE.MathUtils.clamp((Math.PI / 2 - lidRef.current.rotation.x) / (Math.PI / 2 + .09), 0, 1)
      glowRef.current.style.opacity = String(opening)
    }
  }, -5)

  return (
    <group ref={rootRef} position={[0, -0.58, 0]} scale={0.9} rotation={[0, -0.02, 0]}>
      <group ref={geometryRef}>
      <group position={[0, -0.77, 0.12]}>

        <RoundedPanel size={[6.5, 3.8, 0.24]} radius={0.14} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#343d52" emissive="#141c2a" emissiveIntensity={0.09} metalness={0.75} roughness={0.29} />
        </RoundedPanel>
        <RoundedPanel size={[6.26, 3.54, 0.08]} radius={0.1} position={[0, 0.15, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#c1c7d0" emissive="#c1c7d0" emissiveIntensity={0.055} metalness={0.68} roughness={0.34} />
        </RoundedPanel>
        <Keyboard />
        <SpeakerGrilles />
        <SidePorts />
        <RoundedPanel size={[2.28, 0.99, 0.018]} radius={0.08} position={[0, 0.205, 1.13]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#747e8c" metalness={0.76} roughness={0.3} />
        </RoundedPanel>
        <RoundedPanel size={[2.22, 0.935, 0.013]} radius={0.075} position={[0, 0.219, 1.13]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#b2bbc8" emissive="#9ba3b0" emissiveIntensity={0.035} metalness={0.56} roughness={0.39} />
        </RoundedPanel>
        <RoundedPanel size={[6.27, 0.046, 0.025]} radius={0.016} position={[0, 0.063, 1.906]}>
          <meshStandardMaterial color="#8792a4" metalness={0.9} roughness={0.28} />
        </RoundedPanel>
        <RoundedPanel size={[0.91, 0.085, 0.034]} radius={0.035} position={[0, 0.052, 1.922]}>
          <meshStandardMaterial color="#171f2b" metalness={0.62} roughness={0.36} />
        </RoundedPanel>
      </group>

      <group ref={lidRef} position={[0, -0.30, -1.65]} rotation={[Math.PI / 2, 0, 0]}>

        <RoundedPanel size={[6.35, 3.88, 0.18]} radius={0.16} position={[0, 1.8, 0]}>
          <meshStandardMaterial color="#313745" emissive="#111623" emissiveIntensity={0.06} metalness={0.82} roughness={0.27} />
        </RoundedPanel>
        <RoundedPanel size={[6.22, 3.75, 0.022]} radius={0.12} position={[0, 1.8, 0.101]}>
          <meshStandardMaterial color="#737d8e" metalness={0.86} roughness={0.29} />
        </RoundedPanel>
        <RoundedPanel size={[6.145, 3.67, 0.018]} radius={0.1} position={[0, 1.8, 0.118]}>
          <meshStandardMaterial color="#11161e" emissive="#202936" emissiveIntensity={0.035} metalness={0.3} roughness={0.4} />
        </RoundedPanel>
        <LaptopScreen textures={textures} galleries={galleries} textureVersion={textureVersion} activeIndex={activeIndex} active={active} reducedMotion={reducedMotion} story={story} motionRef={motionRef} screenRef={screenRef} worldTextureRef={worldTextureRef} />
        <mesh position={[0, 3.61, 0.17]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color="#1a5066" />
        </mesh>
        <mesh position={[0, -0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.13, 0.13, 5.7, 24]} />
          <meshStandardMaterial color="#8d98a8" metalness={0.85} roughness={0.27} />
        </mesh>
      </group>
      </group>
    </group>
  )
}

function CameraRig({story}) {
  const { camera, size } = useThree()
  const target = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    if (story) {
      camera.position.set(0, 2.2, 10.2)
      camera.lookAt(0, 0.18, 0)
      camera.updateMatrixWorld()
      return
    }
    const compact = size.width < 720
    target.set(0, compact ? 1.98 : 2.2, compact ? 9.25 : 10.2)
    camera.position.lerp(target, 1 - Math.exp(-delta * 4))
    camera.lookAt(0, 0.18, 0)
  }, -20)

  return null
}

function UniversePortal({ motionRef, textureRef, viewRef }) {
  const meshRef = useRef(null)
  const materialRef = useRef(null)
  const uniforms = useMemo(() => ({
    uWorld: {value: null}, uRect: {value: new THREE.Vector4(0, 0, 1, 1)},
    uCover: {value: new THREE.Vector2(1, 1)}, uOpacity: {value: 0}, uExpand: {value: 0}
  }), [])
  useFrame(({size}) => {
    if (!meshRef.current || !materialRef.current) return
    const motion = motionRef.current
    meshRef.current.visible = motion.portalOpacity > 0 && Boolean(textureRef.current)
    meshRef.current.parent.userData.portalVisible = meshRef.current.visible
    if (!meshRef.current.visible) return
    // Update the material that Three.js is actually rendering. R3F can retain
    // a material while replacing React's memoized props during hot refresh.
    const currentUniforms = materialRef.current.uniforms
    const rect = viewRef.current
    currentUniforms.uWorld.value = textureRef.current
    const validRect = [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0
    currentUniforms.uRect.value.set(validRect ? rect.x : 0, validRect ? rect.y : 0,
      validRect ? rect.width : 1, validRect ? rect.height : 1)
    const aspect = size.width / size.height
    const screenAspect = 5.7 / 3.205
    currentUniforms.uCover.value.set(aspect > screenAspect ? screenAspect / aspect : 1, aspect > screenAspect ? 1 : aspect / screenAspect)
    currentUniforms.uOpacity.value = motion.portalOpacity
    currentUniforms.uExpand.value = motion.worldExpand
    materialRef.current.uniformsNeedUpdate = true
  })
  return <mesh ref={meshRef} visible={false} frustumCulled={false} renderOrder={1000}>
    <planeGeometry args={[2, 2]} />
    <shaderMaterial ref={materialRef} uniforms={uniforms} transparent depthTest={false} depthWrite={false} toneMapped={false}
      vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`}
      fragmentShader={`
        uniform sampler2D uWorld; uniform vec4 uRect; uniform vec2 uCover;
        uniform float uOpacity; uniform float uExpand; varying vec2 vUv;
        void main(){
          if(uExpand > .9999){
            gl_FragColor=vec4(texture2D(uWorld,vUv).rgb,uOpacity);
            #include <colorspace_fragment>
            return;
          }
          vec2 screenUv=(vUv-uRect.xy)/uRect.zw;
          vec2 matchedUv=(screenUv-.5)*uCover+.5;
          gl_FragColor=vec4(texture2D(uWorld,mix(matchedUv,vUv,uExpand)).rgb,uOpacity);
          #include <colorspace_fragment>
        }
      `} />
  </mesh>
}

function LaptopScene({ projects, activeIndex, active, reducedMotion, story, motionRef, glowRef }) {
  const screenRef = useRef(null)
  const worldTextureRef = useRef(null)
  const portalViewRef = useRef({x: 0, y: 0, width: 1, height: 1})
  return (
    <>
      <CameraRig story={story} />
      {story && <SkillsWorld motionRef={motionRef} textureRef={worldTextureRef} active={active} />}
      <ambientLight intensity={0.72} color="#edf0f7" />
      <directionalLight position={[-3.5, 7, 6]} intensity={3.3} color="#fff8ef" />
      <directionalLight position={[4.5, 3, 2]} intensity={1.35} color="#dbe2f3" />
      <pointLight position={[0, 2.6, 5]} intensity={5} distance={15} color="#edf1ff" />
      <pointLight position={[5, -0.4, -1]} intensity={1.2} distance={12} color="#a9c4ef" />
      <ProceduralLaptop
        projects={projects}
        activeIndex={activeIndex}
        active={active}
        reducedMotion={reducedMotion}
        story={story}
        motionRef={motionRef}
        screenRef={screenRef}
        worldTextureRef={worldTextureRef}
        portalViewRef={portalViewRef}
        glowRef={glowRef}
      />
      {story && <UniversePortal motionRef={motionRef} textureRef={worldTextureRef} viewRef={portalViewRef} />}
      {!story && <mesh position={[0, -1.11, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.6, 72]} />
        <meshBasicMaterial color="#071c36" transparent opacity={0.34} depthWrite={false} />
      </mesh>}
    </>
  )
}

function ScrollFrameLoop({ active, mobile=false }) {
  const invalidate = useThree(state => state.invalidate)
  const setDpr = useThree(state => state.setDpr)
  const size = useThree(state => state.size)
  useFrame(state => {
    // Canvas can reapply its device DPR after a native viewport resize. Keep
    // the actual drawing buffer within the same desktop pixel budget.
    const bounded = Math.min(mobile?1.3:1.75, window.devicePixelRatio || 1, 2560 / Math.max(1,state.size.width,state.size.height))
    if(Math.abs(state.gl.getPixelRatio()-bounded)>.01)setDpr(bounded)
  },-30)
  useEffect(() => {
    // Bound the procedural world's pixel workload on large desktop displays.
    // It renders directly after entry, so the canvas shares the target budget.
    setDpr(Math.min(mobile?1.3:1.75, window.devicePixelRatio || 1, 2560 / Math.max(1, size.width, size.height)))
  }, [setDpr, size.width, size.height,mobile])
  useEffect(() => {
    const update = () => { if (active) invalidate() }
    window.addEventListener('projects:motion', update)
    update()
    return () => window.removeEventListener('projects:motion', update)
  }, [active, invalidate])
  return null
}

export default function ProjectLaptopScene(props) {
  const [pageVisible, setPageVisible] = useState(true)
  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden)
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])
  const active = props.active && pageVisible
  const glowRef = useRef(null)
  useEffect(() => {
    if (!active && glowRef.current) glowRef.current.style.opacity = '0'
  }, [active])
  return (
    <div className={styles.laptopCanvas} aria-hidden="true">
      <div ref={glowRef} className={styles.laptopAccent} data-laptop-accent />
      {props.mounted && <Canvas
        style={{ position: 'relative', zIndex: 1 }}
        camera={{position: [0, 2.2, 10.2], fov: 40}}
        dpr={[1, props.motionRef?.current?.mobile ? 1.3 : 1.75]}
        frameloop="demand"
        gl={{alpha: true, antialias: true, powerPreference: 'high-performance'}}
        shadows={false}
      >
        {props.story ? <ScrollFrameLoop active={active} mobile={Boolean(props.motionRef?.current?.mobile)} /> : <ActiveFrameLoop active={active} />}
        <LaptopScene {...props} active={active} glowRef={glowRef} />
      </Canvas>}
    </div>
  )
}
