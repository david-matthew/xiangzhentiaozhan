import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './FoodMap.css'

const CATEGORIES = {
  'Breakfast':   { emoji: '🍙', color: '#f59e0b' },
  'Dinner':      { emoji: '🍜', color: '#ef4444' },
  'Dessert':     { emoji: '🍧', color: '#ec4899' },
  'Bubble tea':  { emoji: '🧋', color: '#8b5cf6' },
  'Coffee':      { emoji: '☕️', color: '#92400e' },
  'Alcohol':     { emoji: '🍺', color: '#065f46' },
  'Shopping':    { emoji: '🛍',  color: '#0ea5e9' },
  'Miscellaneous': { emoji: '📌', color: '#6b7280' },
}

const CITIES = ['台北 Taipei','台中 Taichung','彰化 Changhua','嘉義 Chiayi','台南 Tainan','高雄 Kaohsiung','屏東 Pingtung','台東 Taitung','花蓮 Hualien','宜蘭 Yilan']

function makeIcon(category, recommended) {
  const cat = CATEGORIES[category] || CATEGORIES['Miscellaneous']
  const color = cat.color
  const size = recommended ? 32 : 26
  const border = recommended ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.7)'
  const shadow = recommended ? '0 2px 8px rgba(0,0,0,0.35)' : '0 1px 4px rgba(0,0,0,0.25)'
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:${border};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;font-size:${recommended?14:11}px">${recommended ? '🔥' : cat.emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2 - 4],
  })
}

function FlyToMarker({ place }) {
  const map = useMap()
  useEffect(() => {
    if (place) map.flyTo([place.lat, place.lng], 16, { duration: 0.8 })
  }, [place, map])
  return null
}

export default function FoodMap() {
  const [places,       setPlaces]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [activeCats,   setActiveCats]   = useState(new Set(Object.keys(CATEGORIES)))
  const [activeCities, setActiveCities] = useState(new Set(CITIES))
  const [recOnly,      setRecOnly]      = useState(false)
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [flyTarget,    setFlyTarget]    = useState(null)

  useEffect(() => {
    document.title = 'Taiwan Food Guide'
    fetch(`${import.meta.env.BASE_URL}taiwan_food_guide.json`)
      .then(r => r.json())
      .then(data => { setPlaces(data); setLoading(false) })
  }, [])

  const toggleCat  = (cat)  => setActiveCats(s  => { const n = new Set(s); n.has(cat)  ? n.delete(cat)  : n.add(cat);  return n })
  const toggleCity = (city) => setActiveCities(s => { const n = new Set(s); n.has(city) ? n.delete(city) : n.add(city); return n })

  const filtered = useMemo(() => places.filter(p => {
    if (!activeCats.has(p.category))  return false
    if (!activeCities.has(p.city))    return false
    if (recOnly && !p.recommended)    return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.city.toLowerCase().includes(q)
    }
    return true
  }), [places, activeCats, activeCities, recOnly, search])

  if (loading) return (
    <div className="fm-loading">
      <div className="fm-spinner" />
      <p>Loading food guide…</p>
    </div>
  )

  const sidebar = (
    <aside className={`fm-panel ${sidebarOpen ? 'open' : ''}`}>
      <div className="fm-header">
        <h1>Taiwan Food Guide</h1>
        <p className="fm-subtitle">台灣吃貨指南</p>
      </div>

      <input
        className="fm-search"
        type="text"
        placeholder="Search places…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="fm-section">
        <div className="fm-section-label">Category</div>
        <div className="fm-cat-pills">
          {Object.entries(CATEGORIES).map(([cat, { emoji, color }]) => (
            <button
              key={cat}
              className={`fm-cat-pill ${activeCats.has(cat) ? 'active' : ''}`}
              style={{ '--pill-color': color }}
              onClick={() => toggleCat(cat)}
            >
              {emoji} {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="fm-section">
        <div className="fm-section-label">City</div>
        <div className="fm-city-list">
          {CITIES.filter(c => places.some(p => p.city === c)).map(city => (
            <label key={city} className="fm-city-row">
              <input type="checkbox" checked={activeCities.has(city)} onChange={() => toggleCity(city)} />
              <span>{city}</span>
              <span className="fm-city-count">{places.filter(p => p.city === city).length}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="fm-toggle">
        <input type="checkbox" checked={recOnly} onChange={() => setRecOnly(!recOnly)} />
        🔥 Recommended only
      </label>

      <div className="fm-count">{filtered.length} places shown</div>

      <div className="fm-list">
        {filtered.map((p, i) => (
          <button key={i} className="fm-list-item" onClick={() => { setFlyTarget(p); setSidebarOpen(false) }}>
            <span className="fm-list-icon" style={{ background: (CATEGORIES[p.category] || CATEGORIES['Miscellaneous']).color }}>
              {p.recommended ? '🔥' : (CATEGORIES[p.category] || CATEGORIES['Miscellaneous']).emoji}
            </span>
            <span className="fm-list-text">
              <span className="fm-list-name">{p.name}</span>
              <span className="fm-list-meta">{p.city.split(' ')[0]} · {p.category}</span>
            </span>
          </button>
        ))}
      </div>

      <button className="fm-back-btn" onClick={() => window.location.href = '#/'}>← Back</button>
    </aside>
  )

  return (
    <div className="fm-layout">
      <button className="fm-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {sidebar}

      {sidebarOpen && <div className="fm-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="fm-main">
        <MapContainer center={[23.6, 121.0]} zoom={7} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">Carto</a>'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />
          <FlyToMarker place={flyTarget} />
          {filtered.map((p, i) => (
            <Marker key={i} position={[p.lat, p.lng]} icon={makeIcon(p.category, p.recommended)}>
              <Popup className="fm-popup" maxWidth={280}>
                <div className="fm-popup-name">{p.recommended && <span className="fm-rec">🔥</span>}{p.name}</div>
                <div className="fm-popup-badges">
                  <span className="fm-badge city">{p.city.split(' ')[0]}</span>
                  <span className="fm-badge cat" style={{ background: (CATEGORIES[p.category] || CATEGORIES['Miscellaneous']).color }}>
                    {(CATEGORIES[p.category] || CATEGORIES['Miscellaneous']).emoji} {p.category}
                  </span>
                </div>
                {p.description && <p className="fm-popup-desc">{p.description}</p>}
                <a className="fm-maps-btn" href={p.url} target="_blank" rel="noopener noreferrer">
                  Open in Google Maps →
                </a>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </main>
    </div>
  )
}
