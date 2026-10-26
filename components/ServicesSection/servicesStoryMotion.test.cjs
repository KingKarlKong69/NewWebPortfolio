const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const source=readFileSync(join(__dirname,'servicesStoryMotion.js'),'utf8')
const motion=import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('Services camera discovers all world words before disintegration and left-to-right assembly',async()=>{
  const {sampleServicesStory:sample}=await motion
  const phases=[0,.15,.28,.37,.45,.56,.74,.92].map(p=>sample(p).phase)
  assert.deepEqual(phases,['services','what','i','offer','together','disintegrate','assemble','deck'])
  assert.ok(sample(.16).camera[0]<0)
  assert.ok(sample(.28).camera[0]>0)
  assert.ok(sample(.38).camera[0]>sample(.28).camera[0])
  assert.equal(sample(.47).dissolve,0)
  assert.equal(sample(.64).dissolve,1)
  assert.equal(sample(.9).deck,1)
})
test('camera and particle reconstruction are deterministic, continuous and exact in reverse',async()=>{
  const {sampleServicesStory:sample,sampleServiceParticle:particle}=await motion
  const source=[-4,-8,.3],target=[7,-15,.4]
  const samples=Array.from({length:1001},(_,i)=>sample(i/1000))
  samples.forEach((state,i)=>{
    assert.deepEqual(sample(i/1000),state)
    if(i)assert.ok(Math.hypot(...state.camera.map((v,j)=>v-samples[i-1].camera[j]))<.7)
    for(const v of state.camera)assert.ok(Number.isFinite(v))
  })
  for(let i=1000;i>=0;i--){
    assert.deepEqual(sample(i/1000),samples[i])
    assert.deepEqual(particle(source,target,.32,i/1000),particle(source,target,.32,i/1000))
  }
  assert.deepEqual(particle(source,target,.32,0),source)
  assert.deepEqual(particle(source,target,.32,1),target)
  const left=particle(source,target,.02,.75),right=particle(source,target,.98,.75)
  assert.ok(Math.hypot(...left.map((v,i)=>v-target[i]))<Math.hypot(...right.map((v,i)=>v-target[i])))
})
