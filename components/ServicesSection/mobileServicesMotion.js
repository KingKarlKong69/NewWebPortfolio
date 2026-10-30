const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0))
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t)}
// Centers in viewport units: each new scene is reached diagonally through
// the same continuous space. Every stop has a native-scroll reading window.
export const MOBILE_SERVICE_STOPS=Object.freeze([
  [0,0],[.85,1.05],[1.7,2.1],[.85,3.15],[0,4.2],[-.85,5.25],[-1.7,6.3],[-.85,7.35],[-1.7,8.4]
].map(Object.freeze))
export const MOBILE_SERVICES_TRAVEL=(MOBILE_SERVICE_STOPS.length-1)*150+90
export function sampleMobileServices(progress){
  const p=clamp(progress),travel=p*(MOBILE_SERVICE_STOPS.length-1+.6)
  const index=Math.min(MOBILE_SERVICE_STOPS.length-1,Math.floor(travel))
  const next=Math.min(index+1,MOBILE_SERVICE_STOPS.length-1)
  const local=travel-index,blend=smooth((local-.42)/.5)
  const a=MOBILE_SERVICE_STOPS[index],b=MOBILE_SERVICE_STOPS[next]
  return {progress:p,index:blend>.5?next:index,camera:[a[0]+(b[0]-a[0])*blend,a[1]+(b[1]-a[1])*blend],blend}
}
