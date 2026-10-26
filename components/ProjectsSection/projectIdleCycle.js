// A presentation clock only: no scroll, camera, or section writes.
export function createProjectIdleCycle(count) {
  let selected=0,from=0,mode='idle',elapsed=0,idle=0,last=null,lastInput=-Infinity,wasEligible=false,wasPresent=false
  return {
    sample(now,nativeIndex,eligible,inputAt,present=true) {
      const dt=last===null?0:Math.max(0,now-last);last=now
      if(!present||!wasPresent){selected=from=nativeIndex;mode='idle';elapsed=idle=0}
      if(inputAt!==lastInput){
        if(present&&selected!==nativeIndex){from=selected;selected=nativeIndex;mode='return';elapsed=0}
        idle=0;lastInput=inputAt
      }
      wasPresent=present
      if(!present){wasEligible=false;return null}
      if(mode==='return'&&selected!==nativeIndex){selected=nativeIndex;elapsed=0}
      if(mode==='return')elapsed+=dt
      else if(eligible&&wasEligible){if(mode==='cycle')elapsed+=dt;else idle+=dt}
      wasEligible=eligible
      if(mode==='idle'&&idle>=2000&&count>1){from=selected;selected=(selected+1)%count;mode='cycle';elapsed=0}
      const returning=mode==='return',duration=returning?300:850
      const t=mode==='idle'?1:Math.min(1,elapsed/duration),mix=t*t*(3-2*t)
      const index=mix<.5?from:selected,source=mode==='idle'?selected:from
      const automatic=mode!=='idle'||selected!==nativeIndex
      if(mode!=='idle'&&t===1){mode='idle';from=selected;elapsed=idle=0}
      return {index,from:source,to:selected,mix,automatic,returning,
        nextWake:mode==='return'||mode==='cycle'&&eligible?0:eligible?Math.max(1,2000-idle):Infinity}
    }
  }
}
