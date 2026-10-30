import {useEffect,useRef,useState} from 'react'
import {ArrowDownRight,ArrowDownLeft} from 'lucide-react'
import {SERVICES} from './servicesData'
import ContributionField from './ContributionField'
import TestimonialDeck from './TestimonialDeck'
import {MOBILE_SERVICE_STOPS,MOBILE_SERVICES_TRAVEL,sampleMobileServices} from './mobileServicesMotion'
import styles from './MobileServicesStory.module.css'

export default function MobileServicesStory(){
  const runway=useRef(null),plane=useRef(null),panels=useRef([]),lastIndex=useRef(-1)
  const [contributionActive,setContributionActive]=useState(false),[seen,setSeen]=useState(false)
  useEffect(()=>{
    let frame=0,disposed=false
    const update=()=>{
      frame=0;if(disposed||!runway.current)return
      const rect=runway.current.getBoundingClientRect(),stage=plane.current.parentElement
      const progress=-rect.top/Math.max(1,runway.current.offsetHeight-stage.offsetHeight)
      const motion=sampleMobileServices(progress)
      plane.current.style.transform=`translate3d(${-motion.camera[0]*100}%,${-motion.camera[1]*100}%,0)`
      stage.dataset.mobileServicesProgress=motion.progress.toFixed(5)
      stage.dataset.mobileServicesStop=String(motion.index)
      const active=rect.top<innerHeight&&rect.bottom>0&&!document.hidden
      panels.current.forEach((panel,index)=>{
        if(!panel)return
        const center=MOBILE_SERVICE_STOPS[index]
        const distance=Math.hypot(center[0]-motion.camera[0],center[1]-motion.camera[1])
        const reading=active&&distance<.18
        panel.inert=!reading;panel.setAttribute('aria-hidden',String(!reading))
        panel.style.visibility=distance<2?'visible':'hidden'
      })
      const target=MOBILE_SERVICE_STOPS[7],atContributions=active&&Math.hypot(target[0]-motion.camera[0],target[1]-motion.camera[1])<.18
      setContributionActive(current=>current===atContributions?current:atContributions)
      if(active&&motion.index>=5)setSeen(true)
      if(lastIndex.current!==motion.index){lastIndex.current=motion.index}
    }
    const wake=()=>{if(!frame)frame=requestAnimationFrame(update)}
    addEventListener('scroll',wake,{passive:true});addEventListener('resize',wake);document.addEventListener('visibilitychange',wake)
    const observer=new IntersectionObserver(wake);observer.observe(runway.current)
    dispatchEvent(new Event('portfolio:layout'));wake()
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();removeEventListener('scroll',wake);removeEventListener('resize',wake);document.removeEventListener('visibilitychange',wake)}
  },[])
  const panel=(index,content,className='')=><div key={index} ref={node=>{panels.current[index]=node}} className={`${styles.panel} ${className}`} style={{left:`${MOBILE_SERVICE_STOPS[index][0]*100}%`,top:`${MOBILE_SERVICE_STOPS[index][1]*100}%`}}>{content}</div>
  return <div ref={runway} className={styles.runway} style={{height:`${MOBILE_SERVICES_TRAVEL+100}svh`}} data-mobile-services-story>
    <div className={styles.stage} data-mobile-services-stop="0"><div ref={plane} className={styles.plane}>
      {panel(0,<><h2 id="services-heading" className={styles.title}>SERVICES</h2><p className={styles.hint}>SCROLL TO EXPLORE <ArrowDownRight size={16}/></p></>)}
      {panel(1,<><h2 className={styles.title}>WHAT<br/>I OFFER</h2><p className={styles.hint}>EXPLORE THE SERVICES <ArrowDownRight size={16}/></p></>)}
      {SERVICES.map((service,index)=>panel(index+2,<article className={styles.service}>
        <img src={service.image} alt="" draggable="false" loading="lazy"/>
        <div className={styles.serviceShade}/><div className={styles.serviceCopy}><span>{service.number}</span><h3>{service.title}</h3><p>{service.description}</p><div className={styles.continue}>SCROLL TO CONTINUE {index===4?<ArrowDownRight size={17}/>:<ArrowDownLeft size={17}/>}</div></div>
      </article>))}
      {panel(7,<ContributionField active={seen} playActive={contributionActive} mobile/>,styles.contributions)}
      {panel(8,<><h2 className={styles.testimonialTitle}>WHAT<br/>PEOPLE SAY</h2><TestimonialDeck/></>,styles.testimonials)}
    </div></div>
  </div>
}
