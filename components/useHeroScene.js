import { useEffect, useRef, useState } from 'react'
import { getHeroRoleFrame, HERO_ROLES } from './heroRoles'
import { sampleHeroPortraitMotion } from './heroPortraitMotion'

export function useHeroActivity(sectionRef) {
  const [active, setActive] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    let inView = true
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setActive(inView && document.visibilityState !== 'hidden' && section.dataset.aboutCovered !== 'true')
    const preference = () => setReducedMotion(media.matches)
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update() }, {threshold: .01})
    observer.observe(section)
    preference()
    update()
    media.addEventListener('change', preference)
    document.addEventListener('visibilitychange', update)
    section.addEventListener('hero:scene-visibility', update)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', preference)
      document.removeEventListener('visibilitychange', update)
      section.removeEventListener('hero:scene-visibility', update)
    }
  }, [sectionRef])
  return { active, reducedMotion }
}

export function useHeroTypewriter(active, reducedMotion) {
  const elapsed = useRef(0)
  const [frame, setFrame] = useState(() => getHeroRoleFrame(0))
  useEffect(() => {
    if (reducedMotion) {
      setFrame({ text: HERO_ROLES[0], index: 0, role: HERO_ROLES[0] })
      return
    }
    if (!active) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      elapsed.current += Math.min(now - previous, 150)
      previous = now
      const next = getHeroRoleFrame(elapsed.current)
      setFrame(current => current.text === next.text && current.index === next.index ? current : next)
    }, 40)
    return () => window.clearInterval(timer)
  }, [active, reducedMotion])
  return frame
}

// The complete portrait is transformed, so its core inherits exactly the same
// movement. Pointer samples never cause React renders or layout changes.
export function useHeroParallax(portraitRef, active, reducedMotion) {
  const motion = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, elapsed: 0, frame: 0, last: 0, pose: {} })
  useEffect(() => {
    const portrait = portraitRef.current
    if (!portrait) return
    const state = motion.current
    if (reducedMotion || !active) {
      cancelAnimationFrame(state.frame)
      state.frame = 0
      state.last = 0
      portrait.style.transform = ''
      return
    }
    const draw = now => {
      state.frame = 0
      const dt = state.last ? Math.min((now - state.last) / 1000, .05) : 1 / 60
      state.last = now
      state.elapsed += dt
      const damping = 1 - Math.exp(-5.5 * dt)
      state.x += (state.targetX - state.x) * damping
      state.y += (state.targetY - state.y) * damping
      const compact = window.innerWidth <= 1100
      const pose = sampleHeroPortraitMotion(state.x, state.y, state.elapsed, compact, state.pose)
      portrait.style.transform = `perspective(1400px) translate3d(${pose.x.toFixed(3)}px,${pose.y.toFixed(3)}px,0) rotateX(${pose.rotateX.toFixed(3)}deg) rotateY(${pose.rotateY.toFixed(3)}deg) rotateZ(${pose.rotateZ.toFixed(3)}deg)`
      portrait.dataset.parallaxX = pose.x.toFixed(2)
      portrait.dataset.parallaxY = pose.y.toFixed(2)
      portrait.dataset.portraitIdleY = pose.idleY.toFixed(2)
      // Idle levitation continues after pointer damping has settled.
      state.frame = requestAnimationFrame(draw)
    }
    const wake = () => {
      if (!state.frame) { state.last = 0; state.frame = requestAnimationFrame(draw) }
    }
    const update = event => {
      state.targetX = Math.max(-1, Math.min(1, event.clientX / window.innerWidth * 2 - 1))
      state.targetY = Math.max(-1, Math.min(1, event.clientY / window.innerHeight * 2 - 1))
      wake()
    }
    const reset = () => { state.targetX = 0; state.targetY = 0; wake() }
    const leave = event => { if (!event.relatedTarget) reset() }
    const releaseTouch = event => { if (event.pointerType === 'touch') reset() }
    window.addEventListener('pointermove', update, {passive: true})
    window.addEventListener('pointerdown', update, {passive: true})
    window.addEventListener('pointerout', leave, {passive: true})
    window.addEventListener('pointerup', releaseTouch, {passive: true})
    window.addEventListener('pointercancel', reset, {passive: true})
    window.addEventListener('blur', reset)
    wake()
    return () => {
      cancelAnimationFrame(state.frame)
      state.frame = 0
      window.removeEventListener('pointermove', update)
      window.removeEventListener('pointerdown', update)
      window.removeEventListener('pointerout', leave)
      window.removeEventListener('pointerup', releaseTouch)
      window.removeEventListener('pointercancel', reset)
      window.removeEventListener('blur', reset)
    }
  }, [active, reducedMotion, portraitRef])
}
