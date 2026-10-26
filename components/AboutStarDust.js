import { useEffect, useRef } from 'react'

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

// A repeatable distribution keeps the field stable across resize and remounts.
function randomAt(index, salt = 0) {
  const value = Math.sin(index * 127.1 + salt * 311.7 + 17.3) * 43758.5453
  return value - Math.floor(value)
}

export default function AboutStarDust({ sceneRef, motionRef, reducedMotion = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const scene = sceneRef?.current || canvas?.parentElement
    const context = canvas?.getContext('2d', { alpha: true })
    if (!scene || !context) return undefined

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let staticMotion = reducedMotion || motionQuery.matches
    let width = 0
    let height = 0
    let particles = []
    let visible = false
    let frame = 0
    let lastFrame = 0
    let elapsed = 0
    let flow = 1.8

    function schedule() {
      if (!frame && visible && !document.hidden) frame = window.requestAnimationFrame(render)
    }

    function suspend() {
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      lastFrame = 0
    }

    function updateVisibility() {
      const rect = scene.getBoundingClientRect()
      visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
      if (visible) schedule()
      else suspend()
    }

    function resize() {
      const rect = scene.getBoundingClientRect()
      const nextWidth = Math.max(0, rect.width)
      const nextHeight = Math.max(0, rect.height)
      if (nextWidth === width && nextHeight === height) {
        updateVisibility()
        return
      }
      const previousWidth = width
      const previousHeight = height
      width = nextWidth
      height = nextHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      const count = clamp(Math.round(width * height / 23000), 30, 110)
      const oldParticles = particles
      particles = Array.from({ length: count }, (_, index) => {
        const previous = oldParticles[index]
        return {
          x: previous && previousWidth ? previous.x / previousWidth * width : randomAt(index, 1) * width,
          y: previous && previousHeight ? previous.y / previousHeight * height : randomAt(index, 2) * height,
          depth: 0.2 + randomAt(index, 3) * 0.8,
          radius: 0.38 + randomAt(index, 4) * 0.62,
          alpha: 0.12 + randomAt(index, 5) * 0.22,
          phase: randomAt(index, 6) * Math.PI * 2,
          rate: 0.35 + randomAt(index, 7) * 0.65,
          cyan: index % 5 === 0,
          halo: index % 9 === 0
        }
      })
      updateVisibility()
    }

    function render(timestamp) {
      frame = 0
      if (!visible || document.hidden || !width || !height) return

      // This quiet background needs only thirty frames per second.
      if (!staticMotion && lastFrame && timestamp - lastFrame < 32) {
        schedule()
        return
      }
      const delta = staticMotion ? 0 : Math.min((timestamp - (lastFrame || timestamp)) / 1000, 0.06)
      lastFrame = timestamp
      elapsed += delta
      const motion = motionRef?.current
      const velocity = motion?.active && Number.isFinite(motion.velocity) ? motion.velocity : 0
      const targetFlow = staticMotion ? 0 : Math.abs(velocity) > 0.01
        ? Math.sign(velocity) * (1.8 + Math.min(Math.abs(velocity) * 0.055, 85))
        : 1.8
      flow += (targetFlow - flow) * (1 - Math.exp(-delta * 4.5))

      context.clearRect(0, 0, width, height)
      for (const particle of particles) {
        // Scroll direction changes the horizontal current; idle retains a very
        // faint drift. No long streaks cover the reading area.
        particle.x += flow * particle.depth * delta
        particle.y += (0.3 + particle.depth * 1.15) * delta
        if (particle.x < -5) particle.x = width + 5
        else if (particle.x > width + 5) particle.x = -5
        if (particle.y > height + 5) particle.y = -5

        const twinkle = staticMotion ? 0.8 : 0.7 + Math.sin(elapsed * particle.rate + particle.phase) * 0.3
        const alpha = particle.alpha * twinkle
        const color = particle.cyan ? '150,231,244' : '225,233,239'
        if (particle.halo) {
          context.fillStyle = `rgba(${color},${alpha * 0.1})`
          context.beginPath()
          context.arc(particle.x, particle.y, particle.radius * 3.5, 0, Math.PI * 2)
          context.fill()
        }
        context.fillStyle = `rgba(${color},${alpha})`
        context.beginPath()
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        context.fill()
      }
      if (!staticMotion) schedule()
    }

    function onVisibilityChange() {
      if (document.hidden) suspend()
      else updateVisibility()
    }

    function onMotionChange() {
      staticMotion = reducedMotion || motionQuery.matches
      flow = staticMotion ? 0 : 1.8
      suspend()
      schedule()
    }

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(() => {
      // Use fresh bounds because queued observer entries can predate a resize.
      updateVisibility()
    })
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(scene)
    resizeObserver?.observe(scene)
    window.addEventListener('resize', resize, { passive: true })
    if (!observer) window.addEventListener('scroll', updateVisibility, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    motionQuery.addEventListener('change', onMotionChange)
    resize()

    return () => {
      suspend()
      observer?.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', updateVisibility)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      motionQuery.removeEventListener('change', onMotionChange)
    }
  }, [sceneRef, motionRef, reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-about-dust="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
