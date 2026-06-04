import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, GeoJSON, Polyline, Tooltip } from 'react-leaflet'
import * as turf from '@turf/turf'
import 'leaflet/dist/leaflet.css'
import './MapPage.css'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export default function MapPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const accessToken  = searchParams.get('access_token')
  const athleteName  = searchParams.get('athlete_name')

  const [activities, setActivities] = useState([])
  const [geojson, setGeojson]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [showRides, setShowRides]   = useState(true)

  // Redirect to landing if no token
  useEffect(() => {
    if (!accessToken) navigate('/')
  }, [accessToken, navigate])

  // Fetch GeoJSON and activities in parallel
  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    Promise.all([
      fetch('/twCounty2010.geojson').then((r) => r.json()),
      fetch(`${SERVER}/activities?access_token=${accessToken}`).then((r) => r.json()),
    ])
      .then(([geo, data]) => {
        if (data.error) throw new Error(data.error)
        setGeojson(geo)
        setActivities(data.activities)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [accessToken])

  const TOTAL_TOWNSHIPS = geojson ? geojson.features.length : 368

  // Compute visited township IDs using turf point-in-polygon
  const visitedIds = useMemo(() => {
    if (!activities.length || !geojson) return new Set()
    const visited = new Set()

    // Collect all GPS points across all rides
    const allPoints = activities.flatMap((a) => a.points)

    geojson.features.forEach((feature) => {
      // Sample every 5th point for performance
      const hit = allPoints.some((_, i) => {
        if (i % 5 !== 0) return false
        const [lat, lon] = allPoints[i]
        const pt = turf.point([lon, lat])
        try {
          return turf.booleanPointInPolygon(pt, feature)
        } catch {
          return false
        }
      })
      if (hit) visited.add(feature.properties.TOWNID || feature.properties.T_Id || feature.id)
    })

    return visited
  }, [activities, geojson])

  // GeoJSON style per feature
  function townStyle(feature) {
    const id = feature.properties.TOWNID || feature.properties.T_Id || feature.id
    const visited = visitedIds.has(id)
    return {
      fillColor:   visited ? '#f97316' : '#1e293b',
      fillOpacity: visited ? 0.65 : 0.4,
      color:       visited ? '#fb923c' : '#334155',
      weight:      visited ? 1.5 : 0.5,
    }
  }

  function onEachTown(feature, layer) {
    const name = feature.properties.TOWNNAME || feature.properties.T_Name || ''
    const county = feature.properties.COUNTYNAME || feature.properties.C_Name || ''
    if (name) {
      layer.bindTooltip(`${county} · ${name}`, {
        sticky: true,
        className: 'town-tooltip',
      })
    }
  }

  const rideLines = useMemo(() =>
    activities.map((a) => a.points.map(([lat, lon]) => [lat, lon])),
    [activities]
  )

  if (loading) return (
    <div className="map-loading">
      <div className="spinner" />
      <p>Loading your Strava rides…</p>
      <p className="loading-sub">This may take a moment if you have many activities.</p>
    </div>
  )

  if (error) return (
    <div className="map-loading">
      <p style={{ color: '#ef4444' }}>❌ {error}</p>
      <button onClick={() => navigate('/')}>← Back</button>
    </div>
  )

  return (
    <div className="map-layout">
      {/* ── Panel ── */}
      <aside className="map-panel">
        <div className="panel-header">
          <span className="panel-icon">🚴</span>
          <div>
            <h1>Taiwan Ride Explorer</h1>
            {athleteName && <p className="panel-athlete">Hi, {athleteName}!</p>}
          </div>
        </div>

        {/* Counter */}
        <div className="counter-card">
          <div className="counter-main">
            <span className="counter-num">{visitedIds.size}</span>
            <span className="counter-denom"> / {TOTAL_TOWNSHIPS}</span>
          </div>
          <div className="counter-label">townships explored</div>
          <div className="counter-bar-wrap">
            <div
              className="counter-bar"
              style={{ width: `${(visitedIds.size / TOTAL_TOWNSHIPS) * 100}%` }}
            />
          </div>
          <div className="counter-pct">
            {((visitedIds.size / TOTAL_TOWNSHIPS) * 100).toFixed(1)}% of Taiwan
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat">
            <div className="stat-val">{activities.length}</div>
            <div className="stat-lbl">rides in Taiwan</div>
          </div>
          <div className="stat">
            <div className="stat-val">
              {(activities.reduce((s, a) => s + a.distance, 0) / 1000).toFixed(0)}
            </div>
            <div className="stat-lbl">km total</div>
          </div>
          <div className="stat">
            <div className="stat-val">
              {activities.reduce((s, a) => s + a.elevation, 0).toFixed(0)}
            </div>
            <div className="stat-lbl">m elevation</div>
          </div>
        </div>

        {/* Controls */}
        <label className="toggle">
          <input
            type="checkbox"
            checked={showRides}
            onChange={() => setShowRides(!showRides)}
          />
          Show ride routes
        </label>

        {/* Legend */}
        <div className="legend">
          <div className="legend-row">
            <span className="swatch visited" /> Visited township
          </div>
          <div className="legend-row">
            <span className="swatch unvisited" /> Unvisited township
          </div>
          {showRides && (
            <div className="legend-row">
              <span className="swatch route" /> Ride route
            </div>
          )}
        </div>

        <button className="back-btn" onClick={() => navigate('/')}>← Disconnect</button>
      </aside>

      {/* ── Map ── */}
      <main className="map-main">
        <MapContainer
          center={[23.6, 121.0]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">Carto</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {geojson && <GeoJSON
            key={visitedIds.size}
            data={geojson}
            style={townStyle}
            onEachFeature={onEachTown}
          />}
          {showRides && rideLines.map((pts, i) => (
            <Polyline
              key={i}
              positions={pts}
              pathOptions={{ color: '#f97316', weight: 2, opacity: 0.7 }}
            />
          ))}
        </MapContainer>
      </main>
    </div>
  )
}
