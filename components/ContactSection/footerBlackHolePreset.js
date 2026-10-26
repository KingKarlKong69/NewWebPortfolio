import {LAB_PRESET_VERSION, parseLabPreset, sanitizeLabValues} from './blackHoleLabControls'
import {FOOTER_PROJECT_DEFAULT} from './projectFooterBlackHolePreset'

export const getFooterBlackHoleValues=()=>readFooterBlackHolePreset()||FOOTER_PROJECT_DEFAULT

export const FOOTER_PRESET_KEY = 'black-hole-footer-preview-v1'
const CHANGE_EVENT = 'black-hole-footer-preview-change'

export function readFooterBlackHolePreset() {
  if (typeof window === 'undefined') return null
  try {
    const saved = window.localStorage.getItem(FOOTER_PRESET_KEY)
    return saved ? parseLabPreset(saved) : null
  } catch { return null }
}

export function applyFooterBlackHolePreset(values) {
  const preset = sanitizeLabValues(values)
  // Notify only after a successful write; storage failures leave the footer intact.
  window.localStorage.setItem(FOOTER_PRESET_KEY, JSON.stringify({version:LAB_PRESET_VERSION, values:preset}))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function restoreFooterBlackHoleDefaults() {
  window.localStorage.removeItem(FOOTER_PRESET_KEY)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeFooterBlackHolePreset(listener) {
  const storage = event => {
    if (event.key === FOOTER_PRESET_KEY || event.key === null) listener()
  }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', storage)
  window.addEventListener('focus', listener)
  window.addEventListener('pageshow', listener)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', storage)
    window.removeEventListener('focus', listener)
    window.removeEventListener('pageshow', listener)
  }
}
