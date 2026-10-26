// Optional actions let each project expose exactly the controls it supports.
// URL actions use their existing destination; local actions retain the details dialog.
export function getProjectActions(project) {
  const defaults = project.liveUrl
    ? [{ type: 'visitSite', href: project.liveUrl }, { type: 'caseStudy' }]
    : [{ type: 'viewProject' }]
  const labels = { visitSite: 'Visit Site', viewProject: 'View Project', caseStudy: 'Case Study' }
  return (Array.isArray(project.actions) ? project.actions : defaults)
    .filter(action => action && labels[action.type] && action.available !== false)
    .map(action => ({ ...action, label: action.label || labels[action.type], href: action.href || (action.type === 'visitSite' ? project.liveUrl : null) }))
    .filter(action => action.type !== 'visitSite' || action.href)
}
