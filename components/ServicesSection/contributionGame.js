// Presentation-only game state. Contribution counts and dates are never edited.
export const CONTRIBUTION_SPRITES={
  ship:'/game-style/spaceship-gif.gif',bullet:'/game-style/spaceship-bullet-gif.gif',
  explosion:'/game-style/explosion-gif.gif'
}
export const contributionHitPoints=level=>level>=4?3:level>=2?2:1
export const clampShipX=(x,width,halfShip=50)=>Math.max(halfShip,Math.min(Math.max(halfShip,width-halfShip),x))

export function createShipLife(){return {time:0,deadUntil:0,protectedUntil:2.5,bullets:1}}
export function advanceShipLife(life,delta){
  life.time+=Math.max(0,Number.isFinite(delta)?delta:0)
  const respawned=life.deadUntil>0&&life.time>=life.deadUntil
  if(respawned){life.deadUntil=0;life.protectedUntil=life.time+1.5}
  return respawned
}
export function destroyShip(life){
  if(life.deadUntil||life.time<life.protectedUntil)return false
  life.deadUntil=life.time+3;life.bullets=1;return true
}
export function upgradeShip(life,level){if(!life.deadUntil&&level>=4)life.bullets=2}

export function advanceCellRegeneration(pending,damage,delta){
  let next=damage
  pending.forEach((remaining,date)=>{
    if(remaining>delta)pending.set(date,remaining-delta)
    else {pending.delete(date);if(next===damage)next=new Map(damage);next.delete(date)}
  })
  return next
}

export function hitContribution(damage,day){
  const hp=contributionHitPoints(day.level),previous=damage.get(day.date)||0
  if(previous>=hp)return {damage,destroyed:false,hit:false}
  const next=new Map(damage);next.set(day.date,previous+1)
  return {damage:next,destroyed:previous+1===hp,hit:true}
}

// Swept collisions prevent a fast bullet from skipping a thin calendar cell.
// Pick the first still-intact cell encountered from below, consuming the shot.
export function stepContributionBullets(bullets,targets,delta,speed=420){
  const dt=Math.max(0,Math.min(.05,Number.isFinite(delta)?delta:0)),alive=[],hits=[]
  for(const bullet of bullets){
    const y=bullet.y-speed*dt
    let nearest=null
    for(const target of targets){
      if(target.destroyed||bullet.x<target.left-2||bullet.x>target.right+2)continue
      if(bullet.y>=target.top&&y<=target.bottom&&(!nearest||target.bottom>nearest.bottom))nearest=target
    }
    if(nearest)hits.push({id:bullet.id,date:nearest.date,x:bullet.x,y:nearest.bottom})
    else if(y>-40)alive.push({...bullet,y})
  }
  return {bullets:alive,hits}
}
