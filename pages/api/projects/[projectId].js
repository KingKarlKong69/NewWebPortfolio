import {readdir} from 'fs/promises'
import path from 'path'

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({error: 'Method not allowed'})
  }

  const projectId = Array.isArray(req.query.projectId) ? req.query.projectId[0] : req.query.projectId
  if (!projectId || !/^[a-z0-9-]+$/i.test(projectId)) return res.status(400).json({error: 'Invalid project id'})

  const folder = path.join(process.cwd(), 'public', 'projects', projectId)
  try {
    const files = await readdir(folder, {withFileTypes: true})
    const images = files
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}))
      .map((file) => `/projects/${projectId}/${encodeURIComponent(file)}`)

    return res.status(200).json({images})
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(200).json({images: []})
    return res.status(500).json({error: 'Unable to read project screenshots'})
  }
}
