import {useEffect,useRef} from 'react'
import {CONTACT_ENTRANCE,advanceContactEntrance,sampleContactEntrance} from './contactEntranceMotion'

// One owner for both canvases. Scroll only triggers entry; it never sets time.
export default function useContactEntrance({sectionRef,journeyRef,hasEntered,sceneReady,unavailable,reducedMotion,pageVisible,isVisible}){
  const clock=useRef({started:false,elapsed:0,complete:false,blastElapsed:Infinity})
  useEffect(()=>{
    let frame=0,last=null
    const publish=()=>{
      const state=sampleContactEntrance(clock.current.elapsed,clock.current.started)
      if(clock.current.blastElapsed<1.2){
        const t=clock.current.blastElapsed/1.2
        state.wave=1-Math.pow(1-t,3);state.wavePower=Math.min(1,t*16)*(1-t)
      }
      journeyRef.current.entrance=state
      const root=sectionRef.current
      if(root){
        root.__contactEntranceState=state
        root.dataset.contactEntrancePhase=state.phase
        root.dataset.contactEntranceTime=state.time.toFixed(3)
      }
      dispatchEvent(new Event('contact:entrance'))
    }
    if(hasEntered&&(reducedMotion||unavailable))Object.assign(clock.current,{started:true,elapsed:CONTACT_ENTRANCE.end,complete:true})
    const running=hasEntered&&sceneReady&&pageVisible&&isVisible&&!reducedMotion&&!unavailable
    const tick=now=>{
      const delta=last===null?0:(now-last)/1000;last=now
      advanceContactEntrance(clock.current,delta,running&&!document.hidden)
      if(running&&!document.hidden)clock.current.blastElapsed+=delta
      publish()
      frame=0
      if(running&&(!clock.current.complete||clock.current.blastElapsed<1.2))frame=requestAnimationFrame(tick)
    }
    publish()
    const blast=()=>{clock.current.blastElapsed=0;last=null;if(running&&!frame)frame=requestAnimationFrame(tick)}
    addEventListener('contact:blast',blast)
    if(running&&(!clock.current.complete||clock.current.blastElapsed<1.2))frame=requestAnimationFrame(tick)
    return()=>{cancelAnimationFrame(frame);removeEventListener('contact:blast',blast)}
  },[hasEntered,sceneReady,unavailable,reducedMotion,pageVisible,isVisible,journeyRef,sectionRef])
}
