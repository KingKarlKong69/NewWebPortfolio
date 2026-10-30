const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const loaded=import(`data:text/javascript;base64,${Buffer.from(readFileSync(join(__dirname,'mobileChapterGestures.js'),'utf8')).toString('base64')}`)
test('one deliberate vertical or horizontal swipe selects one direction regardless of travel',async()=>{
  const {mobileSwipeDirection}=await loaded
  assert.equal(mobileSwipeDirection(0,-30),1)
  assert.equal(mobileSwipeDirection(-800,-3),1)
  assert.equal(mobileSwipeDirection(0,900),-1)
  assert.equal(mobileSwipeDirection(12,-10),0)
  assert.equal(mobileSwipeDirection(NaN,60),0)
})
test('adjacent reading stops advance exactly one project or mountain face and release boundaries',async()=>{
  const {adjacentMobileStop}=await loaded
  const stops=[.1,.2,.3,.4]
  assert.equal(adjacentMobileStop(stops,1,1,0,.5),.3)
  assert.equal(adjacentMobileStop(stops,1,-1,0,.5),.1)
  assert.equal(adjacentMobileStop(stops,3,1,0,.5),.5)
  assert.equal(adjacentMobileStop(stops,0,-1,0,.5),0)
})
