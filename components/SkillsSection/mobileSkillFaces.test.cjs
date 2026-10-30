const assert = require('node:assert/strict')
const {test} = require('node:test')
const {readFileSync} = require('node:fs')
const {join} = require('node:path')
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const dataURL = asModule(readFileSync(join(__dirname,'skillsExpeditionData.js'),'utf8'))
const faces = import(asModule(readFileSync(join(__dirname,'mobileSkillFaces.js'),'utf8').replace("'./skillsExpeditionData'",`'${dataURL}'`)))

test('mobile faces expose every real skill exactly once with no face exceeding five icons', async()=>{
  const {MOBILE_SKILL_FACES} = await faces
  const {SKILLS_CHAPTERS} = await import(dataURL)
  const actual = MOBILE_SKILL_FACES.flatMap(face=>face.markerIds)
  assert.deepEqual(actual, SKILLS_CHAPTERS.flatMap(chapter=>chapter.markers.map(marker=>marker.id)))
  assert.equal(new Set(actual).size,actual.length)
  assert.ok(MOBILE_SKILL_FACES.every(face=>face.markerIds.length>0&&face.markerIds.length<=5))
})

test('all sides of one mountain precede the next category, including short final faces',async()=>{
  const {MOBILE_SKILL_FACES} = await faces
  const {SKILLS_CHAPTERS} = await import(dataURL)
  SKILLS_CHAPTERS.forEach((chapter,index)=>{
    const pages=MOBILE_SKILL_FACES.filter(face=>face.chapterIndex===index)
    assert.equal(pages.length,Math.ceil(chapter.markers.length/5))
    assert.deepEqual(pages.map(page=>page.pageIndex),pages.map((_,i)=>i))
    assert.ok(pages.every(page=>page.pageCount===pages.length))
    assert.equal(pages.at(-1).index-pages[0].index+1,pages.length)
  })
})

test('invalid face requests remain bounded and surface icon groups fit the mobile reading area',async()=>{
  const {mobileSkillFace,mobileFaceIconLayout,MOBILE_SKILL_FACES} = await faces
  for(const value of [NaN,Infinity,-100])assert.equal(mobileSkillFace(value),MOBILE_SKILL_FACES[0])
  assert.equal(mobileSkillFace(10000),MOBILE_SKILL_FACES.at(-1))
  for(let count=1;count<=5;count++){
    const locations=mobileFaceIconLayout(count)
    assert.equal(locations.length,count)
    assert.ok(locations.every(([x,y])=>x>.2&&x<.95&&y>.43&&y<.95))
    for(let a=0;a<locations.length;a++)for(let b=a+1;b<locations.length;b++){
      assert.ok(Math.hypot(locations[a][0]-locations[b][0],locations[a][1]-locations[b][1])>.16)
    }
  }
})
