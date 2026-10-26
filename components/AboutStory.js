import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import AboutStarDust from './AboutStarDust'
import { ABOUT_STORY_STOPS, sampleAboutStory } from './aboutStoryMotion'
import { JOURNEY_STOPS, JOURNEY_VORTEX_END, sampleJourney } from './journeyMotion'
import { createJourneyCarousel, advanceJourneyCarousel, inputJourneyCarousel, inputJourneyCarouselAscent, rewindJourneyCarouselEnding, resetJourneyCarousel, sampleJourneyCarousel, seekJourneyCarousel, clearJourneyCarouselCharge } from './journeyCarouselMotion'
import { constrainJourneyScroll, journeyAscentAt } from './journeyScrollBoundary'
import { NAV_EVENT } from './navigationState'
import { normalizeJourneyWheel } from './journeyScrollInput'
import { JOURNEY_INTRO, JOURNEY_MEMORIES } from './journeyMemories'
import styles from './AboutStory.module.css'

const BIOGRAPHY = [
  "I'm Karl Lopez, a full-stack developer who enjoys bringing ideas to life through the web. What started as a college subject in my third year became something I genuinely loved, and my internship as a Full Stack Web Developer Intern at PRAXXYS Solutions Inc. made that interest grow even further. Working on real projects showed me how much I enjoy the process of turning ideas into functional products, solving problems, and seeing what I build take shape.",
  "I'm particularly interested in AI-assisted development, or what many call vibe coding, using AI tools to explore ideas, speed up development, and build things I might not have attempted otherwise. I'm also drawn to interactive 3D and immersive web experiences that make websites feel less like static pages and more like something you can explore.",
  'A BSIT graduate from Bulacan State University – Bustos Campus. Resourceful by nature, curious by default, and always learning and building toward becoming the kind of developer who can bring an idea to life.'
]

const POSES = [
  { src: '/Me1.png', width: 941, height: 1672 },
  { src: '/Me2.png', width: 941, height: 1672 },
  { src: '/Me3.png', width: 1087, height: 1447 },
  { src: '/Me4.png', width: 1087, height: 1447 }
]
const STAGE_NAMES = ['Opening', 'Background', 'A little about me', 'Introduction', 'My experience', 'Looking forward']
const JOURNEY_NAMES = ['My Journey', ...JOURNEY_MEMORIES.map(memory => `${memory.year}: ${memory.title}`)]
// Give the biography and cinematic Journey opening room to settle.
// The carousel then occupies the final pinned viewport until it is complete.
const ABOUT_CHAPTER_END = 1120 / 1760
const JourneyScene = dynamic(() => import('./JourneyScene'), { ssr: false })
const AboutVortex = dynamic(() => import('./AboutVortex'), { ssr: false })
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const railPosition = (progress, stops) => {
  for (let index = 1; index < stops.length; index++) {
    if (progress <= stops[index]) return (index - 1 + clamp((progress - stops[index - 1]) / (stops[index] - stops[index - 1]))) / (stops.length - 1)
  }
  return 1
}

