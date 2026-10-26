import dynamic from 'next/dynamic'
import {Component, useEffect, useRef, useState} from 'react'
import ServicesParticleField from './ServicesParticleField'
import {sampleServicesStory,sampleServicesJourney} from './serviceTransitionMotion'
import {LAB_DEFAULTS} from '../ContactSection/blackHoleLabControls'
import {getFooterBlackHoleValues, subscribeFooterBlackHolePreset} from '../ContactSection/footerBlackHolePreset'
import styles from './SpaceJourney.module.css'

const SpaceSky = dynamic(()=>import('./SpaceSky'), {ssr:false})
class SkyBoundary extends Component {
  state = {failed:false}
  static getDerivedStateFromError() { return {failed:true} }
  render() { return this.state.failed ? null : this.props.children }
}

export default function SpaceJourney({children}) {
  const rootRef = useRef(null), viewportRef = useRef(null)
  const motionRef = useRef({travelX:0,travelY:0,pointerX:0,pointerY:0,gravity:0,lensX:0,lensY:0,lensRadius:.34})
  const [near,setNear] = useState(false), [active,setActive] = useState(false)
  useEffect(()=>{
    const root=rootRef.current
    const services=root.querySelector('#services')
    const media=matchMedia('(min-width:1101px) and (prefers-reduced-motion:no-preference)')
    const update=()=>{
      const runway=media.matches?document.querySelector('[data-projects-story]'):null
      const overlap=Number(runway?.dataset.servicesOverlap||0)
      const hold=Number(runway?.dataset.servicesEntryHold||0)
      root.style.setProperty('--services-overlap',`${overlap}svh`)
      root.style.setProperty('--services-entry-hold',`${hold}svh`)
      if(services)services.dataset.servicesEntryHold=String(hold)
      dispatchEvent(new Event('services:handoff-layout'))
    }
    update()
    addEventListener('portfolio:layout',update);addEventListener('resize',update)
    media.addEventListener('change',update)
    return()=>{
      removeEventListener('portfolio:layout',update);removeEventListener('resize',update)
      media.removeEventListener('change',update)
    }
  },[])
  useEffect(()=>{
    const observer = new IntersectionObserver(([entry])=>{
      setActive(entry.isIntersecting)
      if(entry.isIntersecting)setNear(true)
    },{rootMargin:'30% 0px'})
    observer.observe(rootRef.current)
    return ()=>observer.disconnect()
  },[])
  useEffect(()=>{
    let frame = 0
    let preset = getFooterBlackHoleValues()
    const root = rootRef.current
    const services = root.querySelector('#services')
    const contact = root.querySelector('#contact')
    const scene = root.querySelector('[data-contact-sky]')
    const update = ()=>{
      frame = 0
      const motion = motionRef.current
      const progress = Number(services?.dataset.servicesProgress || 0)
      const story = sampleServicesStory(progress)
      const journey = sampleServicesJourney(Number(services?.dataset.servicesJourney||0))
      const arrival = Number(contact?.dataset.contactArrival || 0)
      motion.suppressAsteroids=arrival>.01
      motion.entrance=contact?.__contactEntranceState||null
      const frameBounds=contact?.querySelector('[data-contact-frame]')?.getBoundingClientRect()
      motion.entranceBounds=frameBounds?[frameBounds.left/innerWidth,1-frameBounds.bottom/innerHeight,frameBounds.width/innerWidth,frameBounds.height/innerHeight]:[0,0,1,1]
      motion.travelX = -story.camera[0]*.002 - journey.camera[0]*.065 - arrival*.006
      motion.travelY = story.camera[1]*.002 + journey.camera[1]*.065 + arrival*.004
      const bounds = scene?.getBoundingClientRect()
      if(bounds && bounds.width>0 && bounds.height>0) {
        const mobile = contact.dataset.contactQuality==='mobile'
        motion.lensX = ((bounds.left+bounds.width*(mobile?.5:.69))/innerWidth)*2-1
        motion.lensY = 1-((bounds.top+bounds.height*(1-(mobile?.54:.585)))/innerHeight)*2
        motion.lensRadius = 2*(preset?.coreRadius ?? LAB_DEFAULTS.coreRadius)/3.05*bounds.height/innerHeight
        motion.viewScale = bounds.height/innerHeight
        motion.gravity = motion.entrance?motion.entrance.lensing:arrival*arrival*(3-2*arrival)
      }
    }
    const schedule = ()=>{if(!frame)frame=requestAnimationFrame(update)}
    const pointer = event=>{
      motionRef.current.pointerX = event.clientX/innerWidth*2-1
      motionRef.current.pointerY = 1-event.clientY/innerHeight*2
    }
    const leave = ()=>{motionRef.current.pointerX=0;motionRef.current.pointerY=0}
    const unsubscribe = subscribeFooterBlackHolePreset(()=>{preset=getFooterBlackHoleValues();schedule()})
    // Dataset changes include scroll smoothing, responsive layout and direct Contact links.
    const observer = new MutationObserver(schedule)
    if(services)observer.observe(services,{attributes:true,attributeFilter:['data-services-progress','data-services-journey']})
    if(contact)observer.observe(contact,{attributes:true,attributeFilter:['data-contact-arrival','data-contact-quality']})
    addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true})
    addEventListener('contact:entrance',schedule)
    root.addEventListener('pointermove',pointer,{passive:true});root.addEventListener('pointerleave',leave)
    update()
    return ()=>{
      cancelAnimationFrame(frame);observer.disconnect();unsubscribe()
      removeEventListener('scroll',schedule);removeEventListener('resize',schedule)
      removeEventListener('contact:entrance',schedule)
      root.removeEventListener('pointermove',pointer);root.removeEventListener('pointerleave',leave)
    }
  },[])
  return <div ref={rootRef} className={styles.journey}>
    <div className={styles.background} aria-hidden="true"><div ref={viewportRef} className={styles.viewport}>
      <div className={styles.fallback}><ServicesParticleField/></div>
      {near&&<SkyBoundary><SpaceSky active={active} motionRef={motionRef} viewportRef={viewportRef}/></SkyBoundary>}
    </div></div>
    <div className={styles.content}>{children}</div>
  </div>
}
