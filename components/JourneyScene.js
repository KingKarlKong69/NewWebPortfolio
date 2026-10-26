import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {shuffleMemoryImages} from './journeyImageOrder'
import ActiveFrameLoop from './ActiveFrameLoop'
import JourneyTesseract from './JourneyTesseract'
import JourneyRibbon from './JourneyRibbon'
import JourneyMemoryBackdrop from './JourneyMemoryBackdrop'
import { MOSAIC_CORE_X, MOSAIC_CORE_Y } from './journeyRibbonMath'
import { JOURNEY_INTRO, JOURNEY_MEMORIES } from './journeyMemories'
import { sampleJourney } from './journeyMotion'
import { dragJourneyCarousel } from './journeyCarouselMotion'
import styles from './JourneyScene.module.css'

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t) }

export default function JourneyScene({ enabled, motionRef }) {
  const memories=useMemo(()=>JOURNEY_MEMORIES.map(memory=>({...memory,images:shuffleMemoryImages(memory.images)})),[])
  const rootRef = useRef(null)
  const frameRef = useRef({ coreX: .5, coreY: -.2, coreOpacity: 0, coreScale: 1, elapsed: 0 })
  const titleRef = useRef(null)
  const introRef = useRef(null)
  const headingRef = useRef(null)
  const descriptionRef = useRef(null)
  const barRef = useRef(null)
  const indexRef = useRef(0)
  const dragRef = useRef(null)
  const poseRef = useRef({ tiltX: 0, tiltY: 0, hoverX: 0, hoverY: 0, x: 0, y: 0, offsetX: 0, offsetY: 0 })
  const [memoryIndex, setMemoryIndex] = useState(0)
  const [frontImage, setFrontImage] = useState(JOURNEY_MEMORIES[0].images[0])
  const [active, setActive] = useState(false)
  const memory = memories[memoryIndex]
  const heading = `${memory.title.toUpperCase()} | ${memory.year}`
  const selectFront = useCallback(source => setFrontImage(current => current === source ? current : source), [])

  useEffect(() => {
    if (!enabled || !rootRef.current) return
    const root = rootRef.current
    const frame = frameRef.current
    const intro = {}
    const properties = new Map()
    let raf = 0
    let previous = 0
    let elapsed = 0
    let disposed = false
    let wasActive = false
    let headingChars = -1
    let descriptionChars = -1
    let introChars = -1
    const set = (key, value) => {
      const next = Number(value || 0).toFixed(5)
      if (properties.get(key) === next) return
      properties.set(key, next)
      root.style.setProperty(key, next)
    }
    const wake = () => { if (!disposed && !raf && !document.hidden) raf = requestAnimationFrame(draw) }
    const draw = now => {
      raf = 0
      if (disposed) return
      const motion = motionRef.current
      const visible = Boolean(motion.journeyActive && !document.hidden)
      sampleJourney(clamp(motion.journeyProgress || 0), intro)
      const entered = (motion.journeyProgress || 0) >= .9995
      const carousel = motion.carousel || {}
      const phase = entered ? (carousel.phase || 'gate') : 'intro'
      const delta = visible && previous ? Math.min(.06, (now - previous) / 1000) : 0
      previous = visible ? now : 0
      elapsed += delta
      const nextIndex = Math.floor(clamp(carousel.memoryIndex || 0, 0, JOURNEY_MEMORIES.length - 1))
      if (entered && nextIndex !== indexRef.current) {
        indexRef.current = nextIndex
        headingChars = -1
        descriptionChars = -1
        setMemoryIndex(nextIndex)
      }
      const current = JOURNEY_MEMORIES[indexRef.current]
      const title = `${current.title.toUpperCase()} | ${current.year}`
      const initialFormation = indexRef.current === 0 && (phase === 'gate' || phase === 'charging') ? 0
        : phase === 'forming' && indexRef.current === 0 ? smooth((carousel.formation || 0) / .8) : 1
      frame.phase = phase
      frame.elapsed = elapsed
      frame.formation = entered ? (carousel.formation || 0) : 0
      frame.absorption = entered ? (carousel.absorption || 0) : 0
      frame.rotation = entered ? (carousel.rotation || 0) : 0
      frame.carouselOpacity = entered ? (carousel.carouselOpacity || 0) : 0
      const pose = poseRef.current
      const interactive = phase === 'reading' || phase === 'ready'
      const follow = 1-Math.exp(-9*delta)
      pose.x += ((interactive ? pose.tiltX-pose.hoverY*.045 : 0)-pose.x)*follow
      pose.y += ((interactive ? pose.tiltY+pose.hoverX*.045 : 0)-pose.y)*follow
      pose.offsetX += ((interactive ? pose.hoverX*.004 : 0)-pose.offsetX)*follow
      pose.offsetY += ((interactive ? pose.hoverY*.004 : 0)-pose.offsetY)*follow
      frame.ringTiltX = pose.x
      frame.ringTiltY = pose.y
      frame.ringOffsetX = pose.offsetX
      frame.ringOffsetY = pose.offsetY
      // The same opening coordinates drive the mosaic and its core. The final
      // move reaches viewport center before ascent starts, and retraces on up-scroll.
      const centering = clamp(carousel.centerProgress || 0)
      const openingX = .5 + initialFormation * (MOSAIC_CORE_X - .5)
      const openingY = .5 + initialFormation * (MOSAIC_CORE_Y - .5)
      frame.coreX = entered ? openingX + (.5 - openingX) * centering : .5
      frame.coreY = entered ? openingY + (.5 - openingY) * centering - (carousel.ascend || 0) : intro.coreY
      if (interactive) {
        frame.coreX += pose.offsetX
        frame.coreY += pose.offsetY
      }
      frame.coreOpacity = entered ? (carousel.coreOpacity ?? 1) : intro.coreOpacity
      frame.coreScale = entered ? (carousel.coreScale ?? 1) : 1
      frame.coreCharge = entered ? (carousel.coreCharge || 0) : 0
      frame.finalCharge=entered&&nextIndex===memories.length-1&&(['ready','absorbing','centering','centerSettle','ascending','done'].includes(phase))
      frame.carouselSpeed=Math.abs(motion.carouselState?.rotationVelocity||0)
      frame.spinSpeed = entered ? Math.max(0, (carousel.spinSpeed || 0) - .08) * 32 : 0
      frame.ascend = entered ? (carousel.ascend || 0) : 0
      const gpuActive = visible && (frame.coreOpacity > .001 || frame.carouselOpacity > .001)
      if (gpuActive !== wasActive) { wasActive = gpuActive; setActive(gpuActive) }
      root.style.opacity = entered ? '1' : String(intro.journeyOpacity || 0)
      root.dataset.phase = phase
      root.dataset.memoryYear = String(current.year)
      root.dataset.journeyActive = String(visible)
      root.setAttribute('aria-hidden', String(!visible))
      const showingMemory = entered && ['reading', 'ready', 'erasing', 'absorbing'].includes(phase)
      const textFade = phase === 'absorbing' ? 1 - smooth(frame.absorption * 1.8) : 1
      const background = entered ? frame.carouselOpacity * (phase === 'absorbing' ? 1 - frame.absorption : 1) : 0
      set('--memory-opacity', showingMemory ? textFade : 0)
      set('--background-presence', background)
      set('--journey-title-scale', intro.titleScale)
      set('--journey-title-opacity', entered ? 0 : intro.titleOpacity)
      set('--journey-title-x', intro.titleX)
      set('--journey-intro-opacity', entered ? 0 : intro.introOpacity)
      set('--core-x', frame.coreX)
      set('--core-y', frame.coreY)
      const hintVisible = entered && (phase === 'gate' || phase === 'ready')
      set('--hint-opacity', hintVisible ? 1 : 0)
      set('--charge', entered ? (carousel.charge || 0) : 0)
      const nextIntroChars = Math.floor(clamp(intro.introTyping) * JOURNEY_INTRO.length)
      if (introRef.current && nextIntroChars !== introChars) {
        introRef.current.textContent = JOURNEY_INTRO.slice(0, nextIntroChars)
        introChars = nextIntroChars
      }
      const nextHeadingChars = showingMemory ? Math.floor(clamp(carousel.headingCharacters || 0, 0, title.length)) : 0
      const nextDescriptionChars = showingMemory ? Math.floor(clamp(carousel.textCharacters || 0, 0, current.description.length)) : 0
      if (headingRef.current && headingChars !== nextHeadingChars) {
        headingRef.current.textContent = title.slice(0, nextHeadingChars)
        headingChars = nextHeadingChars
      }
      if (descriptionRef.current && descriptionChars !== nextDescriptionChars) {
        descriptionRef.current.textContent = current.description.slice(0, nextDescriptionChars)
        descriptionChars = nextDescriptionChars
      }
      root.dataset.headingTyping = String(['reading','erasing'].includes(phase) && nextHeadingChars < title.length)
      root.dataset.descriptionTyping = String(['reading','erasing'].includes(phase) && nextHeadingChars >= title.length && nextDescriptionChars < current.description.length)
      headingRef.current?.parentElement?.setAttribute('aria-hidden', String(!showingMemory || !nextHeadingChars))
      descriptionRef.current?.parentElement?.setAttribute('aria-hidden', String(!showingMemory || !nextDescriptionChars))
      titleRef.current?.setAttribute('aria-hidden', String(entered || intro.titleOpacity < .1))
      const chargePercent = Math.round(clamp(carousel.charge || 0) * 100)
      barRef.current?.setAttribute('aria-valuenow', String(chargePercent))
      barRef.current?.setAttribute('aria-hidden', String(!hintVisible))
      // The shared carousel clock drives typing and idle rotation independently
      // of scroll; scroll energy is accepted only once the memory is ready.
      if (gpuActive) wake()
    }
    const notify = () => wake()
    const previousNotify = motionRef.current.onJourneyUpdate
    motionRef.current.onJourneyUpdate = notify
    window.addEventListener('about:journey-update', notify)
    const visibility = () => {
      previous = 0
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf)
        raf = 0
        wasActive = false
        setActive(false)
      } else wake()
    }
    document.addEventListener('visibilitychange', visibility)
    wake()
    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      if (motionRef.current.onJourneyUpdate === notify) motionRef.current.onJourneyUpdate = previousNotify
      window.removeEventListener('about:journey-update', notify)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [enabled, motionRef])

  const endDrag = event => {
    if (!dragRef.current || event.pointerId !== dragRef.current.id) return
    const state = motionRef.current.carouselState
    if (state && event.type === 'pointercancel') state.dragSampleAt = null
    if (state) dragJourneyCarousel(state, 0, false, state.nowMs, event.timeStamp)
    dragRef.current = null
    event.currentTarget.dataset.dragging = 'false'
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const hover = event => {
    const rect = event.currentTarget.getBoundingClientRect()
    poseRef.current.hoverX = clamp((event.clientX-rect.left)/Math.max(1,rect.width)*2-1,-1,1)
    poseRef.current.hoverY = clamp((event.clientY-rect.top)/Math.max(1,rect.height)*2-1,-1,1)
  }

  if (!enabled) return null
  return <div ref={rootRef} className={styles.journey} data-journey-scene data-front-image={frontImage} data-phase="intro" aria-hidden="true" style={{ opacity: 0, '--heading-size': `${Math.min(3.65, 60 / (heading.length * .53))}vw` }}>
    <JourneyMemoryBackdrop source={frontImage} />
    <div ref={titleRef} className={styles.titleScene} aria-hidden="true">
      <h2>MY JOURNEY</h2>
      <p aria-label={JOURNEY_INTRO}><span ref={introRef} aria-hidden="true" /><i aria-hidden="true" /></p>
    </div>
    <div className={styles.canvas} aria-hidden="true">
      <Canvas style={{ pointerEvents: 'none' }} orthographic camera={{ position: [0, 0, 20], zoom: 100, near: .1, far: 100 }} dpr={[1, 1.5]} frameloop="demand" gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}>
        <ActiveFrameLoop active={active} />
        <JourneyTesseract frameRef={frameRef} />
        <Suspense fallback={null}>
          <JourneyRibbon frameRef={frameRef} memory={memory} onFrontImage={selectFront} />
        </Suspense>
      </Canvas>
    </div>
    <div className={styles.carouselDrag} role="group" tabIndex={0} data-journey-interaction
      aria-label="Memory photos. Drag horizontally to spin, vertically to tilt. Left and right arrows rotate; up and down arrows tilt."
      onPointerEnter={hover}
      onPointerLeave={() => { poseRef.current.hoverX=0; poseRef.current.hoverY=0 }}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return
        const state = motionRef.current.carouselState
        if (!state || !motionRef.current.journeyActive || !dragJourneyCarousel(state, 0, true, state.nowMs, event.timeStamp)) return
        event.preventDefault()
        event.currentTarget.focus({preventScroll:true})
        hover(event)
        dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
        event.currentTarget.dataset.dragging = 'true'
      }}
      onPointerMove={event => {
        hover(event)
        const drag = dragRef.current
        if (!drag || drag.id !== event.pointerId) return
        const state = motionRef.current.carouselState
        if (state) dragJourneyCarousel(state, event.clientX-drag.x, true, state.nowMs, event.timeStamp)
        poseRef.current.tiltX = clamp(poseRef.current.tiltX+(event.clientY-drag.y)/Math.max(1,window.innerHeight)*.8,-.17,.17)
        poseRef.current.tiltY = clamp(poseRef.current.tiltY+(event.clientX-drag.x)/Math.max(1,window.innerWidth)*.12,-.16,.16)
        drag.x = event.clientX
        drag.y = event.clientY
      }}
      onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
      onBlur={() => {
        const state = motionRef.current.carouselState
        if (state) state.dragSampleAt = null
        if (state) dragJourneyCarousel(state, 0, false, state.nowMs, performance.now())
        dragRef.current = null
      }}
      onKeyDown={event => {
        if (['ArrowUp','ArrowDown'].includes(event.key)) {
          poseRef.current.tiltX=clamp(poseRef.current.tiltX+(event.key==='ArrowUp'?-.025:.025),-.17,.17)
          event.preventDefault()
          return
        }
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
        const state = motionRef.current.carouselState
        if (state && dragJourneyCarousel(state, event.key === 'ArrowLeft' ? 80 : -80, false)) event.preventDefault()
      }} />
    <div className={styles.memoryCopy}>
      <h3 aria-label={heading} aria-hidden="true"><span ref={headingRef} aria-hidden="true" /><i aria-hidden="true" /></h3>
      <p aria-label={memory.description} aria-hidden="true"><span ref={descriptionRef} aria-hidden="true" /><i aria-hidden="true" /></p>
    </div>
    <div ref={barRef} className={styles.chargeHint} role="progressbar" aria-label="Charge the tesseract" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-hidden="true">
      <div className={styles.chargeTrack}><i /></div>
      <span>CHARGE THE TESSERACT</span>
    </div>
  </div>
}
