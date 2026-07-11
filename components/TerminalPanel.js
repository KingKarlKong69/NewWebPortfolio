import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const lines = [
  { text: '> Passion: Building impactful products', color: 'text-cyan-300' },
  { text: '> Focus: Clean Code. Scalable Systems. Great UX', color: 'text-cyan-300' },
  { text: '> Mission: Solve problems. Create value', color: 'text-cyan-300' }
]

export default function TerminalPanel(){
  const [displayedLines, setDisplayedLines] = useState([])
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    setDisplayedLines([])

    const timers = lines.map((line, idx) => 
      setTimeout(() => {
        setDisplayedLines(prev => [...prev, {text: line.text, color: line.color}])
      }, idx * 500)
    )
    
    return () => timers.forEach(t => clearTimeout(t))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div 
      initial={{opacity:0,y:40}} 
      animate={{opacity:1,y:0}} 
      transition={{delay:1.1,duration:0.8}}
      className="relative z-[60] -mt-7 w-full max-w-[420px] overflow-hidden rounded-2xl glass lg:absolute lg:right-[18rem] lg:bottom-[7rem] lg:mt-0 lg:w-[420px] xl:right-[21rem] xl:bottom-[8rem]"
      style={{boxShadow: '0 0 50px rgba(0,229,255,0.2), inset 0 0 30px rgba(0,229,255,0.08)'}}
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between gap-3 bg-black/40 px-4 py-3 border-b border-cyan-400/20 lg:px-5 lg:py-4">
        <div className="flex gap-2.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-gray-400 font-mono">terminal — bash</span>
        <div className="w-3" />
      </div>
      
      {/* Terminal content */}
      <div className="min-h-28 space-y-2 p-4 font-mono text-sm sm:min-h-36 lg:min-h-40 lg:space-y-2.5 lg:p-6">
        {displayedLines.map((line, idx) => (
          <motion.div 
            key={idx} 
            initial={{opacity:0,x:-15}}
            animate={{opacity:1,x:0}}
            transition={{duration:0.4}}
            className={`text-xs ${line.color}`}
          >
            {line.text}
          </motion.div>
        ))}
        
        {/* Blinking cursor */}
        <motion.div 
          className="text-cyan-400 text-xs inline-block"
          animate={{opacity: showCursor ? 1 : 0.3}}
          transition={{duration: 0.3}}
        >
          ▎
        </motion.div>
      </div>
    </motion.div>
  )
}
