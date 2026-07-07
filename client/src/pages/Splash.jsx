import { useNavigate } from 'react-router-dom'
import './Splash.css'

export default function Splash() {
  const navigate = useNavigate()

  return (
    <div className="splash">
      <div className="splash-content">
        <h1 className="splash-title">哩哩摳摳</h1>
        <p className="splash-zhuyin">ㄌㄧ ㄌㄧ ㄎㄡ ㄎㄡ</p>
        <p className="splash-tagline">odds &amp; ends</p>

        <div className="splash-apps">
          <button className="splash-app-btn" onClick={() => navigate('/challenge')}>
            <span className="splash-app-icon">🚴</span>
            <span className="splash-app-text">
              <span className="splash-app-title">Taiwan City, District and Township Challenge</span>
              <span className="splash-app-sub">台灣鄉鎮市區挑戰</span>
            </span>
            <span className="splash-app-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
