// World-space coordinates keep each icon attached to its terrain location.
// Technology descriptions express intended use, never a proficiency score.
// These user-supplied assets have explicit mappings; no filename guessing occurs.
const additionalIcons = {
  inertia: '/more-icons/Inertia-icon.png',
  capacitor: '/more-icons/capacitor-icon.png',
  office: '/more-icons/Microsoft-office-icon.webp'
}

const technology = (id, label, icon, description, tags, x, z, lift = 5) => ({
  id, label, icon: icon ? `/tech-stack-icons/${icon}.svg` : additionalIcons[id] || null,
  description, tags, x, z, lift: Math.max(5, lift)
})

const strength = (id, label, icon, description, x, z, lift = 5) => ({
  id, label, icon: `/strength-icons/${icon}-fill.svg`,
  description, tags: [], x, z, lift: Math.max(5, lift), monochrome: true
})

export const SKILLS_CHAPTERS = [
  {
    id: 'strengths', title: 'Strengths',
    subtitle: 'How I think · work · collaborate', x: 0,
    markers: [
      strength('time-management', 'Time Management', 'hourglass', 'Prioritizing the work and making room for focused, deliberate progress.', -15.01, -43, 16),
      strength('leadership', 'Leadership', 'crown', 'Helping a team clarify its direction and move the work forward.', 2.33, -47.3, 9.85),
      strength('teamwork', 'Teamwork', 'users-three', 'Communicating clearly, sharing context, and building toward a shared outcome.', 28.88, -48.8, 10.58),
      strength('problem-solving', 'Problem-Solving', 'brain', 'Breaking complex challenges into clear and workable solutions.', 45.22, -44, 14),
      strength('design-thinking', 'Design Thinking', 'eye', 'Connecting usability, structure, and visual judgment to intentional decisions.', -3.24, -17.4, 1.24),
      strength('adaptability', 'Adaptability', 'arrows-clockwise', 'Adjusting the approach when tools, requirements, or constraints change.', 5.14, -38, 2.38),
      strength('organized', 'Organized', 'stack', 'Giving information, tasks, and code a structure that is easier to work with.', 18.63, -24.1, 1.21),
      strength('research', 'Research', 'magnifying-glass', 'Understanding the problem, users, and constraints before choosing a solution.', 22.6, -8, 1.25)
    ]
  },
  {
    id: 'frontend', title: 'Frontend Systems',
    subtitle: 'Interfaces · responsive design · user experience', x: 88,
    markers: [
      technology('html', 'HTML', 'html5', 'Structuring accessible pages and meaningful interface content.', ['Semantics', 'Structure', 'Accessibility'], 84.73, -7.3, 1.22),
      technology('css', 'CSS', 'css3', 'Shaping responsive layouts, typography, and interface motion.', ['Layout', 'Responsive design', 'Motion'], 92.84, -9.3, 1.23),
      technology('tailwind', 'Tailwind CSS', 'tailwindcss', 'Composing consistent interfaces with utility-based styling.', ['Utilities', 'Responsive UI', 'Consistency'], 102.87, -13.7, 1.21),
      technology('javascript', 'JavaScript', 'js', 'Connecting interface behavior, browser APIs, and application state.', ['Interaction', 'State', 'Browser APIs'], 67.85, -45, 14),
      technology('typescript', 'TypeScript', 'typescript', 'Making data contracts and component behavior easier to reason about.', ['Types', 'Contracts', 'Maintainability'], 111.59, -46, 15),
      technology('vue', 'Vue.js', 'vuejs', 'Building reactive interfaces from reusable components.', ['Components', 'Reactivity', 'Interfaces'], 89.96, -40.8, 11),
      technology('nuxt', 'Nuxt.js', 'nuxtjs', 'Organizing Vue applications with routing and server rendering.', ['Vue', 'Routing', 'SSR'], 90.98, -54, 23),
      technology('react', 'React', 'react', 'Composing interactive views and managing component state.', ['Components', 'State', 'Interfaces'], 125.89, -35, 13),
      technology('next', 'Next.js', 'nextjs-dark', 'Structuring React applications with routing and server rendering.', ['React', 'Routing', 'SSR'], 138.65, -56.2, 23),
      technology('inertia', 'Inertia.js', null, 'Connecting a server-driven application to reactive frontend pages.', ['Server-driven', 'Pages', 'Integration'], 110.04, -7.8, 1.44),
      technology('threejs', 'Three.js', 'threejs-dark', 'Creating interactive 3D scenes, materials, and animation in the browser.', ['WebGL', '3D graphics', 'Animation'], 100, -29, 10),
      technology('vite', 'Vite', 'vitejs', 'Keeping frontend development and production builds straightforward.', ['Development', 'Builds', 'Tooling'], 116.49, -67, 13)
    ]
  },
  {
    id: 'backend', title: 'Backend & Data',
    subtitle: 'Application logic · APIs · databases', x: 176,
    markers: [
      technology('php', 'PHP', 'php', 'Implementing server-side application logic and request handling.', ['Server', 'Application logic', 'Web'], 156.08, -47, 15),
      technology('laravel', 'Laravel', 'laravel', 'Organizing PHP applications around clear routes, models, and workflows.', ['PHP', 'Routing', 'Application structure'], 172.36, -33.7, 14.11),
      technology('node', 'Node.js', 'nodejs', 'Running JavaScript outside the browser for application services and tooling.', ['JavaScript', 'Services', 'Tooling'], 194, -26, 12),
      technology('python', 'Python', 'python', 'Working with the Python application layer used by Django.', ['Python', 'Application logic', 'Django'], 212.94, -47, 3.85),
      technology('django', 'Django', 'django-dark', 'Building Python web applications with structured models and request handling.', ['Python', 'Models', 'Web framework'], 224.7, -59.9, 15.35),
      technology('postgresql', 'PostgreSQL', 'postgresql', 'Modeling relational data and querying it with SQL.', ['SQL', 'Relations', 'Queries'], 164, -17, 8),
      technology('mysql', 'MySQL', 'mysql', 'Modeling and querying relational application data.', ['SQL', 'Relations', 'Queries'], 174.13, -6, 1.2),
      technology('mariadb', 'MariaDB', 'mariadb', 'Working with relational data and SQL-based application persistence.', ['SQL', 'Persistence', 'Relational data'], 181.34, -5.1, 1.23),
      technology('sqlite', 'SQLite', 'sqlite', 'Using a lightweight local relational database where it fits the application.', ['Local data', 'SQL', 'Lightweight'], 187.93, -5.9, 1.21),
      technology('firestore', 'Firebase Firestore', 'firebase', 'Organizing document data and synchronizing application updates.', ['Documents', 'Realtime data', 'Firebase'], 202.49, -11.3, 1.25)
    ]
  },
  {
    id: 'delivery', title: 'Development & Delivery',
    subtitle: 'Version control · platforms · design · production', x: 264,
    markers: [
      technology('vercel', 'Vercel', 'vercel-dark', 'Deploying web applications with preview builds and production releases.', ['Hosting', 'Previews', 'Deployment'], 279, -32, 12),
      technology('railway', 'Railway', 'railway-dark', 'Deploying application services and databases for web projects.', ['Services', 'Databases', 'Deployment'], 306, -29, 10),
      technology('git', 'Git', 'git', 'Tracking changes and keeping development work reviewable.', ['Version control', 'Branches', 'History'], 243.38, -54.2, 8.97),
      technology('github', 'GitHub', 'github-dark', 'Sharing repositories and collaborating around code changes.', ['Repositories', 'Collaboration', 'Review'], 259.64, -53, 11.69),
      technology('capacitor', 'Capacitor.js', null, 'Bringing web application interfaces into a native mobile container.', ['Web', 'Mobile', 'Native integration'], 282, -47, 14),
      technology('electron', 'Electron.js', 'electron', 'Packaging web technologies into desktop applications.', ['Web', 'Desktop', 'Packaging'], 315.02, -59.5, 8.93),
      technology('figma', 'Figma', 'figma', 'Exploring interface layouts, reusable components, and design decisions.', ['UI design', 'Prototyping', 'Components'], 251.45, -28.9, 1.2),
      technology('canva', 'Canva', 'canva', 'Developing visual references, presentations, and supporting graphics.', ['Visual references', 'Layouts', 'Presentation'], 267.19, -11, 1.42),
      technology('photoshop', 'Adobe Photoshop', 'photoshop', 'Preparing and editing image assets for digital work.', ['Image editing', 'Assets', 'Graphics'], 274.98, -11.9, 1.23),
      technology('premiere', 'Adobe Premiere Pro', 'premierepro', 'Editing video and supporting motion-focused project communication.', ['Video', 'Editing', 'Media'], 291.63, -21, 1.22),
      technology('office', 'Microsoft Office', null, 'Organizing documents, spreadsheets, and presentations around project work.', ['Documentation', 'Productivity', 'Communication'], 294, -11, 12)
    ]
  },
  {
    id: 'ai', title: 'AI Tools & Workflow',
    subtitle: 'Research · assistance · experimentation · acceleration', x: 352,
    description: 'I use AI to explore ideas, understand unfamiliar concepts, accelerate repetitive work, and build beyond my current limitations.',
    markers: [
      technology('chatgpt', 'ChatGPT', 'openai-dark', 'Research, explanation, brainstorming, and debugging with critical review.', ['Research', 'Explanation', 'Debugging'], 339.13, -40, 8.01),
      technology('codex', 'Codex', 'openai-dark', 'Implementation, coding assistance, and working through an existing codebase.', ['Implementation', 'Codebase work', 'Review'], 358.83, -49.4, 4.69),
      technology('copilot', 'GitHub Copilot', 'copilotgithub-dark', 'In-editor suggestions and completion that support the coding workflow.', ['Editor', 'Suggestions', 'Completion'], 383.47, -44, 6.73),
      technology('gemini', 'Gemini', 'gemini', 'Exploring alternative explanations and possible approaches to a problem.', ['Research', 'Alternatives', 'Exploration'], 365.16, -6.1, 5),
      technology('claude', 'Claude', 'claude', 'Exploring ideas, reasoning through unfamiliar problems, and reviewing possible implementations.', ['Reasoning', 'Ideas', 'Review'], 354, -15, 5)
    ]
  }
]

export const SKILLS_CHECKPOINTS = [
  { id: 'solve', title: 'Solve Problems Clearly', subtitle: 'Break difficult challenges into workable steps.', chapterIndex: 0, x: -44, z: -5, lift: 0.15 },
  { id: 'test', title: 'Test and Refine', subtitle: 'Improve through testing, feedback, and iteration.', chapterIndex: 1, x: 46, z: -5, lift: 0.15 },
  { id: 'collaborate', title: 'Collaborate and Lead', subtitle: 'Communicate clearly and help move the work forward.', chapterIndex: 2, x: 134, z: -5, lift: 0.15 },
  { id: 'ship', title: 'Ship Working Products', subtitle: 'Turn ideas into reliable experiences people can use.', chapterIndex: 3, x: 222, z: -5, lift: 0.15 },
  { id: 'adapt', title: 'Adapt and Keep Learning', subtitle: 'Experiment with unfamiliar tools and approaches.', chapterIndex: 4, x: 310, z: -5, lift: 0.15 }
]
