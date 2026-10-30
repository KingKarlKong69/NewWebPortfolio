import dynamic from 'next/dynamic'
import {ArrowLeft, ArrowUpRight} from 'lucide-react'
import {Component, useEffect, useRef, useState} from 'react'
import {SERVICES} from './servicesData'
import {sampleServicesStory,sampleServicesJourney,servicePanelView,SERVICE_DESTINATIONS} from './serviceTransitionMotion'
import ContributionField from './ContributionField'
import TestimonialDeck from './TestimonialDeck'
import styles from './ServicesExperience.module.css'

const ServicesScene=dynamic(()=>import('./ServicesScene'),{ssr:false})
const MobileServicesStory=dynamic(()=>import('./MobileServicesStory'),{ssr:false})
class SpaceBoundary extends Component {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(){this.props.onFailure?.()}
  render(){return this.state.failed?null:this.props.children}
}

function ServiceDeck({deckRef,selected,onSelect,interactive=true,cinematic=false}){
  const backRef=useRef(null), triggerRefs=useRef([])
  useEffect(()=>{if(selected!==null)backRef.current?.focus({preventScroll:true})},[selected])
  function close(){const index=selected;onSelect(null);requestAnimationFrame(()=>triggerRefs.current[index]?.focus({preventScroll:true}))}
  return <div ref={deckRef} className={styles.deck} data-forming={cinematic&&!interactive?'true':'false'} data-expanded={selected!==null?'true':'false'} aria-hidden={cinematic&&!interactive} aria-label="Explore the five services" onKeyDown={event=>{if(event.key==='Escape'&&selected!==null){event.preventDefault();close()}}}>
    <div className={styles.columns}>
      {SERVICES.map((service,index)=><div key={service.id} className={styles.column} data-service-column={index} data-selected={selected===index?'true':'false'} data-other={selected!==null&&selected!==index?'true':'false'}>
        <img className={styles.artwork} src={service.image} alt="" draggable="false" loading="eager"/><span className={styles.shade}/>
        <button ref={element=>{triggerRefs.current[index]=element}} type="button" className={styles.columnButton} aria-label={`Explore ${service.title}`} aria-expanded={selected===index} tabIndex={interactive&&selected===null?0:-1} onClick={()=>onSelect(index)} disabled={!interactive||selected!==null}>
          <span className={styles.number}><span>{service.number}</span><small className={styles.serviceLabel} aria-hidden="true">{[...'SERVICE'].map((letter,index)=><span key={index}>{letter}</span>)}</small></span><span className={styles.columnName}>{service.title}</span><ArrowUpRight className={styles.columnArrow} size={24}/>
        </button>
        <div className={styles.serviceDetail} aria-hidden={selected!==index}>
          {selected===index&&<button ref={backRef} type="button" className={styles.back} onClick={close} aria-label="Back to all five services"><ArrowLeft size={38}/><span>All services</span></button>}
          <span className={styles.detailNumber}>{service.number}</span><div className={styles.detailCopy}><p>{service.description}</p><h3>{service.title}</h3></div>
        </div>
      </div>)}
    </div>
    <p className={styles.deckHint}>{selected===null?'Choose a service to explore':'Scroll to continue exploring'}<span>↓</span></p>
  </div>
}

