import projectPreset from '../../config/footer-blackhole-preset.json'
import {parseLabPreset} from './blackHoleLabControls'

// Bundled with the site: browser storage is only a temporary override.
export const FOOTER_PROJECT_DEFAULT=parseLabPreset(JSON.stringify(projectPreset))
