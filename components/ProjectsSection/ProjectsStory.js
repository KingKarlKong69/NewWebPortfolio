import dynamic from 'next/dynamic'
import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ProjectDotField from './ProjectDotField'
import ProjectTechnologyMarks from './ProjectTechnologyMarks'
import { getProjectActions } from './projectActions'
import {createProjectIdleCycle} from './projectIdleCycle'
import { projectsSkillsLayout, projectsSkillsStop, sampleProjectsSkillsStory } from './projectStoryMotion'
import SkillsExpedition from '../SkillsSection/SkillsExpedition'
import useSkillsAutoTraverse from '../SkillsSection/useSkillsAutoTraverse'
import styles from './ProjectsStory.module.css'

const Laptop = dynamic(() => import('./ProjectLaptopScene'), { ssr: false })
const clamp = value => Math.max(0, Math.min(1, value))

function MovingWords({ text, field, className }) {
  const words = text.split(/\s+/)
  return <span className={className} aria-label={text}>
    {words.map((word, index) => <span key={`${index}-${word}`} className={styles.wordMask} aria-hidden="true">
      <span data-reveal-field={field} data-word-index={index} data-word-count={words.length}>{word}</span>
    </span>)}
  </span>
}

function GlitchLetters({text}) {
  return <>{text.split('').map((letter,index)=><span key={index} style={{'--letter':index}} aria-hidden="true">{letter === ' ' ? '\u00a0' : letter}</span>)}</>
}

