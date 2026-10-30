const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs'),{join}=require('node:path')
const load=name=>import(`data:text/javascript;base64,${Buffer.from(readFileSync(join(__dirname,name),'utf8')).toString('base64')}`)
test('mobile Services holds each panel and traverses the requested diagonal directions reversibly',async()=>{
  const {MOBILE_SERVICE_STOPS:stops,sampleMobileServices:sample}=await load('mobileServicesMotion.js')
  assert.deepEqual(sample(0).camera,[0,0]);assert.deepEqual(sample(1).camera,stops.at(-1))
  for(let i=0;i<stops.length;i++){
    const p=(i+.2)/(stops.length-1+.6),frame=sample(p)
    assert.deepEqual(frame.camera,stops[i]);assert.equal(frame.index,i)
    assert.deepEqual(sample(p),frame)
  }
  const dx=stops.slice(1).map((point,i)=>Math.sign(point[0]-stops[i][0]))
  assert.deepEqual(dx,[1,1,-1,-1,-1,-1,1,-1])
  assert.ok(stops.slice(1).every((point,i)=>point[1]>stops[i][1]))
  for(const edge of [0,1,2,3,4,5,6,7]){
    const a=sample((edge+.999999)/8.6),b=sample((edge+1)/8.6)
    assert.ok(Math.hypot(a.camera[0]-b.camera[0],a.camera[1]-b.camera[1])<.0001)
  }
})
test('mobile calendar extends future layout only and frames August of latest real year',async()=>{
  const {mobileCalendarDays,mobileCalendarStart}=await load('mobileContributionCalendar.js')
  const days=[{date:'2026-10-29',count:2,level:1},{date:'2026-10-30',count:0,level:0}]
  const result=mobileCalendarDays(days)
  assert.equal(mobileCalendarStart(days),'2026-08-01')
  assert.equal(result.at(-1).date,'2026-12-31')
  assert.deepEqual(result.slice(0,2),days)
  assert.ok(result.slice(2).every(day=>day.future&&day.count===null&&day.level===0))
  assert.equal(days.length,2)
})
