import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { JOURNEY_VORTEX_END } from './journeyMotion'

// The transition uses the actual settled portrait and measured HTML typography
// as its texture. A subdivided surface lets different parts of each letter and
// photograph stretch along different spiral paths instead of rotating a card.
const vertexShader = `
  uniform float progress;
  uniform float aspect;
  varying vec2 sourceUv;
  varying float travel;
  void main() {
    sourceUv = uv;
    vec2 point = position.xy;
    point.x *= aspect;
    float radius = length(point);
    float delay = min(radius * .20, .24);
    float t = clamp((progress - delay) / (1.0 - delay), 0.0, 1.0);
    float eased = t * t * (3.0 - 2.0 * t);
    float angle = atan(point.y, point.x);
    // Inner material falls first. The uneven rotation along the radius creates
    // long curved ribbons while the outer silhouette is still recognizable.
    float spin = eased * (9.0 + 4.5 * exp(-radius * 1.1));
    float squeeze = pow(max(1.0 - eased, .00001), 1.65);
    vec2 warped = vec2(cos(angle + spin), sin(angle + spin)) * radius * squeeze;
    warped.x /= aspect;
    travel = eased;
    gl_Position = vec4(warped, 0.0, 1.0);
  }
`
const fragmentShader = `
  uniform sampler2D memory;
  uniform float progress;
  varying vec2 sourceUv;
  varying float travel;
  void main() {
    vec4 ink = texture2D(memory, sourceUv);
    float finish = 1.0 - smoothstep(.88, 1.0, progress);
    // A restrained cyan edge appears only as matter approaches the singularity.
    vec3 tint = mix(ink.rgb, ink.rgb * vec3(.68, 1.10, 1.18), travel * .45);
    gl_FragColor = vec4(tint, ink.a * finish);
    #include <colorspace_fragment>
  }
`

function paintText(context, element, origin, ratio) {
  const style = getComputedStyle(element)
  if (Number(style.opacity) < .01 || style.display === 'none') return
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  context.fillStyle = style.color
  context.textBaseline = 'alphabetic'
  context.shadowBlur = 0
  const range = document.createRange()
  const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walk.nextNode())) {
    for (let index = 0; index < node.length; index++) {
      const character = node.textContent[index]
      if (!character.trim()) continue
      range.setStart(node, index)
      range.setEnd(node, index + 1)
      const rect = range.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      const metrics = context.measureText(character)
      const descent = metrics.fontBoundingBoxDescent ?? Number.parseFloat(style.fontSize) * .21
      context.fillText(character, (rect.left - origin.left) * ratio, (rect.bottom - origin.top) * ratio - descent)
    }
  }
  range.detach()
}

function makeSnapshot(world, portrait, canvas) {
  const bounds = world.getBoundingClientRect()
  if (!bounds.width || !bounds.height || !portrait?.complete || !portrait.naturalWidth) return false
  const ratio = Math.min(1.25, 2048 / bounds.width)
  canvas.width = Math.round(bounds.width * ratio)
  canvas.height = Math.round(bounds.height * ratio)
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, canvas.width, canvas.height)
  // Use CSS pixel coordinates for the photograph and line; text positions and
  // fonts are scaled together, preserving actual word wrapping at every size.
  context.save()
  context.scale(ratio, ratio)
  const title = world.querySelector('[data-vortex-title]')
  if (title) paintText(context, title, bounds, 1)
  const image = world.querySelector('[data-vortex-portrait] img')
  if (image) {
    const rect = image.getBoundingClientRect()
    context.drawImage(portrait, rect.left - bounds.left, rect.top - bounds.top, rect.width, rect.height)
  }
  world.querySelectorAll('[data-vortex-copy]').forEach(element => paintText(context, element, bounds, 1))
  const line = world.querySelector('[data-vortex-line]')?.getBoundingClientRect()
  if (line) {
    context.fillStyle = '#1ad5ff'
    context.shadowColor = '#00c4ff'
    context.shadowBlur = 9
    context.fillRect(line.left - bounds.left, line.top - bounds.top, line.width, line.height)
  }
  context.restore()
  return true
}

export default function AboutVortex({ worldRef, motionRef, enabled }) {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    const world = worldRef.current
    if (!enabled || !host || !world) return undefined
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    } catch {
      // A CSS fallback still completes the reversible story if WebGL is absent.
      world.dataset.vortexFallback = 'true'
      return () => { delete world.dataset.vortexFallback }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setClearColor(0x000000, 0)
    Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' })
    host.appendChild(renderer.domElement)
    const canvas = document.createElement('canvas')
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { progress: { value: 0 }, aspect: { value: 1 }, memory: { value: texture } }
    })
    const geometry = new THREE.PlaneGeometry(2, 2, 180, 110)
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(geometry, material))
    const camera = new THREE.Camera()
    const portrait = new window.Image()
    let ready = false
    let dirty = true
    let frame = 0
    let disposed = false
    let previousProgress = -1
    const resize = () => {
      const rect = host.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height, false)
      material.uniforms.aspect.value = rect.width / Math.max(rect.height, 1)
      dirty = true
      wake()
    }
    const render = () => {
      frame = 0
      if (disposed || document.hidden) return
      const motion = motionRef.current
      const progress = motion.journeyProgress || 0
      const active = motion.journeyActive && progress < JOURNEY_VORTEX_END + .08
      host.style.visibility = active && progress > 0 ? 'visible' : 'hidden'
      if (!active) return
      if (dirty && ready && makeSnapshot(world, portrait, canvas)) {
        texture.needsUpdate = true
        previousProgress = -1
        dirty = false
        world.dataset.vortexReady = 'true'
      }
      if (dirty) return
      const t = Math.min(1, progress / JOURNEY_VORTEX_END)
      if (t !== previousProgress) {
        material.uniforms.progress.value = t
        renderer.render(scene, camera)
        previousProgress = t
      }
    }
    function wake() {
      if (!frame && !disposed) frame = requestAnimationFrame(render)
    }
    const onUpdate = () => wake()
    portrait.onload = () => { ready = true; dirty = true; wake() }
    portrait.src = '/Me4.png'
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    window.addEventListener('about:journey-update', onUpdate)
    document.addEventListener('visibilitychange', onUpdate)
    document.fonts?.ready.then(() => { if (!disposed) { dirty = true; wake() } })
    resize()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('about:journey-update', onUpdate)
      document.removeEventListener('visibilitychange', onUpdate)
      portrait.onload = null
      delete world.dataset.vortexReady
      texture.dispose()
      material.dispose()
      geometry.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [enabled, worldRef, motionRef])

  return <div ref={hostRef} aria-hidden="true" data-about-vortex="true" style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', visibility: 'hidden' }} />
}
