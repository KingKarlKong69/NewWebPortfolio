import Head from 'next/head'
import NavBar from '../components/NavBar'
import LeftNav from '../components/LeftNav'
import Hero from '../components/Hero'
import AboutSection from '../components/AboutSection'
import SkillsSection from '../components/SkillsSection/SkillsSection'
import ProjectsSection from '../components/ProjectsSection/ProjectsSection'
import ServicesSection from '../components/ServicesSection/ServicesSection'
import ContactSection from '../components/ContactSection/ContactSection'
import ResponsivePortfolioLogo from '../components/ResponsivePortfolioLogo'
import { NavigationProvider } from '../components/navigationState'

export default function Home(){
  return (
    <NavigationProvider>
      <div className="relative min-h-screen overflow-x-clip" style={{background: 'transparent'}}>
        <Head>
          <title>Karl Lopez — Full Stack Engineer</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <ResponsivePortfolioLogo />
        <NavBar />
        <LeftNav />
        <main className="relative min-h-screen w-full" style={{background: 'transparent'}}>
          <Hero />
          <AboutSection />
          <ProjectsSection />
          <SkillsSection />
          <ServicesSection />
          <ContactSection />
        </main>
      </div>
    </NavigationProvider>
  )
}
