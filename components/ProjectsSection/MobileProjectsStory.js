import dynamic from 'next/dynamic'
import {ArrowRight} from 'lucide-react'
import {useEffect,useMemo,useRef,useState} from 'react'
import {mobileProjectsLayout,mobileProjectStop,mobileSkillFaceStop,sampleMobileProjects} from './mobileProjectsMotion'
import ProjectDotField from './ProjectDotField'
import useMobileChapterGestures from './useMobileChapterGestures'
import {MOBILE_SKILL_FACES} from '../SkillsSection/mobileSkillFaces'
import {getProjectActions} from './projectActions'
import ProjectTechnologyMarks from './ProjectTechnologyMarks'
import {SKILLS_CHAPTERS} from '../SkillsSection/skillsExpeditionData'
import styles from './MobileProjectsStory.module.css'

const Laptop=dynamic(()=>import('./ProjectLaptopScene'),{ssr:false})
const MARKERS=SKILLS_CHAPTERS.flatMap((chapter,chapterIndex)=>chapter.markers.map(marker=>({...marker,chapterIndex})))

function MountainIcons({motionRef}) {
  const nodes=useRef(new Map()),root=useRef(null)
  const [selected,setSelected]=useState(null)
  useEffect(()=>{
    let previousChapter=-1,previousActive=false
    const update=()=>{
      const motion=motionRef.current,active=motion.active&&motion.skillsContentOpacity>.5
      root.current.inert=!active
      root.current.style.visibility=active?'visible':'hidden'
      if(previousChapter!==motion.mobileFaceIndex||previousActive!==active)setSelected(null)
      previousChapter=motion.mobileFaceIndex;previousActive=active
      const present=new Set((motion.skillsProjection?.markers||[]).map(anchor=>anchor.id))
      nodes.current.forEach((node,id)=>{if(!present.has(id)){node.style.visibility='hidden';node.style.opacity='0';node.inert=true;node.tabIndex=-1}})
      for(const anchor of motion.skillsProjection?.markers||[]){
        const node=nodes.current.get(anchor.id)
        if(!node)continue
        const visible=active&&anchor.visible&&anchor.opacity>.35&&anchor.x>.04&&anchor.x<.96&&anchor.y>.43&&anchor.y<.94
        node.style.left=`${anchor.x*100}%`;node.style.top=`${anchor.y*100}%`
        node.style.opacity=visible?String(anchor.opacity):'0';node.style.visibility=visible?'visible':'hidden'
        node.inert=!visible;node.tabIndex=visible?0:-1
      }
    }
    addEventListener('skills:projection',update);addEventListener('projects:motion',update)
    return()=>{removeEventListener('skills:projection',update);removeEventListener('projects:motion',update)}
  },[motionRef])
  return <div ref={root} className={styles.icons} aria-label="Mountain technology icons">
    {MARKERS.map(marker=><button key={marker.id} data-monochrome={marker.monochrome||undefined} ref={node=>{if(node)nodes.current.set(marker.id,node);else nodes.current.delete(marker.id)}} type="button" aria-label={`${marker.label}: ${marker.description}`} onClick={()=>setSelected(selected?.id===marker.id?null:marker)} style={{opacity:0,visibility:'hidden'}}>
      <img src={marker.icon} alt="" width="42" height="42"/><span>{marker.label}</span>
    </button>)}
    {selected&&<button className={styles.skillReadout} type="button" onClick={()=>setSelected(null)}><strong>{selected.label}</strong><span>{selected.description}</span><small>Tap to close</small></button>}
  </div>
}

