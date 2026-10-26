const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const source = readFileSync(join(__dirname, '../ProjectsSection/projectStoryMotion.js'), 'utf8')
const modulePromise = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

const atTravel = (sample, x) => {
  let low=0,high=1
  for(let i=0;i<60;i++) {
    const mid=(low+high)/2
    if(sample(mid).expeditionTravel<x)low=mid;else high=mid
  }
  return sample((low+high)/2)
}

test('the laptop entry and project scroll distances survive the longer native Skills runway', async () => {
  const { projectsSkillsLayout, sampleProjectsSkillsStory: sample } = await modulePromise
  const layout = projectsSkillsLayout(4)
  const distance=layout.height-100
  assert.equal(layout.projectsEnd*distance,1900)
  assert.ok(Math.abs((layout.transitionEnd-layout.projectsEnd)*distance-1550)<1e-9)
  assert.equal(layout.expeditionDistance,4800)
  const opening=sample(layout.skillsStop,4)
  assert.equal(opening.terrainFormation,1)
  assert.equal(opening.skillsReveal,1)
  assert.equal(opening.expeditionProgress,0)
  assert.equal(opening.expeditionTravel,-70)
  assert.equal(opening.introMorph,0)
  assert.equal(opening.introHold,1)
})

test('travel never pauses or surges between checkpoints and mountain reading windows', async () => {
  const { sampleSkillsExpedition: sample, SKILLS_CHECKPOINT_STOPS: stops, SKILLS_MOUNTAIN_DWELLS: windows } = await modulePromise
  let last=sample(0).expeditionTravel,low=Infinity,high=0
  for(let i=1;i<=20000;i++) {
    const p=i/20000,state=sample(p),speed=(state.expeditionTravel-last)*20000
    assert.ok(speed>500,'every forward scroll interval must advance the camera')
    low=Math.min(low,speed);high=Math.max(high,speed)
    last=state.expeditionTravel
  }
  assert.ok(high/low<1.000001,'the entire expedition, including the closing landscape, has one velocity')
  windows.forEach(([start,end],index)=>{
    assert.ok(sample(end).expeditionTravel>sample(start).expeditionTravel)
    const center=sample((start+end)/2)
    assert.equal(center.chapterIndex,index)
    assert.ok(center.chapterActivation>.85)
    assert.ok(stops[index]<start)
    assert.equal(sample(stops[index]).checkpointIndex,index)
    assert.equal(sample(stops[index]).checkpointReveal,1)
    assert.equal(sample(stops[index]).chapterActivation,0)
  })
})

test('the introductory copy persists until AI, then leaves only after the AI mountain', async()=>{
  const { sampleSkillsExpedition: sample } = await modulePromise
  for(const x of [-70,-52,0,88,176,264,310]) {
    const state=atTravel(sample,x)
    assert.equal(state.introHold,1)
    assert.equal(state.introMorph,0)
  }
  const ai=atTravel(sample,352)
  assert.equal(ai.introHold,1)
  assert.equal(ai.introMorph,1)
  assert.equal(ai.chapterIndex,4)
  assert.equal(atTravel(sample,400).introHold,0)
})

test('the world message stays formed and the post-AI ground runs ten times farther before Services',async()=>{
  const {sampleSkillsExpedition:sample}=await modulePromise
  assert.equal(atTravel(sample,410).endingReveal,1)
  for(const x of [450,600,900,1150]) {
    const state=atTravel(sample,x)
    assert.equal(state.endingReveal,1,'world text never gets an exit fade')
    assert.equal(state.terrainDissolve,0)
  }
  const end=sample(1)
  assert.equal(end.expeditionTravel-352,(455-352)*10)
  assert.equal(atTravel(sample,1040).whiteout,0,'extended travel is visible before the light')
  assert.equal(sample(.955).whiteout,1)
  assert.equal(sample(.955).servicesReveal,0)
  assert.equal(end.whiteout,1)
  assert.equal(end.servicesReveal,1)
  assert.equal(end.exitLight,1)
})

test('arbitrary forward and reverse seeks reconstruct every expedition channel exactly', async () => {
  const { sampleProjectsSkillsStory: sample } = await modulePromise
  const forward = Array.from({length: 2501}, (_, index) => sample(index / 2500, 4))
  const reusable = {}
  for (let index = forward.length - 1; index >= 0; index--) {
    assert.equal(sample(index / 2500, 4, reusable), reusable)
    assert.deepEqual(reusable, forward[index])
    assert.ok(Object.values(reusable).every(Number.isFinite))
  }
  for (const index of [30,2300,850,2499,0,1600]) assert.deepEqual(sample(index / 2500,4),forward[index])
})

test('camera velocity is continuous and all narrative channels stay bounded', async()=>{
  const {sampleSkillsExpedition:sample}=await modulePromise
  for(const p of [.01,.05,.1,.2,.3,.4,.5,.6,.7,.8,.9,.99]) {
    const epsilon=1e-6
    const a=sample(p-epsilon).expeditionTravel,b=sample(p).expeditionTravel,c=sample(p+epsilon).expeditionTravel
    assert.ok(Math.abs((b-a)-(c-b))/epsilon<.2,`velocity discontinuity at ${p}`)
  }
  for(let i=0;i<=10000;i++) {
    const state=sample(i/10000)
    for(const field of ['chapterActivation','routeReveal','checkpointReveal','checkpointDim','endingReveal','terrainDissolve','introHold','introMorph','exitLight','whiteout','servicesReveal'])assert.ok(state[field]>=0&&state[field]<=1,field)
    if(i)assert.ok(state.routeHead>=sample((i-1)/10000).routeHead)
    assert.equal(state.terrainDissolve,0)
  }
})

test('earlier desktop chapters keep native scroll sampling and delegate the toolset closing journey',()=>{
  const component=readFileSync(join(__dirname,'../ProjectsSection/ProjectsStory.js'),'utf8')
  assert.doesNotMatch(component,/skillsScrollGate|queueInput|preventDefault/)
  assert.match(component,/addEventListener\('scroll', onScroll, \{ passive: true \}\)/)
  assert.match(component,/useSkillsAutoTraverse\(\{runwayRef,motionRef,projectCount:projects.length\}\)/)
})
