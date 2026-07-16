import { motion } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import TechCore from './TechCore'
import TerminalPanel from './TerminalPanel'
import Stats from './Stats'
import IdentityCard from './IdentityCard'
import { useActiveNavSection } from './navigationState'

const rotatingRoles = [
	'Full Stack Developer',
	'Backend Developer',
	'Frontend Developer',
	'UI/UX Designer',
	'Database Administrator',
	'Research Lead',
	'IT Suppport'
]

const svgNumber = (value) => Number(value.toFixed(3))

function useTypedRotatingText(items, cycleMs = 7000) {
	const [displayText, setDisplayText] = useState('')

	useEffect(() => {
		const startedAt = Date.now()

		const updateText = () => {
			const elapsed = Date.now() - startedAt
			const roleIndex = Math.floor(elapsed / cycleMs) % items.length
			const cycleElapsed = elapsed % cycleMs
			const role = items[roleIndex]
			const typeMs = Math.min(1200, role.length * 70)
			const deleteMs = Math.min(900, role.length * 42)
			const deleteStart = cycleMs - deleteMs - 250

			if (cycleElapsed < typeMs) {
				const visibleChars = Math.ceil((cycleElapsed / typeMs) * role.length)
				setDisplayText(role.slice(0, visibleChars))
				return
			}

			if (cycleElapsed >= deleteStart) {
				const deleteElapsed = cycleElapsed - deleteStart
				const remainingChars = Math.max(0, role.length - Math.ceil((deleteElapsed / deleteMs) * role.length))
				setDisplayText(role.slice(0, remainingChars))
				return
			}

			setDisplayText(role)
		}

		updateText()
		const intervalId = setInterval(updateText, 38)

		return () => clearInterval(intervalId)
	}, [items, cycleMs])

	return displayText
}

function ScrollExploreCue(){
	return (
		<motion.div
			initial={{opacity:0,y:12}}
			animate={{opacity:0.82,y:0}}
			transition={{delay:1.25,duration:0.75}}
			className="pointer-events-none absolute bottom-[7.25rem] left-[92px] z-30 hidden items-center gap-3 lg:flex xl:bottom-[8rem]"
		>
			<div className="relative h-8 w-4 rounded-full border border-slate-400/70 bg-black/10 shadow-[0_0_18px_rgba(0,229,255,0.18)]">
				<motion.span
					className="absolute left-1/2 top-1.5 h-1 w-1 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.95)]"
					animate={{y:[0,12,0],opacity:[1,0.25,1]}}
					transition={{duration:1.8,repeat:Infinity,ease:'easeInOut'}}
				/>
			</div>
			<span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400/85">
				Scroll to explore
			</span>
		</motion.div>
	)
}