export default function MobileProjectsStory({projects,onOpenCaseStudy}) {
  const runway=useRef(null),stage=useRef(null),title=useRef(null),copy=useRef(null),skills=useRef(null),ending=useRef(null),white=useRef(null),black=useRef(null)
  const motionRef=useRef(sampleMobileProjects(0,projects.length))
  const [index,setIndex]=useState(0),[chapter,setChapter]=useState(0),[face,setFace]=useState(0),[mounted,setMounted]=useState(false),[active,setActive]=useState(false)
  const layout=useMemo(()=>mobileProjectsLayout(projects.length),[projects.length]),project=projects[index]
  const projectStops=useMemo(()=>projects.map((_,i)=>mobileProjectStop(i,projects.length)),[projects])
  const faceStops=useMemo(()=>MOBILE_SKILL_FACES.map((_,i)=>mobileSkillFaceStop(i,projects.length)),[projects.length])
  useMobileChapterGestures({runwayRef:runway,motionRef,projectStops,faceStops,layout})
  useEffect(()=>{
    let frame=0,lastIndex=-1,lastChapter=-1,lastFace=-1,lastActive=false,warmed=false,disposed=false,idle=0
    const update=()=>{
      frame=0
      if(disposed)return
      const rect=runway.current.getBoundingClientRect(),height=innerHeight
      const visible=rect.top<height&&rect.bottom>0&&!document.hidden
      if(!warmed&&rect.top<height*2&&rect.bottom>0){warmed=true;setMounted(true)}
      const progress=Math.max(0,Math.min(1,-rect.top/Math.max(1,runway.current.offsetHeight-height)))
      const motion=sampleMobileProjects(progress,projects.length,height<700,motionRef.current)
      const arrival=Math.max(0,Math.min(1,1-rect.top/height))
      stage.current.style.transform=rect.top>0?`translateY(${-Math.min(height,rect.top)}px)`:'none'
      stage.current.style.background=arrival>=1?'#000':'transparent'
      stage.current.style.opacity=String(arrival*arrival*(3-2*arrival))
      stage.current.inert=arrival<.99
      motion.active=visible;motion.scrolling=performance.now()-(motion.lastScrollAt||0)<280
      if(lastIndex!==motion.projectIndex){lastIndex=motion.projectIndex;setIndex(lastIndex)}
      if(lastChapter!==motion.chapterIndex){lastChapter=motion.chapterIndex;setChapter(lastChapter)}
      if(lastFace!==motion.mobileFaceIndex){lastFace=motion.mobileFaceIndex;setFace(lastFace)}
      if(lastActive!==visible){lastActive=visible;setActive(visible)}
      stage.current.dataset.mobileProgress=progress.toFixed(5);stage.current.dataset.projectIndex=String(motion.projectIndex)
      stage.current.dataset.skillsChapter=String(motion.chapterIndex)
      stage.current.dataset.mobileFace=String(motion.mobileFaceIndex)
      title.current.style.top=`${50-motion.titlePosition*39}%`
      title.current.style.left=`${50-motion.titlePosition*44}%`
      title.current.style.transform=`translate(${-50+motion.titlePosition*50}%,-50%) scale(${Math.exp(Math.log(14)*(1-motion.titlePosition))})`
      title.current.style.opacity=String(motion.titleOpacity)
      title.current.setAttribute('aria-hidden',String(motion.titleOpacity<.1))
      copy.current.style.opacity=String(motion.copyOpacity)
      copy.current.style.transform=`translateY(${(1-motion.copyOpacity)*12}px)`
      copy.current.inert=motion.copyOpacity<.7;copy.current.setAttribute('aria-hidden',String(motion.copyOpacity<.1))
      skills.current.style.opacity=String(motion.skillsContentOpacity);skills.current.setAttribute('aria-hidden',String(motion.skillsContentOpacity<.1))
      ending.current.style.opacity=String(motion.endingReveal*(1-motion.mobileBlackout))
      ending.current.setAttribute('aria-hidden',String(motion.endingReveal<.1))
      white.current.style.opacity=String(motion.whiteout);black.current.style.opacity=String(motion.mobileBlackout)
      window.dispatchEvent(new Event('projects:motion'))
    }
    const wake=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(update)}
    const scroll=()=>{
      motionRef.current.lastScrollAt=performance.now();clearTimeout(idle);wake()
      idle=setTimeout(wake,300)
    }
    const observer=new IntersectionObserver(wake,{rootMargin:'100% 0px'});observer.observe(runway.current)
    addEventListener('scroll',scroll,{passive:true});addEventListener('resize',wake);document.addEventListener('visibilitychange',wake)
    window.dispatchEvent(new Event('portfolio:layout'));wake()
    return()=>{disposed=true;clearTimeout(idle);cancelAnimationFrame(frame);observer.disconnect();removeEventListener('scroll',scroll);removeEventListener('resize',wake);document.removeEventListener('visibilitychange',wake);motionRef.current.active=false}
  },[projects])
  const select=chosen=>{
    const node=runway.current
    const top=scrollY+node.getBoundingClientRect().top+(node.offsetHeight-innerHeight)*mobileProjectStop(chosen,projects.length)
    scrollTo({top,behavior:'smooth'})
  }
  return <div ref={runway} className={styles.runway} style={{height:`${layout.height}svh`}} data-mobile-projects-story data-nav-progress="0">
    <section id="skills" className={styles.skillsAnchor} style={{top:`${mobileSkillFaceStop(0,projects.length)*layout.distance}svh`}} aria-label="Skills and technologies"/>
    <div ref={stage} className={styles.stage} data-mobile-progress="0">
      <ProjectDotField sceneRef={stage} motionRef={motionRef}/>
      <div className={styles.laptop} aria-hidden="true"><Laptop projects={projects} activeIndex={index} active={active} mounted={mounted} story motionRef={motionRef} reducedMotion={false}/></div>
      <h2 ref={title} id="projects-heading" className={styles.title}>PROJECTS</h2>
      <article ref={copy} className={styles.copy} aria-labelledby={`mobile-project-${project.id}`}>
        <p className={styles.eyebrow}><span>{project.number}</span> {project.eyebrow}</p>
        <h3 id={`mobile-project-${project.id}`}>{project.title}</h3>
        <dl className={styles.facts}>
          <div><dt>ROLE</dt><dd>{project.role||'Project role pending'}</dd></div>
          <div><dt>IMPACT</dt><dd>{project.impact||'Impact details pending'}</dd></div>
          <div className={styles.stack}><dt>TECH STACK</dt><dd><ProjectTechnologyMarks technologies={project.technologies} className={styles.tech}/></dd></div>
        </dl>
        <div className={styles.actions} data-project-actions>{getProjectActions(project).map((action,i)=><span key={`${project.id}-${i}`}>{i>0&&<i className={styles.actionDivider} aria-hidden="true">|</i>}{action.href?<a href={action.href} target="_blank" rel="noopener noreferrer" aria-label={`${action.label}: ${project.title}`}>{action.label}</a>:<button type="button" onClick={()=>onOpenCaseStudy(project)}>{action.label}</button>}</span>)}<ArrowRight aria-hidden="true" size={20}/></div>
        <nav className={styles.navigation} aria-label="Project chapters">{projects.map((entry,i)=><button key={entry.id} type="button" onClick={()=>select(i)} aria-label={`Scroll to project ${entry.number}: ${entry.title}`} aria-current={i===index?'step':undefined}>{entry.number}</button>)}</nav>
      </article>
      <div ref={skills} className={styles.skillsIntro} aria-hidden="true"><p>SKILLS</p><h2 id="skills-heading">Tools that turn<br/>ideas into reality.</h2><div>A modern and evolving stack I use to build, design, and deploy digital experiences. Always learning, always exploring.</div><h3>{SKILLS_CHAPTERS[chapter].title}</h3><small className={styles.faceHint}>FACE {MOBILE_SKILL_FACES[face].pageIndex+1} / {MOBILE_SKILL_FACES[face].pageCount} · SWIPE TO EXPLORE</small></div>
      <MountainIcons motionRef={motionRef}/>
      <div ref={ending} className={styles.ending} aria-hidden="true"><p>ALWAYS IN PROGRESS</p><h2>THE TOOLSET WILL<br/>KEEP <em>EVOLVING.</em></h2><p>Always learning. Always experimenting.<br/>Always building.</p></div>
      <div ref={white} className={styles.white} aria-hidden="true"/><div ref={black} className={styles.black} aria-hidden="true"/>
    </div>
  </div>
}
