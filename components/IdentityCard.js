import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'

export default function IdentityCard(){
  return (
    <motion.div
      initial={{y:28,opacity:0}}
      animate={{y:0,opacity:1}}
      transition={{delay:0.85,duration:0.7}}
      className="absolute left-[-14px] top-[30%] z-30 w-[128px] rounded-md border border-cyan-300/45 bg-[#06101d]/45 p-2.5 min-[375px]:left-[-16px] min-[375px]:w-[138px] min-[430px]:w-[150px] sm:left-[-48px] sm:w-[170px] sm:p-4 md:left-[-64px] md:w-[190px] lg:left-[-80px] lg:top-[42%] lg:w-[210px] lg:p-5"
      style={{
        boxShadow: '0 0 34px rgba(0,229,255,0.18), 0 0 40px rgba(139,92,246,0.12), inset 0 0 24px rgba(0,229,255,0.05)'
      }}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 210 220"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="identityBorderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0" />
            <stop offset="28%" stopColor="#A855F7" stopOpacity="0.95" />
            <stop offset="48%" stopColor="#00E5FF" stopOpacity="1" />
            <stop offset="68%" stopColor="#38BDF8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="identityBorderAccent" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
            <stop offset="45%" stopColor="#8B5CF6" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#00E5FF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
          </linearGradient>
          <filter id="identityBorderBlur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.8" />
          </filter>
        </defs>
        <motion.rect
          x="1.5"
          y="1.5"
          width="207"
          height="217"
          rx="6"
          fill="none"
          stroke="url(#identityBorderGlow)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray="44 170"
          filter="url(#identityBorderBlur)"
          animate={{strokeDashoffset: [0, -214]}}
          transition={{duration: 2.8, repeat: Infinity, ease: 'linear'}}
        />
        <motion.rect
          x="1.5"
          y="1.5"
          width="207"
          height="217"
          rx="6"
          fill="none"
          stroke="url(#identityBorderAccent)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeDasharray="30 184"
          opacity="0.95"
          animate={{strokeDashoffset: [0, -214]}}
          transition={{duration: 2.8, repeat: Infinity, ease: 'linear'}}
        />
      </svg>

      <div className="text-[11px] font-black tracking-wide text-white min-[375px]:text-[12px] sm:text-[15px] lg:text-[19px]">KARL LOPEZ</div>
      <div className="mt-1.5 border-b border-cyan-400/10 pb-2 text-[6px] font-bold tracking-[0.16em] text-cyan-300 min-[375px]:text-[6.5px] sm:text-[8px] lg:mt-3 lg:pb-4 lg:text-[10px]">JUNIOR LEVEL</div>

      <div className="mt-2 flex items-center gap-1.5 border-b border-cyan-400/10 pb-2 text-[6.5px] font-medium text-slate-400 min-[375px]:text-[7px] sm:text-[9px] lg:mt-4 lg:gap-2 lg:pb-4 lg:text-[11px]">
        <MapPin size={10} strokeWidth={2} className="text-cyan-400 lg:h-3 lg:w-3" />
        Based in Philippines
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[6px] font-black tracking-[0.14em] text-cyan-300 min-[375px]:text-[6.5px] sm:text-[8px] lg:mt-4 lg:gap-3 lg:text-[10px]">
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-cyan-300"
          animate={{boxShadow: ['0 0 0 rgba(0,229,255,0.6)', '0 0 11px rgba(0,229,255,0.95)', '0 0 0 rgba(0,229,255,0.6)']}}
          transition={{duration:2.8,repeat:Infinity,ease:'easeInOut'}}
        />
        AVAILABLE FOR WORK
      </div>
    </motion.div>
  )
}
