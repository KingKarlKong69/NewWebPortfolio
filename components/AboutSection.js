import { useEffect, useState } from 'react'
import AboutStory from './AboutStory'
import MobileAboutStory from './MobileAboutStory'
import styles from './AboutStory.module.css'

export default function AboutSection() {
  const [desktop, setDesktop] = useState(null)

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1101px)')
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return (
    <section id="about" className={styles.about} aria-label="About Karl Lopez">
      <AboutStory enabled={desktop === true} />
      <div className={styles.mobile}>{desktop === false && <MobileAboutStory />}</div>
    </section>
  )
}
