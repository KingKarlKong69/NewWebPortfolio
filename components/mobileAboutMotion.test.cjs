const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const modulePromise=import(`data:text/javascript;base64,${Buffer.from(readFileSync(join(__dirname,'mobileAboutMotion.js'),'utf8')).toString('base64')}`)

test('every scroll milestone has a readable hold and selects its real year index',async()=>{
  const {sampleMobileAbout,MOBILE_ABOUT_TRAVEL}=await modulePromise
  for(let index=0;index<5;index++){
    const frame=sampleMobileAbout((11.5+index*2+1)/MOBILE_ABOUT_TRAVEL)
    assert.equal(frame.memoryIndex,index)
    assert.equal(frame.memoryOpacity,1)
    assert.ok(Math.abs(frame.coreX-.085)<1e-9)
    assert.ok(frame.coreScale<.2)
  }
})
test('ascent is reversible and follows scroll sampling rather than elapsed time',async()=>{
  const {sampleMobileAbout,MOBILE_ABOUT_TRAVEL}=await modulePromise
  const at=t=>sampleMobileAbout(t/MOBILE_ABOUT_TRAVEL)
  const start=at(22.3),middle=at(22.9),end=at(23.5)
  assert.equal(start.coreX,.5)
  assert.ok(start.coreY>middle.coreY&&middle.coreY>end.coreY)
  assert.equal(end.coreOpacity,0)
  assert.deepEqual(at(22.9),middle)
  assert.equal(at(22.3).ascend,0)
})
test('invalid inputs are safe, and core placement stays continuous across each memory handoff',async()=>{
  const {sampleMobileAbout,MOBILE_ABOUT_TRAVEL}=await modulePromise
  for(const value of [NaN,undefined,-1,Infinity,0,.5,1,2]){
    const frame=sampleMobileAbout(value)
    assert.ok(Object.values(frame).filter(v=>typeof v==='number').every(Number.isFinite))
    assert.ok(frame.coreOpacity>=0&&frame.coreOpacity<=1)
  }
  // A stop ends with a small departure down the line; the next stop enters
  // after a blank content interval, with no year text overlapping.
  for(let index=1;index<5;index++){
    const boundary=11.5+index*2
    const before=sampleMobileAbout((boundary-.0001)/MOBILE_ABOUT_TRAVEL)
    const after=sampleMobileAbout((boundary+.0001)/MOBILE_ABOUT_TRAVEL)
    assert.ok(before.memoryOpacity<.001&&after.memoryOpacity<.001)
    assert.ok(Math.abs(before.coreX-after.coreX)<.001)
    assert.ok(Math.abs(before.coreY-after.coreY)<.001)
    assert.ok(Math.abs(before.lineTravel-after.lineTravel)<.001)
  }
})

test('finite memory rail exposes at most one pin and the core leads its camera follow',async()=>{
  const {sampleMobileAbout,MOBILE_ABOUT_TRAVEL}=await modulePromise
  const at=t=>sampleMobileAbout(t/MOBILE_ABOUT_TRAVEL)
  for(let t=11.5;t<=21.5;t+=.017){
    const frame=at(t)
    assert.ok(frame.pinPositions.filter(y=>y>=0&&y<=1).length<=1)
    assert.ok(Math.abs(frame.lineStart+frame.lineHeight-frame.pinPositions[4])<1e-9)
    assert.ok(Math.abs(frame.lineStart-frame.pinPositions[0])<1e-9)
  }
  const hold=at(12.5),depart=at(12.9)
  assert.ok(depart.coreY>hold.coreY)
  assert.equal(depart.lineCamera,hold.lineCamera)
  assert.equal(at(20.5).pinPositions[4],.23)
})

test('mobile intro and underline progress are reversible and the core grows before ascent',async()=>{
  const {sampleMobileAbout,MOBILE_ABOUT_TRAVEL}=await modulePromise
  const at=t=>sampleMobileAbout(t/MOBILE_ABOUT_TRAVEL)
  assert.equal(at(0).introOpacity,1)
  assert.equal(at(0).backgroundOpacity,0)
  assert.equal(at(2).introOpacity,0)
  assert.ok(at(7.5).underlineProgress>at(3).underlineProgress)
  assert.deepEqual(at(3),at(3))
  assert.ok(at(22.3).coreScale>at(21.5).coreScale*3)
  assert.equal(at(22.3).ascend,0)
})