export default function ServicesSection(){
  const sectionRef=useRef(null),storyRef=useRef(null),deckRef=useRef(null),titleRef=useRef(null),progressRef=useRef(null)
  const activityRef=useRef(null),testimonialsRef=useRef(null),hintRef=useRef(null)
  const motionRef=useRef({progress:0,pointerX:0,pointerY:0,storyVisible:true,testimonialY:3})
  const [desktop,setDesktop]=useState(false),[active,setActive]=useState(false),[seen,setSeen]=useState(false),[sceneFailed,setSceneFailed]=useState(false),[selected,setSelected]=useState(null),[interactive,setInteractive]=useState(false)
  const [gameActive,setGameActive]=useState(false),gameActiveRef=useRef(false)
  const [mobileStory,setMobileStory]=useState(false)
  const cinematic=desktop&&!sceneFailed
  const interactiveRef=useRef(false)
  const selectedRef=useRef(null)
  const selectService=index=>{selectedRef.current=index;setSelected(index)}
  useEffect(()=>{
    const media=matchMedia('(min-width:1101px) and (prefers-reduced-motion:no-preference)')
    const mobile=matchMedia('(max-width:1100px) and (prefers-reduced-motion:no-preference)')
    const configure=()=>{setDesktop(media.matches);setMobileStory(mobile.matches)};configure();media.addEventListener('change',configure);mobile.addEventListener('change',configure)
    return()=>{media.removeEventListener('change',configure);mobile.removeEventListener('change',configure)}
  },[])
  useEffect(()=>{
    const root=sectionRef.current;if(!root)return
    const observer=new IntersectionObserver(([entry])=>{setActive(entry.isIntersecting);if(entry.isIntersecting)setSeen(true)},{rootMargin:'10% 0px'})
    observer.observe(root);return()=>observer.disconnect()
  },[])
  useEffect(()=>{
    if(!cinematic)return
    let idle=0
    const hide=()=>{if(hintRef.current)hintRef.current.dataset.scrolling='false'}
    const scroll=()=>{
      clearTimeout(idle)
      const rect=storyRef.current?.getBoundingClientRect()
      // The hint belongs to the pinned Services viewport, including its final
      // testimonial stop. Do not leave it visible during entry or departure.
      const inside=rect&&rect.top<=1&&rect.bottom>innerHeight+1
      if(hintRef.current)hintRef.current.dataset.scrolling=inside?'true':'false'
      if(inside)idle=setTimeout(hide,900)
    }
    const visibility=()=>{if(document.hidden){clearTimeout(idle);hide()}}
    addEventListener('scroll',scroll,{passive:true})
    document.addEventListener('visibilitychange',visibility)
    hide()
    return()=>{clearTimeout(idle);removeEventListener('scroll',scroll);document.removeEventListener('visibilitychange',visibility);hide()}
  },[cinematic])
  useEffect(()=>{
    if(!cinematic){
      interactiveRef.current=true
      setInteractive(true)
      if(deckRef.current){deckRef.current.inert=false;deckRef.current.style.setProperty('--deck-handoff','1')}
      return
    }
    let frame=0,last=0,current=null
    function update(now){
      frame=0;if(document.hidden)return
      const rect=storyRef.current?.getBoundingClientRect(),root=sectionRef.current;if(!rect||!root)return
      const entryHold=Number(root.dataset.servicesEntryHold||0)*innerHeight/100
      const target=Math.max(0,Math.min(1,(-rect.top-entryHold)/Math.max(1,rect.height-innerHeight-entryHold)))
      const dt=Math.min(.05,(now-(last||now))/1000);last=now
      current=current===null?target:current+(target-current)*(1-Math.exp(-dt/.085))
      if(Math.abs(current-target)<.00001)current=target
      const journey=sampleServicesJourney(current),state=sampleServicesStory(journey.storyProgress)
      motionRef.current.progress=journey.storyProgress;motionRef.current.journeyProgress=current
      motionRef.current.journey=journey;motionRef.current.storyVisible=rect.bottom>0&&rect.top<innerHeight
      const projectPanel=(element,destination,enabled,eligible)=>{
        if(!element)return
        const view=servicePanelView(destination,journey.camera,innerWidth/innerHeight)
        element.style.transform=`translate3d(${view.x*50}vw,${view.y*50}svh,0) scale(${view.scale})`
        const onScreen=eligible&&Math.abs(view.x)<2.8&&Math.abs(view.y)<2.8
        element.style.visibility=onScreen?'visible':'hidden'
        element.style.pointerEvents=enabled?'auto':'none';element.inert=!enabled
        element.setAttribute('aria-hidden',String(!enabled))
      }
      projectPanel(activityRef.current,SERVICE_DESTINATIONS.contributions,journey.contributionActive,current>.69&&current<.95)
      projectPanel(testimonialsRef.current,SERVICE_DESTINATIONS.testimonials,journey.testimonialActive,current>.88)
      const title=titleRef.current?.getBoundingClientRect()
      motionRef.current.testimonialY=title?(title.top+title.height/2)/innerHeight:3
      motionRef.current.testimonialRect=title?{x:(title.left+title.width/2)/innerWidth,y:(title.top+title.height/2)/innerHeight,width:title.width/innerWidth}:null
      root.dataset.servicesProgress=journey.storyProgress.toFixed(4);root.dataset.servicesPhase=journey.phase==='story'?state.phase:journey.phase
      root.dataset.servicesJourney=current.toFixed(4)
      if(progressRef.current)progressRef.current.style.transform=`scaleX(${current})`
      if(deckRef.current){
        deckRef.current.style.visibility=journey.storyProgress>.745&&journey.exit<1?'visible':'hidden'
        deckRef.current.style.transform='none'
        deckRef.current.style.setProperty('--deck-handoff',String(journey.domDeck))
        deckRef.current.dataset.forming=journey.deckInteractive?'false':'true'
        deckRef.current.inert=!journey.deckInteractive
      }
      if(!journey.deckInteractive&&selectedRef.current!==null){selectedRef.current=null;setSelected(null)}
      const enabled=journey.deckInteractive
      if(enabled!==interactiveRef.current){interactiveRef.current=enabled;setInteractive(enabled)}
      if(journey.contributionActive!==gameActiveRef.current){gameActiveRef.current=journey.contributionActive;setGameActive(journey.contributionActive)}
      if(Math.abs(current-target)>.00001)frame=requestAnimationFrame(update)
    }
    const wake=()=>{if(!frame)frame=requestAnimationFrame(update)}
    const pointer=event=>{motionRef.current.pointerX=event.clientX/innerWidth*2-1;motionRef.current.pointerY=event.clientY/innerHeight*2-1}
    const leave=()=>{motionRef.current.pointerX=0;motionRef.current.pointerY=0}
    addEventListener('scroll',wake,{passive:true});addEventListener('resize',wake,{passive:true});addEventListener('services:handoff-layout',wake);document.addEventListener('visibilitychange',wake)
    const root=sectionRef.current;root?.addEventListener('pointermove',pointer,{passive:true});root?.addEventListener('pointerleave',leave);wake()
    return()=>{cancelAnimationFrame(frame);removeEventListener('scroll',wake);removeEventListener('resize',wake);removeEventListener('services:handoff-layout',wake);document.removeEventListener('visibilitychange',wake);root?.removeEventListener('pointermove',pointer);root?.removeEventListener('pointerleave',leave)}
  },[cinematic,active])
  const contributionPanel=<div ref={activityRef} className={styles.activity}><ContributionField active={seen} playActive={!cinematic||gameActive}/></div>
  const testimonialPanel=<div ref={testimonialsRef} className={styles.testimonials}><div ref={titleRef} className={styles.testimonialTitle}><h2 className={cinematic?styles.accessibleTitle:undefined}>WHAT PEOPLE SAY</h2></div><TestimonialDeck/></div>
  return <section ref={sectionRef} id="services" className={styles.section} data-cinematic={cinematic?'true':'false'} aria-labelledby="services-heading">
    {mobileStory?<MobileServicesStory/>:<>
    <div className={styles.universe} aria-hidden="true">{cinematic&&seen&&<SpaceBoundary onFailure={()=>setSceneFailed(true)}><ServicesScene motionRef={motionRef} active={active} deckRef={deckRef} onFailure={()=>setSceneFailed(true)}/></SpaceBoundary>}</div>
    <div ref={storyRef} className={styles.story}><div className={styles.stage}>
      <h2 id="services-heading" className={styles.accessibleTitle}>Services — What I offer</h2>
      {!cinematic&&<header className={styles.staticHeader}><span>// SERVICES</span><h2>WHAT I OFFER</h2></header>}
      <ServiceDeck deckRef={deckRef} selected={selected} onSelect={selectService} interactive={interactive} cinematic={cinematic}/>
      {cinematic&&<div ref={hintRef} className={styles.journeyHint} aria-hidden="true"><span>04 / SERVICES</span><span>SCROLL TO EXPLORE <i>↓</i></span><div><span ref={progressRef}/></div></div>}
      {cinematic&&contributionPanel}
      {cinematic&&testimonialPanel}
    </div></div>
    {!cinematic&&contributionPanel}
    {!cinematic&&testimonialPanel}
    <div className={styles.departure} aria-hidden="true"/>
    </>}
  </section>
}
