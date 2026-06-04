import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Landing.css'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export default function Landing() {
  const navigate = useNavigate()

  // Handle error redirects from server
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    if (error) console.warn('Auth error:', error)
  }, [])

  function handleConnect() {
    window.location.href = `${SERVER}/auth/strava`
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="landing-icon">🚴</div>
        <h1>Taiwan Ride Explorer</h1>
        <p className="landing-sub">台灣騎車地圖</p>
        <p className="landing-desc">
          Connect your Strava account to see every county and township
          you&apos;ve cycled through across Taiwan — and track your progress
          towards exploring all 368 townships.
        </p>
        <div className="features">
          <div className="feature">🗺️ Interactive Taiwan map</div>
          <div className="feature">🏘️ Township-level tracking</div>
          <div className="feature">📊 Progress counter</div>
          <div className="feature">🚴 All cycling activity types</div>
        </div>
        <button className="strava-btn" onClick={handleConnect}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Connect with Strava
        </button>
        <p className="landing-note">
          Only reads your activity data. No data is stored on any server.
        </p>
      </div>
    </div>
  )
}
