import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import './Landing.css'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export default function Landing() {
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const error = searchParams.get('error')
    if (error) console.warn('Auth error:', error)
  }, [searchParams])

  function handleConnect() {
    window.location.href = `${SERVER}/auth/strava`
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <h1>Taiwan City, District and Township Challenge</h1>
        <p className="landing-sub">台灣鄉鎮市區挑戰</p>
        <p className="landing-desc">
          Connect your Strava account to see how many of Taiwan&apos;s 368 cities,
          districts and townships you&apos;ve visited on your bike.
        </p>
        <button className="strava-btn" onClick={handleConnect}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Connect with Strava
        </button>
        <p className="landing-note">Only reads your activity data. No data is stored on any server.</p>
      </div>
    </div>
  )
}
