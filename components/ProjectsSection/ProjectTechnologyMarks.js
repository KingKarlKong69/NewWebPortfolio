// Exact light-variant SVGs vendored from tech-stack-icons@3.7.1 (MIT).
// See public/tech-stack-icons/NOTICE.md for their source and license.
const ICON_NAMES = {
  HTML: 'html5', CSS: 'css3', TailwindCSS: 'tailwindcss', JavaScript: 'js',
  PHP: 'php', Firebase: 'firebase', TypeScript: 'typescript', 'Vue.js': 'vuejs',
  Laravel: 'laravel', MySQL: 'mysql', 'React.js': 'react'
}

export default function ProjectTechnologyMarks({ technologies = [], className }) {
  return <ul className={className} aria-label="Technology stack">
    {technologies.map(technology => {
      const iconName = ICON_NAMES[technology]
      const extra = {'Inertia.js':'Inertia-icon.png', Inertia:'Inertia-icon.png', XAMPP:'xampp-icon.webp', Xampp:'xampp-icon.webp'}[technology]
      const src = extra ? `/more-icons/${extra}` : iconName ? `/tech-stack-icons/${iconName}.svg` : null
      return <li key={technology} title={technology} data-text-mark={!src || undefined}>
        {src
          ? <img src={src} width="100" height="100" alt={technology} decoding="async" />
          : <span>{technology}</span>}
      </li>
    })}
  </ul>
}
