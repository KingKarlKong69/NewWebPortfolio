import dynamic from 'next/dynamic'
import Image from 'next/image'
import {useEffect,useRef,useState} from 'react'
import {BIOGRAPHY} from './aboutBiography'
import {JOURNEY_INTRO,JOURNEY_MEMORIES} from './journeyMemories'
import JourneyMemoryBackdrop from './JourneyMemoryBackdrop'
import {MOBILE_ABOUT_TRAVEL,sampleMobileAbout} from './mobileAboutMotion'
import styles from './MobileAboutStory.module.css'

const MobileJourneyCore=dynamic(()=>import('./MobileJourneyCore'),{ssr:false})

function StaticAbout() {
  return <div className={styles.staticStory}>
    <p className={styles.label}>Beyond the code</p><h2>Here’s how<br/>I got here.</h2>
    <p className={styles.label}>BACKGROUND</p><h2>A little<br/>about me.</h2>
    <Image src="/Me2.png" width={941} height={1672} alt="Karl Lopez standing with folded arms" sizes="80vw"/>
    {BIOGRAPHY.map(text=><p key={text}>{text}</p>)}
    <h2>MY JOURNEY</h2><p>{JOURNEY_INTRO}</p>
    {JOURNEY_MEMORIES.map(memory=><article key={memory.year}><h3>{memory.title}<br/>{memory.year}</h3><p>{memory.description}</p><Image src={memory.images[0]} width={800} height={800} alt={`A memory from ${memory.year}`} sizes="100vw"/></article>)}
  </div>
}