export default function AboutStory({ enabled = false }) {
  const runwayRef = useRef(null)
  const sceneRef = useRef(null)
  const railRef = useRef(null)
  const countRef = useRef(null)
  const motionBlurRef = useRef(null)
  const worldRef = useRef(null)
  const seekWakeRef = useRef(null)
  const motionRef = useRef({ velocity: 0, progress: 0, active: false })
  const carouselRef = useRef(null)
  if (!carouselRef.current) carouselRef.current = createJourneyCarousel(
    JOURNEY_MEMORIES.map(memory => memory.description.length),
    JOURNEY_MEMORIES.map(memory => `${memory.title.toUpperCase()} | ${memory.year}`.length),
  )
  motionRef.current.carouselState = carouselRef.current
  const [reducedMotion, setReducedMotion] = useState(false)
  const [journeyMounted, setJourneyMounted] = useState(false)
  const [chapter, setChapter] = useState(0)

  useEffect(() => {
    const runway = runwayRef.current
    const scene = sceneRef.current
    const hero = document.getElementById('home')
    if (!runway || !scene) return
    const desktop = window.matchMedia('(min-width: 1101px)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sample = {}
    const journey = {}
    const carousel = {}
    const initialHeroInert = hero?.inert || false
    let frame = 0
    let lastTime = 0
    let lastScroll = window.scrollY
    let lastScrollTime = performance.now()
    let lastInput = -2000
    let current = 0
    let target = 0
    let previousPortraitX = 0
    let previousPortraitY = 0
    let blurX = 0
    let blurY = 0
    let firstFrame = true
    let visible = false
    let disposed = false
    let idleTimer = 0
    let journeyRequested = false
    let lastChapter = 0
    let carouselTime = 0
    let lastCarouselTime = 0
    let wasCarouselGate = false
    let touchStart = null
    let engaged = false
    const laterSections = ['projects', 'skills', 'services', 'contact']
    let navigationBypass = laterSections.includes(window.location.hash.slice(1))
    const motion = motionRef.current
    motion.carouselClock = 0

    const ascentDistance = () => window.innerHeight
    const storyDistance = () => Math.max(1, runway.offsetHeight-window.innerHeight-ascentDistance())
    const gatePosition = () => window.scrollY + runway.getBoundingClientRect().top + storyDistance()
    const descentPosition = () => gatePosition()-storyDistance()*(1-ABOUT_CHAPTER_END)*(1-.26/.30)
    const constrainScroll = () => {
      if (!desktop.matches || reduced.matches) return window.scrollY
      const requested = window.scrollY
      const state = carouselRef.current
      const next = constrainJourneyScroll({ previous: lastScroll, next: requested,
        start: descentPosition(), gate: gatePosition(), ascentDistance: ascentDistance(),
        phase: state.phase, bypass: navigationBypass, engaged, exitRequested: state.exitRequested })
      if (!navigationBypass && next > requested+.5 && requested < gatePosition()) {
        if (state.phase === 'ascending' || state.phase === 'done') {
          inputJourneyCarouselAscent(state,-(state.ascentProgress||0),carouselTime)
          rewindJourneyCarouselEnding(state,carouselTime)
        } else inputJourneyCarousel(state,Math.max(-100,lastScroll > requested ? requested-lastScroll : -100),carouselTime)
      }
      if (Math.abs(next-window.scrollY)>.5) window.scrollTo({top:next,behavior:'instant'})
      if (!navigationBypass && Math.abs(next-gatePosition())<4) engaged = true
      return next
    }
    const gateInView = () => desktop.matches && !reduced.matches && !document.hidden && Math.abs(window.scrollY - gatePosition()) < 5
    const applyScroll = delta => {
      const now = performance.now()
      inputJourneyCarousel(carouselRef.current, delta, carouselTime)
      lastInput = now
      if (carouselRef.current.exitRequested) {
        // Upward scrolling can always return to the preceding title/biography.
        window.scrollBy({ top: -Math.max(110, window.innerHeight * .18), behavior: 'instant' })
      }
      wake()
    }

    const setHeroCovered = covered => {
      if (!hero || (hero.dataset.aboutCovered === 'true') === covered) return
      if (covered) hero.dataset.aboutCovered = 'true'
      else delete hero.dataset.aboutCovered
      hero.inert = covered || initialHeroInert
      hero.dispatchEvent(new Event('hero:scene-visibility'))
    }
    const resetHero = () => {
      hero?.style.removeProperty('--about-handoff')
      hero?.style.removeProperty('--about-cover')
      setHeroCovered(false)
      if (hero) hero.inert = initialHeroInert
    }
    const wake = () => {
      if (!disposed && !frame && desktop.matches && !document.hidden) frame = requestAnimationFrame(draw)
    }
    const wakeSeek = () => { navigationBypass=false; engaged=true; wake() }
    seekWakeRef.current = wakeSeek
    const draw = now => {
      frame = 0
      if (disposed || !desktop.matches || document.hidden) return
      constrainScroll()
      const rect = runway.getBoundingClientRect()
      const height = window.innerHeight
      const distance = storyDistance()
      target = clamp(-rect.top / distance)
      // Browser scroll positions round to device pixels. The final story frame
      // must still reach the final chapter when offsets round down slightly.
      if (-rect.top >= distance - 3) target = 1
      visible = rect.top < height && rect.bottom > 0
      const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 1 / 60
      lastTime = now
      const blend = 1 - Math.exp(-19 * dt)
      if (firstFrame || reduced.matches || !visible) current = target
      else current += (target - current) * blend
      if (Math.abs(target - current) < .000015) current = target
      const biographyProgress = clamp(current / ABOUT_CHAPTER_END)
      const journeyProgress = clamp((current - ABOUT_CHAPTER_END) / (1 - ABOUT_CHAPTER_END))
      sampleAboutStory(biographyProgress, sample)
      sampleJourney(journeyProgress, journey)
      const activeChapter = current >= ABOUT_CHAPTER_END ? 1 : 0
      if (lastChapter !== activeChapter) {
        lastChapter = activeChapter
        setChapter(activeChapter)
      }
      if (!journeyRequested && current >= .21 && !reduced.matches) {
        journeyRequested = true
        setJourneyMounted(true)
      }
      const approach = clamp((height - rect.top) / height)
      motion.progress = current
      motion.active = visible && !reduced.matches
      motion.journeyProgress = journeyProgress
      motion.journeyActive = motion.active && activeChapter === 1
      motion.journey = journey
      const inAscent = window.scrollY >= gatePosition()-3 && window.scrollY <= gatePosition()+ascentDistance()+3
      const carouselGate = target >= .99999 && journeyProgress >= .9995 && inAscent
      if (wasCarouselGate && !carouselGate) {
        clearJourneyCarouselCharge(carouselRef.current, carouselTime)
      }
      wasCarouselGate = carouselGate
      motion.carouselGate = carouselGate
      const clockActive = motion.journeyActive && carouselGate
      if (clockActive && lastCarouselTime) carouselTime += Math.min(80, Math.max(0, now - lastCarouselTime))
      lastCarouselTime = clockActive ? now : 0
      if (clockActive) advanceJourneyCarousel(carouselRef.current, carouselTime)
      const state = carouselRef.current
      if ((state.phase === 'ascending' || state.phase === 'done') && inAscent) {
        inputJourneyCarouselAscent(state, journeyAscentAt(window.scrollY,gatePosition(),ascentDistance())-(state.ascentProgress||0),carouselTime)
      }
      sampleJourneyCarousel(carouselRef.current, carouselTime, carousel)
      motion.carousel = carousel
      motion.carouselClock = carouselTime
      if (now - lastScrollTime > 95) motion.velocity *= Math.exp(-7 * dt)
      if (Math.abs(motion.velocity) < .2) motion.velocity = 0

      const set = (name, value) => scene.style.setProperty(name, Number(value).toFixed(5))
      set('--intro-opacity', biographyProgress <= .035 ? Math.max(sample.introOpacity, approach) : sample.introOpacity)
      set('--title-opacity', sample.titleOpacity)
      set('--title-blur', sample.titleBlur)
      set('--title-dock', sample.titleDock)
      set('--portrait-reveal', sample.portraitReveal)
      set('--portrait-rise', sample.portraitRise)
      set('--portrait-brightness', sample.portraitBrightness)
      set('--portrait-blur', sample.portraitBlur)
      set('--portrait-dock', sample.portraitDock)
      set('--first-line', sample.firstLine)
      set('--second-line', sample.secondLine)
      set('--line-progress', sample.lineProgress)
      set('--label-cyan', sample.labelCyan)
      set('--scene-black', sample.heroDim)
      set('--vortex', Math.min(1, journeyProgress / JOURNEY_VORTEX_END))
      set('--vortex-light', journey.vortexLight)
      set('--biography-visible', 1 - Math.min(1, journeyProgress / JOURNEY_VORTEX_END))
      for (let index = 0; index < 4; index++) set(`--pose-${index}`, sample[`pose${index}Opacity`])
      for (let index = 0; index < 3; index++) {
        set(`--bio-${index}`, sample[`bio${index}Opacity`])
        set(`--bio-y-${index}`, sample[`bio${index}Y`])
      }

      // Directional blur is derived from portrait travel, so text and a settled
      // portrait stay crisp, including when the user reverses the timeline.
      const portraitX = sample.portraitDock * window.innerWidth * .22
      const portraitY = sample.portraitRise * height * .24
      const moving = Math.abs(current - target) > .00003 || now - lastInput < 120
      const desiredBlurX = !firstFrame && moving ? Math.min(5, Math.abs(portraitX - previousPortraitX) * .32) : 0
      const desiredBlurY = !firstFrame && moving ? Math.min(6, Math.abs(portraitY - previousPortraitY) * .32) : 0
      blurX += (desiredBlurX - blurX) * (1 - Math.exp(-14 * dt))
      blurY += (desiredBlurY - blurY) * (1 - Math.exp(-14 * dt))
      previousPortraitX = portraitX
      previousPortraitY = portraitY
      motionBlurRef.current?.setAttribute('stdDeviation', `${blurX.toFixed(2)} ${blurY.toFixed(2)}`)
      scene.dataset.motionBlur = blurX + blurY > .08 ? 'true' : 'false'
      scene.dataset.storyProgress = current.toFixed(4)
      scene.dataset.biographyProgress = biographyProgress.toFixed(4)
      scene.dataset.journeyProgress = journeyProgress.toFixed(4)
      worldRef.current?.setAttribute('aria-hidden', journeyProgress > 0 ? 'true' : 'false')
      const journeyStage = carouselGate && carousel.phase !== 'gate' && carousel.phase !== 'charging' ? carousel.memoryIndex + 1 : 0
      scene.dataset.storyStage = activeChapter ? `journey-${journeyStage}` : String(sample.stage)
      scene.dataset.scrollDirection = motion.velocity > 1 ? 'right' : motion.velocity < -1 ? 'left' : 'idle'
      railRef.current?.style.setProperty('--rail-progress', (activeChapter ? journeyStage / 5 : railPosition(biographyProgress, ABOUT_STORY_STOPS)).toFixed(5))
      if (railRef.current) railRef.current.dataset.active = now - lastInput < 1050 ? 'true' : 'false'
      const activeStage = activeChapter ? journeyStage : sample.stage
      if (countRef.current) countRef.current.textContent = String(activeStage).padStart(2, '0')
      railRef.current?.querySelectorAll('button').forEach((button, index) => {
        if (activeStage === index) button.setAttribute('aria-current', 'step')
        else button.removeAttribute('aria-current')
      })
      motion.onJourneyUpdate?.()
      window.dispatchEvent(new Event('about:journey-update'))

      // The actual Hero stays behind this transparent opening, then sleeps once
      // the black About scene covers it. No duplicated Hero/WebGL scene is used.
      if (reduced.matches) resetHero()
      else {
        hero?.style.setProperty('--about-handoff', String(clamp(approach * .4 + sample.heroDim * .6)))
        hero?.style.setProperty('--about-cover', String(sample.heroDim))
        setHeroCovered(rect.top <= 0 && sample.heroDim >= .999)
      }
      firstFrame = false
      if (visible && (clockActive || Math.abs(target - current) > .000015 || blurX + blurY > .02 || Math.abs(motion.velocity) > .2)) wake()
    }

    const onWheel = event => {
      if (!desktop.matches || reduced.matches || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return
      const position = gatePosition()
      const distance = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
      const atGate = gateInView()
      const state = carouselRef.current
      // Native scroll drives the final ascent and the receiving Projects zoom.
      // Re-entering Journey from an explicit navigation re-arms its boundary.
      navigationBypass = false
      if ((state.phase === 'ascending' || state.phase === 'done') && window.scrollY >= position-3) {
        if (distance < 0 && window.scrollY+distance <= position+3) {
          event.preventDefault()
          window.scrollTo({top:position,behavior:'instant'})
          inputJourneyCarouselAscent(state,-(state.ascentProgress||0),carouselTime)
          rewindJourneyCarouselEnding(state,carouselTime)
          engaged=true
          wake()
        }
        return
      }
      if (!atGate) {
        if (distance > 0 && state.phase !== 'done' && window.scrollY < position && window.scrollY + distance >= position) {
          event.preventDefault()
          window.scrollTo({ top: position, behavior: 'instant' })
          wake()
        } else if (distance < 0 && window.scrollY > position && window.scrollY + distance <= position) {
          // Re-enter the pinned ending from Projects before rewinding its
          // ascent. A native wheel step must not skip over the gate entirely.
          event.preventDefault()
          window.scrollTo({ top: position, behavior: 'instant' })
          if ((motion.journeyProgress || 0) >= .999) applyScroll(normalizeJourneyWheel(event.deltaY, event.deltaMode, window.innerHeight))
          wake()
        }
        return
      }
      if (state.phase === 'done' && distance > 0) return
      event.preventDefault()
      // Let the descent settle before scroll energy can enter the core.
      if ((motion.journeyProgress || 0) < .999) return
      applyScroll(normalizeJourneyWheel(event.deltaY, event.deltaMode, window.innerHeight))
    }
    const onKey = event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input, textarea, select, button, a, [contenteditable="true"]')) return
      if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) navigationBypass=false
      if (carouselRef.current.phase === 'ascending' || carouselRef.current.phase === 'done') return
      if (!gateInView()) return
      const direction = ['ArrowDown', 'PageDown', 'End', ' '].includes(event.key) ? (event.shiftKey ? -1 : 1) : ['ArrowUp', 'PageUp', 'Home'].includes(event.key) ? -1 : 0
      if (!direction || (carouselRef.current.phase === 'done' && direction > 0)) return
      event.preventDefault()
      if ((motion.journeyProgress || 0) >= .999) {
        // A deliberate PageUp/Home steps back once, even without key repeat.
        // Wheel input still uses its separate bounded gesture accumulation.
        if (direction < 0 && ['PageUp','Home'].includes(event.key)) {
          applyScroll(-90)
          applyScroll(-90)
        } else applyScroll(direction * (event.key.startsWith('Page') ? 160 : 90))
      }
    }
    const onTouchStart = event => {
      if (event.target.closest?.('[data-journey-interaction]')) { touchStart=null; return }
      navigationBypass=false
      if (event.touches.length === 1) touchStart = { y: event.touches[0].clientY, x: event.touches[0].clientX, lastY: event.touches[0].clientY, atGate: gateInView() }
    }
    const onTouchMove = event => {
      if (!touchStart || !gateInView() || event.touches.length !== 1) return
      const point = event.touches[0]
      const dy = touchStart.lastY - point.clientY
      touchStart.lastY = point.clientY
      if (carouselRef.current.phase !== 'done' && carouselRef.current.phase !== 'ascending') {
        event.preventDefault()
        if (Math.abs(touchStart.x - point.clientX) < Math.abs(touchStart.y - point.clientY) && (motion.journeyProgress || 0) >= .999) applyScroll(dy * 2)
      }
    }
    const onTouchEnd = event => {
      if (!touchStart) return
      touchStart = null
    }
    const onScroll = () => {
      const now = performance.now()
      const y = constrainScroll()
      const delta = y - lastScroll
      if (delta) {
        motion.velocity = clamp(delta / Math.max(.016, (now - lastScrollTime) / 1000), -2800, 2800)
        lastInput = now
        lastScrollTime = now
        lastScroll = y
        clearTimeout(idleTimer)
        idleTimer = window.setTimeout(wake, 1100)
      }
      wake()
    }
    const onNavigation = event => {
      navigationBypass = true
      engaged=false
    }
    const onPointerDown = event => {
      if (event.clientX >= document.documentElement.clientWidth) navigationBypass=false
    }
    const configure = () => {
      lastCarouselTime = 0
      setReducedMotion(reduced.matches)
      runway.dataset.reducedMotion = String(reduced.matches)
      firstFrame = true
      lastTime = 0
      if (!desktop.matches) {
        cancelAnimationFrame(frame)
        frame = 0
        motion.active = false
        motion.journeyActive = false
        motion.velocity = 0
        resetHero()
      } else wake()
    }
    const visibility = () => {
      lastCarouselTime = 0
      if (document.hidden) {
        clearJourneyCarouselCharge(carouselRef.current, carouselTime)
        cancelAnimationFrame(frame)
        frame = 0
        lastTime = 0
        motion.active = false
        motion.journeyActive = false
      } else wake()
    }
    const observer = new IntersectionObserver(() => wake(), { rootMargin: '100% 0px', threshold: 0 })
    observer.observe(runway)
    const resize = new ResizeObserver(() => { firstFrame = true; wake() })
    resize.observe(runway)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener(NAV_EVENT, onNavigation)
    window.addEventListener('pointerdown', onPointerDown, { passive:true })
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('resize', configure, { passive: true })
    window.addEventListener('pageshow', configure)
    desktop.addEventListener('change', configure)
    reduced.addEventListener('change', configure)
    document.addEventListener('visibilitychange', visibility)
    document.fonts?.ready.then(() => { if (!disposed) wake() })
    configure()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      clearTimeout(idleTimer)
      observer.disconnect()
      resize.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener(NAV_EVENT, onNavigation)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', configure)
      window.removeEventListener('pageshow', configure)
      desktop.removeEventListener('change', configure)
      reduced.removeEventListener('change', configure)
      document.removeEventListener('visibilitychange', visibility)
      motion.active = false
      motion.journeyActive = false
      if (seekWakeRef.current === wakeSeek) seekWakeRef.current=null
      resetHero()
    }
  }, [])

  const seek = index => {
    const runway = runwayRef.current
    if (!runway) return
    const distance = Math.max(1, runway.offsetHeight - window.innerHeight*2)
    const top = window.scrollY + runway.getBoundingClientRect().top
    if (chapter && index > 0) seekJourneyCarousel(carouselRef.current, index - 1, motionRef.current.carouselClock || 0)
    else if (chapter) resetJourneyCarousel(carouselRef.current,motionRef.current.carouselClock||0)
    const stop = chapter ? ABOUT_CHAPTER_END + JOURNEY_STOPS[index] * (1 - ABOUT_CHAPTER_END) : ABOUT_STORY_STOPS[index] * ABOUT_CHAPTER_END
    const position = chapter && index > 0 ? distance : Math.min(distance, stop * distance + (index > 0 ? 1 : 0))
    window.scrollTo({ top: top + position, behavior: chapter || reducedMotion ? 'instant' : 'smooth' })
    seekWakeRef.current?.()
  }

  return (
    <div ref={runwayRef} className={styles.runway} data-about-story="true" data-nav-progress={ABOUT_CHAPTER_END*.2}>
      <div ref={sceneRef} className={styles.scene}>
        <div className={styles.backdrop} aria-hidden="true" />
        {enabled && <AboutStarDust sceneRef={sceneRef} motionRef={motionRef} reducedMotion={reducedMotion} />}
        <div className={styles.animatedScene} aria-hidden={reducedMotion || undefined}>
          <div className={styles.intro} aria-hidden="true">
            <p><i />Beyond the code</p>
            <div>Here’s how<br />I got here.</div>
          </div>
          <svg width="0" height="0" className={styles.filterDefinitions} aria-hidden="true" focusable="false">
            <defs>
              <filter id="about-portrait-motion" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
                <feGaussianBlur ref={motionBlurRef} stdDeviation="0 0" />
              </filter>
            </defs>
          </svg>
          <div ref={worldRef} className={styles.biographyWorld}>
          <p className={styles.backgroundTitle} data-vortex-title>BACKGROUND</p>
          <div className={styles.portraits} aria-hidden="true">
            {enabled && POSES.map((pose, index) => (
              <div className={`${styles.pose} ${styles[`pose${index}`]}`} key={pose.src} data-vortex-portrait={index === 3 ? 'true' : undefined}>
                <Image {...pose} alt="" sizes="(min-width: 1101px) 60vw, 1px" className={styles.portraitImage} loading="eager" />
              </div>
            ))}
          </div>
          <div className={styles.copy}>
            <h2 className={styles.heading}><span data-vortex-copy>A little</span><span data-vortex-copy>about me.</span></h2>
            <div className={styles.growingLine} aria-hidden="true"><i data-vortex-line /></div>
            <div className={styles.biography}>
              {BIOGRAPHY.map((text, index) => <p key={index} className={styles[`bio${index}`]} data-vortex-copy>{text}</p>)}
            </div>
          </div>
          </div>
          {enabled && !reducedMotion && journeyMounted && <>
            <AboutVortex worldRef={worldRef} motionRef={motionRef} enabled />
            <JourneyScene sceneRef={sceneRef} motionRef={motionRef} enabled />
          </>}
          <div className={styles.vortexHalo} aria-hidden="true" />
          <nav ref={railRef} className={styles.progressRail} aria-label="About story progress">
            <span className={styles.railChapter}>{chapter ? 'Journey' : 'Background'}</span>
            <p aria-hidden="true"><span ref={countRef}>00</span><i>/</i>05</p>
            <div className={styles.railTrack}>
              <span className={styles.railFill} aria-hidden="true" />
              {(chapter ? JOURNEY_STOPS : ABOUT_STORY_STOPS).map((stop, index, stops) => (
                <button key={`${chapter}-${index}`} type="button" onClick={() => seek(index)} aria-label={`${chapter ? 'My Journey' : 'About story'} ${index} of ${stops.length - 1}: ${(chapter ? JOURNEY_NAMES : STAGE_NAMES)[index]}`} aria-current={index === 0 ? 'step' : undefined} style={{ top: `${index / (stops.length - 1) * 100}%` }}><i /></button>
              ))}
            </div>
            <span className={styles.railHint}>Scroll to discover</span>
          </nav>
        </div>
        {enabled && reducedMotion && <div className={styles.staticContent}>
          <div>
            <p className={styles.staticLabel}>BACKGROUND</p>
            <h2>A little<br />about me.</h2>
            <div className={styles.staticLine} />
            {BIOGRAPHY.map((text, index) => <p key={index}>{text}</p>)}
          </div>
          <Image src="/Me4.png" width={1087} height={1447} alt="Karl Lopez, smiling and waving" sizes="50vw" />
        </div>}
        {enabled && reducedMotion && <section className={styles.staticJourney} aria-label="My Journey">
          <h2>MY JOURNEY</h2>
          <p>{JOURNEY_INTRO}</p>
          {JOURNEY_MEMORIES.map(memory => <article key={memory.year}>
            <div><p>{memory.year}</p><h3>{memory.title}</h3><p>{memory.description}</p></div>
            <div className={styles.staticMemories}>{memory.images.map((src, index) => <Image key={src} src={src} width={700} height={500} alt={`${memory.year} memory photograph ${index + 1}`} sizes="35vw" />)}</div>
          </article>)}
        </section>}
      </div>
    </div>
  )
}
