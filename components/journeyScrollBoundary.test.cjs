const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const api = import(`data:text/javascript;base64,${Buffer.from(readFileSync(`${__dirname}/journeyScrollBoundary.js`,'utf8')).toString('base64')}`)
const bounds = {previous:950,next:1300,start:900,gate:1000,ascentDistance:100,phase:'gate'}
test('large scroll and keyboard/scrollbar jumps cannot bypass unfinished memories',async()=>{
  const {constrainJourneyScroll:c}=await api
  for(const phase of ['gate','charging','forming','reading','ready','absorbing','centering','centerSettle']) {
    assert.equal(c({...bounds,phase}),1000)
    assert.equal(c({...bounds,previous:0,next:100000,phase}),1000)
  }
})
test('descent and upward scrolling remain possible before the gate',async()=>{
  const {constrainJourneyScroll:c}=await api
  assert.equal(c({...bounds,previous:850,next:970}),970)
  assert.equal(c({...bounds,previous:1000,next:800}),800)
})
test('ascent reserves one viewport and releases only after completion',async()=>{
  const {constrainJourneyScroll:c,journeyAscentAt:a}=await api
  assert.equal(c({...bounds,phase:'ascending',next:1050}),1050)
  assert.equal(c({...bounds,phase:'ascending',next:99999}),1100)
  assert.equal(c({...bounds,phase:'done',next:99999}),99999)
  assert.equal(a(1050,1000,100),.5)
  assert.equal(a(900,1000,100),0)
  assert.equal(a(1200,1000,100),1)
})
test('explicit navigation and existing deep positions are not pulled into Journey',async()=>{
  const {constrainJourneyScroll:c}=await api
  assert.equal(c({...bounds,bypass:true}),1300)
  assert.equal(c({...bounds,previous:5000,next:4900}),4900)
})
test('returning from Projects cannot jump over the reverse memories',async()=>{
  const {constrainJourneyScroll:c}=await api
  assert.equal(c({...bounds,previous:5000,next:500,phase:'done',engaged:true}),1000)
  for (const phase of ['ascending','centerSettle','centering','absorbing','forming','reading','ready']) {
    assert.equal(c({...bounds,previous:1000,next:0,phase,engaged:true}),1000)
  }
})
test('only the restored initial gate or an explicit exit releases upward travel',async()=>{
  const {constrainJourneyScroll:c}=await api
  assert.equal(c({...bounds,previous:1000,next:800,phase:'gate',engaged:true}),800)
  assert.equal(c({...bounds,previous:1000,next:800,phase:'ready',engaged:true,exitRequested:true}),800)
  assert.equal(c({...bounds,previous:1000,next:800,phase:'ready',engaged:true,bypass:true}),800)
})
