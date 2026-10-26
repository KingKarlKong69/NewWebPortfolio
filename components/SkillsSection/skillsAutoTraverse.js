export const SKILLS_SCROLL_COUNT=7
export const SKILLS_FORWARD_SECONDS=7
export const SKILLS_REVERSE_SECONDS=5.5
const clamp=x=>Math.max(0,Math.min(1,x))
const ease=x=>x*x*x*(x*(x*6-15)+10)

// Wheel notches are discrete; a high-resolution touchpad swipe includes a
// stream of movement and momentum. Count the latter once until it goes quiet.
export function createSkillsGestureReader(){
  let last=-Infinity,direction=0,counted=false,pending=0,lastNotch=-Infinity
  return {
    consume(time){last=time;counted=true;pending=0},
    read(delta,time,discrete=false){
      const sign=Math.sign(delta)
      if(!sign||!Number.isFinite(delta))return 0
      if(time-last>220||sign!==direction){counted=false;pending=0}
      direction=sign;last=time
      if(discrete){if(time-lastNotch<40)return 0;lastNotch=time;counted=true;return sign}
      pending+=Math.abs(delta)
      if(counted||pending<14)return 0
      counted=true;return sign
    }
  }
}

export function createSkillsAutoTraverse({getGeometry,getY,seek,isReady=()=>true,isHidden=()=>false,
  requestFrame,cancelFrame,notify=()=>{},now=()=>performance.now()}){
  const gestures=createSkillsGestureReader()
  let phase='native',count=0,frame=0,trip=null,bypass=false,lastY=getY(),disposed=false
  const publish=()=>notify({phase,count,controlled:phase==='forward'||phase==='reverse'})
  const setPhase=value=>{phase=value;publish()}
  const move=y=>{lastY=y;seek(y)}
  const stopFrame=()=>{if(frame)cancelFrame(frame);frame=0}
  const tick=time=>{
    frame=0;if(disposed||!trip)return
    if(isHidden()){trip.last=null;return}
    const geometry=getGeometry();if(!geometry){cancel();return}
    trip.elapsed+=trip.last===null?0:Math.max(0,(time-trip.last)/1000);trip.last=time
    const t=clamp(trip.elapsed/trip.duration),ratio=trip.from+(trip.to-trip.from)*ease(t)
    move(geometry.gate+(geometry.end-geometry.gate)*ratio)
    if(t>=1){
      const to=trip.to;trip=null;count=0;gestures.consume(time)
      setPhase(to===1?'services':'native')
    }else frame=requestFrame(tick)
  }
  const fly=to=>{
    const geometry=getGeometry();if(!geometry)return
    stopFrame()
    const from=clamp((getY()-geometry.gate)/Math.max(1,geometry.end-geometry.gate))
    trip={from,to,elapsed:0,last:null,duration:Math.max(.8,(to?SKILLS_FORWARD_SECONDS:SKILLS_REVERSE_SECONDS)*Math.abs(to-from))}
    count=0;setPhase(to===1?'forward':'reverse');frame=requestFrame(tick)
  }
  function cancel(navigation=false){stopFrame();trip=null;count=0;bypass=navigation;setPhase('native');lastY=getY()}
  return {
    input(delta,time=now(),discrete=false){
      const geometry=getGeometry();if(!geometry||!Number.isFinite(delta)||!delta)return false
      bypass=false
      const y=getY(),sign=Math.sign(delta),gesture=gestures.read(delta,time,discrete)
      if(trip){if(phase==='forward'&&gesture<0)fly(0);return true}
      // Reverse only at the Services entrance; upward browsing deeper inside
      // Services remains native until its opening screen is reached again.
      if(gesture<0&&y>=geometry.end-2&&y<=geometry.end+geometry.viewport*.8){
        fly(0);return true
      }
      if(y>=geometry.gate-2&&y<geometry.end&&gesture>0&&isReady()){
        count++;publish()
        if(count>=SKILLS_SCROLL_COUNT){fly(1);return true}
      }else if(gesture<0){count=0;publish()}
      return false
    },
    sync(){
      const geometry=getGeometry();if(!geometry||trip||bypass)return
      const y=getY()
      if(y<geometry.gate-2&&count){count=0;publish()}
      lastY=getY()
    },
    visibility(){
      if(!trip)return
      stopFrame();trip.last=null
      if(!isHidden())frame=requestFrame(tick)
    },
    relayout(){
      const geometry=getGeometry()
      if(!geometry){cancel(true);return}
      lastY=getY()
    },
    cancel,
    snapshot:()=>({phase,count,traveling:Boolean(trip)}),
    dispose(){disposed=true;stopFrame();trip=null;count=0;setPhase('native')}
  }
}
