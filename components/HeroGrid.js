import { useEffect, useRef } from 'react'
import {
  createHeroGridLines,
  createHeroGridRipple,
  deformHeroGridPoint,
  getHeroGridHoldCharge,
  getHeroGridReleaseState,
  getHeroGridFunnel,
  isHeroGridInViewport,
  HERO_GRID_RIPPLE_LIFETIME,
  HERO_GRID_RIPPLE_LIMIT
} from './heroGridMath'
import styles from './HeroGrid.module.css'

const interactiveSelector = 'a, button, input, textarea, select, [contenteditable="true"], [role="slider"], canvas, [data-hero-core], [data-hero-asteroid-id]'

export default function HeroGrid({ className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { alpha: true })
    if (!context) return undefined
    const hero = canvas.closest('#home')
    const isCovered = () => hero?.dataset.aboutCovered === 'true'
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = motionQuery.matches
    let rect = canvas.getBoundingClientRect()
    let width = 0
    let height = 0
    let lines = []
    let depthGradient
    let frame = 0
    let lastFrame = 0
    let visible = true
    let pointerDown = null
    let ripples = []
    const pointer = { x: 0, y: 0, active: false }
    const hover = { x: 0, y: 0, strength: 0, holdStrength: 0, charge: 0 }
    const output = { x: 0, y: 0 }
    const releaseState = {}
    const funnel = {}

    const isInteractive = target => target instanceof Element && !!target.closest(interactiveSelector)
    const contains = (x, y) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom

    function requestRender() {
      if (!frame && visible && !document.hidden && !isCovered()) frame = window.requestAnimationFrame(render)
    }

    function render(timestamp) {
      frame = 0
      if (!visible || document.hidden || isCovered() || width <= 0 || height <= 0) {
        suspendScene()
        return
      }
      const minimumInterval = width < 700 ? 1000 / 30 : 1000 / 60
      if (lastFrame && timestamp - lastFrame < minimumInterval - 1) {
        requestRender()
        return
      }
      const dt = Math.min((timestamp - (lastFrame || timestamp - 16)) / 1000, 0.05)
      lastFrame = timestamp
      const now = timestamp / 1000
      ripples = ripples.filter(ripple => now - ripple.started < (ripple.lifetime ?? HERO_GRID_RIPPLE_LIFETIME))
      const targetStrength = pointer.active && !reducedMotion ? 1 : 0
      const targetHold = pointerDown && targetStrength ? 1 : 0
      const targetCharge = targetHold ? getHeroGridHoldCharge(now - pointerDown.started) : 0
      const easing = 1 - Math.exp(-dt * 12)
      hover.strength += (targetStrength - hover.strength) * easing
      hover.holdStrength += (targetHold - hover.holdStrength) * easing
      hover.charge += (targetCharge - hover.charge) * easing
      hover.x += (pointer.x - hover.x) * easing
      hover.y += (pointer.y - hover.y) * easing
      if (hover.strength < 0.001) hover.strength = 0
      context.clearRect(0, 0, width, height)
      context.lineJoin = 'round'
      context.lineCap = 'round'
      context.lineWidth = Math.max(0.7, width / 1600 * 1.35)
      let release = null
      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        if (ripples[index].glitchStart) {
          release = ripples[index]
          break
        }
      }
      const state = release ? getHeroGridReleaseState(release, now, releaseState) : null
      const neonGradient = state?.phase === 'wave' ? createNeonSpread(release, state) : null
      const detailStrength = hover.holdStrength * (0.18 + hover.charge * 0.82)
      const detailGradient = detailStrength > 0.015 ? createDetailGradient() : null
      let lineIndex = 0
      for (const line of lines) {
        if (line.detail && !detailGradient) continue
        context.beginPath()
        for (let index = 0; index < line.points.length; index += 1) {
          const point = deformHeroGridPoint(line.points[index], hover, ripples, now, width, height, output)
          if (index === 0) context.moveTo(point.x, point.y)
          else context.lineTo(point.x, point.y)
        }
        context.globalAlpha = line.opacity * (line.detail ? detailStrength * 0.7 : 1)
        if (line.detail) context.strokeStyle = detailGradient
        else if (state?.phase === 'glitch') {
          const channel = (lineIndex + Math.floor(state.age * 12)) % 3
          context.strokeStyle = ['#ff35d6', '#6cff73', '#4eeaff'][channel]
          context.globalAlpha *= 0.65 + state.glitch * 0.35
        } else context.strokeStyle = neonGradient || (line.column ? depthGradient : '#00c7dc')
        context.stroke()
        // Short channel separation makes the glitch read as torn neon wire,
        // while all painting stays inside this independent floor canvas.
        if (!line.detail && state?.phase === 'glitch' && lineIndex % 3 === 0) {
          context.save()
          context.translate(Math.sin(lineIndex * 7 + Math.floor(state.age * 14)) * 5 * state.glitch, 1)
          context.globalAlpha *= 0.28 * state.glitch
          context.strokeStyle = '#eb5bff'
          context.stroke()
          context.restore()
        }
        lineIndex += 1
      }
      context.globalAlpha = 1
      if (detailStrength > 0.015) drawChargingSphere(now)
      if (state?.blast > 0) drawBlast(release, state)
      canvas.dataset.gridWarp = hover.strength.toFixed(2)
      canvas.dataset.gridRipples = String(ripples.length)
      canvas.dataset.gridCharge = (hover.charge * hover.holdStrength).toFixed(2)
      canvas.dataset.gridHeld = String(!!targetHold)
      canvas.dataset.gridPhase = state?.phase || (targetHold ? 'charging' : 'idle')
      canvas.dataset.gridSphere = (Math.max(0, (hover.charge - 0.58) / 0.42) * hover.holdStrength).toFixed(2)
      canvas.dataset.gridGlitch = state?.phase === 'glitch' ? state.glitch.toFixed(2) : '0'
      const settling = Math.abs(targetStrength - hover.strength) > 0.002 ||
        Math.abs(targetHold - hover.holdStrength) > 0.002 || Math.abs(targetCharge - hover.charge) > 0.002 ||
        (hover.strength > 0 && (Math.abs(pointer.x - hover.x) > 0.2 || Math.abs(pointer.y - hover.y) > 0.2))
      if (settling || targetHold || ripples.length) requestRender()
    }

    function createDetailGradient() {
      getHeroGridFunnel(hover, width, height, funnel)
      // Extra mesh is revealed only near the well and fades before its rim.
      const gradient = context.createRadialGradient(hover.x, hover.y, 0,
        hover.x, hover.y, funnel.radius * 1.5 + funnel.depth * 0.6)
      gradient.addColorStop(0, 'rgba(169,180,255,.9)')
      gradient.addColorStop(0.45, 'rgba(60,210,255,.65)')
      gradient.addColorStop(0.8, 'rgba(0,186,220,.22)')
      gradient.addColorStop(1, 'rgba(0,186,220,0)')
      return gradient
    }

    function createNeonSpread(release, state) {
      const maxDistance = Math.hypot(Math.max(release.x, width - release.x), Math.max(release.y, height - release.y)) + 32
      const radius = Math.max(1, state.neonRadius)
      const gradient = context.createRadialGradient(release.x, release.y, 0, release.x, release.y, maxDistance)
      const front = Math.min(0.999, radius / maxDistance)
      for (let index = 0; index <= 7; index += 1) {
        gradient.addColorStop(front * index / 7, `hsl(${(285 + index * 44 - state.age * 24) % 360} 100% ${index === 7 ? 79 : 65}%)`)
      }
      gradient.addColorStop(Math.min(1, front + 0.012), '#00c7dc')
      gradient.addColorStop(1, '#00c7dc')
      return gradient
    }

    function drawChargingSphere(now) {
      const energy = Math.max(0, Math.min(1, (hover.charge - 0.58) / 0.42)) * hover.holdStrength
      if (energy < 0.01) return
      const center = deformHeroGridPoint({ x: hover.x, y: hover.y }, hover, [], now, width, height, output)
      const x = center.x
      const y = Math.min(height - 12, center.y)
      const radius = Math.max(7, Math.min(21, width * 0.013)) * (0.62 + energy * 0.38)
      const breath = 0.9 + Math.sin(now * 5) * 0.1
      context.save()
      context.globalAlpha = energy
      context.globalCompositeOperation = 'screen'
      const aura = context.createRadialGradient(x, y, radius * 0.4, x, y, radius * 4)
      aura.addColorStop(0, `rgba(100,83,255,${0.5 * breath})`)
      aura.addColorStop(0.35, 'rgba(83,48,255,.28)')
      aura.addColorStop(1, 'rgba(66,40,220,0)')
      context.fillStyle = aura
      context.beginPath()
      context.arc(x, y, radius * 4, 0, Math.PI * 2)
      context.fill()
      context.globalCompositeOperation = 'source-over'
      const sphere = context.createRadialGradient(x - radius * 0.28, y - radius * 0.3, 0, x, y, radius)
      sphere.addColorStop(0, '#4a38a6')
      sphere.addColorStop(0.45, '#17103b')
      sphere.addColorStop(0.83, '#080617')
      sphere.addColorStop(0.96, '#5841d4')
      sphere.addColorStop(1, '#b3a2ff')
      context.fillStyle = sphere
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
      context.globalCompositeOperation = 'screen'
      context.strokeStyle = `rgba(149,119,255,${0.35 + energy * 0.5})`
      context.lineWidth = 0.9
      for (let index = 0; index < 2; index += 1) {
        const angle = now * (index ? -0.8 : 0.7)
        context.beginPath()
        context.ellipse(x, y, radius * (1.35 + index * 0.3), radius * 0.35, angle, 0, Math.PI * 2)
        context.stroke()
      }
      context.restore()
    }

    function drawBlast(release, state) {
      const radius = 18 + state.age * Math.max(230, width * 0.48)
      // The detonation starts at the sphere at the bottom of the well. It
      // rebounds with the surface instead of jumping back to the flat plane.
      const rebound = 1 - Math.pow(Math.max(0, 1 - state.age / 0.35), 3)
      const x = (release.blastX ?? release.x) + (release.x - (release.blastX ?? release.x)) * rebound
      const y = (release.blastY ?? release.y) + (release.y - (release.blastY ?? release.y)) * rebound
      context.save()
      context.globalCompositeOperation = 'screen'
      const bloom = context.createRadialGradient(x, y, 0, x, y, radius)
      bloom.addColorStop(0, `rgba(235,220,255,${state.blast * 0.72})`)
      bloom.addColorStop(0.15, `rgba(127,90,255,${state.blast * 0.5})`)
      bloom.addColorStop(0.65, `rgba(58,131,255,${state.blast * 0.12})`)
      bloom.addColorStop(1, 'rgba(80,50,255,0)')
      context.fillStyle = bloom
      context.beginPath()
      context.ellipse(x, y, radius, radius * 0.6, 0, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = `rgba(190,159,255,${state.blast * 0.85})`
      context.lineWidth = 1 + state.blast * 2
      context.stroke()
      context.restore()
    }

    function resize() {
      rect = canvas.getBoundingClientRect()
      // Resizing clears the canvas bitmap. Its new placement must decide
      // whether to repaint, rather than a cached intersection from the old
      // desktop/mobile layout.
      visible = !isCovered() && isHeroGridInViewport(rect, window.innerWidth, window.innerHeight)
      width = rect.width
      height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 1.75)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      lines = createHeroGridLines(width, height)
      depthGradient = context.createLinearGradient(0, 0, 0, height)
      depthGradient.addColorStop(0, 'rgba(0,117,130,.45)')
      depthGradient.addColorStop(0.5, 'rgba(0,191,210,.85)')
      depthGradient.addColorStop(1, 'rgba(100,232,255,.95)')
      pointerDown = null
      pointer.active = false
      lastFrame = 0
      if (visible && !document.hidden) requestRender()
      else suspendScene()
    }

    function updatePointer(event) {
      if (!visible || document.hidden || isCovered()) { suspendScene(); return }
      if (!event.isPrimary || (pointerDown && pointerDown.id !== event.pointerId)) return
      pointer.active = contains(event.clientX, event.clientY) && !isInteractive(event.target)
      // Keep page scrolling native on touch: a moving finger cancels the
      // charge, while a deliberate stationary long press can build energy.
      if (pointerDown && (!pointer.active || (event.pointerType !== 'mouse' &&
        Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 14))) {
        resetPointer()
        return
      }
      if (pointer.active) {
        pointer.x = event.clientX - rect.left
        pointer.y = event.clientY - rect.top
        if (!hover.strength) {
          hover.x = pointer.x
          hover.y = pointer.y
        }
      }
      requestRender()
    }

    function onPointerDown(event) {
      if (!visible || document.hidden || isCovered()) return
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
      updatePointer(event)
      pointerDown = pointer.active && !reducedMotion ? {
        x: event.clientX, y: event.clientY, id: event.pointerId, started: performance.now() / 1000
      } : null
      requestRender()
    }

    function onPointerUp(event) {
      if (!visible || document.hidden || isCovered()) { suspendScene(); return }
      if (!event.isPrimary || (pointerDown && pointerDown.id !== event.pointerId)) return
      if (pointerDown &&
        contains(event.clientX, event.clientY) && !isInteractive(event.target) && !reducedMotion) {
        const released = performance.now() / 1000
        const ripple = createHeroGridRipple(event.clientX - rect.left, event.clientY - rect.top,
          released, released - pointerDown.started, width, height)
        const bottom = deformHeroGridPoint({ x: hover.x, y: hover.y }, hover, [], released, width, height, output)
        ripple.blastX = bottom.x
        ripple.blastY = Math.min(height - 12, bottom.y)
        ripples.push(ripple)
        ripples = ripples.slice(-HERO_GRID_RIPPLE_LIMIT)
      }
      pointerDown = null
      if (event.pointerType !== 'mouse') {
        pointer.active = false
      }
      requestRender()
    }

    function resetPointer() {
      pointer.active = false
      pointerDown = null
      requestRender()
    }

    function suspendScene() {
      pointer.active = false
      pointerDown = null
      ripples = []
      hover.strength = 0
      hover.holdStrength = 0
      hover.charge = 0
      window.cancelAnimationFrame(frame)
      frame = 0
      lastFrame = 0
      canvas.dataset.gridHeld = 'false'
      canvas.dataset.gridCharge = '0'
      canvas.dataset.gridRipples = '0'
      canvas.dataset.gridPhase = 'idle'
      canvas.dataset.gridSphere = '0'
      canvas.dataset.gridGlitch = '0'
      canvas.dataset.gridWarp = '0'
    }

    function onPointerOut(event) {
      if (!event.relatedTarget) resetPointer()
    }

    function onContextMenu(event) {
      if (!visible || document.hidden || isCovered()) return
      if (pointerDown && contains(event.clientX, event.clientY) && !isInteractive(event.target)) {
        event.preventDefault()
      }
    }

    function onScroll() {
      rect = canvas.getBoundingClientRect()
      visible = !isCovered() && isHeroGridInViewport(rect, window.innerWidth, window.innerHeight)
      if (visible && !document.hidden) resetPointer()
      else suspendScene()
    }

    function onVisibility() {
      rect = canvas.getBoundingClientRect()
      visible = !isCovered() && isHeroGridInViewport(rect, window.innerWidth, window.innerHeight)
      if (visible && !document.hidden) {
        lastFrame = 0
        requestRender()
      } else suspendScene()
    }

    function onMotionPreference() {
      reducedMotion = motionQuery.matches
      if (reducedMotion) {
        resetPointer()
        ripples = []
        hover.strength = 0
        hover.holdStrength = 0
        hover.charge = 0
      }
      requestRender()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    const intersection = new IntersectionObserver(() => {
      // A rapid responsive resize can queue both exit and entry notifications.
      // Read the settled bounds so an earlier notification cannot leave a
      // newly visible canvas asleep after its drawing buffer was cleared.
      onVisibility()
    })
    intersection.observe(canvas)
    resize()
    window.addEventListener('pointermove', updatePointer, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', resetPointer, { passive: true })
    window.addEventListener('pointerout', onPointerOut, { passive: true })
    window.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('blur', resetPointer)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', resize, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    hero?.addEventListener('hero:scene-visibility', onVisibility)
    motionQuery.addEventListener('change', onMotionPreference)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      intersection.disconnect()
      window.removeEventListener('pointermove', updatePointer)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', resetPointer)
      window.removeEventListener('pointerout', onPointerOut)
      window.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('blur', resetPointer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      hero?.removeEventListener('hero:scene-visibility', onVisibility)
      motionQuery.removeEventListener('change', onMotionPreference)
    }
  }, [])

  return <canvas ref={canvasRef} className={`${styles.canvas} ${className}`} aria-hidden="true"
    data-hero-grid="interactive" data-grid-warp="0" data-grid-ripples="0" data-grid-charge="0" data-grid-held="false"
    data-grid-phase="idle" data-grid-sphere="0" data-grid-glitch="0" />
}
