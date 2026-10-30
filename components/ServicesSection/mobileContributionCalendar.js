// Extend only the presentation grid. Future days never become claimed GitHub
// contributions or game targets, and totals continue to use verified data.
export function mobileCalendarDays(days){
  if(!days?.length)return []
  const last=days[days.length-1].date,year=Number(last.slice(0,4))
  const output=[...days],end=Date.UTC(year,11,31)
  for(let stamp=Date.parse(`${last}T00:00:00Z`)+86400000;stamp<=end;stamp+=86400000){
    output.push({date:new Date(stamp).toISOString().slice(0,10),future:true,count:null,level:0})
  }
  return output
}
export function mobileCalendarStart(days){return days?.length?`${days[days.length-1].date.slice(0,4)}-08-01`:null}
