import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, GeoJSON, Polyline } from 'react-leaflet'
import * as turf from '@turf/turf'
import * as topojson from 'topojson-client'
import 'leaflet/dist/leaflet.css'
import './MapPage.css'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

const TOWN_FILES = [
  '09007','09020','10002','10004','10005','10007','10008','10009',
  '10010','10013','10014','10015','10016','10017','10018','10020',
  '63000','64000','65000','66000','67000','68000',
]

const TOTAL_TOWNS    = 368
const TOTAL_COUNTIES = 22

const LOAD_STEPS = [
  'Authenticating with Strava…',
  'Loading map data…',
  'Fetching your rides…',
  'Processing routes…',
]

function activityLines(points) {
  const coords = points.map(([lat, lon]) => [lon, lat])
  if (coords.length < 2) return []
  const lines = []
  for (let i = 0; i < coords.length - 1; i += 499) {
    const chunk = coords.slice(i, i + 500)
    if (chunk.length >= 2) lines.push(turf.lineString(chunk))
  }
  return lines
}

export default function MapPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const athleteName  = searchParams.get('name')
  const accessToken  = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')
  const expiresAt    = searchParams.get('expires_at')

  useEffect(() => {
    if (accessToken)  sessionStorage.setItem('strava_access_token',  accessToken)
    if (refreshToken) sessionStorage.setItem('strava_refresh_token', refreshToken)
    if (expiresAt)    sessionStorage.setItem('strava_expires_at',    expiresAt)
    if (athleteName)  sessionStorage.setItem('strava_athlete_name',  athleteName)
  }, [accessToken, refreshToken, expiresAt, athleteName])

  const storedName = athleteName || sessionStorage.getItem('strava_athlete_name')

  const getToken = async () => {
    let token  = sessionStorage.getItem('strava_access_token')
    const exp  = Number(sessionStorage.getItem('strava_expires_at') || 0)
    const rTok = sessionStorage.getItem('strava_refresh_token')
    if (!token) throw new Error('Not authenticated. Please reconnect with Strava.')
    if (rTok && Date.now() / 1000 > exp - 300) {
      const r = await fetch(`${SERVER}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rTok }),
      })
      if (!r.ok) throw new Error('Session expired. Please reconnect with Strava.')
      const data = await r.json()
      sessionStorage.setItem('strava_access_token',  data.access_token)
      sessionStorage.setItem('strava_refresh_token', data.refresh_token)
      sessionStorage.setItem('strava_expires_at',    data.expires_at)
      token = data.access_token
    }
    return token
  }

  const [activities,    setActivities]    = useState([])
  const [countyGeo,     setCountyGeo]     = useState(null)
  const [townFeatures,  setTownFeatures]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [loadStep,      setLoadStep]      = useState(0)
  const [error,         setError]         = useState(null)
  const [showRides,     setShowRides]     = useState(true)
  const [sidebarOpen,   setSidebarOpen]   = useState(false)

  useEffect(() => {
    const base = import.meta.env.BASE_URL

    setLoadStep(0) // Authenticating
    getToken()
      .then((token) => {
        setLoadStep(1) // Loading map data
        const townFetches = TOWN_FILES.map((slug) =>
          fetch(`${base}towns-${slug}.json`).then((r) => r.json())
        )
        const mapFetch = fetch(`${base}twCounty2010.geojson`).then((r) => r.json())

        setLoadStep(2) // Fetching rides
        const activitiesFetch = fetch(`${SERVER}/activities`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => {
          if (r.status === 401) throw new Error('Session expired. Please reconnect with Strava.')
          return r.json()
        })

        return Promise.all([mapFetch, activitiesFetch, ...townFetches])
      })
      .then(([counties, actData, ...topoFiles]) => {
        if (actData.error) throw new Error(actData.error)
        setLoadStep(3) // Processing
        setCountyGeo(counties)
        setActivities(actData.activities)
        setTownFeatures(
          topoFiles.flatMap((topo) => topojson.feature(topo, topo.objects.map).features)
        )
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const activityLineGroups = useMemo(
    () => activities.map((a) => ({ ...a, lines: activityLines(a.points) })),
    [activities]
  )

  const townVisitData = useMemo(() => {
    if (!activityLineGroups.length || !townFeatures.length) return new Map()
    const data = new Map()
    townFeatures.forEach((feature) => {
      const id = feature.properties.id
      activityLineGroups.forEach((activity) => {
        if (!activity.lines.length) return
        const hit = activity.lines.some((line) => {
          try {
            const lb = turf.bbox(line), fb = turf.bbox(feature)
            if (lb[2] < fb[0] || lb[0] > fb[2] || lb[3] < fb[1] || lb[1] > fb[3]) return false
            return turf.booleanIntersects(line, feature)
          } catch { return false }
        })
        if (hit) {
          const prev = data.get(id)
          const date = new Date(activity.date)
          data.set(id, {
            count:    (prev?.count ?? 0) + 1,
            lastDate: !prev || date > prev.lastDate ? date : prev.lastDate,
          })
        }
      })
    })
    return data
  }, [activityLineGroups, townFeatures])

  const visitedTownIds = useMemo(() => new Set(townVisitData.keys()), [townVisitData])

  const visitedCountyIds = useMemo(() => {
    if (!activityLineGroups.length || !countyGeo) return new Set()
    const visited = new Set()
    countyGeo.features.forEach((feature) => {
      const id = feature.properties.COUNTYSN || feature.properties.COUNTYNAME
      const hit = activityLineGroups.some((activity) =>
        activity.lines.some((line) => {
          try {
            const lb = turf.bbox(line), fb = turf.bbox(feature)
            if (lb[2] < fb[0] || lb[0] > fb[2] || lb[3] < fb[1] || lb[1] > fb[3]) return false
            return turf.booleanIntersects(line, feature)
          } catch { return false }
        })
      )
      if (hit) visited.add(id)
    })
    return visited
  }, [activityLineGroups, countyGeo])

  const countyStyle = useMemo(() => (feature) => {
    const id = feature.properties.COUNTYSN || feature.properties.COUNTYNAME
    return {
      fillColor: 'transparent', fillOpacity: 0,
      color:  visitedCountyIds.has(id) ? '#16a34a' : '#9ca3af',
      weight: visitedCountyIds.has(id) ? 2.5 : 1.5,
    }
  }, [visitedCountyIds])

  const townStyle = useMemo(() => (feature) => {
    const visited = visitedTownIds.has(feature.properties.id)
    return {
      fillColor:   visited ? '#4ade80' : '#e5e7eb',
      fillOpacity: visited ? 0.6 : 0.5,
      color:       visited ? '#16a34a' : '#d1d5db',
      weight:      visited ? 1.2 : 0.6,
    }
  }, [visitedTownIds])

  const onEachTown = useMemo(() => (feature, layer) => {
    const name  = feature.properties.name || ''
    const visit = townVisitData.get(feature.properties.id)
    const lastVisited = visit
      ? visit.lastDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—'
    const html = `
      <div class="tt-name">${name}</div>
      <div class="tt-row"><span class="tt-lbl">Last visited</span><span class="tt-val">${lastVisited}</span></div>
      <div class="tt-row"><span class="tt-lbl">Total visits</span><span class="tt-val">${visit?.count ?? 0}</span></div>
    `
    layer.bindTooltip(html, { sticky: true, className: 'town-tooltip' })
  }, [townVisitData])

  const rideLines = useMemo(
    () => activities.map((a) => a.points.map(([lat, lon]) => [lat, lon])),
    [activities]
  )

  const totalKm        = (activities.reduce((s, a) => s + a.distance,  0) / 1000).toFixed(0)
  const totalElevation =  activities.reduce((s, a) => s + a.elevation, 0).toFixed(0)
  const longestRideKm  = activities.length
    ? (Math.max(...activities.map((a) => a.distance)) / 1000).toFixed(0)
    : 0
  const isEmpty = !loading && !error && activities.length === 0

  const disconnect = () => {
    sessionStorage.removeItem('strava_access_token')
    sessionStorage.removeItem('strava_refresh_token')
    sessionStorage.removeItem('strava_expires_at')
    sessionStorage.removeItem('strava_athlete_name')
    navigate('/')
  }

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="map-loading">
      <div className="load-card">
        <div className="spinner" />
        <div className="load-steps">
          {LOAD_STEPS.map((label, i) => (
            <div key={i} className={`load-step ${i < loadStep ? 'done' : i === loadStep ? 'active' : 'pending'}`}>
              <span className="load-step-icon">{i < loadStep ? '✓' : i === loadStep ? '›' : '·'}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── Error screen ──────────────────────────────────────────────────────────
  if (error) return (
    <div className="map-error">
      <div className="error-card">
        <div className="error-icon">⚠️</div>
        <h2>Something went wrong</h2>
        <p className="error-msg">{error}</p>
        <button className="error-btn" onClick={() => navigate('/')}>← Back to home</button>
      </div>
    </div>
  )

  // ── Sidebar content (shared between desktop + mobile) ─────────────────────
  const sidebarContent = (
    <>
      <div className="panel-header">
        <h1>Taiwan City, District and Township Challenge</h1>
        <p className="panel-subtitle">台灣鄉鎮市區挑戰</p>
        {storedName && <p className="panel-athlete">Showing data for {storedName}</p>}
      </div>

      <div className="stats-grid">
        <div className="stat">
          <div className="stat-val">{activities.length}</div>
          <div className="stat-lbl">rides</div>
        </div>
        <div className="stat">
          <div className="stat-val">{totalKm}</div>
          <div className="stat-lbl">km total</div>
        </div>
        <div className="stat">
          <div className="stat-val">{totalElevation}</div>
          <div className="stat-lbl">elevation (m)</div>
        </div>
        <div className="stat stat-wide">
          <div className="stat-val">{longestRideKm} km</div>
          <div className="stat-lbl">longest ride in Taiwan</div>
        </div>
      </div>

      <div className="counter-card">
        <div className="counter-label-top">縣市 Counties &amp; Cities</div>
        <div className="counter-row">
          <span className="counter-num">{visitedCountyIds.size}</span>
          <span className="counter-denom">/ {TOTAL_COUNTIES}</span>
        </div>
        <div className="counter-bar-wrap">
          <div className="counter-bar county" style={{ width: `${(visitedCountyIds.size / TOTAL_COUNTIES) * 100}%` }} />
        </div>
      </div>

      <div className="counter-card">
        <div className="counter-label-top">鄉鎮市區 Townships</div>
        <div className="counter-row">
          <span className="counter-num">{visitedTownIds.size}</span>
          <span className="counter-denom">/ {TOTAL_TOWNS}</span>
        </div>
        <div className="counter-bar-wrap">
          <div className="counter-bar town" style={{ width: `${(visitedTownIds.size / TOTAL_TOWNS) * 100}%` }} />
        </div>
        <div className="counter-pct">{((visitedTownIds.size / TOTAL_TOWNS) * 100).toFixed(1)}% of Taiwan</div>
      </div>

      <label className="toggle">
        <input type="checkbox" checked={showRides} onChange={() => setShowRides(!showRides)} />
        Show ride routes
      </label>

      <div className="legend">
        <div className="legend-row"><span className="swatch town-visited" /> Visited township</div>
        <div className="legend-row"><span className="swatch town-unvisited" /> Unvisited township</div>
        <div className="legend-row"><span className="swatch county-border" /> County border</div>
        {showRides && <div className="legend-row"><span className="swatch route" /> Ride route</div>}
      </div>

      <button className="back-btn" onClick={disconnect}>← Disconnect</button>
    </>
  )

  return (
    <div className="map-layout">
      {/* Mobile hamburger */}
      <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar — desktop always visible, mobile toggled */}
      <aside className={`map-panel ${sidebarOpen ? 'open' : ''}`}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="map-main">
        <MapContainer center={[23.6, 121.0]} zoom={7} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">Carto</a>'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />
          {townFeatures.length > 0 && (
            <GeoJSON
              key={`towns-${visitedTownIds.size}`}
              data={{ type: 'FeatureCollection', features: townFeatures }}
              style={townStyle}
              onEachFeature={onEachTown}
            />
          )}
          {countyGeo && (
            <GeoJSON
              key={`counties-${visitedCountyIds.size}`}
              data={countyGeo}
              style={countyStyle}
              interactive={false}
            />
          )}
          {showRides && rideLines.map((pts, i) => (
            <Polyline key={i} positions={pts} pathOptions={{ color: '#16a34a', weight: 2, opacity: 0.7 }} />
          ))}
        </MapContainer>

        {/* Empty state overlay */}
        {isEmpty && (
          <div className="empty-overlay">
            <div className="empty-card">
              <div className="empty-icon">✈️</div>
              <h2>No Taiwan rides found</h2>
              <p>Time to book a flight to Taiwan and discover all those amazing mountain roads!</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
