import { useNavigate } from 'react-router-dom'
import './Splash.css'

const CHARS = [
  { char: '哩', zhuyin: 'ㄌㄧ' },
  { char: '哩', zhuyin: 'ㄌㄧ' },
  { char: '叩', zhuyin: 'ㄎㄡ' },
  { char: '叩', zhuyin: 'ㄎㄡ' },
]

export default function Splash() {
  const navigate = useNavigate()

  return (
    <div className="splash">
      <div className="splash-content">
        <h1 className="splash-title">
          {CHARS.map(({ char, zhuyin }, i) => (
            <span key={i} className="splash-char-col">
              <span className="splash-char">{char}</span>
              <span className="splash-zhuyin">{zhuyin}</span>
            </span>
          ))}
        </h1>
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
          <button className="splash-app-btn" onClick={() => navigate('/food-guide')}>
            <span className="splash-app-icon">🍜</span>
            <span className="splash-app-text">
              <span className="splash-app-title">Taiwan Food Guide</span>
              <span className="splash-app-sub">台灣吃貨指南</span>
            </span>
            <span className="splash-app-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
