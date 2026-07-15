import dynamic from 'next/dynamic'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUp, ArrowUpRight, Clock3, Mail, MapPin, Minus, Phone, Plus } from 'lucide-react'
import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useActiveNavSection } from '../navigationState'
import { CONTACT_COPY, CONTACT_PROFILE } from './contactData'
import styles from './ContactSection.module.css'

const ContactCanvas = dynamic(() => import('./ContactScene'), {ssr: false})

const ICONS = {
  email: Mail,
  phone: Phone,
  location: MapPin,
  availability: Clock3
}

const SCENE_PHASE = Object.freeze({
  DORMANT: 'DORMANT',
  INITIALIZING: 'INITIALIZING',
  RUNNING: 'RUNNING',
  PAUSED_OFFSCREEN: 'PAUSED_OFFSCREEN',
  CONTEXT_LOST: 'CONTEXT_LOST',
  RESTORING: 'RESTORING',
  FAILED: 'FAILED'
})

const isReadyPhase = (phase) => (
  phase === SCENE_PHASE.RUNNING || phase === SCENE_PHASE.PAUSED_OFFSCREEN
)

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {failed: false}
  }

  static getDerivedStateFromError() {
    return {failed: true}
  }

  componentDidCatch(error) {
    this.props.onError?.(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function ContactRow({ item, index, visible, reducedMotion }) {
  const Icon = ICONS[item.id]
  const rowContent = (
    <>
      <span className={styles.rowIcon} aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span>
      <span className={styles.rowLabel}>{item.label}</span>
      <span className={`${styles.rowValue} ${item.placeholder ? styles.placeholderValue : ''}`}>
        {item.status && <span className={styles.statusDot} aria-hidden="true" />}
        {item.value}
      </span>
      <span className={styles.rowAction} aria-hidden="true">
        {item.href ? <ArrowUpRight size={18} strokeWidth={1.7} /> : <Minus size={16} strokeWidth={1.4} />}
      </span>
    </>
  )

  return (
    <motion.div
      className={styles.rowMotion}
      initial={false}
      animate={visible ? {opacity: 1, y: 0} : {opacity: 0, y: 18}}
      transition={reducedMotion ? {duration: 0} : {delay: 0.38 + index * 0.075, duration: 0.58, ease: [0.22, 1, 0.36, 1]}}
    >
      {item.href ? (
        <a className={styles.contactRow} href={item.href} aria-label={`${item.label}: ${item.value}`}>
          {rowContent}
        </a>
      ) : (
        <div className={styles.contactRow} role={item.status ? 'status' : undefined} aria-label={`${item.label}: ${item.value}`}>
          {rowContent}
        </div>
      )}
    </motion.div>
  )
}

function StaticBlackHole({hidden = false}) {
  return (
    <div className={`${styles.sceneFallback} ${hidden ? styles.sceneFallbackHidden : ''}`} aria-hidden="true">
      <span className={styles.fallbackHaze} />
      <span className={styles.fallbackDiskOuter} />
      <span className={styles.fallbackRearArc} />
      <span className={styles.fallbackHorizon} />
      <span className={styles.fallbackFrontFlow} />
      <span className={styles.fallbackStarOne} />
      <span className={styles.fallbackStarTwo} />
      <span className={styles.fallbackStarThree} />
    </div>
  )
}

function getQualityTier() {
  if (window.innerWidth < 700) return 'mobile'
  if (window.innerWidth < 1100) return 'tablet'
  return 'desktop'
}

export default function ContactSection() {
  const {activeSection} = useActiveNavSection()
  const sectionRef = useRef(null)
  const interfaceRef = useRef(null)
  const pointerRef = useRef({x: 0, y: 0})
  const interactionRef = useRef({dragging: false, releaseDrag: null, blockSurgeUntil: 0, cursorOwner: null})
  const frameRequestRef = useRef(null)
  const contextRecoveryTimerRef = useRef(null)
  const finePointerRef = useRef(false)
  const reducedMotion = Boolean(useReducedMotion())
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const [hasEntered, setHasEntered] = useState(false)
  const [hasMountedScene, setHasMountedScene] = useState(false)
  const [scenePhase, setScenePhase] = useState(SCENE_PHASE.DORMANT)
  const [sceneGeneration, setSceneGeneration] = useState(0)
  const [sceneRetryCount, setSceneRetryCount] = useState(0)
  const [forceReveal, setForceReveal] = useState(false)
  const [quality, setQuality] = useState(null)

  const contactItems = useMemo(() => [
    {
      id: 'email',
      label: 'Email',
      value: CONTACT_PROFILE.email || 'To be confirmed',
      href: CONTACT_PROFILE.email ? `mailto:${CONTACT_PROFILE.email}` : null,
      placeholder: !CONTACT_PROFILE.email
    },
    {
      id: 'phone',
      label: 'Phone',
      value: CONTACT_PROFILE.phone || 'To be confirmed',
      href: CONTACT_PROFILE.phone ? `tel:${CONTACT_PROFILE.phone.replace(/\s/g, '')}` : null,
      placeholder: !CONTACT_PROFILE.phone
    },
    {id: 'location', label: 'Location', value: CONTACT_PROFILE.location, href: null},
    {id: 'availability', label: 'Availability', value: CONTACT_PROFILE.availability, href: null, status: true}
  ], [])

  useEffect(() => {
    setQuality(getQualityTier())
    finePointerRef.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches

    let resizeFrame = null
    const handleResize = () => {
      if (resizeFrame) return
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null
        setQuality(getQualityTier())
        finePointerRef.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches
      })
    }

    window.addEventListener('resize', handleResize)
    return () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined

    const nearObserver = new IntersectionObserver(([entry]) => {
      setIsNearViewport(entry.isIntersecting)
    }, {rootMargin: '80% 0px', threshold: 0.01})
    const visibleObserver = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
      if (entry.isIntersecting) setHasEntered(true)
    }, {rootMargin: '0px', threshold: 0.01})

    nearObserver.observe(section)
    visibleObserver.observe(section)
    return () => {
      nearObserver.disconnect()
      visibleObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const handleVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    if (!quality || hasMountedScene || (!isNearViewport && activeSection !== 'contact')) return
    setHasMountedScene(true)
    setHasEntered(true)
    setScenePhase(SCENE_PHASE.INITIALIZING)
  }, [activeSection, hasMountedScene, isNearViewport, quality])

  const shouldRunScene = Boolean(
    hasMountedScene &&
    quality &&
    pageVisible &&
    (isVisible || activeSection === 'contact')
  )
  const sceneReady = isReadyPhase(scenePhase)
  const sceneFailed = scenePhase === SCENE_PHASE.FAILED

  useEffect(() => {
    if (!hasMountedScene) return
    setScenePhase((currentPhase) => {
      if (!isReadyPhase(currentPhase)) return currentPhase
      return shouldRunScene ? SCENE_PHASE.RUNNING : SCENE_PHASE.PAUSED_OFFSCREEN
    })
  }, [hasMountedScene, shouldRunScene])

  useEffect(() => {
    if (!hasEntered || sceneReady || reducedMotion) return undefined
    const timer = window.setTimeout(() => setForceReveal(true), 900)
    return () => window.clearTimeout(timer)
  }, [hasEntered, reducedMotion, sceneReady])

  useEffect(() => {
    if (
      scenePhase !== SCENE_PHASE.FAILED ||
      !pageVisible ||
      (!isVisible && activeSection !== 'contact') ||
      sceneRetryCount >= 2
    ) return undefined

    const timer = window.setTimeout(() => {
      setSceneRetryCount((count) => count + 1)
      setSceneGeneration((generation) => generation + 1)
      setScenePhase(SCENE_PHASE.INITIALIZING)
    }, 900 * (sceneRetryCount + 1))
    return () => window.clearTimeout(timer)
  }, [activeSection, isVisible, pageVisible, scenePhase, sceneRetryCount])

  useEffect(() => () => {
    if (frameRequestRef.current) window.cancelAnimationFrame(frameRequestRef.current)
    if (contextRecoveryTimerRef.current) window.clearTimeout(contextRecoveryTimerRef.current)
  }, [])

  const handleSceneReady = useCallback(() => {
    if (contextRecoveryTimerRef.current) window.clearTimeout(contextRecoveryTimerRef.current)
    contextRecoveryTimerRef.current = null
    setScenePhase(shouldRunScene ? SCENE_PHASE.RUNNING : SCENE_PHASE.PAUSED_OFFSCREEN)
  }, [shouldRunScene])

  const handleSceneStable = useCallback(() => {
    setSceneRetryCount(0)
  }, [])

  const handleSceneError = useCallback(() => {
    interactionRef.current.releaseDrag?.({preserveVelocity: false})
    setScenePhase(SCENE_PHASE.FAILED)
  }, [])

  const handleContextLost = useCallback(() => {
    setScenePhase(SCENE_PHASE.CONTEXT_LOST)
    if (contextRecoveryTimerRef.current) window.clearTimeout(contextRecoveryTimerRef.current)
    contextRecoveryTimerRef.current = window.setTimeout(() => {
      setScenePhase(SCENE_PHASE.FAILED)
    }, 4000)
  }, [])

  const handleContextRestored = useCallback(() => {
    if (contextRecoveryTimerRef.current) window.clearTimeout(contextRecoveryTimerRef.current)
    contextRecoveryTimerRef.current = null
    setScenePhase(SCENE_PHASE.RESTORING)
  }, [])

  const resetPointer = () => {
    if (interactionRef.current.dragging) return
    pointerRef.current.x = 0
    pointerRef.current.y = 0

    if (frameRequestRef.current) window.cancelAnimationFrame(frameRequestRef.current)
    frameRequestRef.current = window.requestAnimationFrame(() => {
      interfaceRef.current?.style.setProperty('--contact-tilt-x', '0deg')
      interfaceRef.current?.style.setProperty('--contact-tilt-y', '0deg')
      interfaceRef.current?.style.setProperty('--contact-shift-x', '0px')
      interfaceRef.current?.style.setProperty('--contact-shift-y', '0px')
    })
  }

  const handlePointerMove = (event) => {
    if (interactionRef.current.dragging || reducedMotion || !finePointerRef.current || !isVisible) return
    const bounds = sectionRef.current?.getBoundingClientRect()
    if (!bounds) return

    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2))
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2))
    pointerRef.current.x = x
    pointerRef.current.y = -y

    if (frameRequestRef.current) window.cancelAnimationFrame(frameRequestRef.current)
    frameRequestRef.current = window.requestAnimationFrame(() => {
      interfaceRef.current?.style.setProperty('--contact-tilt-x', `${(-y * 1.25).toFixed(2)}deg`)
      interfaceRef.current?.style.setProperty('--contact-tilt-y', `${(x * 1.55).toFixed(2)}deg`)
      interfaceRef.current?.style.setProperty('--contact-shift-x', `${(x * 2.4).toFixed(2)}px`)
      interfaceRef.current?.style.setProperty('--contact-shift-y', `${(y * 1.8).toFixed(2)}px`)
    })
  }

  const returnToTop = () => {
    const home = document.getElementById('home')
    home?.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'start'})
    if (window.location.hash) window.history.pushState(null, '', window.location.pathname)
  }

  const revealContent = hasEntered && (sceneReady || forceReveal || sceneFailed || reducedMotion)
  const canvasActive = pageVisible && (
    scenePhase === SCENE_PHASE.INITIALIZING ||
    scenePhase === SCENE_PHASE.RESTORING ||
    (scenePhase === SCENE_PHASE.RUNNING && shouldRunScene)
  )

  return (
    <section
      ref={sectionRef}
      id="contact"
      className={styles.section}
      aria-labelledby="contact-heading"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-scene-phase={scenePhase}
      data-contact-quality={quality || 'measuring'}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <motion.div
        className={styles.frame}
        initial={false}
        animate={hasEntered ? {opacity: 1} : {opacity: 0.35}}
        transition={reducedMotion ? {duration: 0} : {duration: 0.72, ease: [0.22, 1, 0.36, 1]}}
      >
        <span className={styles.frameGlow} aria-hidden="true" />
        <span className={styles.frameCornerTop} aria-hidden="true" />
        <span className={styles.frameCornerBottom} aria-hidden="true" />

        <div className={styles.contentGrid}>
          <div className={styles.leadMotion}>
            <div ref={interfaceRef} className={styles.interfaceTilt}>
              <motion.div
                className={styles.eyebrow}
                initial={false}
                animate={revealContent ? {opacity: 1, y: 0} : {opacity: 0, y: 12}}
                transition={reducedMotion ? {duration: 0} : {delay: 0.08, duration: 0.52}}
              >
                <Plus size={16} strokeWidth={1.7} aria-hidden="true" />
                <span>{CONTACT_COPY.eyebrow}</span>
              </motion.div>

              <motion.h2
                id="contact-heading"
                className={styles.heading}
                initial={false}
                animate={revealContent ? {opacity: 1, y: 0} : {opacity: 0, y: 24}}
                transition={reducedMotion ? {duration: 0} : {delay: 0.14, duration: 0.72, ease: [0.22, 1, 0.36, 1]}}
              >
                <span>{CONTACT_COPY.heading[0]}</span>
                <span>{CONTACT_COPY.heading[1]}</span>
                <span className={styles.headingAccent}>{CONTACT_COPY.heading[2]}</span>
              </motion.h2>

              <motion.p
                className={styles.description}
                initial={false}
                animate={revealContent ? {opacity: 1, y: 0} : {opacity: 0, y: 16}}
                transition={reducedMotion ? {duration: 0} : {delay: 0.26, duration: 0.62}}
              >
                {CONTACT_COPY.description}
              </motion.p>
            </div>
          </div>

          <div className={styles.sceneWrap} aria-hidden="true">
            <StaticBlackHole hidden={sceneReady && !sceneFailed} />
            {hasMountedScene && quality && !sceneFailed && (
              <SceneErrorBoundary key={sceneGeneration} onError={handleSceneError}>
                <div className={`${styles.sceneCanvas} ${sceneReady ? styles.sceneCanvasReady : ''}`}>
                  <ContactCanvas
                    active={canvasActive}
                    reducedMotion={reducedMotion}
                    pointerRef={pointerRef}
                    interactionRef={interactionRef}
                    quality={quality}
                    phase={scenePhase}
                    onReady={handleSceneReady}
                    onStable={handleSceneStable}
                    onError={handleSceneError}
                    onContextLost={handleContextLost}
                    onContextRestored={handleContextRestored}
                  />
                </div>
              </SceneErrorBoundary>
            )}
          </div>

          <div className={styles.contactList} aria-label="Contact details">
            {contactItems.map((item, index) => (
              <ContactRow
                key={item.id}
                item={item}
                index={index}
                visible={revealContent}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>

          <footer className={styles.footer}>
            <motion.div
              className={styles.footerDivider}
              initial={false}
              animate={revealContent ? {scaleX: 1, opacity: 1} : {scaleX: 0, opacity: 0}}
              transition={reducedMotion ? {duration: 0} : {delay: 0.66, duration: 0.85, ease: [0.22, 1, 0.36, 1]}}
              aria-hidden="true"
            />

            <motion.div
              className={styles.footerMeta}
              initial={false}
              animate={revealContent ? {opacity: 1, y: 0} : {opacity: 0, y: 10}}
              transition={reducedMotion ? {duration: 0} : {delay: 0.82, duration: 0.58}}
            >
              <p>&copy; {new Date().getFullYear()} {CONTACT_PROFILE.name}. All rights reserved.</p>
              <button type="button" className={styles.topControl} onClick={returnToTop} aria-label="Return to top">
                <ArrowUp size={18} strokeWidth={1.8} />
              </button>
              <p className={styles.closing}>{CONTACT_COPY.closing}<span aria-hidden="true" /></p>
            </motion.div>
          </footer>
        </div>
      </motion.div>
    </section>
  )
}
