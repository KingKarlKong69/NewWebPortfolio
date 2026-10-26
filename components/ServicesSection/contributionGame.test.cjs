const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync,existsSync}=require('node:fs')
const {join}=require('node:path')
const source=readFileSync(join(__dirname,'contributionGame.js'),'utf8')
const game=import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('cells regenerate at 1.2 seconds and restore original durability without modifying data',async()=>{
  const {advanceCellRegeneration:advance,hitContribution:hit}=await game
  const day=Object.freeze({date:'2026-10-27',level:4,count:25})
  let damage=new Map([[day.date,3]]),pending=new Map([[day.date,1200]])
  damage=advance(pending,damage,1199);assert.equal(damage.get(day.date),3)
  damage=advance(pending,damage,1);assert.equal(damage.has(day.date),false);assert.equal(pending.size,0)
  assert.equal(hit(damage,day).destroyed,false);assert.equal(day.count,25)
})
test('ship upgrade caps at two, collision resets it, and respawn occurs after three active seconds with protection',async()=>{
  const {createShipLife:create,advanceShipLife:advance,destroyShip:hit,upgradeShip:upgrade}=await game
  const life=create();assert.equal(hit(life),false)
  advance(life,3);upgrade(life,3);assert.equal(life.bullets,1)
  for(let i=0;i<10;i++)upgrade(life,4)
  assert.equal(life.bullets,2);assert.equal(hit(life),true);assert.equal(life.bullets,1)
  assert.equal(hit(life),false);assert.equal(advance(life,2.999),false)
  assert.equal(advance(life,.001),true);assert.equal(hit(life),false)
  advance(life,1.5);assert.equal(hit(life),true)
})

test('intensity controls 1/2/3 hit points; destruction does not mutate contribution data',async()=>{
  const {hitContribution:hit,contributionHitPoints:hp}=await game
  assert.deepEqual([0,1,2,3,4].map(hp),[1,1,2,2,3])
  for(let level=0;level<=4;level++){
    const day=Object.freeze({date:`2026-10-${20+level}`,count:level*7,level})
    let damage=new Map()
    for(let n=1;n<=hp(level);n++){
      const previous=damage,result=hit(damage,day);damage=result.damage
      assert.equal(previous.get(day.date)||0,n-1)
      assert.equal(result.hit,true);assert.equal(result.destroyed,n===hp(level))
    }
    assert.equal(hit(damage,day).destroyed,false,'do not trigger repeated explosions')
    assert.equal(hit(damage,day).damage,damage)
    assert.equal(day.count,level*7)
  }
})

test('swept bullets hit the nearest intact cell, consume one shot and pass destroyed cells',async()=>{
  const {stepContributionBullets:step}=await game
  const targets=[{date:'above',left:10,right:20,top:95,bottom:100},
    {date:'below',left:10,right:20,top:110,bottom:115}]
  const shot={id:1,x:15,y:125}
  let result=step([shot],targets,.05,800)
  assert.equal(result.hits[0].date,'below');assert.equal(result.bullets.length,0)
  result=step([shot],[targets[0],{...targets[1],destroyed:true}],.05,800)
  assert.equal(result.hits[0].date,'above')
  assert.equal(shot.y,125)
  assert.equal(step([{...shot,x:30}],targets,.05,800).hits.length,0)
  assert.equal(step([{...shot,y:80}],targets,.05,800).hits.length,0,'do not hit boxes behind a bullet')
  assert.equal(step([shot],[],100,800).bullets[0].y,85,'cap resume-time deltas')
  assert.equal(step([shot],[],NaN,800).bullets[0].y,125)
  assert.equal(step([{...shot,y:-39}],[],.05,800).bullets.length,0,'discard offscreen bullets')
})

test('horizontal ship bounds stay inside the arena and all supplied sprite paths exist',async()=>{
  const {clampShipX:clamp,CONTRIBUTION_SPRITES:sprites}=await game
  assert.equal(clamp(-100,1000),50);assert.equal(clamp(2000,1000),950)
  assert.equal(clamp(500,1000),500)
  for(const path of Object.values(sprites))assert.ok(existsSync(join(__dirname,'../../public',path)))
})
