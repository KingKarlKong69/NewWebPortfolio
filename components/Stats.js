import { motion } from 'framer-motion'

const items = [
  {value:'10+',label:'Projects Completed'},
  {value:'3+',label:'Years Experience'},
  {value:'100%',label:'Client Satisfaction'},
  {value:'24/7',label:'Passion For Coding'},
]

export default function Stats(){
  return (
    <div className="mx-auto grid w-full max-w-[360px] grid-cols-4 gap-3 sm:max-w-[460px] sm:gap-5 lg:mx-0 lg:max-w-[520px] lg:gap-7">
      {items.map((it, idx) => (
        <motion.div 
          key={idx} 
          initial={{opacity:0,y:15}} 
          animate={{opacity:1,y:0}} 
          transition={{delay:0.7 + idx*0.12,duration:0.7}}
          className="group relative border-r border-cyan-400/10 last:border-r-0"
        >
          <motion.div 
            className="bg-gradient-to-br from-cyan-300 to-blue-500 bg-clip-text font-mono text-[20px] font-black leading-none text-transparent sm:text-[24px] lg:text-[28px]"
            whileHover={{scale: 1.06}}
          >
            {it.value}
          </motion.div>
          <div className="mx-auto mt-2 max-w-[72px] text-[7px] font-bold uppercase leading-[1.35] tracking-[0.08em] text-gray-400 sm:text-[9px] lg:mx-0 lg:mt-4 lg:max-w-[94px] lg:text-[11px] lg:leading-[1.65]">
            {it.label}
          </div>
          <motion.div 
            className="absolute -inset-3 bg-gradient-to-br from-cyan-400/0 via-purple-400/0 to-cyan-400/0 group-hover:from-cyan-400/15 group-hover:to-purple-400/15 rounded-xl transition-all duration-300 -z-10" 
          />
        </motion.div>
      ))}
    </div>
  )
}
