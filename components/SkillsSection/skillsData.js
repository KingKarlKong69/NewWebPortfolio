import { Bot, Code2, Cpu, Database, Server, Zap } from 'lucide-react'

export const SKILL_CATEGORIES = [
  {
    id: 'strengths',
    label: 'Strengths',
    Icon: Zap,
    items: [
      { name: 'Time Management', value: 85 },
      { name: 'Problem Solving', value: 90 },
      { name: 'Leadership', value: 67 },
      { name: 'Design', value: 80 },
      { name: 'Adaptability', value: 95 },
      { name: 'Organized', value: 90 },
      { name: 'Research', value: 82 }
    ]
  },
  {
    id: 'frontend',
    label: 'Frontend',
    Icon: Code2,
    items: [
      { name: 'HTML', value: 90 },
      { name: 'CSS', value: 90 },
      { name: 'JavaScript', value: 87 },
      { name: 'TypeScript', value: 85 },
      { name: 'Vue.js', value: 75 },
      { name: 'React.js', value: 79 },
      { name: 'Tailwind CSS', value: 80 }
    ]
  },
  {
    id: 'backend',
    label: 'Backend',
    Icon: Server,
    items: [
      { name: 'PHP', value: 88 },
      { name: 'Laravel', value: 80 },
      { name: 'Node.js', value: 80 },
      { name: 'Django', value: 75 }
    ]
  },
  {
    id: 'database',
    label: 'Database',
    Icon: Database,
    items: [
      { name: 'MySQL', value: 90 },
      { name: 'MariaDB', value: 90 },
      { name: 'Firebase Firestore', value: 87 },
      { name: 'SQLite', value: 87 }
    ]
  },
  {
    id: 'dev-tools-tech',
    label: 'Dev Tools & Tech',
    Icon: Cpu,
    items: [
      { name: 'Git', value: 70 },
      { name: 'GitHub', value: 73 },
      { name: 'Inertia.js', value: 73 },
      { name: 'Vite', value: 73 },
      { name: 'Capacitor.js', value: 78 },
      { name: 'Electron.js', value: 76 },
      { name: 'Figma', value: 86 },
      { name: 'Canva', value: 84 },
      { name: 'Adobe Photoshop', value: 75 },
      { name: 'Adobe Premiere Pro', value: 70 },
      { name: 'Microsoft Office', value: 70 }
    ]
  },
  {
    id: 'ai-tools',
    label: 'AI Tools',
    Icon: Bot,
    items: [
      { name: 'ChatGPT', value: 90 },
      { name: 'Codex', value: 87 },
      { name: 'GitHub Copilot', value: 87 },
      { name: 'Gemini', value: 87 }
    ]
  }
]

