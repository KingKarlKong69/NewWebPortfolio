import { motion } from 'framer-motion'
import { Briefcase, Code2, Home, Mail, ServerCog, User } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useActiveNavSection } from './navigationState'

const HolographicKLLogo = dynamic(() => import('./HolographicKLLogo'), {
  ssr: false
})

const DEFAULT_LOGO_INTENSITY = 1.08
const SIDEBAR_LOGO_SCALE = 0.8
const SIDEBAR_BEAM_EDGE_WIDTH = 90

const navItems = [
  { icon: Home, label: 'Home', id: 'home' },
  { icon: User, label: 'About', id: 'about' },
  { icon: Briefcase, label: 'Projects', id: 'projects' },
  { icon: Code2, label: 'Skills', id: 'skills' },
  { icon: ServerCog, label: 'Services', id: 'services' },
  { icon: Mail, label: 'Contact', id: 'contact' }
]

function GitHubMark({ size = 17, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.6 2 12.28c0 4.54 2.87 8.39 6.84 9.75.5.1.68-.22.68-.5v-1.74c-2.78.62-3.37-1.38-3.37-1.38-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.27 9.27 0 0 1 12 6.96c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.95-2.34 4.81-4.57 5.07.36.32.68.95.68 1.92v2.85c0 .28.18.6.69.5A10.25 10.25 0 0 0 22 12.28C22 6.6 17.52 2 12 2Z" />
    </svg>
  )
}

function LinkedInMark({ size = 17, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M5.2 8.9h3.1v9.9H5.2V8.9Zm1.56-4.9a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6ZM10.2 8.9h3v1.35h.04c.42-.8 1.45-1.65 2.99-1.65 3.2 0 3.79 2.1 3.79 4.84v5.36h-3.1v-4.75c0-1.13-.02-2.6-1.59-2.6-1.59 0-1.83 1.24-1.83 2.52v4.83h-3.1V8.9Z" />
    </svg>
  )
}

function TwitterXMark({ size = 17, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path d="m5 5 14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  )
}

const socialItems = [
  { icon: GitHubMark, label: 'GitHub' },
  { icon: LinkedInMark, label: 'LinkedIn' },
  { icon: TwitterXMark, label: 'Twitter / X' }
]

export default function LeftNav(){
  const { activeSection, navigateToSection } = useActiveNavSection()

  return (
    <motion.aside
      initial={{opacity:0,x:-34}}
      animate={{opacity:1,x:0}}
      transition={{delay:0.25,duration:0.9}}
      onClick={() => window.dispatchEvent(new Event('navbar:reveal'))}
      className="hidden lg:flex fixed left-0 top-0 z-[60] h-screen w-[66px] flex-col items-center"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-full border-r border-cyan-400/10 bg-black/22 shadow-[0_0_28px_rgba(0,229,255,0.08)] backdrop-blur-sm"
        style={{width: SIDEBAR_BEAM_EDGE_WIDTH}}
      />

      <div className="relative mt-1 h-[172px] w-[224px] shrink-0 translate-x-[54px] overflow-visible">
        <motion.div
          initial={{opacity:0}}
          animate={{opacity:1}}
          transition={{delay:0.35,duration:0.8}}
          className="h-full w-full"
        >
          <HolographicKLLogo
            cameraDistance={8.15}
            intensity={DEFAULT_LOGO_INTENSITY}
            sceneScale={SIDEBAR_LOGO_SCALE}
            showMask={false}
          />
        </motion.div>
      </div>

      <nav className="relative mt-3 flex translate-x-[12px] flex-col items-center gap-7">
        {navItems.map((item, idx) => {
          const Icon = item.icon
          const isActive = item.id === activeSection

          return (
            <motion.a
              key={item.label}
              href={`#${item.id}`}
              onClick={() => navigateToSection(item.id)}
              initial={{opacity:0,scale:0.72}}
              animate={{opacity:1,scale:1}}
              transition={{delay:0.45 + idx*0.08}}
              whileHover={{scale:1.09}}
              className="group relative flex h-8 w-8 cursor-pointer items-center justify-center"
              aria-label={item.label}
            >
              <span className={`absolute -left-[33px] h-8 w-px rounded-full bg-cyan-300 transition-opacity duration-300 ${isActive ? 'opacity-100 shadow-[0_0_14px_rgba(0,229,255,0.95)]' : 'opacity-0 group-hover:opacity-60'}`} />
              <Icon
                size={19}
                strokeWidth={isActive ? 2.4 : 1.7}
                className={`transition-all duration-300 ${isActive ? 'text-cyan-300 drop-shadow-[0_0_10px_rgba(0,229,255,0.95)]' : 'text-slate-500 group-hover:text-cyan-200 group-hover:drop-shadow-[0_0_8px_rgba(0,229,255,0.45)]'}`}
              />
              <span className="pointer-events-none absolute left-full ml-5 rounded-md border border-cyan-400/25 bg-black/80 px-3 py-2 text-[11px] font-bold text-cyan-200 opacity-0 shadow-[0_0_18px_rgba(0,229,255,0.2)] backdrop-blur-md transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                {item.label}
              </span>
            </motion.a>
          )
        })}
      </nav>

      <div className="relative mb-9 mt-auto flex translate-x-[12px] flex-col items-center gap-6">
        {socialItems.map((item) => {
          const Icon = item.icon

          return (
            <motion.a
              key={item.label}
              whileHover={{scale:1.12}}
              className="group relative flex h-6 w-6 cursor-pointer items-center justify-center"
              aria-label={item.label}
            >
              <Icon size={17} className="text-slate-500 transition-all duration-300 group-hover:text-cyan-200 group-hover:drop-shadow-[0_0_9px_rgba(0,229,255,0.65)]" />
            </motion.a>
          )
        })}
      </div>
    </motion.aside>
  )
}
