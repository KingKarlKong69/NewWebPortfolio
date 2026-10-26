const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs')
const entrance=import('data:text/javascript;base64,'+Buffer.from(readFileSync(`${__dirname}/contactEntranceMotion.js`,'utf8')).toString('base64'))

test('actual contact click handler enforces the two-second cooldown and ignores an unfinished birth',()=>{
  const source=readFileSync(`${__dirname}/ContactSection.js`,'utf8')
  const start=source.indexOf('  const blast=()=>{'),end=source.indexOf('\n  }',start)
  assert.ok(start>=0&&end>start)
  let now=0,count=0
  const scope={performance:{now:()=>now},blastAt:{current:-Infinity},blastTimer:{current:0},
    journeyRef:{current:{entrance:{phase:'charging'}}},setBlastCooling:()=>{},dispatchEvent:()=>count++,Event,
    clearTimeout:()=>{},setTimeout:()=>1}
  const blast=new Function(...Object.keys(scope),source.slice(start,end+4)+';return blast')(...Object.values(scope))
  blast();assert.equal(count,0)
  scope.journeyRef.current.entrance.phase='settled'
  blast();blast();assert.equal(count,1)
  now=1999;blast();assert.equal(count,1)
  now=2000;blast();assert.equal(count,2)
})

test('actual entrance hook reuses settled geometry and sends a complete wave for a click blast',async()=>{
  const api=await entrance,source=readFileSync(`${__dirname}/useContactEntrance.js`,'utf8')
  const frames=new Map(),events=new Map(),root={dataset:{}},journeyRef={current:{}}
  let clock=null,cleanup,id=0,now=0
  const scope={...api,useRef:value=>({current:clock??=(value)}),useEffect:effect=>{cleanup=effect()},
    requestAnimationFrame:callback=>{frames.set(++id,callback);return id},cancelAnimationFrame:id=>frames.delete(id),
    addEventListener:(name,callback)=>events.set(name,callback),removeEventListener:name=>events.delete(name),
    dispatchEvent:()=>{},Event,document:{hidden:false}}
  const hook=new Function(...Object.keys(scope),source.slice(source.indexOf('export default function')).replace('export default ','')+';return useContactEntrance')(...Object.values(scope))
  hook({sectionRef:{current:root},journeyRef,hasEntered:true,sceneReady:true,unavailable:false,reducedMotion:false,pageVisible:true,isVisible:true})
  const step=()=>{now+=1000/60;const current=[...frames.values()];frames.clear();current.forEach(frame=>frame(now))}
  for(let i=0;i<300;i++)step()
  assert.equal(journeyRef.current.entrance.phase,'settled');assert.equal(journeyRef.current.entrance.size,1)
  events.get('contact:blast')();let peak=0
  for(let i=0;i<90;i++){step();const state=journeyRef.current.entrance;assert.equal(state.size,1);peak=Math.max(peak,state.wavePower)}
  assert.ok(peak>.8);assert.equal(journeyRef.current.entrance.wavePower,0)
  assert.equal(frames.size,0);cleanup();assert.equal(events.size,0)
})
