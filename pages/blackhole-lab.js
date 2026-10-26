import Head from 'next/head'
import dynamic from 'next/dynamic'
import {useCallback,useEffect,useRef,useState} from 'react'
import {LAB_CATEGORIES,LAB_DEFAULTS,LAB_GROUPS,LAB_PRESETS,LAB_PRESET_VERSION,parseLabPreset,resetLabGroupValues,sanitizeLabValue,sanitizeLabValues} from '../components/ContactSection/blackHoleLabControls'
import {applyFooterBlackHolePreset,readFooterBlackHolePreset,restoreFooterBlackHoleDefaults,subscribeFooterBlackHolePreset} from '../components/ContactSection/footerBlackHolePreset'
import {FOOTER_PROJECT_DEFAULT} from '../components/ContactSection/projectFooterBlackHolePreset'
import styles from '../styles/BlackHoleTuningLab.module.css'

const BlackHoleScene=dynamic(()=>import('../components/ContactSection/IsolatedBlackHoleScene'),{ssr:false})
const STORAGE_KEY='black-hole-lab-preset-v1'
const COMPLETE_NUMBER=/^[+-]?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i
const displayValue=value=>Number(value.toFixed(5)).toString()
const importMessage=(text,message)=>{
  try{
    const version=JSON.parse(text).version
    if(version===1)return `${message} Legacy appearance values were retained; 3D disk and universe controls use defaults. Projection spread cannot be converted into physical thickness. Missing new material and arc-shape controls use defaults.`
    if(version===2)return `${message} Version 2 settings were retained; missing new material and arc-shape controls use defaults.`
  }catch{}
  return message
}

function Control({control,value,onChange,syncVersion}){
  const {key,label,min,max,step,help}=control
  const [draft,setDraft]=useState(()=>displayValue(value))
  const editing=useRef(false)
  const lastSync=useRef(syncVersion)
  useEffect(()=>{
    if(!editing.current||lastSync.current!==syncVersion)setDraft(displayValue(value))
    lastSync.current=syncVersion
  },[value,syncVersion])
  const commitDraft=()=>{
    editing.current=false
    const raw=draft.trim()
    const next=COMPLETE_NUMBER.test(raw)?sanitizeLabValue(key,raw,value):value
    onChange(key,next);setDraft(displayValue(next))
  }
  if(control.kind==='toggle')return <div className={`${styles.control} ${styles.toggleControl}`}>
    <label className={styles.toggleLabel} htmlFor={`lab-${key}-toggle`}>
      <span>{label}</span>
      <input id={`lab-${key}-toggle`} type="checkbox" checked={value===1}
        onChange={event=>onChange(key,event.target.checked?1:0)}
        aria-describedby={help?`lab-${key}-help`:undefined}/>
    </label>
    {help&&<p id={`lab-${key}-help`} className={styles.help}>{help}</p>}
  </div>
  return <div className={styles.control}>
    <div className={styles.controlTop}>
      <label htmlFor={`lab-${key}-range`}>{label}</label>
      <input id={`lab-${key}-number`} className={styles.number} type="text" inputMode="decimal"
        role="spinbutton" aria-label={`${label} value`} aria-valuemin={min} aria-valuemax={max}
        aria-valuenow={value} autoComplete="off" spellCheck={false} value={draft}
        onFocus={()=>{editing.current=true}}
        onChange={event=>{
          const raw=event.target.value
          if(raw.length>24)return
          setDraft(raw)
          if(COMPLETE_NUMBER.test(raw.trim())&&Number.isFinite(Number(raw)))onChange(key,raw)
        }}
        onBlur={commitDraft}
        onKeyDown={event=>{
          if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur()}
          if(event.key==='Escape'){setDraft(displayValue(value));event.currentTarget.blur()}
          if(event.key==='ArrowUp'||event.key==='ArrowDown'){
            event.preventDefault()
            const next=sanitizeLabValue(key,value+(event.key==='ArrowUp'?step:-step),value)
            onChange(key,next);setDraft(displayValue(next))
          }
        }}/>
    </div>
    <input id={`lab-${key}-range`} className={styles.range} type="range" min={min} max={max}
      step={step} value={value} onChange={event=>onChange(key,event.target.value)}
      aria-describedby={help?`lab-${key}-help`:undefined}/>
    {help&&<p id={`lab-${key}-help`} className={styles.help}>{help}</p>}
  </div>
}

