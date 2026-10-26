export const CONTACT_ENTRANCE={pullEnd:.9,snapEnd:1.65,chargeEnd:3.15,growEnd:3.45,end:4.55}
const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0))
const smooth=(time,a,b)=>{const x=clamp((time-a)/(b-a));return x*x*(3-2*x)}

export function sampleContactEntrance(elapsed=0,started=true){
  const k=CONTACT_ENTRANCE,t=Math.min(k.end,Math.max(0,Number.isFinite(elapsed)?elapsed:0))
  if(!started)return {time:0,phase:'waiting',size:0,appearance:0,lensing:0,pull:0,snap:0,
    recede:0,charge:0,growth:0,wave:0,wavePower:0,jitterX:0,jitterY:0,roll:0,pitch:0,flash:1,focal:0,tremor:0}
  const growth=clamp((t-k.chargeEnd)/(k.growEnd-k.chargeEnd))
  const expansion=1-Math.pow(1-growth,4)
  // Ease from the convergence point to the small charging hole. There is no
  // visibility switch to an already-sized object at the end of the star pull.
  const emergence=smooth(t,k.pullEnd,k.snapEnd)
  const appearance=emergence
  const size=.1*emergence+.9*expansion
  const chargeProgress=smooth(t,k.snapEnd,k.chargeEnd)
  const shake=smooth(t,k.snapEnd,k.snapEnd+.06)*(1-smooth(t,k.chargeEnd-.045,k.chargeEnd))*(.65+.35*chargeProgress)
  const charge=smooth(t,k.pullEnd,k.snapEnd)*(.3+.7*chargeProgress)*(1-smooth(t,k.chargeEnd,k.growEnd))
  const rawWave=clamp((t-k.chargeEnd)/(k.end-k.chargeEnd))
  return {time:Math.min(t,k.end),
    phase:t<k.pullEnd?'pulling':t<k.snapEnd?'emerging':t<k.chargeEnd?'charging':t<k.growEnd?'expanding':t<k.end?'wave':'settled',
    size,appearance,lensing:size*appearance,
    pull:smooth(t,0,k.pullEnd)*(1-smooth(t,k.chargeEnd,k.growEnd+.2)),
    snap:smooth(t,k.pullEnd,k.snapEnd)*(1-smooth(t,k.chargeEnd,k.growEnd)),
    recede:(1-emergence*.82)*(1-expansion),charge,growth,
    focal:smooth(t,k.pullEnd-.25,k.pullEnd)*(1-smooth(t,k.pullEnd+.1,k.snapEnd)),
    wave:1-Math.pow(1-rawWave,3),
    wavePower:smooth(t,k.chargeEnd,k.chargeEnd+.06)*(1-smooth(t,k.end-.55,k.end)),
    tremor:shake*(Math.sin(t*73)+.28*Math.sin(t*109+.4))/1.28,
    jitterX:shake*.008*(Math.sin(t*97)+.32*Math.sin(t*163+.7)),
    jitterY:shake*.006*(Math.sin(t*113+.4)+.3*Math.sin(t*179)),
    roll:shake*.055*Math.sin(t*109),pitch:shake*.035*Math.sin(t*83),
    flash:1+charge*.18+Math.sin(growth*Math.PI)*.55}
}

export function contactEntryVisible(rect,viewportHeight){
  if(!rect||rect.height<=0||viewportHeight<=0)return false
  const visible=Math.max(0,Math.min(viewportHeight,rect.bottom)-Math.max(0,rect.top))
  return visible>=Math.min(viewportHeight,rect.height)*.42
}

export function advanceContactEntrance(clock,delta,running){
  if(!running||clock.complete)return clock
  clock.started=true
  clock.elapsed=Math.min(CONTACT_ENTRANCE.end,clock.elapsed+Math.max(0,Number.isFinite(delta)?delta:0))
  clock.complete=clock.elapsed>=CONTACT_ENTRANCE.end-1e-9
  if(clock.complete)clock.elapsed=CONTACT_ENTRANCE.end
  return clock
}

// Aspect-correct distance to the farthest corner of the *footer*, including
// off-center origins and frames that currently extend below the viewport.
export function contactWaveRadius(center,bounds,aspect){
  return Math.max(...[0,1].flatMap(x=>[0,1].map(y=>Math.hypot(
    (bounds[0]+bounds[2]*x-center[0])*aspect,bounds[1]+bounds[3]*y-center[1]))))
}

// Recession changes actual depth. This compensation preserves the requested
// apparent 10% scale and the same projected anchor while the point moves back.
export function contactEntranceTransform(birth,cameraZ,height){
  const z=-birth.recede*height*.55
  const compensation=(cameraZ-z)/Math.max(.01,cameraZ)
  return {z,compensation,scale:birth.size*compensation}
}
