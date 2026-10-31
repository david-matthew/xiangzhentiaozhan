import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './About.css'

export default function About() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'About 哩哩叩叩'
  }, [])

  return (
    <div className="about-page">
      <div className="about-content">
        <button className="about-back" onClick={() => navigate('/')}>← Back</button>
        <h1 className="about-title">About</h1>
        <p>
          Hi, I&apos;m David! I love cycling and eating my way around Taiwan. With this little
          site I hope to share my favourite cycling routes and food stops on this beautiful
          island. I lived in Taiwan for a few years and now travel there regularly for work.
        </p>
        <p>
          Find me on{' '}
          <a href="https://www.strava.com/athletes/10375775" target="_blank" rel="noopener noreferrer">
            Strava
          </a>
        </p>
      </div>
    </div>
  )
}