function PreviewStatus({status,paused}){
  const label=status.state==='ready'?(paused?'Paused':'Rendering'):status.state==='context-lost'?'Graphics context lost':status.state==='error'?'Preview needs recovery':status.state==='recovering'?'Recovering preview':'Starting preview'
  return <div className={styles.status}>
    <div className={styles.statusLine}><span className={`${styles.indicator} ${status.state==='error'||status.state==='context-lost'?styles.indicatorError:''}`} aria-hidden="true"/>{label}</div>
    {status.state==='ready'&&<p className={styles.metrics}>
      {Number.isFinite(status.fps)&&!paused?`${Math.round(status.fps)} fps · `:''}
      {Number.isFinite(status.dpr)?`${status.dpr.toFixed(2)}× DPR`:''}
      {status.width&&status.height?` · ${Math.round(status.width)} × ${Math.round(status.height)}`:''}
      {status.adaptive?' · adaptive':''}
    </p>}
    {status.message&&<p className={styles.statusMessage} role={status.state==='error'?'alert':undefined}>{status.message}</p>}
  </div>
}

export default function BlackHoleLab(){
  const valuesRef=useRef({...FOOTER_PROJECT_DEFAULT})
  const [values,setValues]=useState(()=>({...FOOTER_PROJECT_DEFAULT}))
  const [revision,setRevision]=useState(0)
  const [syncVersion,setSyncVersion]=useState(0)
  const [paused,setPaused]=useState(false)
  const [birthReplay,setBirthReplay]=useState(0)
  const [panelOpen,setPanelOpen]=useState(true)
  const [category,setCategory]=useState('blackhole')
  const [presetText,setPresetText]=useState('')
  const [notice,setNotice]=useState('')
  const [status,setStatus]=useState({state:'starting'})
  const [footerApplied,setFooterApplied]=useState(false)
  const [footerNotice,setFooterNotice]=useState('')
  const [savingProject,setSavingProject]=useState(false)
  const onStatus=useCallback(next=>setStatus(next),[])
  useEffect(()=>{
    const refresh=()=>{
      setFooterApplied(Boolean(readFooterBlackHolePreset()))
      setFooterNotice('')
    }
    refresh()
    return subscribeFooterBlackHolePreset(refresh)
  },[])
  const updateValue=useCallback((key,raw)=>{
    const previous=valuesRef.current
    const next=sanitizeLabValue(key,raw,previous[key])
    if(next===previous[key])return
    valuesRef.current={...previous,[key]:next}
    setValues(valuesRef.current);setRevision(value=>value+1)
  },[])
  const applyValues=useCallback((incoming,message)=>{
    const next=sanitizeLabValues(incoming,valuesRef.current)
    valuesRef.current=next;setValues(next)
    setRevision(value=>value+1);setSyncVersion(value=>value+1)
    if(message)setNotice(message)
  },[])
  // Fast Refresh can preserve a tuned v2 state while adding v3 controls.
  // Fill missing fields without replacing the user's current lab settings.
  useEffect(()=>{applyValues(valuesRef.current)},[applyValues])
  const resetGroup=group=>{
    applyValues(resetLabGroupValues(valuesRef.current,group.id),`${group.label} restored.`)
  }
  const applyPreset=key=>applyValues({...valuesRef.current,...LAB_PRESETS[key].values},`${LAB_PRESETS[key].label} quality applied.`)
  const exportPreset=()=>{
    setPresetText(JSON.stringify({version:LAB_PRESET_VERSION,values:valuesRef.current},null,2))
    setNotice('Current preset is ready to copy below.')
  }
  const importPreset=()=>{
    try{applyValues(parseLabPreset(presetText,valuesRef.current),importMessage(presetText,'Preset imported.'))}
    catch(error){setNotice(error.message||'That preset could not be imported.')}
  }
  const savePreset=()=>{
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:LAB_PRESET_VERSION,values:valuesRef.current}));setNotice('Preset saved in this browser.')}
    catch{setNotice('This browser could not save the preset. Use Export instead.')}
  }
  const loadPreset=()=>{
    try{
      const saved=localStorage.getItem(STORAGE_KEY)
      if(!saved){setNotice('No preset has been saved in this browser yet.');return}
      applyValues(parseLabPreset(saved,valuesRef.current),importMessage(saved,'Saved preset loaded.'))
    }catch(error){setNotice(error.message||'The saved preset could not be loaded.')}
  }
  const applyToFooter=()=>{
    try{
      applyFooterBlackHolePreset(valuesRef.current)
      setFooterNotice('Applied to Contact and its shared universe in this browser.')
    }catch{
      setFooterNotice('Browser storage is unavailable. The footer was not changed.')
    }
  }
  const restoreFooter=()=>{
    try{
      restoreFooterBlackHoleDefaults()
      setFooterNotice('Using the JSON project default. Your lab settings are kept.')
    }catch{
      setFooterNotice('Browser storage is unavailable. Could not restore footer defaults.')
    }
  }
  const saveProjectDefault=async()=>{
    if(savingProject)return
    setSavingProject(true)
    const snapshot={version:LAB_PRESET_VERSION,values:{...valuesRef.current}}
    try{
      const response=await fetch('/api/footer-blackhole-preset',{method:'POST',headers:{'Content-Type':'application/json','X-Black-Hole-Lab':'save-project-default'},body:JSON.stringify(snapshot)})
      const result=await response.json()
      if(!response.ok)throw new Error(result.error||'Could not save project default.')
      try{applyFooterBlackHolePreset(result.values)}catch{}
      setFooterNotice('Saved to config/footer-blackhole-preset.json. This default survives restarts and ships with your next deployment.')
    }catch(error){setFooterNotice(error.message||'Could not save project default.')}
    finally{setSavingProject(false)}
  }
  return <>
    <Head><title>Black Hole Lab</title><meta name="robots" content="noindex,nofollow"/></Head>
    <main className={`${styles.lab} ${!panelOpen?styles.panelHidden:''}`}>
      <div className={styles.scene}>
        <BlackHoleScene valuesRef={valuesRef} revision={revision} paused={paused} birthReplay={birthReplay} onStatus={onStatus}/>
      </div>
      <div className={styles.toolbar}>
        <span className={styles.labName}>BLACK HOLE / LAB</span>
        <div className={styles.toolbarActions}>
          <button type="button" disabled={status.state!=='ready'} onClick={()=>{setPaused(false);setBirthReplay(value=>value+1)}} title="Replay the black-hole opening with the current preset">Play birth</button>
          <button type="button" onClick={()=>setPaused(value=>!value)} aria-pressed={paused}>{paused?'Resume':'Pause'}</button>
          <button type="button" onClick={()=>setPanelOpen(value=>!value)} aria-expanded={panelOpen} aria-controls="black-hole-controls">{panelOpen?'Hide controls':'Show controls'}</button>
          <button type="button" onClick={()=>applyPreset('performance')} title="Reduce rendering cost">Performance fallback</button>
          <button type="button" onClick={()=>updateValue('universeEnabled',values.universeEnabled?0:1)} aria-pressed={values.universeEnabled===1}>Universe {values.universeEnabled?'on':'off'}</button>
          <button type="button" onClick={()=>updateValue('curvatureEnabled',values.curvatureEnabled?0:1)} aria-pressed={values.curvatureEnabled===1}>Curvature {values.curvatureEnabled?'on':'off'}</button>
          <button type="button" onClick={applyToFooter}>Apply to footer</button>
          {process.env.NODE_ENV==='development'&&<button type="button" onClick={saveProjectDefault} disabled={savingProject}>{savingProject?'Saving…':'Save as project default'}</button>}
          <button type="button" onClick={restoreFooter} disabled={!footerApplied}>Use project default</button>
        </div>
        <p className={styles.footerPreview} role="status">
          {footerNotice||(footerApplied?'A temporary browser preview is active. Save as project default to persist it in the project.':'The footer uses its JSON project default. Apply to footer creates a temporary browser preview.')}
          {' '}<a href="/#contact" target="_blank" rel="noopener noreferrer">View footer ↗</a>
        </p>
        {!panelOpen&&<PreviewStatus status={status} paused={paused}/>}
        {(status.state==='context-lost'||status.state==='error')&&typeof status.recover==='function'&&<button type="button" className={styles.recover} onClick={status.recover}>Recover preview</button>}
      </div>
      {panelOpen&&<aside id="black-hole-controls" className={styles.panel} aria-label="Black hole and universe controls">
        <header className={styles.panelHeader}>
          <div className={styles.headingRow}><div><span className={styles.eyebrow}>PROCEDURAL / LIVE</span><h1>Black hole laboratory</h1></div><button type="button" className={styles.resetAll} onClick={()=>applyValues({...LAB_DEFAULTS},'All controls restored to defaults.')}>Reset all</button></div>
          <PreviewStatus status={status} paused={paused}/>
          <div className={styles.categoryTabs} aria-label="Control categories">
            {LAB_CATEGORIES.map(entry=><button type="button" key={entry.id}
              aria-pressed={category===entry.id} onClick={()=>setCategory(entry.id)}>{entry.label}</button>)}
          </div>
        </header>
        <div className={styles.panelBody}>
          <section className={styles.qualityPresets} aria-label="Rendering quality presets">
            <p className={styles.sectionLabel}>QUALITY PRESET</p>
            <div className={styles.presetButtons}>{Object.entries(LAB_PRESETS).map(([key,preset])=><button key={key} type="button" onClick={()=>applyPreset(key)} aria-pressed={Object.entries(preset.values).every(([name,value])=>values[name]===value)}>{preset.label}</button>)}</div>
          </section>
          {LAB_GROUPS.filter(group=>group.category===category).map((group,index)=><details className={styles.group} key={group.id} open={index<2}>
            <summary>{group.label}<span className={styles.groupMark} aria-hidden="true">+</span></summary>
            <div className={styles.groupContent}>
              <button className={styles.groupReset} type="button" onClick={()=>resetGroup(group)}>Reset {group.label.toLowerCase()}</button>
              {group.controls.map(control=><Control key={control.key} control={control} value={values[control.key]??LAB_DEFAULTS[control.key]} onChange={updateValue} syncVersion={syncVersion}/>)}
            </div>
          </details>)}
          <details className={styles.group}>
            <summary>Save &amp; transfer presets<span className={styles.groupMark} aria-hidden="true">+</span></summary>
            <div className={styles.presetContent}>
              <div className={styles.twoButtons}><button type="button" onClick={savePreset}>Save locally</button><button type="button" onClick={loadPreset}>Load saved</button></div>
              <label className={styles.presetLabel} htmlFor="black-hole-preset">Preset JSON</label>
              <textarea id="black-hole-preset" value={presetText} maxLength={20000} onChange={event=>setPresetText(event.target.value)} placeholder="Export current values or paste a preset here." spellCheck={false}/>
              <div className={styles.twoButtons}><button type="button" onClick={exportPreset}>Export current</button><button type="button" onClick={importPreset} disabled={!presetText.trim()}>Import preset</button></div>
              <p className={styles.help}>Local saving uses this browser. Copy exported JSON to keep a separate preset.</p>
            </div>
          </details>
          <p className={styles.notice} role="status" aria-live="polite">{notice||'Changes apply live. Numeric fields accept precise values; Enter commits and Escape restores.'}</p>
        </div>
      </aside>}
    </main>
  </>
}
