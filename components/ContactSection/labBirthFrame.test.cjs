const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const read=name=>readFileSync(join(__dirname,name),'utf8')
const load=name=>import(`data:text/javascript;base64,${Buffer.from(read(name)).toString('base64')}`)

// Execute the actual LabWorld frame body, not a duplicate of its birth logic.
// Renderer boundaries are mocked so this catches scope errors without WebGL.
function frameCallback(scope){
  const source=read('IsolatedBlackHoleScene.js')
  const marker='  useFrame((_, delta) => {'
  const start=source.indexOf(marker),end=source.indexOf('\n  }, -10)',start)
  assert.ok(start>=0&&end>start,'LabWorld frame callback exists')
  const body=source.slice(start+marker.length,end)
  return new Function(...Object.keys(scope),`return (_,delta)=>{${body}\n}`)(...Object.values(scope))
}

test('the real lab frame runs idle, advances every birth phase, pauses and replays without a ReferenceError',async()=>{
  const entrance=await load('contactEntranceMotion.js'),motion=await load('blackHoleMotion.js')
  let now=0
  const scope={contextLost:false,running:true,performance:{now:()=>now},
    birthClock:{current:{replay:0,started:false,elapsed:0,complete:false}},
    lastBirthFrame:{current:null},layoutRef:{current:{}},simulationRef:{current:{time:0,flow:0,turbulence:0}},
    valuesRef:{current:{rotationSpeed:1,pixelRatio:1}},sanitizeLabValue:(_,value)=>value,
    advanceBlackHoleMotion:motion.advanceBlackHoleMotion,
    advanceContactEntrance:entrance.advanceContactEntrance,sampleContactEntrance:entrance.sampleContactEntrance,
    gl:{domElement:{dataset:{},width:1280,height:720},info:{programs:[]},getPixelRatio:()=>1},
    statsRef:{current:{start:0,frames:0,slow:0,warmUntil:1500}},resolutionLimited:{current:false},
    adaptiveCap:2,lastRequestedDpr:{current:1},setAdaptiveCap:()=>{},onStatus:()=>{}}
  let frame=frameCallback(scope)
  frame(null,1/60)
  assert.equal(scope.gl.domElement.dataset.labBirthPhase,'idle')
  assert.equal(scope.layoutRef.current.entrance,null)
  scope.birthClock.current={replay:1,started:true,elapsed:0,complete:false}
  const phases=new Set()
  for(let i=0;i<=Math.ceil(entrance.CONTACT_ENTRANCE.end*60);i++){
    now=i*1000/60;frame(null,1/60)
    phases.add(scope.gl.domElement.dataset.labBirthPhase)
  }
  assert.deepEqual([...phases],['pulling','emerging','charging','expanding','wave','settled'])
  assert.equal(scope.birthClock.current.complete,true)
  assert.equal(scope.layoutRef.current.entrance.size,1)
  scope.birthClock.current={replay:2,started:true,elapsed:0,complete:false}
  scope.lastBirthFrame.current=null
  now+=100;frame(null,1/60);now+=500;frame(null,.05)
  assert.equal(scope.birthClock.current.elapsed,.5)
  scope.running=false;frame=frameCallback(scope)
  now+=10000;frame(null,.05)
  assert.equal(scope.birthClock.current.elapsed,.5)
  scope.running=true;frame=frameCallback(scope)
  now+=10000;frame(null,.05)
  assert.equal(scope.birthClock.current.elapsed,.5,'resume does not consume the paused wall-clock gap')
  now+=50;frame(null,.05)
  assert.ok(Math.abs(scope.birthClock.current.elapsed-.55)<1e-9)
  scope.contextLost=true;frame=frameCallback(scope)
  const before=scope.birthClock.current.elapsed
  now+=5000;frame(null,.05)
  assert.equal(scope.birthClock.current.elapsed,before)
})
