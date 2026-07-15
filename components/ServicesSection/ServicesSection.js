import {motion, useMotionValue, useReducedMotion, useScroll, useTransform} from 'framer-motion'
import {Plus, Quote} from 'lucide-react'
import {Fragment, useEffect, useRef, useState} from 'react'
import {SERVICES, TESTIMONIALS} from './servicesData'
import styles from './ServicesSection.module.css'

const NODE_RANGES = [
  [0.12, 0.20],
  [0.26, 0.34],
  [0.40, 0.48],
  [0.54, 0.62],
  [0.68, 0.76],
  [0.82, 0.89]
]

const CONNECTOR_RANGES = [
  [0.20, 0.26],
  [0.34, 0.40],
  [0.48, 0.54],
  [0.62, 0.68],
  [0.76, 0.82]
]

const DESKTOP_CONNECTORS = [
  'M126 314 L324 252',
  'M324 252 L528 205',
  'M528 205 L720 151',
  'M720 151 L924 112',
  'M924 112 L1092 110'
]

const DESTINATIONS = [
  [324, 252],
  [528, 205],
  [720, 151],
  [924, 112],
  [1092, 110]
]

const clampProgress = (value) => Math.max(0, Math.min(1, value))

function usePhase(progress, start, end) {
  return useTransform(progress, (value) => clampProgress((value - start) / (end - start)))
}

function ServiceNode({service, index, progress, mobile = false}) {
  const [start, end] = NODE_RANGES[index]
  const nodeProgress = usePhase(progress, start, end)
  const ignitionOpacity = useTransform(nodeProgress, [0, 0.12, 0.45, 1], [0, 1, 0.82, 0.68])
  const ignitionScale = useTransform(nodeProgress, [0, 0.25, 0.7], [0.35, 1.35, 1])
  const ringProgress = useTransform(nodeProgress, [0.08, 0.58], [0, 1])
  const platformOpacity = useTransform(nodeProgress, [0.16, 0.54], [0, 1])
  const iconOpacity = useTransform(nodeProgress, [0.36, 0.66], [0, 1])
  const iconScale = useTransform(nodeProgress, [0.36, 0.76], [0.78, 1])
  const iconY = useTransform(nodeProgress, [0.36, 0.76], [15, 0])
  const iconBlur = useTransform(nodeProgress, [0.36, 0.7], ['blur(8px)', 'blur(0px)'])
  const numberOpacity = useTransform(nodeProgress, [0.54, 0.72], [0, 1])
  const titleOpacity = useTransform(nodeProgress, [0.62, 0.82], [0, 1])
  const descriptionOpacity = useTransform(nodeProgress, [0.72, 1], [0, 1])
  const copyY = useTransform(nodeProgress, [0.52, 1], [15, 0])
  const Icon = service.Icon

  return (
    <motion.li
      className={`${styles.serviceNode} ${mobile ? styles.serviceNodeMobile : ''}`}
      style={mobile ? {'--accent': service.accent, '--glow': service.glow} : {
        '--accent': service.accent,
        '--glow': service.glow,
        left: `${service.x}%`,
        top: `${service.y}%`
      }}
    >
      <div className={styles.platform} aria-hidden="true">
        <motion.span className={styles.platformAura} style={{opacity: platformOpacity}} />
        <svg className={styles.platformRings} viewBox="0 0 140 90">
          <motion.ellipse cx="70" cy="48" rx="62" ry="29" className={styles.ringOuter} style={{pathLength: ringProgress, opacity: platformOpacity}} />
          <motion.ellipse cx="70" cy="46" rx="45" ry="20" className={styles.ringInner} style={{pathLength: ringProgress, opacity: platformOpacity}} />
        </svg>
        <motion.span className={styles.ignition} style={{opacity: ignitionOpacity, scale: ignitionScale}} />
        <motion.span className={styles.coreDiamond} style={{opacity: platformOpacity, scale: platformOpacity}} />
        <motion.div className={styles.hologram} style={{opacity: iconOpacity, scale: iconScale, y: iconY, filter: iconBlur}}>
          <Icon size={mobile ? 47 : 54} strokeWidth={1.65} />
          <span className={styles.iconEcho}><Icon size={mobile ? 47 : 54} strokeWidth={1.65} /></span>
        </motion.div>
      </div>

      <motion.div className={styles.serviceCopy} style={{y: copyY}}>
        <motion.span className={styles.serviceNumber} style={{opacity: numberOpacity}}>{service.number}</motion.span>
        <motion.h3 style={{opacity: titleOpacity}}>{service.title}</motion.h3>
        <motion.p style={{opacity: descriptionOpacity}}>{service.description}</motion.p>
      </motion.div>
    </motion.li>
  )
}

