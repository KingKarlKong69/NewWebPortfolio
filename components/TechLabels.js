import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const roles = [
  'Frontend Developer',
  'Backend Developer',
  'UI/UX Designer',
  'Research Lead',
  'Database Administrator',
  'IT Support'
]

function randomPoint() {
  return {
    x: 8 + Math.random() * 84,
    y: 8 + Math.random() * 84
  }
}

function randomLabelPoint() {
  const center = { x: 50, y: 50 }
  let point = randomPoint()
  let attempts = 0

  while (distance(center, point) < 24 && attempts < 25) {
    point = randomPoint()
    attempts += 1
  }

  return point
}

function distance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y)
}

function createSignal(index, activeSignals = []) {
  let start = randomPoint()
  let end = randomLabelPoint()
  let attempts = 0

  while (
    (distance(start, end) < 34 || activeSignals.some((signal) => distance(signal.end, end) < 36)) &&
    attempts < 25
  ) {
    start = randomPoint()
    end = randomLabelPoint()
    attempts += 1
  }

  return {
    id: `${index}-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    role: roles[index % roles.length],
    start,
    end
  }
}

export default function TechLabels() {
  const [signals, setSignals] = useState([])

  useEffect(() => {
    let roleIndex = 0
    let timeoutId

    const spawn = () => {
      setSignals((currentSignals) => {
        const activeSignals = currentSignals.slice(-1)
        const nextSignals = [createSignal(roleIndex, activeSignals)]

        roleIndex += 1

        if (Math.random() > 0.68) {
          nextSignals.push(createSignal(roleIndex, nextSignals))
          roleIndex += 1
        }

        return nextSignals
      })

      timeoutId = setTimeout(spawn, 4300 + Math.random() * 1600)
    }

    spawn()

    return () => clearTimeout(timeoutId)
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-visible">
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="shootingSignal" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0" />
            <stop offset="55%" stopColor="#67E8F9" stopOpacity="0.35" />
            <stop offset="88%" stopColor="#E0F2FE" stopOpacity="1" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
          </linearGradient>
          <filter id="shootingGlow">
            <feGaussianBlur stdDeviation="0.65" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {signals.map((signal) => {
          const dx = signal.end.x - signal.start.x
          const dy = signal.end.y - signal.start.y
          const angle = Math.atan2(dy, dx) * (180 / Math.PI)
          const length = Math.max(16, Math.min(34, distance(signal.start, signal.end) * 0.48))

          return (
            <motion.g
              key={`star-${signal.id}`}
              initial={{
                x: signal.start.x,
                y: signal.start.y,
                rotate: angle,
                opacity: 0
              }}
              animate={{
                x: signal.end.x,
                y: signal.end.y,
                opacity: [0, 1, 1, 0]
              }}
              transition={{
                duration: 2.8,
                ease: [0.22, 0.72, 0.25, 1]
              }}
            >
              <line
                x1={-length}
                y1="0"
                x2="0"
                y2="0"
                stroke="url(#shootingSignal)"
                strokeWidth="0.72"
                strokeLinecap="round"
                filter="url(#shootingGlow)"
              />
              <circle cx="0" cy="0" r="0.72" fill="#E0F2FE" filter="url(#shootingGlow)" />
            </motion.g>
          )
        })}
      </svg>

      {signals.map((signal) => (
        <motion.div
          key={`label-${signal.id}`}
          className="absolute max-w-[150px]"
          style={{
            left: `${signal.end.x}%`,
            top: `${signal.end.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
          initial={{ opacity: 0, x: 0, y: 6, filter: 'blur(6px)' }}
          animate={{
            opacity: [0, 0, 1, 0.55, 1, 1, 0],
            x: [0, 0, -2, 2, -1, 0, 1],
            y: [6, 6, 0, -1, 1, 0, 2],
            filter: [
              'blur(6px)',
              'blur(6px)',
              'blur(0px)',
              'blur(1px)',
              'blur(0px)',
              'blur(0px)',
              'blur(5px)'
            ]
          }}
          transition={{
            duration: 3.2,
            delay: 2.45,
            ease: 'easeInOut'
          }}
        >
          <div className="relative text-center text-[10px] font-black uppercase leading-tight tracking-[0.18em] text-cyan-200" style={{ textShadow: '0 0 13px rgba(0,229,255,0.85)' }}>
            <motion.span
              className="absolute left-0 top-0 w-full text-fuchsia-300/70"
              animate={{ x: [0, 2, -1, 0], opacity: [0, 0.8, 0.2, 0] }}
              transition={{ duration: 0.6, delay: 2.52 }}
            >
              {signal.role}
            </motion.span>
            <motion.span
              className="absolute left-0 top-0 w-full text-sky-100/70"
              animate={{ x: [0, -2, 1, 0], opacity: [0, 0.75, 0.2, 0] }}
              transition={{ duration: 0.55, delay: 4.55 }}
            >
              {signal.role}
            </motion.span>
            <span className="relative">{signal.role}</span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
