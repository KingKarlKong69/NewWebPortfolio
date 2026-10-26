export const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
export const smoothRange = (value, start, end) => {
  const t = clamp01((value - start) / (end - start))
  return t * t * (3 - 2 * t)
}

// View-relative route: center, lower-right, up the right edge, across the top,
// down the far left, then out toward the viewer. These are flow stages,
// not service-column indices. Catmull-Rom interpolation supplies rounded bends.
export const SERVICE_DUST_ROUTE = [
  [.04,.04,0], [.56,-.40,.08], [.80,.10,.02], [.60,.70,-.06],
  [-.22,.75,-.08], [-.86,.32,.02], [-.88,-.22,.08],
  [-.78,-.20,.35], [-.10,-.08,.84]
]

export function advanceServiceDustPhase(phase,delta,enabled=true) {
  if(!enabled||!Number.isFinite(delta))return phase
  return (phase+Math.max(0,Math.min(.05,delta))*.18)%(Math.PI*2)
}

export const SERVICE_WORDS = [
  {text:'SERVICES', width:20, position:[0,4,0], tilt:-.025, releaseOffset:0},
  {text:'WHAT', width:10, position:[-.9,-9,0], tilt:0, releaseOffset:0},
  {text:'I', width:.5, position:[5.4,-9,0], tilt:0, releaseOffset:4},
  {text:'OFFER', width:13.2, position:[0,-12.3,0], tilt:0, releaseOffset:5}
]
const KEYS = [
  [0,[0,4,23]], [.07,[0,4,23]],
  [.16,[-.9,-9,12]], [.21,[-.9,-9,12]],
  [.28,[5.4,-9,5]], [.31,[5.4,-9,5]],
  [.37,[5,-12.3,17],0], [.40,[5,-12.3,17],0],
  [.455,[0,-10.65,18.5]], [1,[0,-10.65,18.5]]
]

export function sampleServicesStory(value) {
  const progress = clamp01(value)
  let index = KEYS.findIndex((key, i) => i < KEYS.length - 1 && progress <= KEYS[i + 1][0])
  if (index < 0) index = KEYS.length - 2
  const [start,a] = KEYS[index], [end,b] = KEYS[index+1]
  const blend = smoothRange(progress,start,end)
  const lookA=KEYS[index][2]??a[0], lookB=KEYS[index+1][2]??b[0]
  return {
    progress, camera:a.map((axis,i)=>axis+(b[i]-axis)*blend), lookX:lookA+(lookB-lookA)*blend,
    dissolve:smoothRange(progress,.49,.65), spiral:smoothRange(progress,.515,.755),
    route:smoothRange(progress,.715,.89), approach:smoothRange(progress,.83,.915),
    assembly:smoothRange(progress,.915,.95), consolidation:smoothRange(progress,.96,.98),
    handoff:smoothRange(progress,.985,.995), deck:smoothRange(progress,.985,.995), deckY:0,
    phase:progress<.10?'services':progress<.24?'what':progress<.32?'i':progress<.42?'offer':
      progress<.49?'together':progress<.65?'disintegrate':progress<.715?'spiral':
      progress<.915?'flow':progress<.96?'assemble':progress<.985?'consolidate':'deck'
  }
}

export function sampleServiceColumn(state,index) {
  // The camera-facing cloud now fills every footprint together.
  return {gather:state.assembly,solid:state.consolidation}
}

// Coordinates are in half-viewport-height units, including depth. Both the
// WebGL camera and DOM panels project from this same spatial journey.
export const SERVICE_DESTINATIONS={contributions:[3.9,-2.2,-1.0],testimonials:[-1.5,-4.6,-1.6]}
const easeJourney=t=>{const x=clamp01(t);return x*x*x*(x*(x*6-15)+10)}
function journeyCurve(progress,start,end,a,b,c,d){
  const t=easeJourney((progress-start)/(end-start)),s=1-t
  return a.map((v,i)=>s*s*s*v+3*s*s*t*b[i]+3*s*t*t*c[i]+t*t*t*d[i])
}
export function sampleServicesJourney(value){
  const progress=clamp01(value)
  const contributions=SERVICE_DESTINATIONS.contributions,testimonials=SERVICE_DESTINATIONS.testimonials
  const camera=progress<.81
    ?journeyCurve(progress,.715,.81,[0,0,0],[.65,-.08,.6],[3.7,-1.1,-.4],contributions)
    :journeyCurve(progress,.88,.96,contributions,[3.6,-3.4,-.45],[-.7,-3.7,-1.1],testimonials)
  const exit=smoothRange(progress,.66,.715)
  const storyProgress=clamp01(progress/.60)
  const handoff=sampleServicesStory(storyProgress).handoff
  return {progress,storyProgress,camera,exit,
    scatter:smoothRange(progress,.69,.79),dustFade:smoothRange(progress,.765,.81),
    domDeck:handoff*(1-smoothRange(exit,0,.12)),
    deckInteractive:progress>=.597&&progress<=.66,
    contributionActive:progress>=.805&&progress<=.88,
    testimonialActive:progress>=.958,
    phase:progress<.60?'story':progress<.66?'deck':progress<.715?'departure':
      progress<.805?'to-contributions':progress<=.88?'contributions':progress<.958?'to-testimonials':'testimonials'}
}

export function servicePanelView(destination,camera,aspect=16/9){
  const distance=1/Math.tan(20*Math.PI/180)
  const depth=distance+camera[2]-destination[2]
  const scale=distance/Math.max(.15,depth)
  return {x:(destination[0]-camera[0])*scale/aspect,y:-(destination[1]-camera[1])*scale,scale}
}

export function serviceCoverScale(imageAspect,columnAspect,zoom=1.035) {
  return [Math.min(1,columnAspect/imageAspect)/zoom,Math.min(1,imageAspect/columnAspect)/zoom]
}

export function serviceRectNdc(rect,canvas) {
  return [2*(rect.left-canvas.left)/canvas.width-1,
    1-2*(rect.top+rect.height-canvas.top)/canvas.height,
    2*rect.width/canvas.width,2*rect.height/canvas.height]
}
