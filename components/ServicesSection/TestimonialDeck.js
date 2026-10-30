import {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {ArrowLeft, ArrowRight, Quote, Star} from 'lucide-react'
import {TESTIMONIALS} from './servicesData'
import styles from './TestimonialDeck.module.css'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/{}#*'
const useBrowserLayoutEffect=typeof window==='undefined'?useEffect:useLayoutEffect

function DecodingText({text, progress, as: Tag = 'span', className = '', elementRef}) {
  const visible = [...text].map((character, index) => {
    const threshold = ((index * 37 + 19) % 101) / 101
    const settled = progress >= 1 || /\s|[.,’'!?—–-]/.test(character) || progress > .12 + threshold * .8
    const glyph = settled ? character : GLYPHS[(index * 13 + Math.floor(progress * 83)) % GLYPHS.length]
    return <span key={index} className={settled ? undefined : index % 3 ? styles.cyanFragment : styles.violetFragment}>{glyph}</span>
  })
  return <Tag ref={elementRef} className={className}><span className={styles.srOnly}>{text}</span><span aria-hidden="true">{visible}</span></Tag>
}

function Rating({rating, decoding}) {
  // Existing portfolio entries have no rating. Do not manufacture five stars.
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) return null
  return <div className={`${styles.rating} ${decoding ? styles.ratingDecoding : ''}`} role="img" aria-label={`${rating} out of 5 stars`}>
    {[0,1,2,3,4].map(index => <span key={index} className={styles.star}>
      <Star aria-hidden="true" className={styles.starEmpty}/>
      <span className={styles.starFill} style={{width:`${Math.max(0,Math.min(1,rating-index))*100}%`}}><Star aria-hidden="true"/></span>
    </span>)}
  </div>
}

export default function TestimonialDeck({testimonials = TESTIMONIALS, className = '', style}) {
  const [index, setIndex] = useState(0)
  const [decode, setDecode] = useState(1)
  const [revision, setRevision] = useState(0)
  const rootRef=useRef(null)
  const quoteAreaRef=useRef(null),quoteRef=useRef(null),measureRef=useRef(null)
  const [visible,setVisible]=useState(false),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false),[hidden,setHidden]=useState(false)
  useEffect(()=>{
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting&&entry.intersectionRatio>.5),{threshold:[0,.5]})
    if(rootRef.current)observer.observe(rootRef.current)
    const visibility=()=>setHidden(document.hidden)
    visibility();document.addEventListener('visibilitychange',visibility)
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility)}
  },[])
  useEffect(()=>{
    if(!visible||hidden||hovered||focused||testimonials.length<2)return
    const timer=setTimeout(()=>{setIndex(value=>(value+1)%testimonials.length);setRevision(value=>value+1)},2000)
    return()=>clearTimeout(timer)
  },[visible,hidden,hovered,focused,index,revision,testimonials.length])
  const testimonial = testimonials[index % testimonials.length]

  useBrowserLayoutEffect(()=>{
    const area=quoteAreaRef.current,quote=quoteRef.current,measure=measureRef.current
    if(!area||!quote||!measure)return
    let disposed=false,frame=0
    const fit=()=>{
      if(disposed||area.clientHeight===0)return
      // Measure the settled message, not the changing decoder glyphs, so the
      // type stays still throughout each transition and the card never grows.
      measure.style.fontSize=''
      const maximum=parseFloat(getComputedStyle(measure).fontSize)
      let low=Math.min(12,maximum),high=maximum
      for(let pass=0;pass<9;pass++){
        const candidate=(low+high)/2
        measure.style.fontSize=`${candidate}px`
        if(measure.scrollHeight<=area.clientHeight*.96&&measure.scrollWidth<=measure.clientWidth)low=candidate
        else high=candidate
      }
      quote.style.fontSize=`${Math.floor(low*10)/10}px`
    }
    const schedule=()=>{if(!disposed){cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)}}
    const observer=new ResizeObserver(schedule)
    observer.observe(area)
    fit()
    document.fonts?.ready.then(schedule)
    return()=>{disposed=true;observer.disconnect();cancelAnimationFrame(frame)}
  },[testimonial?.quote])

  useEffect(() => {
    if (!revision) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {setDecode(1);return undefined}
    let frame = 0
    let started = null
    const advance = time => {
      if (started === null) started = time
      const progress = Math.min(1,(time-started)/620)
      setDecode(progress)
      if (progress < 1) frame = requestAnimationFrame(advance)
    }
    setDecode(0)
    frame = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(frame)
  }, [revision])

  if (!testimonial) return null
  function choose(direction) {
    setIndex(value => (value+direction+testimonials.length)%testimonials.length)
    setRevision(value => value+1)
  }

  return (
    <section ref={rootRef} className={`${styles.deck} ${className}`} style={style} aria-label="Client testimonials" data-testimonial-index={index}
      onPointerEnter={()=>setHovered(true)} onPointerLeave={()=>setHovered(false)}
      onFocus={()=>setFocused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false)}}>
      <div className={styles.card} data-accent={testimonial.accent}>
        <div className={styles.identity}>
          {testimonial.image ? <img className={styles.avatar} src={testimonial.image} alt=""/> : <span className={styles.monogram} aria-hidden="true">{testimonial.initials}</span>}
          <div className={styles.person} aria-live="polite" aria-atomic="true">
            <DecodingText as="h3" text={testimonial.name} progress={decode}/>
            {testimonial.role && <DecodingText as="p" text={testimonial.role} progress={decode}/>} 
            <Rating rating={testimonial.rating} decoding={decode<1}/>
          </div>
          <span className={styles.identityLine} aria-hidden="true"/>
        </div>
        <div ref={quoteAreaRef} className={styles.quoteArea}>
          <Quote className={styles.quoteMark} aria-hidden="true"/>
          <DecodingText elementRef={quoteRef} as="blockquote" text={testimonial.quote} progress={decode} className={styles.quote}/>
          <div ref={measureRef} className={`${styles.quote} ${styles.quoteMeasure}`} aria-hidden="true">{testimonial.quote}</div>
        </div>
        <div className={styles.controls}>
          <div className={styles.dots} role="group" aria-label="Choose testimonial">
            {testimonials.map((entry, entryIndex) => <button key={entry.id} type="button" aria-label={`Read testimonial ${entryIndex+1} from ${entry.name}`} aria-current={entryIndex===index ? 'true' : undefined} onClick={() => {if (index!==entryIndex){setIndex(entryIndex);setRevision(value=>value+1)}}}/>)}
          </div>
          <div className={styles.navigation}>
            <span className={styles.counter} aria-hidden="true">{String(index+1).padStart(2,'0')}<small> / {String(testimonials.length).padStart(2,'0')}</small></span>
            <button className={styles.previous} type="button" aria-label="Previous testimonial" onClick={() => choose(-1)} disabled={testimonials.length<2}><ArrowLeft aria-hidden="true"/></button>
            <button className={styles.next} type="button" aria-label="Next testimonial" onClick={() => choose(1)} disabled={testimonials.length<2}><ArrowRight aria-hidden="true"/></button>
          </div>
        </div>
      </div>
    </section>
  )
}
