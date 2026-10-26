const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs')
const api=import('data:text/javascript;base64,'+Buffer.from(readFileSync(`${__dirname}/journeyImageOrder.js`,'utf8')).toString('base64'))
test('randomized carousel order preserves originals and cannot repeat adjacent images across its cyclic boundary',async()=>{
  const {shuffleMemoryImages:shuffle}=await api,original=Object.freeze(['1','2','3','4','5'])
  const images=shuffle(original,()=>.25)
  assert.notDeepEqual(images,original);assert.deepEqual([...images].sort(),original)
  for(let i=0;i<20;i++)assert.notEqual(images[i%images.length],images[(i+1)%images.length])
  assert.deepEqual(original,['1','2','3','4','5'])
})
