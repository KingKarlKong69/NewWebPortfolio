import {useEffect,useRef,useState} from 'react'
import {CONTRIBUTION_SPRITES,clampShipX,stepContributionBullets,createShipLife,advanceShipLife,destroyShip,upgradeShip} from './contributionGame'
import styles from './ContributionField.module.css'

export default function ContributionShooter({arenaRef,active,paused,onHit,revision,mobile=false}){
  const shipRef=useRef(null),layerRef=useRef(null),shipX=useRef(.5),drag=useRef(null)
  const inputAt=useRef(0)
  const callbacks=useRef({onHit,paused});callbacks.current={onHit,paused}
  const [visible,setVisible]=useState(false)
  const engaged=active&&visible
  useEffect(()=>{Object.values(CONTRIBUTION_SPRITES).forEach(src=>{const image=new Image();image.src=src})},[])
  useEffect(()=>{
    const arena=arenaRef.current;if(!arena)return
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting&&entry.intersectionRatio>.4),{threshold:[0,.4,.6]})
    observer.observe(arena);return()=>observer.disconnect()
  },[arenaRef])

  useEffect(()=>{
    const arena=arenaRef.current,layer=layerRef.current,ship=shipRef.current
    if(!engaged||!arena||!layer||!ship)return
    let frame=0,last=0,elapsed=0,cooldown=0,serial=0,dirty=true,targets=[],shots=[]
    const life=createShipLife()
    let nextHazard=2,rocks=[]
    const nodes=new Map(),bursts=new Map()
    const measure=()=>{
      const bounds=arena.getBoundingClientRect(),scale=bounds.width/Math.max(1,arena.offsetWidth)
      targets=[...arena.querySelectorAll('[data-contribution-date]')].map(cell=>{
        const rect=cell.getBoundingClientRect()
        return {date:cell.dataset.contributionDate,element:cell,left:(rect.left-bounds.left)/scale,
          right:(rect.right-bounds.left)/scale,top:(rect.top-bounds.top)/scale,bottom:(rect.bottom-bounds.top)/scale}
      })
      dirty=false
    }
    const explosion=(x,y)=>{
      const node=document.createElement('img');node.src=CONTRIBUTION_SPRITES.explosion;node.alt=''
      node.className=styles.explosion;node.style.left=`${x}px`;node.style.top=`${y}px`
      layer.appendChild(node);bursts.set(node,elapsed+.8)
    }
    const clearShots=()=>{shots=[];nodes.forEach(node=>node.remove());nodes.clear()}
    const tick=now=>{
      frame=requestAnimationFrame(tick)
      const dt=Math.min(.05,Math.max(0,(now-(last||now))/1000));last=now
      if(document.hidden||callbacks.current.paused){clearShots();bursts.forEach((_,node)=>node.remove());bursts.clear();return}
      elapsed+=dt
      const width=arena.offsetWidth,height=arena.offsetHeight,half=ship.offsetWidth/2
      const respawned=advanceShipLife(life,dt),dead=life.deadUntil>0
      if(respawned){
        shipX.current=.5
        ship.animate?.([{opacity:0,transform:'translate(-50%,160%)'},{opacity:1,transform:'translate(-50%,0)'}],{duration:650,easing:'ease-out'})
      }
      ship.style.visibility=dead?'hidden':'';ship.disabled=dead
      ship.dataset.bullets=String(life.bullets)
      ship.style.filter=!dead&&elapsed<life.protectedUntil?'drop-shadow(0 0 12px #80edff)':''
      if(!dead&&!drag.current&&now-inputAt.current>2000){
        const wanted=.5+Math.sin(elapsed*.58)*.36
        shipX.current+=(wanted-shipX.current)*(1-Math.exp(-dt*2))
      }
      const x=clampShipX(shipX.current*width,width,half)
      ship.style.left=`${x}px`
      if(dirty)measure()
      // The entrance is time driven: pausing scroll does not pause the ascent.
      if(elapsed<.95)return
      if(elapsed>=nextHazard){
        nextHazard=elapsed+1.2+Math.random()*1.3
        const node=document.createElement('span');node.className=styles.fallingAsteroid;layer.appendChild(node)
        rocks.push({node,x:width*(.08+Math.random()*.84),y:-35,r:mobile?7+Math.random()*6:15+Math.random()*15,speed:mobile?55+Math.random()*45:90+Math.random()*90,angle:Math.random()*6})
      }
      rocks=rocks.filter(rock=>{
        rock.y+=rock.speed*dt;rock.angle+=dt
        const shipY=height-18-ship.offsetHeight*.5
        const overlap=Math.abs(rock.x-x)<half*.65+rock.r&&Math.abs(rock.y-shipY)<ship.offsetHeight*.35+rock.r
        const hit=overlap&&destroyShip(life)
        if(hit){explosion(x,shipY);clearShots();drag.current=null}
        const keep=!hit&&rock.y<height+50
        if(!keep)rock.node.remove()
        else {rock.node.style.width=rock.node.style.height=`${rock.r*2}px`;rock.node.style.transform=`translate(${rock.x-rock.r}px,${rock.y-rock.r}px) rotate(${rock.angle}rad)`}
        return keep
      })
      cooldown-=dt
      if(cooldown<=0&&!life.deadUntil){
        cooldown=.22
        for(const offset of life.bullets===2?(mobile?[-7,7]:[-13,13]):[0]){
        const shot={id:++serial,x:x+offset,y:height-18-ship.offsetHeight+10}
        const node=document.createElement('img');node.src=CONTRIBUTION_SPRITES.bullet;node.alt=''
        node.className=styles.bullet;layer.appendChild(node);nodes.set(shot.id,node);shots.push(shot)
        }
      }
      targets.forEach(target=>{target.destroyed=target.element.dataset.destroyed==='true'})
      const stepped=stepContributionBullets(shots,targets,dt,mobile?Math.max(220,height*.52):Math.max(360,height*.7))
      const alive=new Set(stepped.bullets.map(shot=>shot.id))
      nodes.forEach((node,id)=>{if(!alive.has(id)){node.remove();nodes.delete(id)}})
      shots=stepped.bullets
      shots.forEach(shot=>{const node=nodes.get(shot.id);node.style.left=`${shot.x}px`;node.style.top=`${shot.y}px`})
      stepped.hits.forEach(hit=>{
        const target=targets.find(cell=>cell.date===hit.date)
        if(callbacks.current.onHit(hit.date)){
          upgradeShip(life,Number(target?.element.dataset.level))
          if(target)target.destroyed=true
          explosion(target?(target.left+target.right)/2:hit.x,target?(target.top+target.bottom)/2:hit.y)
        }else if(target){
          target.element.animate?.([{filter:'brightness(3)'},{filter:'brightness(1)'}],{duration:140})
        }
      })
      bursts.forEach((until,node)=>{if(elapsed>=until){node.remove();bursts.delete(node)}})
    }
    const invalidate=()=>{dirty=true}
    const resize=new ResizeObserver(invalidate);resize.observe(arena)
    arena.addEventListener('scroll',invalidate,true);addEventListener('resize',invalidate)
    frame=requestAnimationFrame(tick)
    return()=>{cancelAnimationFrame(frame);resize.disconnect();removeEventListener('resize',invalidate);arena.removeEventListener('scroll',invalidate,true);clearShots();bursts.forEach((_,node)=>node.remove());rocks.forEach(rock=>rock.node.remove());ship.style.visibility='';ship.disabled=false}
  },[engaged,revision,arenaRef,mobile])

  const move=clientX=>{
    inputAt.current=performance.now()
    const arena=arenaRef.current,ship=shipRef.current;if(!arena||!ship)return
    const bounds=arena.getBoundingClientRect(),scale=bounds.width/Math.max(1,arena.offsetWidth)
    const x=clampShipX((clientX-bounds.left)/scale,arena.offsetWidth,ship.offsetWidth/2)
    shipX.current=x/arena.offsetWidth;ship.style.left=`${x}px`
  }
  return <div ref={layerRef} className={styles.gameLayer} data-active={engaged?'true':'false'}>
    <button ref={shipRef} className={styles.ship} type="button" tabIndex={engaged?0:-1}
      aria-label="Spaceship. Drag horizontally or use left and right arrow keys to aim. Fires automatically."
      onPointerDown={event=>{
        if(!engaged)return;event.preventDefault()
        inputAt.current=performance.now()
        const bounds=event.currentTarget.getBoundingClientRect()
        drag.current={id:event.pointerId,offset:event.clientX-(bounds.left+bounds.width/2)}
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event=>{if(drag.current?.id===event.pointerId)move(event.clientX-drag.current.offset)}}
      onPointerUp={event=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}}
      onPointerCancel={()=>{drag.current=null}}
      onLostPointerCapture={()=>{drag.current=null}}
      onKeyDown={event=>{
        if(!['ArrowLeft','ArrowRight','a','A','d','D'].includes(event.key))return
        event.preventDefault();const arena=arenaRef.current,rect=arena.getBoundingClientRect()
        const sign=['ArrowLeft','a','A'].includes(event.key)?-1:1
        move(rect.left+(shipX.current*arena.offsetWidth+sign*28)*rect.width/arena.offsetWidth)
      }}>
      <img src={CONTRIBUTION_SPRITES.ship} alt="" draggable="false"/>
    </button>
  </div>
}
