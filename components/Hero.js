import Image from 'next/image'
import { ArrowDown, ArrowRight, ChevronDown } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { useActiveNavSection } from './navigationState'
import { useHeroActivity, useHeroParallax, useHeroTypewriter } from './useHeroScene'
import HeroGrid from './HeroGrid'
import styles from './Hero.module.css'

const HeroAsteroids = dynamic(() => import('./HeroAsteroids'), { ssr: false })
const TechCore = dynamic(() => import('./TechCore'), { ssr: false })

// Deterministic positions keep server and client markup identical.
const particles = Array.from({ length: 66 }, (_, index) => ({
  x: ((index * 73 + 19) % 997) / 10,
  y: ((index * 137 + 47) % 983) / 10,
  size: index % 11 === 0 ? 5 : index % 4 === 0 ? 3 : 1.5,
  delay: -(index % 13),
  duration: 5 + index % 7,
  driftDuration: 32 + index % 37,
  driftX: (index % 2 ? 1 : -1) * (28 + index * 17 % 95),
  driftY: -(45 + index * 23 % 115)
}))

function HeroRole({ active, reducedMotion }) {
  const role = useHeroTypewriter(active, reducedMotion)
  return (
    <p className={styles.role} aria-label={role.role} data-role-index={role.index}>
      <span className={styles.roleDot} aria-hidden="true" />
      <span className={styles.roleText} aria-hidden="true">{role.text}<i className={styles.typeCursor} /></span>
    </p>
  )
}

export default function Hero() {
  const sectionRef = useRef(null)
  const portraitRef = useRef(null)
  const shineTimers = useRef(new Set())
  const { active, reducedMotion } = useHeroActivity(sectionRef)
  useHeroParallax(portraitRef, active, reducedMotion)
  const { navigateToSection } = useActiveNavSection()
  useEffect(() => () => shineTimers.current.forEach(clearTimeout), [])
  const followSection = (event, section) => {
    event.preventDefault()
    navigateToSection(section)
  }
  const positionShine = event => {
    const button = event.currentTarget
    const bounds = button.getBoundingClientRect()
    button.style.setProperty('--shine-x', `${(event.clientX - bounds.left) / bounds.width * 100}%`)
    button.style.setProperty('--shine-y', `${(event.clientY - bounds.top) / bounds.height * 100}%`)
  }
  const touchShine = event => {
    positionShine(event)
    const button = event.currentTarget
    button.dataset.shining = 'true'
    const timer = setTimeout(() => { delete button.dataset.shining; shineTimers.current.delete(timer) }, 800)
    shineTimers.current.add(timer)
  }

  return (
    <section ref={sectionRef} id="home" className={styles.hero} aria-labelledby="hero-heading" data-hero-active={active}>
      <div className={styles.space} aria-hidden="true">
        <div className={styles.outlineName}>
          <span>KARL</span><span>LOPEZ</span>
        </div>
        <div className={styles.particles}>
          {particles.map((particle, index) => (
            <i key={index} style={{
              left: `${particle.x}%`, top: `${particle.y}%`,
              '--particle-size': `${particle.size}px`,
              '--particle-delay': `${particle.delay}s`,
              '--particle-duration': `${particle.duration}s`,
              '--drift-duration': `${particle.driftDuration}s`,
              '--drift-x': `${particle.driftX}px`,
              '--drift-y': `${particle.driftY}px`
            }}><b /></i>
          ))}
        </div>
        <span className={`${styles.bokeh} ${styles.bokehOne}`} />
        <span className={`${styles.bokeh} ${styles.bokehTwo}`} />
        <span className={`${styles.bokeh} ${styles.bokehThree}`} />
        <HeroGrid className={styles.grid} />
        <span className={styles.leftBeam} /><span className={styles.rightBeam} />
      </div>

      <HeroAsteroids layer="background" className={styles.backgroundRocks} />

      <div ref={portraitRef} className={styles.portrait} data-hero-portrait="true">
        <Image
          src="/ProfessionalMe2.png"
          alt="Karl Lopez holding a glowing holographic core"
          width={1122} height={1402} priority
          sizes="(max-width: 600px) 100vw, (max-width: 1100px) 82vw, 48vw"
          className={styles.portraitImage}
        />
        <div className={styles.portraitLighting} aria-hidden="true" />
        <div className={styles.core} data-hero-core="true">
          <TechCore anchored />
        </div>
      </div>

      <div className={styles.copy}>
        <HeroRole active={active} reducedMotion={reducedMotion} />
        <h1 id="hero-heading" className={styles.name} aria-label="Karl Lopez"><span>KARL</span><span>LOPEZ</span></h1>
        <p className={styles.description}>
          <span>I turn ideas into working</span>{' '}
          <span>applications, constantly</span>{' '}
          <span>learning, experimenting,</span>{' '}
          <span>and finding better ways</span>{' '}
          <span>to build with AI.</span>
        </p>
        <div className={styles.actions}>
          <a href="#projects" className={styles.primaryButton} onPointerMove={positionShine} onPointerDown={touchShine} onClick={(event) => followSection(event, 'projects')}>
            <span>View My Work</span> <ArrowRight aria-hidden="true" strokeWidth={1.5} />
          </a>
          <a href="#about" className={styles.secondaryButton} onPointerMove={positionShine} onPointerDown={touchShine} onClick={(event) => followSection(event, 'about')}><span>About Me</span></a>
        </div>
      </div>

      <HeroAsteroids layer="foreground" className={styles.foregroundRocks} />

      <a href="#about" className={styles.scrollCue} onClick={(event) => followSection(event, 'about')}>
        <span className={styles.mouse} aria-hidden="true"><i /></span>
        <ChevronDown className={styles.scrollChevron} aria-hidden="true" strokeWidth={1.5} />
        <span>Scroll to Explore</span>
        <ArrowDown className={styles.scrollArrow} aria-hidden="true" size={13} />
      </a>
    </section>
  )
}