export default function MobileAboutStory() {
  const runwayRef=useRef(null),stageRef=useRef(null),frameRef=useRef(sampleMobileAbout(0))
  const [reduced,setReduced]=useState(false),[coreMounted,setCoreMounted]=useState(false),[coreActive,setCoreActive]=useState(false)
  const [bioIndex,setBioIndex]=useState(0),[memoryIndex,setMemoryIndex]=useState(0),[source,setSource]=useState(JOURNEY_MEMORIES[0].images[0])
  const [photoPlaying,setPhotoPlaying]=useState(false)
  const photoIndices=useRef([0,0,0,0,0])
  useEffect(()=>{setSource(JOURNEY_MEMORIES[memoryIndex].images[photoIndices.current[memoryIndex]])},[memoryIndex])
  useEffect(()=>{
    const images=JOURNEY_MEMORIES[memoryIndex].images
    if(!photoPlaying||reduced)return
    const timer=setInterval(()=>{
      const next=(photoIndices.current[memoryIndex]+1)%images.length
      photoIndices.current[memoryIndex]=next;setSource(images[next])
    },3600)
    return()=>clearInterval(timer)
  },[memoryIndex,photoPlaying,reduced])
  useEffect(()=>{
    const query=matchMedia('(prefers-reduced-motion: reduce)')
    const sync=()=>setReduced(query.matches)
    sync();query.addEventListener('change',sync)
    return()=>query.removeEventListener('change',sync)
  },[])
  useEffect(()=>{
    if(reduced)return
    const runway=runwayRef.current,stage=stageRef.current
    if(!runway||!stage)return
    let raf=0,visible=false,disposed=false
    const draw=()=>{
      raf=0
      if(disposed)return
      const rect=runway.getBoundingClientRect()
      const sample=sampleMobileAbout(-rect.top/Math.max(1,runway.offsetHeight-stage.offsetHeight))
      Object.assign(frameRef.current,sample)
      const vars={
        '--background-opacity':sample.backgroundOpacity,'--opening-opacity':sample.openingOpacity,
        '--copy-opacity':sample.copyOpacity,'--portrait-dock':sample.portraitDock,'--portrait-mix':sample.portraitMix,
        '--journey-title-opacity':sample.journeyTitleOpacity,'--journey-title-dock':sample.journeyTitleDock,
        '--journey-intro-opacity':sample.journeyIntroOpacity,'--line-opacity':sample.lineOpacity,
        '--line-start':`${sample.lineStart*100}%`,'--line-height':`${sample.lineHeight*100}%`,'--memory-opacity':sample.memoryOpacity,
        '--intro-opacity':sample.introOpacity,'--intro-rise':sample.introRise,'--underline-progress':sample.underlineProgress,
        '--bio-0':sample.biography[0],'--bio-1':sample.biography[1],'--bio-2':sample.biography[2],
        '--core-x':`${sample.coreX*100}%`,'--core-y':`${sample.coreY*100}%`,
      }
      for(const [key,value] of Object.entries(vars))stage.style.setProperty(key,String(value))
      stage.dataset.mobileAboutProgress=sample.progress.toFixed(5)
      stage.dataset.memoryYear=String(JOURNEY_MEMORIES[sample.memoryIndex].year)
      stage.dataset.mobileProjectsReveal=sample.projectsReveal.toFixed(4)
      stage.querySelectorAll('[data-memory-pin]').forEach((node,index)=>{node.style.top=`${sample.pinPositions[index]*100}%`})
      const readingMemory=sample.memoryOpacity>.05
      stage.dataset.memoryVisible=String(readingMemory)
      stage.dataset.journeyActive=String(visible&&!document.hidden)
      setBioIndex(current=>current===sample.bioIndex?current:sample.bioIndex)
      setMemoryIndex(current=>current===sample.memoryIndex?current:sample.memoryIndex)
      setPhotoPlaying(visible&&!document.hidden&&sample.memoryOpacity>.8)
      const animateCore=visible&&!document.hidden&&sample.coreOpacity>.001
      setCoreActive(current=>current===animateCore?current:animateCore)
      if(visible&&sample.t>8)setCoreMounted(true)
      const biography=stage.querySelector('[data-mobile-biography]')
      const memory=stage.querySelector('[data-mobile-memory]')
      biography?.setAttribute('aria-hidden',String(sample.copyOpacity<.01))
      memory?.setAttribute('aria-hidden',String(!readingMemory))
    }
    const wake=()=>{if(!raf)raf=requestAnimationFrame(draw)}
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;wake()},{rootMargin:'100px 0px'})
    observer.observe(stage)
    addEventListener('scroll',wake,{passive:true});addEventListener('resize',wake,{passive:true});document.addEventListener('visibilitychange',wake)
    wake()
    dispatchEvent(new Event('portfolio:layout'))
    return()=>{disposed=true;observer.disconnect();cancelAnimationFrame(raf);removeEventListener('scroll',wake);removeEventListener('resize',wake);document.removeEventListener('visibilitychange',wake)}
  },[reduced])
  if(reduced)return <StaticAbout/>
  const memory=JOURNEY_MEMORIES[memoryIndex]
  return <div ref={runwayRef} className={styles.runway} data-mobile-about-story data-nav-progress="0" style={{'--mobile-about-travel':MOBILE_ABOUT_TRAVEL}}>
    <div ref={stageRef} className={styles.stage}>
      <div className={styles.intro}><p>BEYOND THE CODE</p><h2>Here’s how<br/>I got here.</h2></div>
      <div className={styles.background}>
        <div className={styles.portraits} aria-hidden="true"><Image src="/Me1.png" width={941} height={1672} alt="" sizes="100vw" className={styles.poseOne}/><Image src="/Me2.png" width={941} height={1672} alt="" sizes="100vw" className={styles.poseTwo}/></div>
        <div className={styles.portraitShade}/>
        <h2 className={styles.opening}>BACKGROUND</h2>
        <div className={styles.biography} data-mobile-biography>
          <span className={styles.label}>BACKGROUND</span><h2>A little<br/>about me.</h2><i className={styles.underline}/>
          <div className={styles.messages}>{BIOGRAPHY.map((text,index)=><p key={index} aria-hidden={bioIndex!==index} style={{opacity:`var(--bio-${index},0)`}}>{text}</p>)}</div>
        </div>
      </div>
      <div className={styles.journeyHeading}><h2>MY JOURNEY</h2><p>{JOURNEY_INTRO}</p></div>
      <div className={styles.memoryLine} aria-hidden="true"><i/>{JOURNEY_MEMORIES.map((entry,index)=><span key={entry.year} data-memory-pin data-current={index===memoryIndex}/>)}</div>
      <article className={styles.memory} data-mobile-memory>
        <div className={styles.memoryPhoto}><JourneyMemoryBackdrop source={source}/></div>
        <div className={styles.memoryShade}/>
        <div className={styles.memoryCopy}><h3>{memory.title}<br/><span>{memory.year}</span></h3><p>{memory.description}</p></div>
      </article>
      <div className={styles.core} aria-hidden="true">{coreMounted&&<MobileJourneyCore frameRef={frameRef} active={coreActive}/>}</div>
      <span className={styles.scrollHint} aria-hidden="true">SCROLL TO DISCOVER</span>
    </div>
  </div>
}
