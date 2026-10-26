import dynamic from 'next/dynamic'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUp, Clock3, Mail, MapPin, Phone } from 'lucide-react'
import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useActiveNavSection } from '../navigationState'
import { CONTACT_COPY, CONTACT_PROFILE } from './contactData'
import useContactEntrance from './useContactEntrance'
import {sampleContactEntrance,contactEntryVisible} from './contactEntranceMotion'
import styles from './ContactSection.module.css'
import {getFooterBlackHoleValues,subscribeFooterBlackHolePreset} from './footerBlackHolePreset'

const ContactCanvas = dynamic(() => import('./UnifiedBlackHoleScene'), {ssr: false})
const Asteroids=dynamic(()=>import('../HeroAsteroids'),{ssr:false})

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

function GlitchLine({text,accent=false}){
  return <span className={`${styles.glitchLine} ${accent?styles.headingAccent:''}`}>
    <span>{text}</span><span className={styles.glitchGhost} aria-hidden="true">{text}</span>
    <span className={styles.glitchGhostAlt} aria-hidden="true">{text}</span>
  </span>
}

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
      <span className={styles.anchor} aria-hidden="true" />
      <span className={styles.rowIcon} aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span>
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>{item.label}</span>
        <span className={`${styles.rowValue} ${item.placeholder ? styles.placeholderValue : ''}`}>
          {item.value}
          {item.status && <span className={styles.statusDot} aria-hidden="true" />}
        </span>
        <span className={styles.rowGhost} aria-hidden="true">{item.value}</span>
      </span>
    </>
  )

  return (
    <div
      className={styles.rowMotion}
      style={{'--glitch-delay':`${.2+index*.075}s`}}
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
    </div>
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
  const frameRef=useRef(null)
  const pointerRef = useRef({x: 0, y: 0})
  const journeyRef = useRef({progress: 0,entrance:sampleContactEntrance(0,false)})
  const contextRecoveryTimerRef = useRef(null)
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
  const [asteroidValues,setAsteroidValues]=useState(getFooterBlackHoleValues)
  const [blastCooling,setBlastCooling]=useState(false)
  const blastAt=useRef(-Infinity),blastTimer=useRef(0)
  useEffect(()=>{
    const update=()=>setAsteroidValues(getFooterBlackHoleValues())
    update();const unsubscribe=subscribeFooterBlackHolePreset(update)
    return()=>{unsubscribe();clearTimeout(blastTimer.current)}
  },[])
  const blast=()=>{
    const now=performance.now()
    if(now-blastAt.current<2000||journeyRef.current.entrance?.phase!=='settled')return
    blastAt.current=now;setBlastCooling(true)
    dispatchEvent(new Event('contact:blast'))
    clearTimeout(blastTimer.current);blastTimer.current=setTimeout(()=>setBlastCooling(false),2000)
  }

  useEffect(() => {
    let frame = null
    const update = () => {
      frame = null
      const bounds = sectionRef.current?.getBoundingClientRect()
      if (!bounds) return
      if(contactEntryVisible(frameRef.current?.getBoundingClientRect(),innerHeight))setHasEntered(true)
      const progress = reducedMotion || window.innerWidth < 761 ? 1 : Math.max(0, Math.min(1, (window.innerHeight * 0.65 - bounds.top) / (window.innerHeight * 0.9)))
      journeyRef.current.progress = progress
      sectionRef.current.style.setProperty('--contact-arrival', progress.toFixed(4))
      sectionRef.current.dataset.contactArrival = progress.toFixed(3)
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, {passive: true})
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [reducedMotion])

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

    let resizeFrame = null
    const handleResize = () => {
      if (resizeFrame) return
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null
        setQuality(getQualityTier())
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
  useContactEntrance({sectionRef,journeyRef,hasEntered,sceneReady,
    unavailable:sceneFailed||(forceReveal&&!sceneReady),reducedMotion,pageVisible,isVisible})

  useEffect(() => {
    if (!hasMountedScene) return
    setScenePhase((currentPhase) => {
      if (!isReadyPhase(currentPhase)) return currentPhase
      return shouldRunScene ? SCENE_PHASE.RUNNING : SCENE_PHASE.PAUSED_OFFSCREEN
    })
  }, [hasMountedScene, shouldRunScene])

  useEffect(() => {
    if (!hasEntered || sceneReady || reducedMotion || !pageVisible) return undefined
    const timer = window.setTimeout(() => setForceReveal(true), 900)
    return () => window.clearTimeout(timer)
  }, [hasEntered, reducedMotion, sceneReady,pageVisible])

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

  const returnToTop = () => {
    const home = document.getElementById('home')
    home?.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'start'})
    if (window.location.hash) window.history.pushState(null, '', window.location.pathname)
  }

  const revealContent = hasEntered
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
      data-contact-entered={hasEntered?'true':'false'}
      data-contact-visible={isVisible&&pageVisible?'true':'false'}
    >
      <div
        ref={frameRef}
        data-contact-frame
        className={styles.frame}
      >
        <span className={styles.frameGlow} aria-hidden="true" />
        {isNearViewport&&asteroidValues.asteroidsEnabled>0&&<>
          <Asteroids footer layer="background" className={styles.footerRocksBack} enabled={isVisible&&pageVisible} sizeScale={asteroidValues.asteroidSize} speedScale={asteroidValues.asteroidSpeed} count={asteroidValues.asteroidCount-Math.round(asteroidValues.asteroidCount*asteroidValues.asteroidNearFraction)}/>
          <Asteroids footer layer="foreground" className={styles.foregroundAsteroids} enabled={isVisible&&pageVisible} sizeScale={asteroidValues.asteroidSize} speedScale={asteroidValues.asteroidSpeed} count={Math.round(asteroidValues.asteroidCount*asteroidValues.asteroidNearFraction)}/>
        </>}
        <button type="button" className={styles.blackHoleBlast} onClick={blast} disabled={!hasEntered||blastCooling} aria-label={blastCooling?'Black-hole blast recharging':'Release a black-hole blast to destroy visible asteroids'} title="Release blast"/>

        <div className={styles.contentGrid}>
          <div className={styles.leadMotion} inert={hasEntered?undefined:''} aria-hidden={!hasEntered}>
            <div>
              <motion.div
                className={styles.eyebrow}
                initial={false}
                animate={revealContent ? {opacity: 1, y: 0} : {opacity: 0, y: 12}}
                transition={reducedMotion ? {duration: 0} : {delay: 0.08, duration: 0.52}}
              >
                <span>{CONTACT_COPY.eyebrow}</span>
              </motion.div>

              <h2
                id="contact-heading"
                className={styles.heading}
              >
                {CONTACT_COPY.heading.map((text,index)=><GlitchLine key={text} text={text} accent={index===2}/>)}
              </h2>

              <motion.p
                className={styles.description}
                initial={false}
                animate={revealContent ? {opacity: 1, y: 0} : {opacity: 0, y: 16}}
                transition={reducedMotion ? {duration: 0} : {delay: 0.26, duration: 0.62}}
              >
                {CONTACT_COPY.description}
              </motion.p>
              <details className={styles.composer}>
              <summary className={styles.conversation}>
                Start a conversation <ArrowRight size={20} strokeWidth={1.3} aria-hidden="true" />
                <span aria-hidden="true" />
              </summary>
              <div className={styles.composerOptions} aria-label="Choose your email app">
                <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_PROFILE.email)}`} target="_blank" rel="noopener noreferrer">Gmail</a>
                <a href={`https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(CONTACT_PROFILE.email)}`} target="_blank" rel="noopener noreferrer">Outlook</a>
                <a href={`https://compose.mail.yahoo.com/?to=${encodeURIComponent(CONTACT_PROFILE.email)}`} target="_blank" rel="noopener noreferrer">Yahoo Mail</a>
                <a href={`mailto:${CONTACT_PROFILE.email}`}>Default email app</a>
              </div>
              </details>
            </div>
          </div>

          <div className={styles.sceneWrap} aria-hidden="true" data-contact-sky>
            <StaticBlackHole hidden={!hasEntered||(!sceneFailed&&(!forceReveal||sceneReady))} />
            {hasMountedScene && quality && !sceneFailed && (
              <SceneErrorBoundary key={sceneGeneration} onError={handleSceneError}>
                <div className={`${styles.sceneCanvas} ${sceneReady ? styles.sceneCanvasReady : ''}`}>
                  <ContactCanvas
                    active={canvasActive}
                    reducedMotion={reducedMotion}
                    pointerRef={pointerRef}
                    journeyRef={journeyRef}
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


          <div className={styles.contactList} aria-label="Contact details" inert={hasEntered?undefined:''} aria-hidden={!hasEntered}>
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
              className={styles.footerMeta}
              initial={false}
              animate={revealContent ? {opacity: 1, y: 0} : {opacity: 0, y: 10}}
              transition={reducedMotion ? {duration: 0} : {delay: 0.82, duration: 0.58}}
            >
              <p>{CONTACT_PROFILE.name} &copy; {new Date().getFullYear()}</p>
              <div className={styles.socials}>
                <a href={CONTACT_PROFILE.github} target="_blank" rel="noreferrer">GitHub</a>
                <span aria-hidden="true">·</span>
                <a href={CONTACT_PROFILE.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
              </div>
              <button type="button" className={styles.topControl} onClick={returnToTop} aria-label="Back to top">
                Back to top
                <ArrowUp size={18} strokeWidth={1.8} />
              </button>
            </motion.div>
          </footer>
        </div>
      </div>
    </section>
  )
}
