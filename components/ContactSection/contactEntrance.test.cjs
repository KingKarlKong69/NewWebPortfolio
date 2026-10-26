const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const {pathToFileURL}=require('node:url')
const source=name=>readFileSync(join(__dirname,name),'utf8')
const load=text=>import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
const motion=load(source('contactEntranceMotion.js'))
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`)

test('entry requires a meaningful visible area, including tall mobile frames and direct Contact links',async()=>{
  const {contactEntryVisible:visible}=await motion
  assert.equal(visible({top:790,bottom:1590,height:800},800),false)
  assert.equal(visible({top:470,bottom:1270,height:800},800),false)
  assert.equal(visible({top:460,bottom:1260,height:800},800),true)
  assert.equal(visible({top:0,bottom:800,height:800},800),true)
  assert.equal(visible({top:0,bottom:2000,height:2000},600),true)
  assert.equal(visible({top:-2100,bottom:-100,height:2000},600),false)
})

test('the hole emerges continuously to ten percent, charges for exactly 1.5s and settles',async()=>{
  const {sampleContactEntrance:sample,CONTACT_ENTRANCE:k}=await motion
  assert.equal(k.chargeEnd-k.snapEnd,1.5)
  assert.equal(sample(0,false).phase,'waiting')
  for(const t of [0,.3,.899]){assert.equal(sample(t).size,0);assert.equal(sample(t).appearance,0)}
  near(sample(k.pullEnd).size,0)
  assert.equal(sample(1.2).phase,'emerging')
  assert.ok(sample(1.2).size>0&&sample(1.2).size<.1)
  for(const t of [k.snapEnd,2,3.14])near(sample(t).size,.1)
  assert.ok(sample(.85).focal>0&&sample(.85).size===0,'amber focal point precedes the silhouette')
  let previous=sample(k.pullEnd)
  for(let t=k.pullEnd+.001;t<k.snapEnd;t+=.001){
    const value=sample(t)
    assert.ok(value.size>=previous.size&&value.size-previous.size<.0003)
    assert.ok(value.appearance>=previous.appearance)
    assert.ok(value.recede<=previous.recede,'hole approaches from depth')
    previous=value
  }
  assert.equal(sample(k.snapEnd).phase,'charging')
  assert.equal(sample(k.chargeEnd).phase,'expanding')
  assert.equal(sample(k.growEnd).phase,'wave')
  near(sample(k.growEnd).size,1)
  const end=sample(k.end)
  assert.equal(end.phase,'settled');near(end.size,1);near(end.appearance,1);near(end.lensing,1)
  for(const key of ['pull','snap','recede','charge','wavePower','jitterX','jitterY','roll','pitch','focal'])near(end[key],0)
  near(end.flash,1)
  assert.deepEqual(sample(100),end)
})

test('one elapsed-time clock keeps 30/60/144fps aligned, pauses explicitly and cannot replay after completion',async()=>{
  const {advanceContactEntrance:advance,sampleContactEntrance:sample,CONTACT_ENTRANCE:k}=await motion
  const snapshots=[]
  for(const rate of [30,60,144]){
    const clock={started:false,elapsed:0,complete:false}
    advance(clock,3,false);assert.equal(clock.started,false)
    for(let i=0;i<rate*2;i++)advance(clock,1/rate,true)
    snapshots.push(sample(clock.elapsed))
    const old={...clock};advance(clock,99,false);assert.deepEqual(clock,old)
    advance(clock,NaN,true);near(clock.elapsed,2)
    for(let i=0;i<Math.ceil(rate*(k.end-2));i++)advance(clock,1/rate,true)
    assert.equal(clock.complete,true);near(clock.elapsed,k.end)
    advance(clock,10,true);near(clock.elapsed,k.end)
  }
  snapshots.forEach(value=>{assert.equal(value.phase,'charging');near(value.size,.1);near(value.charge,snapshots[0].charge)})
})

test('birth parameters remain bounded and the charge brightens before its final disappearance',async()=>{
  const {sampleContactEntrance:sample,CONTACT_ENTRANCE:k}=await motion
  assert.ok(sample(k.chargeEnd-.1).charge>sample(k.snapEnd+.1).charge)
  assert.ok(sample(k.chargeEnd+.1).charge<sample(k.chargeEnd).charge)
  assert.equal(sample(k.growEnd).charge,0)
  assert.ok(sample(2.0).jitterX!==0)
  for(let i=0;i<=Math.ceil(k.end*1000);i++){
    const t=i/1000,s=sample(t)
    for(const value of Object.values(s))if(typeof value==='number')assert.ok(Number.isFinite(value))
    for(const key of ['size','appearance','lensing','pull','snap','recede','charge','growth','wave','wavePower'])assert.ok(s[key]>=0&&s[key]<=1,`${key} at ${t}`)
    assert.ok(Math.abs(s.jitterX)<.012&&Math.abs(s.jitterY)<.009)
    assert.ok(Math.abs(s.tremor)<=1)
    if(t<k.snapEnd||t>=k.chargeEnd){near(s.jitterX,0);near(s.jitterY,0);near(s.tremor,0)}
  }
})

test('the universe tremor alternates quickly between pull and push during charging only',async()=>{
  const {sampleContactEntrance:sample,CONTACT_ENTRANCE:k}=await motion
  assert.equal(sample(0,false).tremor,0)
  let reversals=0,previous=0
  for(let t=k.snapEnd+.1;t<k.chargeEnd-.1;t+=1/120){
    const pulse=sample(t).tremor,sign=Math.sign(pulse)
    if(previous&&sign!==previous)reversals++
    previous=sign
  }
  assert.ok(reversals>20,'rapid alternating contraction and expansion')
  near(sample(k.chargeEnd).tremor,0)
  near(sample(k.end).tremor,0)
})

test('the wave reaches the farthest Contact corner before its power fades to zero',async()=>{
  const {contactWaveRadius:radius,sampleContactEntrance:sample}=await motion
  for(const aspect of [.6,16/9,2.5])for(const center of [[.69,.585],[.5,.54],[.85,.2]]){
    const bounds=[.045,-.2,.955,1.2],maximum=radius(center,bounds,aspect)
    const {CONTACT_ENTRANCE:k}=await motion
    const wave=sample(k.chargeEnd+.9)
    assert.ok(wave.wavePower>0)
    assert.ok(maximum*1.15*wave.wave>=maximum)
    for(const x of [bounds[0],bounds[0]+bounds[2]])for(const y of [bounds[1],bounds[1]+bounds[3]]){
      assert.ok(Math.hypot((x-center[0])*aspect,y-center[1])<=maximum+1e-10)
    }
  }
})

test('recession preserves the projected anchor and apparent scale; final transform returns exactly to the tuned one',async()=>{
  const {contactEntranceTransform:transform,sampleContactEntrance:sample,CONTACT_ENTRANCE:k}=await motion
  for(const height of [4,7,12])for(const time of [.95,1.1,2.2,3.3,k.end]){
    const birth=sample(time),result=transform(birth,10,height),anchor=.31*height
    near(anchor*result.compensation/(10-result.z),anchor/10)
    near(result.scale/(10-result.z),birth.size/10)
    assert.ok(result.z<=0)
  }
  assert.deepEqual(transform(sample(k.end),10,7),{z:-0,compensation:1,scale:1})
})

test('electrical ribbons have valid finite geometry with 12 main bolts and 24 branches',async()=>{
  const three=pathToFileURL(require.resolve('three').replace(/three\.cjs$/,'three.module.js')).href
  const {createContactChargeGeometry:create}=await load(source('contactChargeGeometry.js').replace("'three'",`'${three}'`))
  const geometry=create()
  try{
    const positions=geometry.getAttribute('position'),bolts=geometry.getAttribute('aBolt')
    assert.equal(positions.count,36*29*2);assert.equal(bolts.count,positions.count)
    assert.ok(positions.array.every(Number.isFinite));assert.ok(bolts.array.every(Number.isFinite))
    for(const i of geometry.index.array)assert.ok(i>=0&&i<positions.count)
    assert.equal(geometry.index.count,36*28*6)
  }finally{geometry.dispose()}
})

test('electrical and universe shaders have matching varyings and every custom uniform wired',async()=>{
  const charge=await load(source('contactChargeShaders.js'))
  const sky=await load(readFileSync(join(__dirname,'../ServicesSection/universeShaders.js'),'utf8'))
  const component=source('ContactCharge.js')
  const layers=readFileSync(join(__dirname,'../ServicesSection/UniverseLayers.js'),'utf8')
  const declarations=(text,type)=>[...text.matchAll(new RegExp(`${type}\\s+\\w+\\s+([^;]+);`,'g'))].flatMap(match=>match[1].split(',').map(value=>value.trim()))
  for(const [vertex,fragment,owner] of [[charge.CONTACT_CHARGE_VERTEX,charge.CONTACT_CHARGE_FRAGMENT,component],
    [charge.CONTACT_FOCAL_VERTEX,charge.CONTACT_FOCAL_FRAGMENT,component],
    [sky.STAR_VERTEX,sky.STAR_FRAGMENT,layers],[sky.UNIVERSE_VERTEX,sky.UNIVERSE_FRAGMENT,layers]]){
    const varyings=new Set(declarations(vertex,'varying'))
    declarations(fragment,'varying').forEach(value=>assert.ok(varyings.has(value),value))
    for(const uniform of new Set([...declarations(vertex,'uniform'),...declarations(fragment,'uniform')])){
      assert.ok(owner.includes(`${uniform}:{value:`),uniform)
    }
  }
})
