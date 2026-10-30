const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const desktop=url(readFileSync(join(__dirname,'projectStoryMotion.js'),'utf8'))
const skillsData=url(readFileSync(join(__dirname,'../SkillsSection/skillsExpeditionData.js'),'utf8'))
const faces=url(readFileSync(join(__dirname,'../SkillsSection/mobileSkillFaces.js'),'utf8').replace("'./skillsExpeditionData'",`'${skillsData}'`))
const modulePromise=import(url(readFileSync(join(__dirname,'mobileProjectsMotion.js'),'utf8').replace("'./projectStoryMotion'",`'${desktop}'`).replace("'../SkillsSection/mobileSkillFaces'",`'${faces}'`)))

test('mobile chapter navigation lands on readable real projects with an open powered screen',async()=>{
  const {mobileProjectStop,sampleMobileProjects}=await modulePromise
  for(const count of [1,4,6])for(let index=0;index<count;index++){
    const state=sampleMobileProjects(mobileProjectStop(index,count),count)
    assert.equal(state.projectIndex,index);assert.equal(state.lidOpen,1);assert.equal(state.screenPower,1)
    assert.equal(state.copyOpacity,1);assert.equal(state.screenCurrentIndex,index)
  }
})
test('mobile project screen handoff is continuous through each project boundary in either direction',async()=>{
  const {mobileProjectsLayout,sampleMobileProjects}=await modulePromise
  const {distance}=mobileProjectsLayout(4)
  const screen=state=>state.screenCurrentIndex*(1-state.screenMix)+state.screenNextIndex*state.screenMix
  for(let boundary=1;boundary<4;boundary++){
    const at=(180+boundary*190)/distance
    const before=sampleMobileProjects(at-.000001),after=sampleMobileProjects(at+.000001)
    assert.ok(Math.abs(screen(after)-screen(before))<.001)
    assert.ok(before.screenTransition>.99);assert.ok(after.screenTransition>.99)
  }
})
test('mobile portal enters the actual cosmos before mountains and traverses monotonically left to right',async()=>{
  const {mobileProjectsLayout,sampleMobileProjects}=await modulePromise
  const layout=mobileProjectsLayout(),start=layout.skillsStart
  const first=sampleMobileProjects(start)
  assert.equal(first.portalDolly,1);assert.equal(first.portalOpacity,1);assert.equal(first.worldExpand,1)
  assert.equal(first.terrainFormation,1);assert.equal(first.skillsReveal,1)
  let previous=-Infinity
  for(let step=0;step<=100;step++){
    const state=sampleMobileProjects(start+step/100*layout.mountains/layout.distance)
    assert.ok(state.expeditionTravel>=previous);previous=state.expeditionTravel
    assert.equal(state.checkpointIndex,-1)
  }
})
test('toolset has its own reading interval before a scroll-controlled white then black handoff',async()=>{
  const {mobileProjectsLayout,sampleMobileProjects}=await modulePromise
  const l=mobileProjectsLayout(),at=l.projects+l.portal+l.mountains
  const reading=sampleMobileProjects((at+l.ending*.7)/l.distance)
  assert.equal(reading.endingReveal,1);assert.equal(reading.whiteout,0);assert.equal(reading.mobileBlackout,0)
  const shine=sampleMobileProjects((l.distance-l.exit*.5)/l.distance)
  assert.equal(shine.whiteout,1);assert.equal(shine.mobileBlackout,0)
  assert.equal(sampleMobileProjects(1).mobileBlackout,1);assert.equal(sampleMobileProjects(1).whiteout,0)
  assert.deepEqual(sampleMobileProjects(.6),sampleMobileProjects(.6))
})
