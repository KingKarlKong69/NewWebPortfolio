import {useEffect, useMemo, useRef, useState} from 'react'
import {ArrowUpRight, RotateCcw, Pause, Play} from 'lucide-react'
import {calendarWeeks, GITHUB_PROFILE} from './contributionData'
import {contributionHitPoints,hitContribution,advanceCellRegeneration} from './contributionGame'
import ContributionShooter from './ContributionShooter'
import {mobileCalendarDays,mobileCalendarStart} from './mobileContributionCalendar'
import styles from './ContributionField.module.css'

const DATE_FORMAT = {month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'}
const dateFormatter=new Intl.DateTimeFormat('en-US',DATE_FORMAT)
const friendlyDate = date => dateFormatter.format(new Date(`${date}T00:00:00Z`))

export default function ContributionField({className = '', style, active = true,playActive=true,mobile=false}) {
  const [calendar, setCalendar] = useState(null)
  const [status, setStatus] = useState('loading')
  const [focused, setFocused] = useState(null)
  const [keyboardDate, setKeyboardDate] = useState(null)
  const [damage,setDamage]=useState(new Map()),damageRef=useRef(new Map())
  const [paused,setPaused]=useState(false),[revision,setRevision]=useState(0)
  const arenaRef=useRef(null),scrollerRef=useRef(null),calendarDrag=useRef(null),didDrag=useRef(false)
  const regenerationRef=useRef(new Map())
  const [retry, setRetry] = useState(0)
  const weekElements = useRef([])
  const weeks = useMemo(() => calendarWeeks(mobile?mobileCalendarDays(calendar?.days):calendar?.days), [calendar,mobile])
  useEffect(()=>{
    if(!mobile||!calendar||!scrollerRef.current)return
    const scroller=scrollerRef.current
    const startDate=mobileCalendarStart(calendar.days)
    setKeyboardDate(current=>current||(calendar.days.find(day=>day.date>=startDate)||calendar.days[calendar.days.length-1]).date)
    const position=()=>{
      const start=scroller.querySelector(`[data-calendar-date="${mobileCalendarStart(calendar.days)}"]`)
      if(start){const bounds=scroller.getBoundingClientRect();scroller.scrollLeft+=start.getBoundingClientRect().left-bounds.left-35}
    }
    const frame=requestAnimationFrame(position)
    return()=>cancelAnimationFrame(frame)
  },[mobile,calendar])

  useEffect(() => {
    if (!active) return undefined
    const controller = new AbortController()
    setStatus('loading')
    fetch('/api/github-contributions', {signal: controller.signal})
      .then(async response => {
        if (!response.ok) throw new Error('unavailable')
        const result = await response.json()
        if (!Array.isArray(result.days) || !result.days.length) throw new Error('unavailable')
        setCalendar(result)
        setStatus('ready')
      }).catch(error => {if (error.name !== 'AbortError') setStatus('unavailable')})
    return () => controller.abort()
  }, [active, retry])

  const dayLookup=useMemo(()=>new Map((calendar?.days||[]).map(day=>[day.date,day])),[calendar])
  useEffect(()=>{
    if(!playActive||paused)return
    let previous=performance.now()
    const timer=setInterval(()=>{
      const now=performance.now(),dt=document.hidden?0:Math.min(250,now-previous);previous=now
      const next=advanceCellRegeneration(regenerationRef.current,damageRef.current,dt)
      if(next!==damageRef.current){damageRef.current=next;setDamage(next)}
    },40)
    const visibility=()=>{previous=performance.now()}
    document.addEventListener('visibilitychange',visibility)
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visibility)}
  },[playActive,paused])
  function hitDay(date){
    const day=dayLookup.get(date);if(!day)return false
    const result=hitContribution(damageRef.current,day)
    if(result.hit){damageRef.current=result.damage;setDamage(result.damage)}
    if(result.destroyed)regenerationRef.current.set(date,1200)
    return result.destroyed
  }
  function resetGame(){regenerationRef.current.clear();damageRef.current=new Map();setDamage(damageRef.current);setRevision(value=>value+1)}
  const destroyedCount=[...damage].filter(([date,hits])=>hits>=contributionHitPoints(dayLookup.get(date)?.level||0)).length

  function navigate(event, week, day) {
    const offsets = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}
    const offset = offsets[event.key]
    if (!offset) return
    const targetWeek = week + offset[0], targetDay = day + offset[1]
    const target = weekElements.current[targetWeek]?.[targetDay]
    if (target) {event.preventDefault(); target.focus()}
  }

  const activeDate = focused ? Date.parse(`${focused.date}T00:00:00Z`) : null
  const activeDay = activeDate === null ? -10 : new Date(activeDate).getUTCDay()
  return (
    <section ref={arenaRef} className={`${styles.field} ${className}`} style={style} aria-labelledby="contribution-heading" data-contribution-state={status} data-mobile-calendar={mobile?'true':undefined}>
      <div className={styles.header}>
        <div><span className={styles.eyebrow}>// THE WORK BETWEEN RELEASES</span><h3 id="contribution-heading"><img src="/tech-stack-icons/github-dark.svg" alt="" width="24" height="24"/> Contribution activity</h3></div>
        <a href={GITHUB_PROFILE} target="_blank" rel="noreferrer">View GitHub <ArrowUpRight size={15} aria-hidden="true"/></a>
      </div>
      {mobile&&status==='ready'&&<p className={styles.calendarHint}>SWIPE CALENDAR SIDEWAYS TO EXPLORE MONTHS <span>↔</span></p>}
      {status === 'loading' && <p className={styles.empty} role="status"><span className={styles.loadingDot}/> Connecting to GitHub’s public activity…</p>}
      {status === 'unavailable' && <div className={styles.empty} role="status"><p>The live calendar is temporarily unavailable.</p><p className={styles.unavailableDetail}>Explore the latest work on GitHub.</p><button onClick={() => setRetry(value => value + 1)}><RotateCcw size={14} aria-hidden="true"/> Try again</button></div>}
      {status === 'ready' && calendar && <>
        <div ref={scrollerRef} className={styles.gridScroller} tabIndex={mobile?0:undefined} aria-label={mobile?'Contribution calendar. Swipe horizontally to explore other months.':undefined}
          onPointerDown={event=>{if(!mobile||event.pointerType==='touch')return;calendarDrag.current={id:event.pointerId,x:event.clientX,scroll:event.currentTarget.scrollLeft};didDrag.current=false}}
          onPointerMove={event=>{const drag=calendarDrag.current;if(!drag||drag.id!==event.pointerId)return;const delta=event.clientX-drag.x;if(Math.abs(delta)>5){didDrag.current=true;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.scrollLeft=drag.scroll-delta}}}
          onPointerUp={event=>{calendarDrag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}}
          onPointerCancel={()=>{calendarDrag.current=null}}
          onClickCapture={event=>{if(didDrag.current){event.preventDefault();event.stopPropagation();didDrag.current=false}}}>
          <div className={styles.calendar} role="group" aria-label="Daily GitHub contributions. Use arrow keys to inspect dates and Enter to hit a cell.">
            <div className={styles.days} aria-hidden="true"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
            <div className={styles.weeks}>
              {weeks.map((week, weekIndex) => {
                const firstDay = week.find(Boolean)
                const monthStart = week.find(day => day && Number(day.date.slice(8)) === 1)
                const month = monthStart || (weekIndex === 0 ? firstDay : null)
                return <div className={styles.week} key={firstDay?.date || weekIndex}>
                  <span className={styles.month} aria-hidden="true">{month ? new Date(`${month.date}T00:00:00Z`).toLocaleDateString('en-US', {month:'short', timeZone:'UTC'}) : ''}</span>
                  {week.map((day, dayIndex) => {
                    if (!day) return <span key={`empty-${dayIndex}`} className={styles.gap}/>
                    if(day.future)return <span key={day.date} className={`${styles.gap} ${styles.future}`} data-calendar-date={day.date} aria-hidden="true"/>
                    const stamp = Date.parse(`${day.date}T00:00:00Z`)
                    const neighbor = activeDate !== null && Math.abs(stamp-activeDate) <= 8*86400000 && Math.abs(dayIndex-activeDay) <= 1
                    const hits=damage.get(day.date)||0,hp=contributionHitPoints(day.level),shattered=hits>=hp
                    return <button key={day.date} type="button" ref={element => {if (!weekElements.current[weekIndex]) weekElements.current[weekIndex] = []; weekElements.current[weekIndex][dayIndex] = element}}
                      className={`${styles.cell} ${neighbor ? styles.neighbor : ''} ${shattered ? styles.broken : ''}`}
                      data-level={day.level} data-calendar-date={day.date} data-contribution-date={day.date} data-damage={hits} data-destroyed={shattered?'true':'false'} aria-label={`${day.count} ${day.count === 1 ? 'contribution' : 'contributions'} on ${friendlyDate(day.date)}. ${shattered?'Destroyed':`${hp-hits} hits remaining`}.`}
                      tabIndex={day.date === (keyboardDate || calendar.days[0].date) ? 0 : -1}
                      onMouseEnter={() => setFocused(day)} onMouseLeave={() => setFocused(null)} onFocus={() => {setFocused(day);setKeyboardDate(day.date)}} onBlur={() => setFocused(null)}
                      onKeyDown={event => navigate(event, weekIndex, dayIndex)} onClick={() => hitDay(day.date)}>
                    </button>
                  })}
                </div>
              })}
            </div>
          </div>
        </div>
        <div className={styles.meta}>
          <p aria-live="polite" className={styles.readout}>{focused ? <><strong>{focused.count.toLocaleString()}</strong> {focused.count === 1 ? 'contribution' : 'contributions'} · {friendlyDate(focused.date)}</> : <><strong>{calendar.total.toLocaleString()}</strong> contributions · {friendlyDate(calendar.from)} — {friendlyDate(calendar.to)}</>}</p>
          <div className={styles.legend} aria-label="Contribution intensity, less to more"><span>Less</span>{[0,1,2,3,4].map(level => <i key={level} data-level={level}/>)}<span>More</span></div>
        </div>
        <div className={styles.footer}><span>{calendar.stale ? 'Last verified ' : 'Synced '}{new Date(calendar.fetchedAt).toLocaleDateString('en-US', {month:'short',day:'numeric',timeZone:'UTC'})} · Public GitHub calendar</span><div className={styles.gameControls}><button onClick={()=>setPaused(value=>!value)}>{paused?<Play size={14}/>:<Pause size={14}/>} {paused?'Resume':'Pause'} fire</button><button onClick={resetGame}><RotateCcw size={14}/> Reset field</button></div></div>
        <p className={styles.gameHint}>Drag to aim · Auto fire · Normal 1 hit / Medium 2 / Bright 3 <span aria-live="polite">{destroyedCount} / {calendar.days.length} cleared</span></p>
        <ContributionShooter arenaRef={arenaRef} active={playActive} paused={paused} onHit={hitDay} revision={revision} mobile={mobile}/>
      </>}
    </section>
  )
}