export default function ProjectsStory({ projects, onOpenCaseStudy, hostRef }) {
  const runwayRef = useRef(null)
  const sceneRef = useRef(null)
  const titleRef = useRef(null)
  const copyRef = useRef(null)
  const navigationRef = useRef(null)
  const skillsRef = useRef(null)
  const bridgeRef = useRef(null)
  const wakeRef = useRef(null)
  const motionRef = useRef({ ...sampleProjectsSkillsStory(0, projects.length), active: false, reducedMotion: false, scrolling: false, lastScrollAt: -Infinity })
  const [activeIndex, setActiveIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(false)
  const project = projects[activeIndex]
  const actions = getProjectActions(project)
  const layout = projectsSkillsLayout(projects.length)
  useSkillsAutoTraverse({runwayRef,motionRef,projectCount:projects.length})

  // React must commit the new word spans before the final settled frame
  // applies their reveal values, including jumps and offscreen navigation.
  useEffect(() => { wakeRef.current?.() }, [activeIndex])

  useEffect(() => {
    const runway = runwayRef.current
    const scene = sceneRef.current
    if (!runway || !scene) return undefined
    const motion = motionRef.current
    if (hostRef?.current) hostRef.current.dataset.projectsEntryHold = '100'
    // The desktop runway is dynamically mounted after hydration. Let an
    // initial #skills destination reanchor against its final geometry.
    window.dispatchEvent(new Event('portfolio:layout'))
    let disposed = false, raf = 0, previous = 0, current = 0, initialized = false
    let lastIndex = -1, lastActive = false, warmed = false
    let idleTimer=0, interacting=false
    const idleCycle=createProjectIdleCycle(projects.length)
    const wake = () => { if (!disposed && !raf && !document.hidden) raf = requestAnimationFrame(draw) }
    wakeRef.current = wake
    const draw = now => {
      raf = 0
      if (disposed) return
      const rect = runway.getBoundingClientRect()
      const stage = scene.getBoundingClientRect()
      const distance = Math.max(1, runway.offsetHeight - window.innerHeight)
      const raw = -rect.top / distance
      const arrival = clamp(-rect.top / window.innerHeight)
      const entryOpacity = arrival*arrival*(3-2*arrival)
      scene.style.opacity = String(entryOpacity)
      scene.inert = arrival < .99
      scene.style.pointerEvents = arrival < .99 ? 'none' : ''
      const target = clamp(raw)
      const visible = stage.top < window.innerHeight && stage.bottom > 0 && rect.top < window.innerHeight && rect.bottom > 0 && !document.hidden
      const near = rect.top < window.innerHeight * 2 && rect.bottom > -window.innerHeight
      if (near && !warmed) { warmed = true; setMounted(true) }
      const dt = previous ? Math.min(.06, (now - previous) / 1000) : 1 / 60
      previous = now
      if (!initialized || !visible || motion.skillsAutoControlled) current = target
      else {
        // Earlier chapters retain native scrolling. The toolset hold and
        // timed closing journey use exact samples through the branch above.
        const remaining = target-current
        current = Math.abs(remaining)<.000002 ? target : current+remaining*(1-Math.exp(-18*dt))
      }
      initialized = true
      sampleProjectsSkillsStory(current, projects.length, motion)
      motion.active = visible
      motion.reducedMotion = false
      motion.scrolling = now - motion.lastScrollAt < 260 || Math.abs(target - current) > .000012
      const present=visible&&motion.lidOpen>.999&&motion.copyOpacity>.98&&motion.copyExit<.001&&!document.querySelector('dialog[open]')
      const idle=idleCycle.sample(now,motion.projectIndex,present&&!motion.scrolling&&!interacting,motion.lastScrollAt,present)
      if(idle?.automatic){
        motion.projectIndex=idle.index;motion.screenCurrentIndex=idle.from;motion.screenNextIndex=idle.to;motion.screenMix=idle.mix
        motion.screenTransition=Math.sin(idle.mix*Math.PI)
        if(!idle.returning)for(const key of ['eyebrowReveal','titleReveal','roleReveal','stackReveal','impactReveal','actionsReveal','navReveal'])motion[key]=1
      }
      const laptopActive = visible && (motion.laptopOpacity > .001 || motion.portalOpacity > .001)
      if (laptopActive !== lastActive) { lastActive = laptopActive; setActive(laptopActive) }
      if (motion.projectIndex !== lastIndex) { lastIndex = motion.projectIndex; setActiveIndex(lastIndex) }
      scene.dataset.storyProgress = current.toFixed(5)
      scene.dataset.projectIndex = String(motion.projectIndex)
      scene.dataset.screenMix = motion.screenMix.toFixed(4)
      scene.dataset.active = String(visible)
      scene.dataset.skillsProgress = motion.skillsProgress.toFixed(5)
      scene.dataset.terrainFormation = motion.terrainFormation.toFixed(5)
      scene.dataset.expeditionProgress = motion.expeditionProgress.toFixed(5)
      scene.dataset.expeditionTravel = motion.expeditionTravel.toFixed(3)
      scene.dataset.skillsChapter = String(motion.chapterIndex)
      scene.dataset.inputControlled = String(Boolean(motion.skillsAutoControlled))
      scene.dataset.scrollTarget = target.toFixed(5)
      scene.style.setProperty('--copy-opacity', motion.copyOpacity)
      scene.style.setProperty('--copy-exit', motion.copyExit)
      if (skillsRef.current) {
        const reveal = motion.skillsIntroOpacity
        const morph = motion.introMorph
        const aiReveal = reveal*morph
        const glitch = Math.max(motion.skillsGlitch,Math.sin(morph*Math.PI)**2,
          Math.sin(motion.introHold*Math.PI)**2*.35)
        const displacement = Math.sin((morph+reveal)*87)*Math.cos(morph*41)*glitch
        skillsRef.current.style.setProperty('--skills-reveal', Math.max(reveal,aiReveal))
        skillsRef.current.style.setProperty('--tools-opacity', reveal*(1-morph))
        skillsRef.current.style.setProperty('--ai-opacity', aiReveal)
        skillsRef.current.style.setProperty('--intro-world-x', `${-Math.max(0,motion.expeditionTravel-376)*5}px`)
        skillsRef.current.style.setProperty('--glitch-x', `${displacement * 9}px`)
        skillsRef.current.style.setProperty('--glitch-split', `${glitch * 3}px`)
        skillsRef.current.style.setProperty('--glitch-band', `${Math.round(reveal * 7) % 4 * 20}%`)
        skillsRef.current.style.setProperty('--glitch-opacity', glitch * .8)
        skillsRef.current.setAttribute('aria-hidden', String(Math.max(reveal,aiReveal) < .1))
        skillsRef.current.querySelector('[data-intro-tools]')?.setAttribute('aria-hidden',String(reveal*(1-morph)<.1))
        skillsRef.current.querySelector('[data-intro-ai]')?.setAttribute('aria-hidden',String(aiReveal<.1))
      }
      if(bridgeRef.current) {
        bridgeRef.current.style.setProperty('--whiteout',motion.whiteout)
        // The real Services scene now supplies the receiving universe/title.
        // Crossfade the white frame into it instead of holding an empty sky.
        bridgeRef.current.style.opacity=String(motion.whiteout)
      }
      if(hostRef?.current){
        hostRef.current.style.opacity=String(1-motion.servicesReveal)
        const covered = arrival < .99 || motion.servicesReveal > .99
        hostRef.current.style.pointerEvents=covered?'none':'auto'
        hostRef.current.inert=covered
      }
      scene.style.setProperty('--exit-light', motion.exitLight)
      titleRef.current.style.setProperty('--title-scale', motion.titleScale)
      titleRef.current.style.setProperty('--title-tracking', `${motion.titleTracking}em`)
      titleRef.current.style.setProperty('--title-y', `${motion.titleY * 100}vh`)
      titleRef.current.style.opacity = String(motion.titleOpacity)
      titleRef.current.setAttribute('aria-hidden', String(motion.titleOpacity < .1))
      copyRef.current?.querySelectorAll('[data-reveal-field]').forEach(node => {
        const field = node.dataset.revealField
        const value = motion[field] || 0
        const count = Number(node.dataset.wordCount || 1)
        const index = Number(node.dataset.wordIndex || 0)
        const spread = count > 1 ? .36 : 0
        const reveal = clamp((value - index / Math.max(1, count - 1) * spread) / (1 - spread))
        node.style.setProperty('--reveal', reveal.toFixed(5))
        node.setAttribute('aria-hidden', String(reveal < .01))
      })
      const actions = copyRef.current?.querySelector('[data-project-actions]')
      if (actions) actions.inert = !visible || motion.actionsReveal < .92 || motion.copyOpacity < .8
      if (copyRef.current) {
        copyRef.current.setAttribute('aria-hidden', String(motion.copyOpacity < .05))
      }
      if (navigationRef.current) {
        navigationRef.current.style.setProperty('--reveal', motion.navReveal)
        navigationRef.current.inert = !visible || motion.navReveal < .9 || motion.copyOpacity < .8
      }
      window.dispatchEvent(new Event('projects:motion'))
      clearTimeout(idleTimer)
      if (visible && (Math.abs(target-current)>.000002 || motion.scrolling || idle?.nextWake===0)) wake()
      else if(idle&&Number.isFinite(idle.nextWake))idleTimer=setTimeout(wake,idle.nextWake)
    }
    const visibility = () => {
      previous = 0
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf)
        raf = 0
        motion.active = false
        setActive(false)
        lastActive = false
      } else {
        wake()
      }
    }
    const onScroll = () => {
      // Raw input pauses a gallery immediately, before the smoothed story
      // catches up. The screen can resume after the gesture has settled.
      motion.scrolling = true
      motion.lastScrollAt = performance.now()
      window.dispatchEvent(new Event('projects:motion'))
      wake()
    }
    const input=()=>{motion.lastScrollAt=performance.now();clearTimeout(idleTimer);wake()}
    const enter=()=>{interacting=true;wake()}
    const leave=()=>{interacting=false;wake()}
    copyRef.current?.addEventListener('pointerenter',enter)
    copyRef.current?.addEventListener('pointerleave',leave)
    copyRef.current?.addEventListener('focusin',enter)
    const blur=event=>{if(!copyRef.current?.contains(event.relatedTarget))leave()}
    copyRef.current?.addEventListener('focusout',blur)
    window.addEventListener('wheel',input,{passive:true})
    window.addEventListener('touchstart',input,{passive:true})
    window.addEventListener('keydown',input)
    const intersection = new IntersectionObserver(wake, { rootMargin: '100% 0px', threshold: 0 })
    intersection.observe(scene)
    const resize = new ResizeObserver(wake)
    resize.observe(runway)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', wake)
    document.addEventListener('visibilitychange', visibility)
    wake()
    return () => {
      disposed = true
      clearTimeout(idleTimer)
      window.removeEventListener('wheel',input)
      window.removeEventListener('touchstart',input)
      window.removeEventListener('keydown',input)
      copyRef.current?.removeEventListener('pointerenter',enter)
      copyRef.current?.removeEventListener('pointerleave',leave)
      copyRef.current?.removeEventListener('focusin',enter)
      copyRef.current?.removeEventListener('focusout',blur)
      cancelAnimationFrame(raf)
      intersection.disconnect()
      resize.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', wake)
      document.removeEventListener('visibilitychange', visibility)
      if (wakeRef.current === wake) wakeRef.current = null
      motion.active = false
      if(hostRef?.current){
        hostRef.current.style.removeProperty('opacity')
        delete hostRef.current.dataset.projectsEntryHold
        hostRef.current.style.removeProperty('pointer-events')
        hostRef.current.inert=false
      }
    }
  }, [projects,hostRef])

  const select = index => {
    const runway = runwayRef.current
    const top = window.scrollY + runway.getBoundingClientRect().top
    const distance = Math.max(1, runway.offsetHeight - window.innerHeight)
    window.scrollTo({ top: top + distance * projectsSkillsStop(index, projects.length), behavior: 'smooth' })
  }

  return <div ref={runwayRef} className={styles.runway} style={{ height: `${layout.height}svh` }} data-projects-story
    data-nav-progress={layout.projectsEnd*.15} data-services-overlap={layout.servicesOverlap} data-services-entry-hold={layout.servicesEntryHold}>
    <section id="skills" className={styles.skillsAnchor} style={{ top: `${(layout.height - 100) * layout.skillsStop}svh` }} aria-label="Skills and technologies" />
    <div ref={sceneRef} className={styles.scene} data-active="false">
      <ProjectDotField sceneRef={sceneRef} motionRef={motionRef} />
      <h2 ref={titleRef} className={styles.openingTitle} id="projects-heading">PROJECTS</h2>
      <div className={styles.laptop} aria-hidden="true">
        <Laptop projects={projects} activeIndex={activeIndex} active={active} mounted={mounted} reducedMotion={false} story motionRef={motionRef} />
      </div>
      <article ref={copyRef} className={styles.copy} aria-labelledby={`story-project-title-${project.id}`}>
        <p className={styles.eyebrow} data-reveal-field="eyebrowReveal"><span>{project.number}</span> {project.eyebrow}</p>
        <h3 id={`story-project-title-${project.id}`} aria-label={project.title}><MovingWords text={project.title} field="titleReveal" /></h3>
        <dl className={styles.facts}>
          <div className={styles.fact} data-reveal-field="roleReveal"><dt>ROLE</dt><dd>{project.role || 'Project role pending'}</dd></div>
          <div className={styles.fact} data-reveal-field="stackReveal"><dt>TECH STACK</dt><dd><ProjectTechnologyMarks technologies={project.technologies} className={styles.technologies} /></dd></div>
          <div className={styles.fact} data-reveal-field="impactReveal"><dt>IMPACT</dt><dd>{project.impact || 'Impact details pending'}</dd></div>
        </dl>
        <div className={styles.actions} data-project-actions data-reveal-field="actionsReveal">
          {actions.map((action, index) => <span className={styles.actionItem} key={`${action.type}-${index}`}>
            {index > 0 && <span className={styles.actionDivider} aria-hidden="true">|</span>}
            {action.href
              ? <a href={action.href} target="_blank" rel="noopener noreferrer" aria-label={`${action.label}: ${project.title}`}>{action.label}</a>
              : <button type="button" onClick={() => onOpenCaseStudy(project)} aria-label={`${action.label}: ${project.title}`}>{action.label}</button>}
          </span>)}
          {actions.length > 0 && <ArrowRight size={24} aria-hidden="true" />}
        </div>
        <nav ref={navigationRef} className={styles.projectNavigation} aria-label="Project chapters">
          {projects.map((item, index) => <button key={item.id} type="button" aria-label={`Scroll to project ${item.number}: ${item.title}`} aria-current={activeIndex === index ? 'step' : undefined} onClick={() => select(index)}>{item.number}</button>)}
        </nav>
      </article>
      <div ref={skillsRef} className={styles.skillsCopy} aria-hidden="true" data-skills-intro>
        <div data-intro-tools className={styles.introTools}>
        <p className={styles.skillsEyebrow}>// SKILLS &amp; TECHNOLOGIES</p>
        <h2 id="skills-heading" aria-label="Tools that turn ideas into reality" data-glitch-text="TOOLS THAT TURN IDEAS INTO REALITY"><GlitchLetters text="TOOLS THAT" /><br /><GlitchLetters text="TURN IDEAS" /><br /><GlitchLetters text="INTO " /><em><GlitchLetters text="REALITY" /></em></h2>
        <p className={styles.skillsDescription}>A modern and evolving stack I use to build, design, and deploy digital experiences. Always learning, always exploring.</p>
        <p className={styles.skillsMantra}>LEARN<br />BUILD<br />IMPROVE<br />REPEAT <span aria-hidden="true" /></p>
        </div>
        <div data-intro-ai className={styles.introAi} aria-hidden="true">
          <p className={styles.skillsEyebrow}>// IDEAS TO IMPLEMENTATION</p>
          <h2 aria-label="AI-assisted development" data-glitch-text="AI-ASSISTED DEVELOPMENT"><GlitchLetters text="AI-ASSISTED" /><br /><em><GlitchLetters text="DEVELOPMENT" /></em></h2>
          <p className={styles.skillsDescription}>I use AI to explore ideas, understand unfamiliar concepts, accelerate repetitive work, and build beyond my current limitations.</p>
        </div>
      </div>
      <SkillsExpedition motionRef={motionRef} sceneRef={sceneRef} />
      <div className={styles.exitAtmosphere} aria-hidden="true" />
      <div ref={bridgeRef} className={styles.servicesBridge} aria-hidden="true"><div className={styles.whiteout} /></div>
    </div>
  </div>
}
