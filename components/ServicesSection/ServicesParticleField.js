import styles from './ServicesParticleField.module.css'
import {SPACE_ANCHORS as PARTICLES} from './spaceStarData'

// Shared deterministic positions make the end of Skills and start of Services
// the same receiving atmosphere, including when the visitor scrolls backward.

export default function ServicesParticleField(){
  return <div className={styles.field} aria-hidden="true" data-services-particles>
    <div className={styles.haze}/>
    {PARTICLES.map((particle,index)=><span key={index} className={particle.violet?styles.violet:undefined} style={{left:`${particle.x.toFixed(3)}%`,top:`${particle.y.toFixed(3)}%`,width:Number(particle.size.toFixed(3)),height:Number(particle.size.toFixed(3)),
      animationDelay:`${particle.phase.toFixed(3)}s`,animationDuration:`${particle.duration.toFixed(3)}s`}}/>)}
  </div>
}