function DesktopConnector({path, destination, index, progress}) {
  const [start, end] = CONNECTOR_RANGES[index]
  const connectorProgress = usePhase(progress, start, end)
  const pulseOffset = useTransform(connectorProgress, [0, 1], [0, -1])
  const destinationOpacity = useTransform(connectorProgress, [0.78, 0.94, 1], [0, 1, 0.45])
  const destinationScale = useTransform(connectorProgress, [0.78, 0.94, 1], [0.4, 1.8, 1])

  return (
    <g>
      <motion.path d={path} className={styles.connectorProgress} style={{pathLength: connectorProgress}} />
      <motion.path d={path} className={styles.connectorPulse} pathLength="1" strokeDasharray="0.055 0.945" style={{pathOffset: pulseOffset, opacity: connectorProgress}} />
      <motion.circle cx={destination[0]} cy={destination[1]} r="6" className={styles.receivingFlash} style={{opacity: destinationOpacity, scale: destinationScale, transformOrigin: `${destination[0]}px ${destination[1]}px`}} />
    </g>
  )
}

function MobileConnector({index, progress}) {
  const [start, end] = CONNECTOR_RANGES[index]
  const connectorProgress = usePhase(progress, start, end)
  const pulseY = useTransform(connectorProgress, [0, 1], ['0%', '100%'])

  return (
    <li className={styles.mobileConnector} aria-hidden="true">
      <motion.span className={styles.mobileConnectorFill} style={{scaleY: connectorProgress}} />
      <motion.span className={styles.mobileConnectorPulse} style={{top: pulseY, opacity: connectorProgress}} />
    </li>
  )
}

function TestimonialCard({testimonial, index, progress}) {
  const cardProgress = usePhase(progress, 0.92 + index * 0.02, 0.975 + index * 0.015)
  const x = useTransform(cardProgress, [0, 1], [index === 0 ? -28 : 28, 0])
  const borderProgress = useTransform(cardProgress, [0.05, 0.7], [0, 1])

  return (
    <motion.blockquote
      className={`${styles.testimonialCard} ${testimonial.accent === 'violet' ? styles.testimonialViolet : ''}`}
      style={{opacity: cardProgress, x, '--card-trace': borderProgress}}
    >
      <span className={styles.cardTrace} aria-hidden="true" />
      <Quote className={styles.quoteMark} size={40} strokeWidth={1.25} aria-hidden="true" />
      <p>{testimonial.quote}</p>
      <footer>
        <span className={styles.avatar} aria-hidden="true">{testimonial.initials}</span>
        <span>
          <cite>{testimonial.name}</cite>
          <small>{testimonial.role}</small>
        </span>
      </footer>
      <Quote className={styles.quoteMarkEnd} size={34} strokeWidth={1.25} aria-hidden="true" />
    </motion.blockquote>
  )
}

