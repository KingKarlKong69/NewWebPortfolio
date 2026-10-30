import {useEffect} from 'react'
import {adjacentMobileStop,mobileSwipeDirection} from './mobileChapterGestures'

const INTERACTIVE='a,button,input,textarea,select,[role="dialog"],[data-gesture-ignore]'

export default function useMobileChapterGestures({runwayRef,motionRef,projectStops,faceStops,layout}) {
  useEffect(()=>{
    const node=runwayRef.current
    if(!node)return
    let touch=null,wheelTimer=0,wheelLocked=false,wheelTravel=0,settlingUntil=0
    const context=()=>{
      const m=motionRef.current,at=m.progress*layout.distance
      if(at>=180&&at<layout.projects)return {stops:projectStops,index:m.projectIndex===0&&m.projectLocal<.2?-1:m.projectIndex,before:90/layout.distance,after:(layout.projects+layout.portal*.18)/layout.distance}
      if(at>=layout.projects+layout.portal&&at<layout.projects+layout.portal+layout.mountains){
        const enteringFirst=at<layout.projects+layout.portal+layout.mountains/faceStops.length*.2
        return {stops:faceStops,index:enteringFirst?-1:m.mobileFaceIndex||0,before:(layout.projects+layout.portal*.82)/layout.distance,after:(layout.projects+layout.portal+layout.mountains+layout.ending*.55)/layout.distance}
      }
      return null
    }
    const seek=(state,direction)=>{
      if(!direction||performance.now()<settlingUntil)return
      const progress=adjacentMobileStop(state.stops,state.index,direction,state.before,state.after)
      settlingUntil=performance.now()+650
      window.scrollTo({top:window.scrollY+node.getBoundingClientRect().top+(node.offsetHeight-innerHeight)*progress,behavior:'smooth'})
    }
    const start=event=>{
      if(event.touches.length!==1||event.target.closest?.(INTERACTIVE)){touch=null;return}
      const point=event.touches[0]
      touch={x:point.clientX,y:point.clientY,state:context(),dx:0,dy:0}
    }
    const move=event=>{
      if(!touch?.state||event.touches.length!==1)return
      touch.dx=event.touches[0].clientX-touch.x;touch.dy=event.touches[0].clientY-touch.y
      if(Math.max(Math.abs(touch.dx),Math.abs(touch.dy))>5&&event.cancelable)event.preventDefault()
    }
    const end=()=>{if(touch?.state)seek(touch.state,mobileSwipeDirection(touch.dx,touch.dy));touch=null}
    const cancel=()=>{touch=null}
    const wheel=event=>{
      if(event.ctrlKey||event.metaKey||event.target.closest?.(INTERACTIVE))return
      const state=context()
      if(!state&&!wheelLocked)return
      if(event.cancelable)event.preventDefault()
      clearTimeout(wheelTimer)
      wheelTimer=setTimeout(()=>{wheelLocked=false;wheelTravel=0},240)
      if(wheelLocked||!state)return
      wheelTravel+=Math.abs(event.deltaY)>=Math.abs(event.deltaX)?event.deltaY:event.deltaX
      if(Math.abs(wheelTravel)<35)return
      wheelLocked=true;seek(state,Math.sign(wheelTravel))
    }
    const key=event=>{
      if(event.target.closest?.(INTERACTIVE)||event.altKey||event.ctrlKey||event.metaKey)return
      const direction=['ArrowDown','ArrowRight','PageDown',' '].includes(event.key)?1:['ArrowUp','ArrowLeft','PageUp'].includes(event.key)?-1:0
      const state=context()
      if(direction&&state){event.preventDefault();seek(state,direction)}
    }
    node.addEventListener('touchstart',start,{passive:true});node.addEventListener('touchmove',move,{passive:false})
    node.addEventListener('touchend',end,{passive:true});node.addEventListener('touchcancel',cancel,{passive:true})
    node.addEventListener('wheel',wheel,{passive:false});window.addEventListener('keydown',key)
    return()=>{clearTimeout(wheelTimer);node.removeEventListener('touchstart',start);node.removeEventListener('touchmove',move);node.removeEventListener('touchend',end);node.removeEventListener('touchcancel',cancel);node.removeEventListener('wheel',wheel);window.removeEventListener('keydown',key)}
  },[runwayRef,motionRef,projectStops,faceStops,layout])
}
