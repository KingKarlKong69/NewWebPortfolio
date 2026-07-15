import {Code2, Database, FlaskConical, Layers, PenTool, Smartphone} from 'lucide-react'

export const SERVICES = [
  {
    id: 'ui-ux-design',
    number: '01',
    title: 'UI / UX Design',
    description: 'Designing intuitive and engaging experiences that users love.',
    Icon: PenTool,
    accent: '#ffbd38',
    glow: '255, 189, 56',
    x: 10.5,
    y: 73
  },
  {
    id: 'frontend-development',
    number: '02',
    title: 'Frontend Development',
    description: 'Building fast, responsive and accessible web interfaces.',
    Icon: Code2,
    accent: '#27e7ff',
    glow: '39, 231, 255',
    x: 27,
    y: 58.5
  },
  {
    id: 'backend-development',
    number: '03',
    title: 'Backend Development',
    description: 'Developing secure, scalable and high-performance server-side applications.',
    Icon: Database,
    accent: '#20e5ff',
    glow: '32, 229, 255',
    x: 44,
    y: 47.5
  },
  {
    id: 'full-stack-development',
    number: '04',
    title: 'Full Stack Development',
    description: 'Integrating frontend and backend to build powerful end-to-end solutions.',
    Icon: Layers,
    accent: '#a85eff',
    glow: '168, 94, 255',
    x: 60,
    y: 35
  },
  {
    id: 'hybrid-cross-platform',
    number: '05',
    title: 'Hybrid / Cross-Platform',
    description: 'Building high-quality mobile apps for iOS and Android with a single codebase.',
    Icon: Smartphone,
    accent: '#27e7ff',
    glow: '39, 231, 255',
    x: 77,
    y: 26
  },
  {
    id: 'research',
    number: '06',
    title: 'Research',
    description: 'Conducting in-depth research to validate ideas and drive data-informed decisions.',
    Icon: FlaskConical,
    accent: '#a85eff',
    glow: '168, 94, 255',
    x: 91,
    y: 25.5
  }
]

export const TESTIMONIALS = [
  {
    id: 'john-eric-paragas',
    quote: 'Karl is an exceptional developer. He delivered a high-quality product ahead of schedule and his attention to detail is outstanding.',
    name: 'John Eric Paragas',
    role: 'CEO, TechNova Solutions',
    initials: 'JP',
    accent: 'cyan'
  },
  {
    id: 'vannah-joy-valencia',
    quote: 'Working with Karl was a smooth experience. He understood the requirements perfectly and the results exceeded our expectations.',
    name: 'Vannah Joy Valencia',
    role: 'Product Manager, VisionUI',
    initials: 'VV',
    accent: 'violet'
  }
]
