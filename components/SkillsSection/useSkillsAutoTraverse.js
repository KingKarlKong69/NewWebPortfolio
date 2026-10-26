import {useEffect} from 'react'
import {NAV_EVENT} from '../navigationState'
import {projectsSkillsLayout,SKILLS_TOOLSET_STOP,SERVICES_HANDOFF_END} from '../ProjectsSection/projectStoryMotion'
import {createSkillsAutoTraverse} from './skillsAutoTraverse'

export default function useSkillsAutoTraverse({runwayRef,motionRef,projectCount}){
  useEffect(()=>{
    const media=matchMedia('(min-width:1101px) and (prefers-reduced-motion:no-preference)')
    const layout=projectsSkillsLayout(projectCount)
    const storyStop=p=>layout.transitionEnd+(1-layout.transitionEnd)*p
    const getGeometry=()=>{
      const runway=runwayRef.current
      if(!media.matches||!runway)return null
      const top=scrollY+runway.getBoundingClientRect().top,distance=runway.offsetHeight-innerHeight
      const services=document.getElementById('services')
      const end=services?scrollY+services.getBoundingClientRect().top+Number(services.dataset.servicesEntryHold||0)*innerHeight/100
        :top+distance*storyStop(SERVICES_HANDOFF_END)
      return {gate:top+distance*storyStop(SKILLS_TOOLSET_STOP),end,viewport:innerHeight}
    }
    const controller=createSkillsAutoTraverse({getGeometry,getY:()=>scrollY,
      seek:top=>window.scrollTo({top,behavior:'instant'}),
      requestFrame:callback=>requestAnimationFrame(callback),cancelFrame:id=>cancelAnimationFrame(id),isHidden:()=>document.hidden,
      isReady:()=>motionRef.current.endingReveal>=.999,
      notify:state=>{
        Object.assign(motionRef.current,{skillsAutoPhase:state.phase,skillsAutoCount:state.count,skillsAutoControlled:state.controlled})
        const root=runwayRef.current
        if(root){root.dataset.skillsAutoPhase=state.phase;root.dataset.skillsAutoCount=String(state.count)}
        dispatchEvent(new Event('projects:motion'))
      }})
    if(['#services','#contact'].includes(location.hash))controller.cancel(true)
    const interactive=target=>target?.closest?.('input,textarea,select,button,a,[contenteditable="true"],dialog,[role="dialog"]')
    const wheel=event=>{
      if(event.defaultPrevented||event.ctrlKey||event.metaKey||interactive(event.target)||Math.abs(event.deltaX)>Math.abs(event.deltaY))return
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1)
      const magnitude=Math.abs(event.deltaY)
      const notch=event.deltaMode!==0||event.deltaX===0&&magnitude>=80&&(magnitude%40===0||magnitude%100===0)
      if(controller.input(delta,performance.now(),notch))event.preventDefault()
    }
    const key=event=>{
      if(event.defaultPrevented||interactive(event.target)||event.ctrlKey||event.metaKey||event.altKey)return
      if(event.key==='Escape'){controller.cancel();return}
      const direction=['ArrowDown','PageDown'].includes(event.key)||event.key===' '&&!event.shiftKey?1:
        ['ArrowUp','PageUp'].includes(event.key)||event.key===' '&&event.shiftKey?-1:0
      if(direction&&controller.input(direction*innerHeight*.8,performance.now(),!event.repeat))event.preventDefault()
    }
    let touch=null
    const touchStart=event=>{if(event.touches.length===1&&!interactive(event.target))touch={y:event.touches[0].clientY,consumed:false};else touch=null}
    const touchMove=event=>{
      if(!touch||event.touches.length!==1)return
      const delta=touch.y-event.touches[0].clientY
      if(Math.abs(delta)<18)return
      if(touch.consumed){if(controller.snapshot().traveling)event.preventDefault();return}
      touch.consumed=true
      if(controller.input(delta,performance.now(),true))event.preventDefault()
    }
    const touchEnd=()=>{touch=null}
    const navigation=()=>controller.cancel(true)
    const changed=()=>{controller.cancel(true)}
    addEventListener('wheel',wheel,{passive:false});addEventListener('keydown',key)
    addEventListener('scroll',controller.sync,{passive:true})
    addEventListener('touchstart',touchStart,{passive:true});addEventListener('touchmove',touchMove,{passive:false});addEventListener('touchend',touchEnd,{passive:true});addEventListener('touchcancel',touchEnd,{passive:true})
    addEventListener(NAV_EVENT,navigation);addEventListener('hashchange',navigation);addEventListener('popstate',navigation)
    addEventListener('resize',controller.relayout);addEventListener('portfolio:layout',controller.relayout)
    document.addEventListener('visibilitychange',controller.visibility);media.addEventListener('change',changed)
    return()=>{
      controller.dispose()
      removeEventListener('wheel',wheel);removeEventListener('keydown',key);removeEventListener('scroll',controller.sync)
      removeEventListener('touchstart',touchStart);removeEventListener('touchmove',touchMove);removeEventListener('touchend',touchEnd);removeEventListener('touchcancel',touchEnd)
      removeEventListener(NAV_EVENT,navigation);removeEventListener('hashchange',navigation);removeEventListener('popstate',navigation)
      removeEventListener('resize',controller.relayout);removeEventListener('portfolio:layout',controller.relayout)
      document.removeEventListener('visibilitychange',controller.visibility);media.removeEventListener('change',changed)
    }
  },[runwayRef,motionRef,projectCount])
}
