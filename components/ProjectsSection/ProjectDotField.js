import { useEffect, useRef } from 'react'
import {
  createProjectDots,
  PROJECT_DOT_WAVE_SPEED,
  projectDotHoverStrength,
  projectDotWaveReach,
  projectDotWaveStrength
} from './projectDotMath'

const INTERACTIVE_TARGETS = 'a,button,input,textarea,select,summary,[role="button"],[data-dot-ignore]'

export default function ProjectDotField({ sceneRef, motionRef }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const scene = sceneRef?.current || canvas?.parentElement
    const context = canvas?.getContext('2d', { alpha: true })
    if (!scene || !context) return undefined

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let dots = []
    let waves = []
    let frame = 0
    let lastFrame = 0
    let elapsed = 0
    let visible = false
    let staticDrawn = false
    let previousOpacity = -1
    const pointer = { x: -1000, y: -1000, targetX: -1000, targetY: -1000, strength: 0, inside: false }

    function wake() {
      if (!frame && visible && !document.hidden) frame = window.requestAnimationFrame(draw)
    }

    function suspend() {
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      lastFrame = 0
    }

    function updateVisibility() {
      const bounds = scene.getBoundingClientRect()
      visible = bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight
      if (visible) wake()
      else suspend()
    }

    function resize() {
      const bounds = scene.getBoundingClientRect()
      width = Math.max(0, bounds.width)
      height = Math.max(0, bounds.height)
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      const spacing = Math.max(17, Math.min(22, width / 96))
      dots = createProjectDots(width, height, spacing)
      staticDrawn = false
      waves = []
      updateVisibility()
    }

    function draw(timestamp) {
      frame = 0
      if (!visible || document.hidden || !width || !height) return
      const motion = motionRef?.current
      const active = motion?.active !== false
      const reducedMotion = Boolean(motion?.reducedMotion || motionQuery.matches)
      const opacity = Math.max(0, Math.min(1, motion?.dotOpacity ?? 1))
      if (opacity !== previousOpacity) {
        canvas.style.opacity = String(opacity)
        previousOpacity = opacity
      }
      if (!active || opacity <= .001) {
        lastFrame = 0
        return
      }
      if (!reducedMotion && lastFrame && timestamp - lastFrame < 32) {
        wake()
        return
      }
      const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.06) : 1 / 30
      lastFrame = timestamp
      if (!reducedMotion) elapsed += delta
      if (reducedMotion && staticDrawn) return

      const follow = 1 - Math.exp(-delta * 10)
      pointer.x += (pointer.targetX - pointer.x) * follow
      pointer.y += (pointer.targetY - pointer.y) * follow
      pointer.strength += ((pointer.inside && !reducedMotion ? 1 : 0) - pointer.strength) * (1 - Math.exp(-delta * 7))
      waves = reducedMotion ? [] : waves.filter((wave) => (elapsed - wave.started) * PROJECT_DOT_WAVE_SPEED <= wave.reach + 100)

      context.clearRect(0, 0, width, height)
      for (const dot of dots) {
        const hover = reducedMotion ? 0 : projectDotHoverStrength(dot.x, dot.y, pointer.x, pointer.y, elapsed, pointer.strength)
        let waveStrength = 0
        for (const wave of waves) {
          const distance = Math.hypot(dot.x - wave.x, dot.y - wave.y)
          waveStrength += projectDotWaveStrength(distance, elapsed - wave.started, wave.reach)
        }
        const illumination = Math.min(1, hover * 0.8 + waveStrength)
        const alpha = Math.min(0.78, dot.alpha + illumination * 0.62)
        const radius = dot.radius + illumination * 1.05
        context.fillStyle = `rgba(184,202,208,${alpha.toFixed(3)})`
        context.beginPath()
        context.arc(dot.x, dot.y, radius, 0, Math.PI * 2)
        context.fill()
      }
      staticDrawn = reducedMotion
      if (!reducedMotion && (pointer.inside || pointer.strength > .001 || waves.length > 0)) wake()
    }

    function setPointer(event) {
      if (event.pointerType === 'touch') return
      const bounds = scene.getBoundingClientRect()
      pointer.targetX = event.clientX - bounds.left
      pointer.targetY = event.clientY - bounds.top
      if (!pointer.inside) {
        pointer.x = pointer.targetX
        pointer.y = pointer.targetY
      }
      pointer.inside = true
      wake()
    }

    function clearPointer() {
      pointer.inside = false
      wake()
    }

    function addWave(event) {
      if (event.button !== 0 || event.target?.closest?.(INTERACTIVE_TARGETS)) return
      if (motionRef?.current?.reducedMotion || motionQuery.matches || motionRef?.current?.active === false || (motionRef?.current?.dotOpacity ?? 1) < .05) return
      const bounds = scene.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      waves.push({ x, y, started: elapsed, reach: projectDotWaveReach(x, y, width, height) })
      if (waves.length > 5) waves.shift()
      wake()
    }

    function onVisibilityChange() {
      if (document.hidden) suspend()
      else updateVisibility()
    }

    function onMotionChange() {
      staticDrawn = false
      waves = []
      wake()
    }

    const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(updateVisibility)
    const resizing = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    intersection?.observe(scene)
    resizing?.observe(scene)
    scene.addEventListener('pointermove', setPointer, { passive: true })
    scene.addEventListener('pointerleave', clearPointer, { passive: true })
    scene.addEventListener('pointerdown', addWave, { passive: true })
    window.addEventListener('scroll', updateVisibility, { passive: true })
    window.addEventListener('resize', resize, { passive: true })
    window.addEventListener('projects:motion', wake)
    document.addEventListener('visibilitychange', onVisibilityChange)
    motionQuery.addEventListener('change', onMotionChange)
    resize()

    return () => {
      suspend()
      intersection?.disconnect()
      resizing?.disconnect()
      scene.removeEventListener('pointermove', setPointer)
      scene.removeEventListener('pointerleave', clearPointer)
      scene.removeEventListener('pointerdown', addWave)
      window.removeEventListener('scroll', updateVisibility)
      window.removeEventListener('resize', resize)
      window.removeEventListener('projects:motion', wake)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      motionQuery.removeEventListener('change', onMotionChange)
    }
  }, [sceneRef, motionRef])

  return (
    <canvas
      ref={canvasRef}
      data-project-dots="true"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0 }}
    />
  )
}
