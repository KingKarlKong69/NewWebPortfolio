import { Canvas, useFrame } from '@react-three/fiber'
import { animate, remove, set } from 'animejs'
import { motion, useReducedMotion } from 'framer-motion'
import { BookOpen, BriefcaseBusiness, Code2, FileText, GraduationCap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import ActiveFrameLoop from './ActiveFrameLoop'

const milestones = [
  {
    year: '2022',
    title: 'Started College',
    description: 'Begins to learn the basic fundamentals of programming.',
    Icon: BookOpen,
    side: 'right',
    accent: 'cyan'
  },
  {
    year: '2023',
    title: 'Academic Projects',
    description: 'Developed full-stack applications, both web and mobile.',
    Icon: Code2,
    side: 'left',
    accent: 'cyan'
  },
  {
    year: '2024',
    title: 'Capstone Thesis',
    description: 'Served as research lead and full stack developer for developing the Orphanage Management System.',
    Icon: FileText,
    side: 'right',
    accent: 'blue'
  },
  {
    year: '2025',
    title: 'Internship',
    description: 'Worked as a Full Stack Web Developer Intern at PRAXXYS Solutions, Inc.',
    Icon: BriefcaseBusiness,
    side: 'left',
    accent: 'blue'
  },
  {
    year: '2026',
    title: 'Graduated & Open for Opportunities',
    description: 'Earned my BSIT Degree from Bulacan State University - Bustos Campus and ready to build meaningful digital products.',
    Icon: GraduationCap,
    side: 'right',
    accent: 'purple',
    featured: true
  }
]

const strengths = [
  'Problem-solving',
  'Adaptability',
  'Collaboration',
  'Time management',
  'Feedback-driven'
]

const accentStyles = {
  cyan: {
    text: 'text-cyan-300',
    icon: 'text-cyan-100',
    stroke: '#67e8f9',
    line: 'bg-cyan-300',
    dotShadow: 'shadow-[0_0_16px_rgba(0,229,255,0.95),0_0_30px_rgba(0,229,255,0.34)]',
    glow: 'shadow-[0_0_18px_rgba(0,229,255,0.55),0_0_34px_rgba(0,229,255,0.32)]',
    edgeGlow: 'shadow-[0_0_12px_rgba(0,229,255,0.95),inset_0_0_12px_rgba(0,229,255,0.36)]',
    border: 'border-cyan-200/85',
    fill: 'from-cyan-300/20 via-sky-500/12 to-cyan-300/5'
  },
  blue: {
    text: 'text-sky-400',
    icon: 'text-sky-100',
    stroke: '#38bdf8',
    line: 'bg-sky-400',
    dotShadow: 'shadow-[0_0_16px_rgba(56,189,248,0.9),0_0_30px_rgba(56,189,248,0.3)]',
    glow: 'shadow-[0_0_18px_rgba(56,189,248,0.5),0_0_34px_rgba(56,189,248,0.28)]',
    edgeGlow: 'shadow-[0_0_12px_rgba(56,189,248,0.88),inset_0_0_12px_rgba(56,189,248,0.34)]',
    border: 'border-sky-300/80',
    fill: 'from-sky-400/18 via-blue-500/12 to-cyan-300/5'
  },
  purple: {
    text: 'text-purple-300',
    icon: 'text-purple-100',
    stroke: '#d8b4fe',
    line: 'bg-purple-300',
    dotShadow: 'shadow-[0_0_18px_rgba(216,180,254,0.96),0_0_34px_rgba(168,85,247,0.42)]',
    glow: 'shadow-[0_0_22px_rgba(216,180,254,0.58),0_0_40px_rgba(168,85,247,0.42)]',
    edgeGlow: 'shadow-[0_0_14px_rgba(216,180,254,0.95),inset_0_0_14px_rgba(168,85,247,0.42)]',
    border: 'border-purple-200/85',
    fill: 'from-purple-400/28 via-fuchsia-500/16 to-cyan-300/6'
  }
}

const clamp01 = (value) => Math.max(0, Math.min(1, value))

const easeOutCubic = (value) => 1 - Math.pow(1 - clamp01(value), 3)

const phaseValue = (value, start, end) => {
  if (end <= start) return value >= end ? 1 : 0
  return easeOutCubic((value - start) / (end - start))
}

function JourneyAtmosphere(){
  const pointsRef = useRef()
  const geometry = useMemo(() => {
    const positions = []
    const colors = []
    const cyan = new THREE.Color('#00E5FF')
    const purple = new THREE.Color('#8B5CF6')

    for (let index = 0; index < 420; index += 1) {
      const angle = index * 2.399963
      const radius = 3 + (index % 70) * 0.055
      const layer = Math.floor(index / 70)
      const color = cyan.clone().lerp(purple, (index % 90) / 90)

      positions.push(
        Math.cos(angle) * radius,
        -2.4 + layer * 0.72 + Math.sin(index * 0.79) * 0.18,
        Math.sin(angle) * radius - 4
      )
      colors.push(color.r, color.g, color.b)
    }

    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return particleGeometry
  }, [])

  useFrame((state, delta) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y += delta * 0.018
    pointsRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.16) * 0.015
    pointsRef.current.material.opacity = 0.24 + Math.sin(state.clock.elapsedTime * 0.8) * 0.04
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.022}
        transparent
        opacity={0.24}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function Milestone({ milestone, index, setItemRef }){
  const { Icon } = milestone
  const accent = accentStyles[milestone.accent]
  const isLeft = milestone.side === 'left'
  const connectorPosition = isLeft
    ? '-ml-3 justify-start md:col-start-1 md:ml-0 md:-mr-16 md:justify-end md:pr-0'
    : '-ml-3 justify-start md:col-start-3 md:-ml-16 md:pl-0'
  const copyPosition = isLeft
    ? 'md:col-start-1 md:justify-self-end md:pr-20 md:text-left'
    : 'md:col-start-3 md:pl-28'

  return (
    <div
      ref={setItemRef(index)}
      className="journey-item group relative z-10 grid min-h-[190px] grid-cols-[58px_minmax(0,1fr)] items-center gap-4 md:min-h-[218px] md:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] md:gap-5"
    >
        <div className="journey-node relative z-30 col-start-1 row-start-1 flex items-center justify-center will-change-transform md:col-start-2">
          <div className={`journey-badge-core relative flex h-[58px] w-[58px] items-center justify-center bg-[#03101c] bg-gradient-to-br ${accent.fill} ${accent.glow} md:h-[64px] md:w-[64px] ${milestone.featured ? 'md:h-[72px] md:w-[72px]' : ''}`} style={{clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)'}}>
            <svg className="journey-hex-outline pointer-events-none absolute -inset-[6px] z-10 overflow-visible" viewBox="0 0 100 100" aria-hidden="true" style={{'--hex-stroke': accent.stroke}}>
              <polygon className="journey-hex-outline-glow" points="25,4 75,4 100,50 75,96 25,96 0,50" />
              <polygon className="journey-hex-outline-core" points="25,4 75,4 100,50 75,96 25,96 0,50" />
            </svg>
            <span className="pointer-events-none absolute inset-[5px] border border-white/18" style={{clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)'}} />
            <Icon size={milestone.featured ? 32 : 28} strokeWidth={1.75} className={`relative z-10 ${accent.icon} drop-shadow-[0_0_12px_rgba(0,229,255,0.62)]`} />
          </div>
        </div>

        <div className={`journey-connector pointer-events-none col-start-2 row-start-1 flex items-center ${connectorPosition}`}>
          <div className="flex items-center">
            {isLeft && (
            <span className={`journey-connector-dot hidden h-2.5 w-2.5 rounded-full ${accent.line} ${accent.dotShadow} md:block`} />
          )}
          <span
              className={`journey-connector-line h-[2px] w-16 ${accent.line} opacity-80 shadow-[0_0_16px_rgba(0,229,255,0.72)] will-change-transform md:w-24`}
            />
            {!isLeft && (
              <span className={`journey-connector-dot h-2.5 w-2.5 rounded-full ${accent.line} ${accent.dotShadow}`} />
            )}
            {isLeft && (
              <span className={`journey-connector-dot h-2.5 w-2.5 rounded-full ${accent.line} ${accent.dotShadow} md:hidden`} />
            )}
          </div>
        </div>

        <div className={`journey-copy col-start-2 row-start-1 max-w-[390px] pl-12 will-change-transform md:max-w-[360px] md:pl-0 ${copyPosition}`}>
          <div className={`journey-year font-mono text-[32px] font-black leading-none tracking-[0.18em] ${accent.text} drop-shadow-[0_0_12px_rgba(0,229,255,0.34)] ${milestone.featured ? 'md:text-[40px]' : 'md:text-[36px]'}`}>
            {milestone.year}
          </div>
          <h3 className={`journey-title mt-2 max-w-[360px] text-[23px] font-black leading-[1.15] text-white ${milestone.featured ? 'md:text-[27px]' : 'md:text-[24px]'}`}>
            {milestone.title}
          </h3>
          <p className="journey-description mt-2 max-w-[390px] text-[16px] font-light leading-[1.62] text-slate-200/82 md:text-[16px]">
            {milestone.description}
          </p>
        </div>
    </div>
  )
}

export default function AboutSection(){
  const prefersReducedMotion = useReducedMotion()
  const [journeyCanvasMounted, setJourneyCanvasMounted] = useState(false)
  const [journeyCanvasActive, setJourneyCanvasActive] = useState(false)
  const sectionRef = useRef()
  const timelineRef = useRef()
  const headingRef = useRef()
  const lineRef = useRef()
  const spineHeadRef = useRef()
  const startTerminalRef = useRef()
  const endTerminalRef = useRef()
  const itemRefs = useRef([])
  const frameRef = useRef(null)
  const activatedItemsRef = useRef([])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      const active = entry.isIntersecting
      setJourneyCanvasActive(active)
      if (active) setJourneyCanvasMounted(true)
    }, {rootMargin: '30% 0px', threshold: 0.01})
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  const setItemRef = (index) => (node) => {
    itemRefs.current[index] = node
  }

  useEffect(() => {
    const timeline = timelineRef.current
    if (!lineRef.current || !timeline) return
    frameRef.current = null
    activatedItemsRef.current = []

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const getScrollParent = (node) => {
      let parent = node?.parentElement
      while (parent) {
        const { overflowY } = window.getComputedStyle(parent)
        const canScroll = /(auto|scroll|overlay)/.test(overflowY) && parent.scrollHeight > parent.clientHeight
        if (canScroll) return parent
        if (parent === document.body) break
        parent = parent.parentElement
      }
      return window
    }
    const scrollTarget = getScrollParent(sectionRef.current)

    const setTerminalState = (terminal, progress, isEnd = false) => {
      if (!terminal) return
      const opacity = isEnd ? progress : 0.18 + progress * 0.82
      const scale = 0.72 + progress * (isEnd ? 0.48 : 0.32)
      set(terminal, {
        opacity,
        scale,
        translateX: '-50%',
        translateY: isEnd ? '50%' : '-50%',
        filter: `blur(${(1 - progress) * 4}px)`
      })
      terminal.classList.toggle('is-complete', isEnd && progress > 0.98)
    }

    const revealAll = () => {
      set(lineRef.current, { scaleY: 1, transformOrigin: '50% 0%' })
      set(spineHeadRef.current, { opacity: 0 })
      setTerminalState(startTerminalRef.current, 1)
      setTerminalState(endTerminalRef.current, 1, true)

      itemRefs.current.forEach((item) => {
        if (!item) return
        item.style.pointerEvents = 'auto'
        item.classList.add('is-revealed')
        item.classList.remove('is-dimmed')
        set(item, { opacity: 1 })
        set(item.querySelector('.journey-node'), { opacity: 1, scale: 1, translateY: 0, filter: 'blur(0px)' })
        set(item.querySelector('.journey-badge-core'), { scale: 1 })
        set(item.querySelector('.journey-connector-line'), { opacity: 0.92, scaleX: 1 })
        item.querySelectorAll('.journey-connector-dot').forEach((dot) => set(dot, { opacity: 1, scale: 1 }))
        set(item.querySelector('.journey-copy'), { opacity: 1, translateX: 0, translateY: 40, filter: 'blur(0px)' })
        set(item.querySelector('.journey-year'), { opacity: 1, translateY: 0, letterSpacing: '0.18em' })
        set(item.querySelector('.journey-title'), { opacity: 1, translateY: 0 })
        set(item.querySelector('.journey-description'), { opacity: 1, translateY: 0 })
      })
    }

    const prepareInitialState = () => {
      set(lineRef.current, { scaleY: 0, transformOrigin: '50% 0%' })
      set(spineHeadRef.current, { opacity: 0, translateY: 0 })
      setTerminalState(startTerminalRef.current, 0)
      setTerminalState(endTerminalRef.current, 0, true)

      itemRefs.current.forEach((item) => {
        if (!item) return
        item.style.pointerEvents = 'none'
        item.classList.remove('is-revealed', 'is-dimmed')
        set(item, { opacity: 1 })
        set(item.querySelector('.journey-node'), { opacity: 0, scale: 0.72, translateY: 16, filter: 'blur(8px)' })
        set(item.querySelector('.journey-badge-core'), { scale: 1 })
        set(item.querySelector('.journey-connector-line'), { opacity: 0, scaleX: 0 })
        item.querySelectorAll('.journey-connector-dot').forEach((dot) => set(dot, { opacity: 0, scale: 0.35 }))
        set(item.querySelector('.journey-copy'), { opacity: 1, translateX: 24, translateY: 22, filter: 'blur(8px)' })
        set(item.querySelector('.journey-year'), { opacity: 0, translateY: 12, letterSpacing: '0.3em' })
        set(item.querySelector('.journey-title'), { opacity: 0, translateY: 12 })
        set(item.querySelector('.journey-description'), { opacity: 0, translateY: 14 })
      })
    }

    const triggerActivationPulse = (index, item) => {
      if (activatedItemsRef.current[index]) return
      activatedItemsRef.current[index] = true

      const badge = item.querySelector('.journey-badge-core')
      const outline = item.querySelector('.journey-hex-outline')
      const year = item.querySelector('.journey-year')

      animate(badge, {
        scale: [1.08, 1],
        duration: milestones[index].featured ? 720 : 560,
        ease: 'out(3)'
      })

      animate(outline, {
        opacity: [0.7, 1],
        duration: 420,
        ease: 'out(2)'
      })

      animate(year, {
        letterSpacing: ['0.28em', '0.18em'],
        duration: 620,
        ease: 'out(3)'
      })
    }

    const applyItemProgress = (index, localProgress, dimProgress, isDesktop) => {
      const item = itemRefs.current[index]
      if (!item) return

      const copy = item.querySelector('.journey-copy')
      const node = item.querySelector('.journey-node')
      const badge = item.querySelector('.journey-badge-core')
      const connectorLine = item.querySelector('.journey-connector-line')
      const connectorDots = item.querySelectorAll('.journey-connector-dot')
      const year = item.querySelector('.journey-year')
      const title = item.querySelector('.journey-title')
      const description = item.querySelector('.journey-description')
      const isLeft = milestones[index].side === 'left'
      const nodeIn = phaseValue(localProgress, 0, 0.18)
      const connectorIn = phaseValue(localProgress, 0.16, 0.46)
      const dotIn = phaseValue(localProgress, 0.34, 0.56)
      const yearIn = phaseValue(localProgress, 0.42, 0.7)
      const titleIn = phaseValue(localProgress, 0.52, 0.82)
      const descriptionIn = phaseValue(localProgress, 0.62, 1)
      const dim = dimProgress * (milestones[index].featured ? 0.06 : 0.28)
      const liveOpacity = 1 - dim
      const finalBoost = milestones[index].featured ? phaseValue(localProgress, 0.82, 1) * 0.05 : 0
      const copyFinalY = isDesktop ? 40 : 0
      const copyDirection = isDesktop && isLeft ? -20 : 20

      item.style.pointerEvents = localProgress > 0.62 ? 'auto' : 'none'
      item.classList.toggle('is-revealed', localProgress > 0.62)
      item.classList.toggle('is-dimmed', dimProgress > 0.2)

      if (localProgress > 0.18) {
        triggerActivationPulse(index, item)
      } else {
        activatedItemsRef.current[index] = false
      }

      if (connectorLine) {
        connectorLine.style.transformOrigin = isDesktop && isLeft ? '100% 50%' : '0% 50%'
      }

      set(node, {
        opacity: nodeIn * liveOpacity,
        scale: 0.72 + nodeIn * (0.28 + finalBoost),
        translateY: (1 - nodeIn) * 16,
        filter: `blur(${(1 - nodeIn) * 7}px)`
      })

      set(badge, {
        filter: `brightness(${0.72 + nodeIn * (milestones[index].featured ? 0.68 : 0.42)})`
      })

      set(connectorLine, {
        opacity: connectorIn * (0.9 - dim * 0.28),
        scaleX: connectorIn
      })

      connectorDots.forEach((dot) => set(dot, {
        opacity: dotIn * liveOpacity,
        scale: 0.45 + dotIn * 0.55
      }))

      set(copy, {
        opacity: liveOpacity,
        translateX: copyDirection * (1 - titleIn),
        translateY: copyFinalY + (1 - titleIn) * 16,
        filter: `blur(${(1 - descriptionIn) * 8}px)`
      })

      set(year, {
        opacity: yearIn,
        translateY: (1 - yearIn) * 12,
        letterSpacing: `${0.28 - yearIn * 0.1}em`
      })

      set(title, {
        opacity: titleIn,
        translateY: (1 - titleIn) * 10
      })

      set(description, {
        opacity: descriptionIn,
        translateY: (1 - descriptionIn) * 12
      })
    }

    const update = () => {
      frameRef.current = null
      if (reducedMotionQuery.matches) {
        revealAll()
        return
      }

      const rect = timeline.getBoundingClientRect()
      const isDesktop = window.matchMedia('(min-width: 768px)').matches
      const navHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')) || 96
      const revealY = Math.min(window.innerHeight * 0.66, window.innerHeight - navHeight - 72)
      const entryLead = Math.min(260, Math.max(160, window.innerHeight * 0.28))
      const journeyProgress = clamp01((revealY - rect.top + entryLead) / Math.max(1, rect.height))
      const lineProgress = clamp01((journeyProgress - 0.01) / 0.975)
      const localLineHeight = timeline.offsetHeight

      set(lineRef.current, { scaleY: lineProgress })
      set(spineHeadRef.current, {
        opacity: lineProgress > 0.02 && lineProgress < 0.995 ? 1 : 0,
        translateX: '-50%',
        translateY: lineProgress * localLineHeight - 8
      })
      setTerminalState(startTerminalRef.current, phaseValue(lineProgress, 0, 0.025))
      setTerminalState(endTerminalRef.current, phaseValue(lineProgress, 0.955, 1), true)

      milestones.forEach((_, index) => {
        const item = itemRefs.current[index]
        const node = item?.querySelector('.journey-node')
        if (!item || !node) return

        const nodeRect = node.getBoundingClientRect()
        const nextNode = itemRefs.current[index + 1]?.querySelector('.journey-node')
        const nextNodeRect = nextNode?.getBoundingClientRect()
        const activationLead = Math.min(38, Math.max(24, nodeRect.height * 0.42))
        const nodeThreshold = clamp01((nodeRect.top - rect.top - activationLead) / Math.max(1, rect.height))
        const threshold = index === 0 ? 0.012 : nodeThreshold
        const nextThreshold = nextNodeRect
          ? clamp01((nextNodeRect.top - rect.top - Math.min(38, Math.max(24, nextNodeRect.height * 0.42))) / Math.max(1, rect.height))
          : 1
        const revealDistance = Math.max(0.095, (nextThreshold - threshold) * 0.54)
        const localProgress = clamp01((lineProgress - threshold) / revealDistance)
        const dimProgress = index < milestones.length - 1
          ? phaseValue(lineProgress, nextThreshold + 0.03, nextThreshold + 0.11)
          : 0

        applyItemProgress(index, localProgress, dimProgress, isDesktop)
      })
    }

    const requestUpdate = () => {
      if (frameRef.current) return
      frameRef.current = window.requestAnimationFrame(update)
    }

    const settledUpdateTimers = []
    const requestSettledUpdates = () => {
      requestUpdate()
      window.requestAnimationFrame(() => window.requestAnimationFrame(requestUpdate))
      ;[80, 240, 600, 1200].forEach((delay) => {
        settledUpdateTimers.push(window.setTimeout(requestUpdate, delay))
      })
      document.fonts?.ready?.then(requestUpdate).catch(() => {})
    }

    const requestUpdateWhenVisible = () => {
      if (!document.hidden) requestSettledUpdates()
    }

    if (reducedMotionQuery.matches) {
      revealAll()
    } else {
      prepareInitialState()
    }
    requestSettledUpdates()
    scrollTarget.addEventListener('scroll', requestUpdate, { passive: true })
    if (scrollTarget !== window) {
      window.addEventListener('scroll', requestUpdate, { passive: true, capture: true })
    }
    window.addEventListener('resize', requestUpdate)
    window.addEventListener('load', requestSettledUpdates)
    window.addEventListener('pageshow', requestSettledUpdates)
    window.addEventListener('hashchange', requestSettledUpdates)
    document.addEventListener('visibilitychange', requestUpdateWhenVisible)
    reducedMotionQuery.addEventListener?.('change', requestUpdate)

    return () => {
      settledUpdateTimers.forEach((timerId) => window.clearTimeout(timerId))
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      scrollTarget.removeEventListener('scroll', requestUpdate)
      if (scrollTarget !== window) {
        window.removeEventListener('scroll', requestUpdate, { capture: true })
      }
      window.removeEventListener('resize', requestUpdate)
      window.removeEventListener('load', requestSettledUpdates)
      window.removeEventListener('pageshow', requestSettledUpdates)
      window.removeEventListener('hashchange', requestSettledUpdates)
      document.removeEventListener('visibilitychange', requestUpdateWhenVisible)
      reducedMotionQuery.removeEventListener?.('change', requestUpdate)
      const animatedTargets = [
        lineRef.current,
        spineHeadRef.current,
        startTerminalRef.current,
        endTerminalRef.current,
        ...itemRefs.current.filter(Boolean)
      ].filter(Boolean)
      remove(animatedTargets)
    }
  }, [])

  return (
    <section id="about" className="relative scroll-mt-[118px] overflow-visible">
      <div className="pointer-events-none absolute inset-0 overflow-visible">
        <div className="absolute right-[-14rem] top-[18rem] h-[38rem] w-[38rem] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative min-h-[86vh] overflow-hidden px-6 py-24 sm:px-8 lg:min-h-[82vh] lg:px-28 lg:py-20 xl:px-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-18rem] top-12 h-[34rem] w-[34rem] rounded-full bg-purple-600/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
          <div className="absolute left-[8%] top-[18%] hidden h-[64%] w-px bg-gradient-to-b from-transparent via-cyan-300/25 to-transparent lg:block" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-[1320px] gap-14 lg:min-h-[calc(82vh-10rem)] lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-20">
          <motion.div
            initial={{opacity:0,y:28}}
            whileInView={{opacity:1,y:0}}
            viewport={{once:false,amount:0.35}}
            transition={{duration:0.8,ease:[0.22,1,0.36,1]}}
            className="space-y-7"
          >
            <div className="inline-flex items-center gap-3 rounded-md border border-cyan-400/25 bg-cyan-300/[0.025] px-4 py-2 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(0,229,255,0.95)]" />
              <span className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200/90">About Me</span>
            </div>

            <div className="space-y-4">
              <h2 className="font-montserrat text-[44px] font-black uppercase leading-[0.9] tracking-[0] text-white sm:text-[58px] lg:text-[72px]">
                Background
              </h2>
              <div className="h-px w-32 bg-gradient-to-r from-cyan-300 via-blue-500 to-transparent shadow-[0_0_18px_rgba(0,229,255,0.55)]" />
            </div>

            <p className="max-w-[620px] text-[16px] font-light leading-[1.9] text-slate-300/88 sm:text-[18px]">
              I'm Karl Lopez, a BSIT graduate at Bulacan State University - Bustos Campus. I've always believed technology is the most powerful force shaping our future, so I dedicated myself to mastering web development from front-end to back-end.
            </p>
          </motion.div>

          <motion.div
            initial={{opacity:0,y:32}}
            whileInView={{opacity:1,y:0}}
            viewport={{once:false,amount:0.3}}
            transition={{delay:0.12,duration:0.85,ease:[0.22,1,0.36,1]}}
            className="relative"
          >
            <div className="absolute -left-8 top-0 hidden h-full w-px bg-gradient-to-b from-cyan-300/0 via-cyan-300/35 to-cyan-300/0 lg:block" />

            <div className="space-y-8 text-slate-300/88">
              <p className="max-w-[720px] text-[17px] font-light leading-[1.9] sm:text-[19px]">
                My motivation is simple: I want to be part of technology's growth, work in a high-demand field, and build a rewarding career.
              </p>

              <p className="max-w-[760px] text-[17px] font-light leading-[1.9] sm:text-[19px]">
                College shaped me into a developer who values problem-solving, adaptability, collaboration, time management, and openness to feedback. As a research lead, I also contributed to system architecture and development, giving me a stronger understanding of how ideas become functional digital products.
              </p>

              <div className="pt-4">
                <div className="mb-5 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300/90">Developer Values</div>
                <div className="flex flex-wrap gap-x-7 gap-y-4">
                  {strengths.map((item, index) => (
                    <motion.div
                      key={item}
                      initial={{opacity:0,x:-12}}
                      whileInView={{opacity:1,x:0}}
                      viewport={{once:false}}
                      transition={{delay:0.18 + index * 0.08,duration:0.55}}
                      className="group flex items-center gap-3"
                    >
                      <span className="h-px w-8 bg-cyan-300/50 transition-all duration-300 group-hover:w-12 group-hover:bg-cyan-200 group-hover:shadow-[0_0_14px_rgba(0,229,255,0.9)]" />
                      <span className="font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-slate-300 transition-colors duration-300 group-hover:text-cyan-100">
                        {item}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div
        ref={sectionRef}
        className="relative scroll-mt-[124px] overflow-visible px-5 py-10 sm:px-8 lg:px-28 lg:py-12 xl:px-32"
      >
      <div
        className="relative flex items-start overflow-visible py-0"
      >
        <div className="pointer-events-none absolute inset-0 opacity-55">
          {journeyCanvasMounted && <Canvas
            camera={{position:[0,0,7],fov:48}}
            gl={{alpha:true,antialias:true,powerPreference:'high-performance'}}
            dpr={[1,1.35]}
            frameloop="demand"
          >
            <ActiveFrameLoop active={journeyCanvasActive} />
            <JourneyAtmosphere />
          </Canvas>}
        </div>

        <div className="relative z-10 mx-auto max-w-[1120px]">
          <motion.div
            ref={headingRef}
            initial={prefersReducedMotion ? {opacity: 1, y: 0, filter: 'blur(0px)'} : {opacity: 0, y: 28, filter: 'blur(8px)'}}
            whileInView={{opacity: 1, y: 0, filter: 'blur(0px)'}}
            viewport={{once: false, amount: 0.45}}
            transition={prefersReducedMotion ? {duration: 0} : {duration: 0.82, ease: [0.22, 1, 0.36, 1]}}
            className="mb-5 text-center md:mb-4"
          >
            <h2 className="font-montserrat text-[30px] font-black uppercase leading-none tracking-[0.28em] text-white sm:text-[38px] lg:text-[46px]">
              My Journey
            </h2>
          </motion.div>

          <motion.p
            initial={prefersReducedMotion ? {opacity: 1, y: 0, filter: 'blur(0px)'} : {opacity: 0, y: 18, filter: 'blur(6px)'}}
            whileInView={{opacity: 1, y: 0, filter: 'blur(0px)'}}
            viewport={{once: false, amount: 0.55}}
            transition={prefersReducedMotion ? {duration: 0} : {delay: 0.08, duration: 0.72, ease: [0.22, 1, 0.36, 1]}}
            className="mx-auto mb-4 max-w-[760px] text-center text-[14px] font-light leading-[1.7] text-slate-300/72 sm:text-[15px] md:mb-4"
          >
            From learning programming fundamentals at Bulacan State University - Bustos Campus to building full-stack systems, my path has been shaped by research, collaboration, and a drive to create meaningful digital products.
          </motion.p>

          <div ref={timelineRef} className="relative mx-auto mb-48 mt-16 max-w-[900px] origin-top md:mb-72 md:mt-28 lg:mb-80 lg:mt-36 lg:scale-[1.18]">
            <div className="absolute bottom-0 left-[28px] top-0 z-0 w-[2px] bg-cyan-300/[0.018] shadow-[0_0_8px_rgba(0,229,255,0.07)] md:left-1/2 md:-translate-x-1/2" />
            <div ref={lineRef} className="absolute bottom-0 left-[28px] top-0 z-0 w-[2px] origin-top bg-gradient-to-b from-cyan-200 via-sky-400 to-purple-400 shadow-[0_0_12px_rgba(0,229,255,0.95),0_0_30px_rgba(56,189,248,0.48),0_0_54px_rgba(168,85,247,0.28)] md:left-1/2 md:-translate-x-1/2" />
            <span ref={spineHeadRef} className="journey-spine-head pointer-events-none absolute left-[29px] top-0 z-30 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100 opacity-0 shadow-[0_0_12px_rgba(0,229,255,1),0_0_34px_rgba(0,229,255,0.72)] md:left-1/2" />
            <span ref={startTerminalRef} className="journey-terminal-dot pointer-events-none absolute left-[29px] top-0 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(0,229,255,1),0_0_28px_rgba(0,229,255,0.56)] md:left-1/2" />
            <span ref={endTerminalRef} className="journey-terminal-dot pointer-events-none absolute bottom-0 left-[29px] z-20 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-purple-300 shadow-[0_0_12px_rgba(216,180,254,1),0_0_30px_rgba(168,85,247,0.6)] md:left-1/2" />

            <div className="relative z-10 space-y-2 md:space-y-2">
              {milestones.map((milestone, index) => (
                <Milestone
                  key={milestone.year}
                  milestone={milestone}
                  index={index}
                  setItemRef={setItemRef}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  )
}