export default function ServicesSection() {
  const sectionRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const completeProgress = useMotionValue(1)
  const [isVisible, setIsVisible] = useState(false)
  const {scrollYProgress} = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end']
  })
  const progress = reducedMotion ? completeProgress : scrollYProgress

  const headerProgress = usePhase(progress, 0.01, 0.09)
  const headerY = useTransform(headerProgress, [0, 1], [24, 0])
  const headerSpacing = useTransform(headerProgress, [0, 1], ['0.34em', '0.18em'])
  const foundationProgress = usePhase(progress, 0.07, 0.14)
  const testimonialsProgress = usePhase(progress, 0.90, 0.96)
  const testimonialsY = useTransform(testimonialsProgress, [0, 1], [32, 0])
  const finalPulse = useTransform(progress, [0.88, 0.91, 0.94], [0, 1, 0.35])
  const finalPulseOffset = useTransform(finalPulse, [0, 1], [0, -1])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {rootMargin: '12% 0px', threshold: 0.02})
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="services"
      aria-labelledby="services-heading"
      className={`${styles.section} ${isVisible ? styles.sectionActive : ''}`}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      <div className={styles.stickyStage}>
        <motion.div className={styles.circuitAtmosphere} style={{opacity: foundationProgress}} aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </motion.div>

        <div className={styles.stageInner}>
          <motion.header className={styles.header} style={{opacity: headerProgress, y: headerY}}>
            <div className={styles.headerCopy}>
              <div className={styles.sectionTag}><span>04</span><i>—</i> Services</div>
              <motion.h2 id="services-heading" style={{letterSpacing: headerSpacing}}>What I Offer</motion.h2>
              <p>I deliver end-to-end digital solutions with a focus on quality, performance, and exceptional user experience.</p>
            </div>
            <div className={styles.impactPanel} aria-hidden="true">
              <span>Solutions that<br />drive impact</span>
              <Plus size={17} />
            </div>
          </motion.header>

          <div className={styles.desktopPipeline}>
            <motion.svg className={styles.pipelineSvg} viewBox="0 0 1200 430" preserveAspectRatio="none" style={{opacity: foundationProgress}} aria-hidden="true">
              <defs>
                <linearGradient id="services-base-gradient" x1="0" x2="1">
                  <stop offset="0" stopColor="#ffbd38" />
                  <stop offset="0.23" stopColor="#22e7ff" />
                  <stop offset="0.62" stopColor="#9b5cff" />
                  <stop offset="0.82" stopColor="#22e7ff" />
                  <stop offset="1" stopColor="#a85eff" />
                </linearGradient>
                <filter id="services-path-glow" x="-20%" y="-80%" width="140%" height="260%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <path d="M126 314 L324 252 L528 205 L720 151 L924 112 L1092 110" className={styles.connectorBase} />
              {DESKTOP_CONNECTORS.map((path, index) => (
                <DesktopConnector key={path} path={path} destination={DESTINATIONS[index]} index={index} progress={progress} />
              ))}
              <motion.path d="M126 314 L324 252 L528 205 L720 151 L924 112 L1092 110" className={styles.finalPipelinePulse} pathLength="1" strokeDasharray="0.025 0.975" style={{pathOffset: finalPulseOffset, opacity: finalPulse}} />
            </motion.svg>

            <ol className={styles.desktopServiceList}>
              {SERVICES.map((service, index) => (
                <ServiceNode key={service.id} service={service} index={index} progress={progress} />
              ))}
            </ol>
          </div>

          <ol className={styles.mobilePipeline}>
            {SERVICES.map((service, index) => (
              <Fragment key={service.id}>
                <ServiceNode service={service} index={index} progress={progress} mobile />
                {index < SERVICES.length - 1 && <MobileConnector index={index} progress={progress} />}
              </Fragment>
            ))}
          </ol>

          <motion.section className={styles.testimonials} style={{opacity: testimonialsProgress, y: testimonialsY}} aria-labelledby="testimonials-heading">
            <div className={styles.testimonialHeading}>
              <span>05</span><i>—</i><h3 id="testimonials-heading">What People Say</h3>
            </div>
            <div className={styles.testimonialGrid}>
              {TESTIMONIALS.map((testimonial, index) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} index={index} progress={progress} />
              ))}
            </div>
            <div className={styles.pagination} aria-hidden="true"><span /><span /><span /><span /><span /></div>
          </motion.section>
        </div>
      </div>
    </section>
  )
}
