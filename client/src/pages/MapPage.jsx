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

// Build a turf LineString from activity points [[lat,lon],...]
// Splits into chunks of 500 to avoid turf coordinate limits
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

  const accessToken = searchParams.get('access_token')
  const athleteName = searchParams.get('athlete_name')

  const [activities,   setActivities]   = useState([])
  const [countyGeo,    setCountyGeo]    = useState(null)
  const [townFeatures, setTownFeatures] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [showRides,    setShowRides]    = useState(true)

  useEffect(() => {
    if (!accessToken) navigate('/')
  }, [accessToken, navigate])

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    const townFetches = TOWN_FILES.map((slug) =>
      fetch(`/towns-${slug}.json`).then((r) => r.json())
    )
    Promise.all([
      fetch('/twCounty2010.geojson').then((r) => r.json()),
      fetch(`${SERVER}/activities?access_token=${accessToken}`).then((r) => r.json()),
      ...townFetches,
    ])
      .then(([counties, actData, ...topoFiles]) => {
        if (actData.error) throw new Error(actData.error)
        setCountyGeo(counties)
        setActivities(actData.activities)
        setTownFeatures(
          topoFiles.flatMap((topo) => topojson.feature(topo, topo.objects.map).features)
        )
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [accessToken])

  // Pre-build turf lines per activity (used for intersection checks)
  const activityLineGroups = useMemo(
    () => activities.map((a) => ({ ...a, lines: activityLines(a.points) })),
    [activities]
  )

  // For each town, find which activities intersected it
  const townVisitData = useMemo(() => {
    if (!activityLineGroups.length || !townFeatures.length) return new Map()
    const data = new Map()
    townFeatures.forEach((feature) => {
      const id = feature.properties.id
      activityLineGroups.forEach((activity) => {
        if (!activity.lines.length) return
        const hit = activity.lines.some((line) => {
          try {
            // First cheap check: bounding box overlap
            const lineBbox   = turf.bbox(line)
            const featureBbox = turf.bbox(feature)
            if (
              lineBbox[2] < featureBbox[0] || lineBbox[0] > featureBbox[2] ||
              lineBbox[3] < featureBbox[1] || lineBbox[1] > featureBbox[3]
            ) return false
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

  // County visit detection — use line intersection too
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
      fillColor:   'transparent',
      fillOpacity: 0,
      color:       visitedCountyIds.has(id) ? '#16a34a' : '#9ca3af',
      weight:      visitedCountyIds.has(id) ? 2.5 : 1.5,
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

  if (loading) return (
    <div className="map-loading">
      <div className="spinner" />
      <p>Loading your Strava rides…</p>
      <p className="loading-sub">This may take a moment if you have many activities.</p>
    </div>
  )

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

  return (
    <div className="map-layout">
      <aside className="map-panel">
        <div className="panel-header">
          <h1>Taiwan City, District and Township Challenge</h1>
          <p className="panel-subtitle">台灣鄉鎮市區挑戰</p>
          {athleteName && <p className="panel-athlete">Showing data for {athleteName}</p>}
        </div>

        {/* Strava stats */}
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

        {/* Counties counter */}
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

        {/* Townships counter */}
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

        <button className="back-btn" onClick={() => navigate('/')}>← Disconnect</button>
      </aside>

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
      </main>
    </div>
  )
}