export default function Hero(){
	const { navigateToSection } = useActiveNavSection()
	const typedRole = useTypedRotatingText(rotatingRoles)
	const floorHorizonY = 86
	const floorBottomY = 420
	const floorVanishingX = 800
	const floorDepth = floorBottomY - floorHorizonY
	const floorBottomLeft = -520
	const floorBottomRight = 2120
	const floorColumnBottoms = [
		-520, -360, -200, -40, 120, 280, 440, 600, 760, 920, 1080, 1240, 1400, 1560, 1720, 1880, 2040, 2120
	]
	const floorRowDepths = [0.025, 0.045, 0.07, 0.1, 0.135, 0.18, 0.235, 0.3, 0.38, 0.47, 0.58, 0.71, 0.86, 1]
	const projectFloorX = (bottomX, depth) => floorVanishingX + (bottomX - floorVanishingX) * depth
	const floorNodeColors = ['#00E5FF', '#38BDF8', '#8B5CF6']
	const activeFloorNodes = floorRowDepths.flatMap((depth, rowIndex) =>
		floorColumnBottoms
			.map((bottomX, colIndex) => ({ depth, bottomX, rowIndex, colIndex }))
			.filter(({ rowIndex, colIndex }) => rowIndex > 1 && rowIndex < floorRowDepths.length - 1 && (rowIndex * 7 + colIndex * 11) % 5 === 0)
	)
	const activeFloorCells = floorRowDepths.slice(2, -1).flatMap((depth, rowIndex) =>
		floorColumnBottoms
			.slice(1, -2)
			.map((bottomX, colIndex) => ({ depth, bottomX, rowIndex: rowIndex + 2, colIndex: colIndex + 1 }))
			.filter(({ rowIndex, colIndex }) => (rowIndex * 5 + colIndex * 13) % 17 === 0)
	)
	const portraitEdgeMask = 'radial-gradient(ellipse at 52% 45%, #000 0%, #000 56%, rgba(0,0,0,0.86) 70%, rgba(0,0,0,0.42) 84%, transparent 100%)'
	const portraitBottomMask = 'linear-gradient(to bottom, #000 0%, #000 84%, rgba(0,0,0,0.92) 90%, rgba(0,0,0,0.7) 96%, transparent 100%)'
	const portraitFadeMask = `${portraitEdgeMask}, ${portraitBottomMask}`

	return (
		<div id="home" className="relative min-h-screen w-full overflow-x-clip bg-transparent lg:h-screen lg:overflow-hidden">
			<ScrollExploreCue />

			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="absolute bottom-10 -right-60 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" style={{animationDelay: '2s', animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite'}} />

				<svg
					className="pointer-events-none absolute inset-x-0 bottom-0 h-[30vh] min-h-[210px] w-full lg:h-[44vh]"
					viewBox="0 0 1600 420"
					preserveAspectRatio="none"
					style={{ filter: 'drop-shadow(0 0 10px rgba(0,229,255,0.24)) drop-shadow(0 0 28px rgba(59,130,246,0.12))' }}
				>
					<defs>
						<linearGradient id="floorPlaneFade" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stopColor="#00131f" stopOpacity="0" />
							<stop offset="44%" stopColor="#00384c" stopOpacity="0.08" />
							<stop offset="100%" stopColor="#00e5ff" stopOpacity="0.13" />
						</linearGradient>
						<linearGradient id="floorLineDepth" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stopColor="#00E5FF" stopOpacity="0" />
							<stop offset="35%" stopColor="#00E5FF" stopOpacity="0.12" />
							<stop offset="72%" stopColor="#22D3EE" stopOpacity="0.36" />
							<stop offset="100%" stopColor="#7DD3FC" stopOpacity="0.6" />
						</linearGradient>
						<linearGradient id="floorHorizonFade" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stopColor="#020617" stopOpacity="1" />
							<stop offset="38%" stopColor="#020617" stopOpacity="0.42" />
							<stop offset="100%" stopColor="#020617" stopOpacity="0" />
						</linearGradient>
						<filter id="floorBloom" x="-20%" y="-20%" width="140%" height="160%">
							<feGaussianBlur stdDeviation="3.2" result="blur" />
							<feMerge>
								<feMergeNode in="blur" />
								<feMergeNode in="SourceGraphic" />
							</feMerge>
						</filter>
						<filter id="floorNodeBloom" x="-140%" y="-140%" width="380%" height="380%">
							<feGaussianBlur stdDeviation="4.5" result="nodeBlur" />
							<feMerge>
								<feMergeNode in="nodeBlur" />
								<feMergeNode in="SourceGraphic" />
							</feMerge>
						</filter>
						<radialGradient id="floorNodeCore" cx="50%" cy="50%" r="50%">
							<stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
							<stop offset="42%" stopColor="#00E5FF" stopOpacity="0.55" />
							<stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
						</radialGradient>
						<mask id="floorSoftMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="420">
							<radialGradient id="floorEdgeMask" cx="50%" cy="66%" r="72%" fx="50%" fy="66%">
								<stop offset="0%" stopColor="white" stopOpacity="0.95" />
								<stop offset="55%" stopColor="white" stopOpacity="0.82" />
								<stop offset="78%" stopColor="white" stopOpacity="0.28" />
								<stop offset="100%" stopColor="white" stopOpacity="0" />
							</radialGradient>
							<linearGradient id="floorVerticalMask" x1="0%" y1="0%" x2="0%" y2="100%">
								<stop offset="0%" stopColor="white" stopOpacity="0" />
								<stop offset="18%" stopColor="white" stopOpacity="0.18" />
								<stop offset="42%" stopColor="white" stopOpacity="0.82" />
								<stop offset="78%" stopColor="white" stopOpacity="0.9" />
								<stop offset="100%" stopColor="white" stopOpacity="0" />
							</linearGradient>
							<rect width="1600" height="420" fill="url(#floorEdgeMask)" />
							<rect width="1600" height="420" fill="url(#floorVerticalMask)" opacity="0.62" />
						</mask>
					</defs>

					<g mask="url(#floorSoftMask)">
						<path d={`M${projectFloorX(floorBottomLeft, 0.02)} ${floorHorizonY} H${projectFloorX(floorBottomRight, 0.02)} L${floorBottomRight} ${floorBottomY} H${floorBottomLeft} Z`} fill="url(#floorPlaneFade)" />
						<g filter="url(#floorBloom)" opacity="0.44" strokeLinecap="round">
							{floorColumnBottoms.map((bottomX) => (
								<line key={`floor-glow-col-${bottomX}`} x1={projectFloorX(bottomX, 0.026)} y1={floorHorizonY + floorDepth * 0.026} x2={bottomX} y2={floorBottomY} stroke="url(#floorLineDepth)" strokeWidth="1.35" />
							))}
							{floorRowDepths.slice(1).map((depth) => (
								<line key={`floor-glow-row-${depth}`} x1={projectFloorX(floorBottomLeft, depth)} y1={floorHorizonY + floorDepth * depth} x2={projectFloorX(floorBottomRight, depth)} y2={floorHorizonY + floorDepth * depth} stroke="#00E5FF" strokeWidth={depth > 0.7 ? '1.4' : '1'} opacity={Math.min(0.08 + depth * 0.45, 0.52)} />
							))}
						</g>
						<g>
							{activeFloorCells.map(({ rowIndex, colIndex }, index) => {
								const nearDepth = floorRowDepths[rowIndex + 1]
								const farDepth = floorRowDepths[rowIndex]
								const leftBottom = floorColumnBottoms[colIndex]
								const rightBottom = floorColumnBottoms[colIndex + 1]
								const delay = ((rowIndex * 1.7 + colIndex * 2.9) % 9).toFixed(2)
								const duration = (9 + ((rowIndex + colIndex) % 5) * 1.4).toFixed(2)

								return (
									<polygon key={`floor-cell-${index}`} points={`${projectFloorX(leftBottom, farDepth)},${floorHorizonY + floorDepth * farDepth} ${projectFloorX(rightBottom, farDepth)},${floorHorizonY + floorDepth * farDepth} ${projectFloorX(rightBottom, nearDepth)},${floorHorizonY + floorDepth * nearDepth} ${projectFloorX(leftBottom, nearDepth)},${floorHorizonY + floorDepth * nearDepth}`} fill={floorNodeColors[(rowIndex + colIndex) % floorNodeColors.length]} opacity="0">
										<animate attributeName="opacity" values="0;0;0.14;0.045;0" keyTimes="0;0.52;0.66;0.82;1" dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
									</polygon>
								)
							})}
						</g>
						<g strokeLinecap="round">
							{floorColumnBottoms.map((bottomX, index) => (
								<line key={`floor-col-${bottomX}`} x1={projectFloorX(bottomX, 0.026)} y1={floorHorizonY + floorDepth * 0.026} x2={bottomX} y2={floorBottomY} stroke="url(#floorLineDepth)" strokeWidth={index % 4 === 0 ? '1.05' : '0.7'} opacity={index % 4 === 0 ? '0.72' : '0.5'} />
							))}
							{floorRowDepths.slice(1).map((depth, index) => (
								<line key={`floor-row-${depth}`} x1={projectFloorX(floorBottomLeft, depth)} y1={floorHorizonY + floorDepth * depth} x2={projectFloorX(floorBottomRight, depth)} y2={floorHorizonY + floorDepth * depth} stroke={index % 4 === 0 ? '#7DD3FC' : '#00E5FF'} strokeWidth={index % 4 === 0 ? '1.05' : '0.72'} opacity={Math.min(0.09 + depth * 0.54, 0.62)} />
							))}
						</g>
						<g filter="url(#floorNodeBloom)">
							{activeFloorNodes.map(({ depth, bottomX, rowIndex, colIndex }, index) => {
								const x = projectFloorX(bottomX, depth)
								const y = floorHorizonY + floorDepth * depth
								const delay = ((rowIndex * 1.13 + colIndex * 0.79) % 7.5).toFixed(2)
								const duration = (7.5 + ((rowIndex * colIndex) % 6) * 1.15).toFixed(2)
								const color = floorNodeColors[(rowIndex + colIndex) % floorNodeColors.length]

								return (
									<g key={`floor-node-${index}`}>
										<circle cx={x} cy={y} r={1.4 + depth * 1.7} fill={color} opacity="0">
											<animate attributeName="opacity" values="0;0;0.42;0.16;0" keyTimes="0;0.48;0.64;0.8;1" dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
										</circle>
										<circle cx={x} cy={y} r={4 + depth * 4.2} fill="url(#floorNodeCore)" opacity="0">
											<animate attributeName="opacity" values="0;0;0.2;0.05;0" keyTimes="0;0.5;0.66;0.86;1" dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
											<animate attributeName="r" values={`${3 + depth * 2.4};${6 + depth * 6};${4 + depth * 3}`} dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
										</circle>
									</g>
								)
							})}
						</g>
					</g>
					<rect x="0" y="0" width="1600" height="185" fill="url(#floorHorizonFade)" />
				</svg>

				<svg className="absolute inset-0 h-full w-full opacity-15" style={{filter: 'drop-shadow(0 0 20px rgba(0,229,255,0.1))'}}>
					<defs>
						<radialGradient id="ringGradient" cx="50%" cy="50%" r="50%">
							<stop offset="0%" stopColor="#00E5FF" stopOpacity="0.3"/>
							<stop offset="100%" stopColor="#8B5CF6" stopOpacity="0"/>
						</radialGradient>
					</defs>
					<circle cx="50%" cy="50%" r="200" fill="none" stroke="url(#ringGradient)" strokeWidth="1" opacity="0.3"/>
					<circle cx="50%" cy="50%" r="350" fill="none" stroke="url(#ringGradient)" strokeWidth="0.8" opacity="0.2"/>
					<circle cx="50%" cy="50%" r="550" fill="none" stroke="url(#ringGradient)" strokeWidth="0.5" opacity="0.1"/>
				</svg>
			</div>

			<div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1640px] grid-cols-1 items-start gap-0 px-5 pb-8 pt-3 min-[375px]:px-6 sm:px-8 md:pt-24 lg:h-full lg:min-h-0 lg:grid-cols-12 lg:items-center lg:gap-6 lg:py-0 lg:pl-28 lg:pr-10 xl:pl-32">
				<motion.div initial={{x:-60,opacity:0}} animate={{x:0,opacity:1}} transition={{delay:0.2,duration:0.9}} className="relative z-30 order-2 col-span-full mx-auto mt-1 max-w-[560px] space-y-3 self-start text-center min-[390px]:mt-0 min-[430px]:-mt-2 lg:order-1 lg:col-span-4 lg:mx-0 lg:mt-[-4.5rem] lg:max-w-none lg:space-y-6 lg:self-center lg:text-left xl:mt-[-5rem]">
					<motion.div initial={{opacity:0,scale:0.85}} animate={{opacity:1,scale:1}} transition={{delay:0.3, duration:0.6}} className="relative z-40 inline-flex min-w-[220px] items-center gap-3 rounded-md border border-cyan-400/30 bg-cyan-300/[0.035] px-3.5 py-2 backdrop-blur-md lg:min-w-[270px] lg:px-4 lg:py-2.5" style={{boxShadow: '0 0 18px rgba(0,229,255,0.14), inset 0 0 16px rgba(0,229,255,0.035)'}}>
						<motion.span className="h-2 w-2 rounded-full bg-cyan-300" animate={{boxShadow: ['0 0 0px rgba(0,229,255,0.8)', '0 0 10px rgba(0,229,255,0.5)', '0 0 0px rgba(0,229,255,0.8)']}} transition={{duration: 2, repeat: Infinity}} />
						<span className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/90 lg:text-[12px]">
							{typedRole}
							<motion.span
								className="ml-0.5 inline-block h-[1em] w-px translate-y-[2px] bg-cyan-200/90"
								animate={{opacity: [0.15, 1, 0.15]}}
								transition={{duration: 0.8, repeat: Infinity, ease: 'easeInOut'}}
							/>
						</span>
					</motion.div>

					<motion.h1 initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{delay:0.4,duration:0.9}} className="mx-auto max-w-[330px] font-montserrat font-black leading-[0.92] tracking-[0] text-white min-[390px]:max-w-[360px] md:max-w-[520px] lg:mx-0 lg:w-[630px] lg:max-w-none lg:leading-[0.98] xl:w-[720px]">
						<span className="block text-[28px] leading-[0.95] min-[375px]:text-[31px] min-[430px]:text-[34px] lg:inline lg:text-[64px] xl:text-[70px] 2xl:text-[74px]">I BUILD </span>
						<span className="block text-[42px] leading-[0.9] min-[375px]:text-[48px] min-[430px]:text-[52px] lg:inline lg:text-[64px] lg:leading-[0.98] xl:text-[70px] 2xl:text-[74px]">DIGITAL </span>
						<span className="block bg-gradient-to-r from-purple-500 via-blue-400 to-cyan-300 bg-clip-text text-[42px] leading-[0.9] text-transparent min-[375px]:text-[48px] min-[430px]:text-[52px] lg:text-[64px] lg:leading-[0.98] xl:text-[70px] 2xl:text-[74px]">PRODUCTS</span>
					</motion.h1>

					<motion.p initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{delay:0.5, duration:0.8}} className="mx-auto max-w-[310px] pt-1 text-[11px] font-light leading-[1.55] text-gray-300/85 min-[375px]:max-w-[335px] min-[375px]:text-[12px] sm:max-w-[430px] sm:text-[15px] lg:mx-0 lg:max-w-[460px] lg:pt-0 lg:text-[17px] lg:leading-[1.85]">
						I turn complex problems into clean, scalable, and beautiful solutions that make an impact.
					</motion.p>

					<motion.div initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{delay:0.6, duration:0.8}} className="flex justify-center gap-3 pt-3 sm:gap-4 lg:justify-start lg:gap-5 lg:pt-5">
						<motion.button type="button" onClick={() => navigateToSection('projects')} whileHover={{scale:1.04,boxShadow: '0 0 34px rgba(0,229,255,0.52)'}} whileTap={{scale:0.94}} className="min-w-[136px] rounded-md bg-gradient-to-r from-cyan-300 to-purple-600 px-4 py-3 font-mono text-[9px] font-black tracking-wide text-black shadow-[0_0_28px_rgba(0,229,255,0.25)] min-[375px]:min-w-[150px] min-[375px]:text-[10px] sm:px-7 sm:text-[12px] lg:min-w-0 lg:px-8 lg:py-[18px] lg:text-[14px]">
							VIEW MY WORK <span className="ml-2">-&gt;</span>
						</motion.button>
						<motion.button type="button" onClick={() => navigateToSection('contact')} whileHover={{scale:1.04,boxShadow: '0 0 20px rgba(0,229,255,0.26)', borderColor:'rgba(0,229,255,0.56)'}} whileTap={{scale:0.94}} className="min-w-[136px] rounded-md border border-cyan-400/20 bg-white/[0.015] px-4 py-3 font-mono text-[9px] font-black tracking-wide text-white backdrop-blur-md transition hover:bg-cyan-400/10 min-[375px]:min-w-[150px] min-[375px]:text-[10px] sm:px-7 sm:text-[12px] lg:min-w-0 lg:px-8 lg:py-[18px] lg:text-[14px]">
							GET IN TOUCH
						</motion.button>
					</motion.div>

					<motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.8, duration:0.8}} className="pt-4 sm:pt-3 lg:pt-5">
						<Stats />
					</motion.div>
				</motion.div>

				<div className="contents lg:relative lg:order-2 lg:col-span-8 lg:block lg:h-full lg:translate-x-0 lg:translate-y-[-1rem] xl:translate-x-[8rem] xl:translate-y-[-1rem]">
				<div className="relative order-1 col-span-full flex h-[360px] items-start justify-center min-[375px]:h-[385px] min-[430px]:h-[410px] sm:h-[390px] md:h-[500px] lg:absolute lg:left-0 lg:top-1/2 lg:h-full lg:w-[46%] lg:-translate-y-1/2 lg:items-center">
					<motion.div initial={{scale:0.82,opacity:0}} animate={{scale:0.94,opacity:1}} transition={{delay:0.5,duration:1}} className="relative z-20 -translate-y-2 lg:translate-x-0 lg:translate-y-0 xl:translate-x-0 xl:translate-y-0 2xl:translate-x-0">
						<div className="relative h-[360px] w-[300px] min-[375px]:h-[385px] min-[375px]:w-[320px] min-[430px]:h-[410px] min-[430px]:w-[340px] sm:h-[390px] sm:w-[290px] md:h-[500px] md:w-[360px] lg:h-[760px] lg:w-[500px] xl:h-[790px] xl:w-[520px]">
							<div className="pointer-events-none absolute inset-[-95px] z-0">
								<svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 740 980" fill="none">
									<defs>
										<radialGradient id="portraitHalo" cx="50%" cy="50%" r="50%">
											<stop offset="0%" stopColor="#00E5FF" stopOpacity="0.16" />
											<stop offset="36%" stopColor="#8B5CF6" stopOpacity="0.12" />
											<stop offset="68%" stopColor="#4338CA" stopOpacity="0.08" />
											<stop offset="100%" stopColor="#020617" stopOpacity="0" />
										</radialGradient>
										<linearGradient id="portraitRingStroke" x1="0%" y1="0%" x2="100%" y2="100%">
											<stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.15" />
											<stop offset="33%" stopColor="#00E5FF" stopOpacity="0.9" />
											<stop offset="66%" stopColor="#3B82F6" stopOpacity="0.55" />
											<stop offset="100%" stopColor="#A855F7" stopOpacity="0.1" />
										</linearGradient>
										<linearGradient id="portraitRingAccent" x1="0%" y1="100%" x2="100%" y2="0%">
											<stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
											<stop offset="42%" stopColor="#38BDF8" stopOpacity="0.78" />
											<stop offset="62%" stopColor="#8B5CF6" stopOpacity="0.9" />
											<stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
										</linearGradient>
										<filter id="portraitRingBlur" x="-35%" y="-35%" width="170%" height="170%">
											<feGaussianBlur stdDeviation="3.2" />
										</filter>
									</defs>

									<ellipse cx="370" cy="475" rx="195" ry="260" stroke="url(#portraitHalo)" strokeWidth="1.1" opacity="0.9" />
									<g filter="url(#portraitRingBlur)" opacity="0.72">
										<circle cx="370" cy="475" r="190" stroke="url(#portraitRingStroke)" strokeWidth="1.4" strokeDasharray="10 16" />
										<circle cx="370" cy="475" r="238" stroke="#00E5FF" strokeWidth="0.8" strokeOpacity="0.28" strokeDasharray="4 20" />
										<circle cx="370" cy="475" r="286" stroke="#8B5CF6" strokeWidth="0.8" strokeOpacity="0.18" strokeDasharray="2 18" />
									</g>

									<motion.g
										animate={{rotate: 360}}
										transition={{duration: 42, repeat: Infinity, ease: 'linear'}}
										style={{originX: '50%', originY: '48%'}}
									>
										<circle cx="370" cy="475" r="206" stroke="#00E5FF" strokeWidth="1" strokeOpacity="0.22" strokeDasharray="2 12" />
										<path d="M170 470 C235 355, 505 355, 570 470" stroke="#38BDF8" strokeOpacity="0.28" strokeWidth="1.1" />
										<path d="M170 480 C235 595, 505 595, 570 480" stroke="#8B5CF6" strokeOpacity="0.22" strokeWidth="1.1" />
										<path d="M370 210 L370 740" stroke="#00E5FF" strokeOpacity="0.18" strokeWidth="0.8" strokeDasharray="5 14" />
										<path d="M220 310 L520 640" stroke="#4338CA" strokeOpacity="0.16" strokeWidth="0.8" strokeDasharray="3 15" />
									</motion.g>

									<motion.g
										animate={{rotate: -360}}
										transition={{duration: 58, repeat: Infinity, ease: 'linear'}}
										style={{originX: '50%', originY: '48%'}}
									>
										<circle cx="370" cy="475" r="258" stroke="url(#portraitRingAccent)" strokeWidth="1.1" strokeDasharray="42 18 4 18" />
										<circle cx="370" cy="475" r="320" stroke="#00E5FF" strokeWidth="0.7" strokeOpacity="0.16" strokeDasharray="1 22" />
										<circle cx="370" cy="475" r="346" stroke="#8B5CF6" strokeWidth="0.6" strokeOpacity="0.08" strokeDasharray="1 28" />
									</motion.g>

									<motion.g
										animate={{rotate: [0, 4, 0, -3, 0]}}
										transition={{duration: 18, repeat: Infinity, ease: 'easeInOut'}}
										style={{originX: '50%', originY: '48%'}}
									>
										<path d="M205 285 H260 M480 285 H535 M205 665 H260 M480 665 H535" stroke="#00E5FF" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />
										<path d="M190 410 H225 M515 410 H550 M190 540 H225 M515 540 H550" stroke="#8B5CF6" strokeOpacity="0.22" strokeWidth="1" strokeLinecap="round" />
										<path d="M305 225 V260 M435 225 V260 M305 690 V725 M435 690 V725" stroke="#38BDF8" strokeOpacity="0.28" strokeWidth="1" strokeLinecap="round" />
									</motion.g>

									<g opacity="0.5">
										{Array.from({length: 24}).map((_, index) => {
											const angle = (index / 24) * Math.PI * 2
											const innerX = svgNumber(370 + Math.cos(angle) * 180)
											const innerY = svgNumber(475 + Math.sin(angle) * 244)
											const outerX = svgNumber(370 + Math.cos(angle) * 206)
											const outerY = svgNumber(475 + Math.sin(angle) * 278)
											const longTick = index % 4 === 0

											return (
												<line
													key={`portrait-tick-${index}`}
													x1={innerX}
													y1={innerY}
													x2={outerX}
													y2={outerY}
													stroke={index % 3 === 0 ? '#00E5FF' : index % 3 === 1 ? '#8B5CF6' : '#3B82F6'}
													strokeOpacity={longTick ? '0.5' : '0.22'}
													strokeWidth={longTick ? '1.1' : '0.7'}
												/>
											)
										})}
									</g>
								</svg>
							</div>
							<div className="pointer-events-none absolute inset-x-10 top-24 bottom-14 z-[1] rounded-[48%] bg-black/48 blur-3xl" />
							<div className="pointer-events-none absolute -left-6 top-24 z-[2] h-[520px] w-20 rounded-full bg-cyan-300/16 blur-2xl" />
							<div className="pointer-events-none absolute -right-4 top-32 z-[2] h-[470px] w-20 rounded-full bg-purple-500/14 blur-2xl" />
							<Image
								src="/ProfessionalMe.png"
								alt="Karl Lopez Portrait"
								fill
								priority
								sizes="(min-width: 1024px) 42vw, 100vw"
								style={{
									objectFit: 'cover',
									objectPosition: 'center',
									transform: 'scaleX(-1)',
									WebkitMaskImage: portraitFadeMask,
									WebkitMaskComposite: 'source-in',
									maskImage: portraitFadeMask,
									maskComposite: 'intersect',
									filter: 'drop-shadow(0 28px 34px rgba(0,0,0,0.42)) drop-shadow(0 0 18px rgba(0,229,255,0.12))'
								}}
								className="relative z-10"
							/>
							<IdentityCard />
						</div>
					</motion.div>
				</div>

				<div className="relative z-30 order-3 col-span-full mx-auto mt-5 flex w-full max-w-[520px] flex-col items-center justify-start overflow-visible pb-8 lg:absolute lg:right-[4rem] lg:top-1/2 lg:mt-0 lg:h-full lg:w-[62%] lg:max-w-none lg:-translate-y-1/2 lg:translate-x-0 lg:justify-center lg:pb-0 xl:right-[7rem] xl:translate-x-0">
					<motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.6,duration:0.9}} className="relative h-[235px] w-full overflow-visible min-[375px]:h-[255px] min-[430px]:h-[280px] sm:h-[300px] md:h-[360px] lg:h-[680px] lg:w-[122%] xl:h-[760px] xl:w-[126%]">
						<TechCore />
					</motion.div>
					<TerminalPanel />
				</div>
				</div>
			</div>
		</div>
	)
}
