const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const load=file=>import('data:text/javascript;base64,'+Buffer.from(readFileSync(join(__dirname,file),'utf8')).toString('base64'))
const auto=load('skillsAutoTraverse.js')
function harness(create){
  let y=1000,time=0,id=0,hidden=false,ready=true
  const frames=new Map(),geometry={gate:1000,end:9000,viewport:1000}
  const controller=create({getGeometry:()=>geometry,getY:()=>y,seek:value=>{y=value},isReady:()=>ready,isHidden:()=>hidden,
    requestFrame:callback=>{frames.set(++id,callback);return id},cancelFrame:key=>frames.delete(key),now:()=>time})
  return {controller,geometry,get y(){return y},set y(value){y=value},
    set hidden(value){hidden=value;controller.visibility()},set ready(value){ready=value},
    step(ms=16){time+=ms;const work=[...frames.values()];frames.clear();work.forEach(callback=>callback(time))},
    input(delta=120,discrete=true,gap=100){time+=gap;const taken=controller.input(delta,time,discrete);if(!taken){y+=delta;controller.sync()}return taken},
    finish(){for(let i=0;i<650&&controller.snapshot().traveling;i++)this.step(16);assert.equal(controller.snapshot().traveling,false)},
    forward(){for(let i=0;i<7;i++)this.input();assert.equal(controller.snapshot().phase,'forward')}}
}
test('six gestures move natively; seventh flies from the current position; reverse releases at toolset',async()=>{
  const h=harness((await auto).createSkillsAutoTraverse)
  for(let i=1;i<=6;i++){assert.equal(h.input(),false);assert.equal(h.controller.snapshot().count,i);assert.equal(h.y,1000+i*120)}
  const from=h.y
  assert.equal(h.input(),true);h.step();assert.equal(h.y,from,'no rewind on takeover')
  h.step(1000);assert.ok(h.y>from&&h.y<9000)
  h.finish();assert.equal(h.y,9000)
  h.input(-120);h.finish();assert.equal(h.y,1000)
  assert.deepEqual(h.controller.snapshot(),{phase:'native',count:0,traveling:false})
  assert.equal(h.input(),false);assert.equal(h.y,1120)
})
test('touchpad momentum counts once; distinct notches count separately',async()=>{
  const {createSkillsGestureReader:create}=await auto
  const pad=create();let count=0
  for(let i=0;i<100;i++)if(pad.read(4,i*16)>0)count++
  assert.equal(count,1);assert.equal(pad.read(20,2000),1);assert.equal(pad.read(-20,2020),-1)
  const wheel=create();count=0
  for(let i=0;i<7;i++)if(wheel.read(120,i*100,true)>0)count++
  assert.equal(count,7)
})
test('only emerged text arms counting; upward browsing and navigation never seek',async()=>{
  const h=harness((await auto).createSkillsAutoTraverse)
  h.ready=false;h.input();assert.equal(h.controller.snapshot().count,0)
  h.ready=true;h.input();assert.equal(h.controller.snapshot().count,1)
  h.input(-120);assert.equal(h.controller.snapshot().count,0)
  h.controller.cancel(true);h.y=11000;h.controller.sync();assert.equal(h.y,11000)
  assert.equal(h.input(-120),false)
})
test('hidden time pauses travel, reverse interrupts forward, and navigation cancels',async()=>{
  const h=harness((await auto).createSkillsAutoTraverse)
  h.forward();h.step();h.step(1000)
  const before=h.y;h.hidden=true;h.step(60000);assert.equal(h.y,before)
  h.hidden=false;h.step();assert.equal(h.y,before)
  h.input(-120);h.finish();assert.equal(h.y,1000)
  h.forward();h.step();h.step(1000);h.controller.cancel(true)
  const canceled=h.y;h.step(10000);assert.equal(h.y,canceled)
  h.controller.dispose()
})
test('relayout does not snap native travel; reverse destination is formed before whiteout',async()=>{
  const h=harness((await auto).createSkillsAutoTraverse)
  h.input();h.geometry.gate=1300;h.controller.relayout();assert.equal(h.y,1120)
  const motion=await load('../ProjectsSection/projectStoryMotion.js')
  for(const count of [1,4,8]){
    const layout=motion.projectsSkillsLayout(count)
    const state=motion.sampleProjectsSkillsStory(layout.transitionEnd+(1-layout.transitionEnd)*motion.SKILLS_TOOLSET_STOP,count)
    assert.ok(Math.abs(state.expeditionTravel-410)<1e-8)
    assert.equal(state.endingReveal,1);assert.equal(state.whiteout,0)
  }
})
