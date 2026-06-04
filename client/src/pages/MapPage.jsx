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

const TOTAL_TOWNS   = 368
const TOTAL_COUNTIES = 22

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
        const features = topoFiles.flatMap((topo) =>
          topojson.feature(topo, topo.objects.map).features
        )
        setTownFeatures(features)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [accessToken])

  const allPoints = useMemo(
    () => activities.flatMap((a) => a.points),
    [activities]
  )

  const visitedTownIds = useMemo(() => {
    if (!allPoints.length || !townFeatures.length) return new Set()
    const visited = new Set()
    townFeatures.forEach((feature) => {
      const hit = allPoints.some((pt, i) => {
        if (i % 5 !== 0) return false
        try { return turf.booleanPointInPolygon(turf.point([pt[1], pt[0]]), feature) }
        catch { return false }
      })
      if (hit) visited.add(feature.properties.id)
    })
    return visited
  }, [allPoints, townFeatures])

  const visitedCountyIds = useMemo(() => {
    if (!allPoints.length || !countyGeo) return new Set()
    const visited = new Set()
    countyGeo.features.forEach((feature) => {
      const id = feature.properties.COUNTYSN || feature.properties.COUNTYNAME
      const hit = allPoints.some((pt, i) => {
        if (i % 5 !== 0) return false
        try { return turf.booleanPointInPolygon(turf.point([pt[1], pt[0]]), feature) }
        catch { return false }
      })
      if (hit) visited.add(id)
    })
    return visited
  }, [allPoints, countyGeo])

  const countyStyle = useMemo(() => (feature) => {
    const id = feature.properties.COUNTYSN || feature.properties.COUNTYNAME
    const visited = visitedCountyIds.has(id)
    return {
      fillColor:   'transparent',
      fillOpacity: 0,
      color:       visited ? '#16a34a' : '#9ca3af',
      weight:      visited ? 2.5 : 1.5,
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

  function onEachTown(feature, layer) {
    const name = feature.properties.name || ''
    if (name) layer.bindTooltip(name, { sticky: true, className: 'town-tooltip' })
  }

  const rideLines = useMemo(
    () => activities.map((a) => a.points.map(([lat, lon]) => [lat, lon])),
    [activities]
  )

  const totalKm       = (activities.reduce((s, a) => s + a.distance,  0) / 1000).toFixed(0)
  const totalElevation = activities.reduce((s, a) => s + a.elevation, 0).toFixed(0)

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
      <aside className="map-panel">
        {/* Title */}
        <div className="panel-header">
          <h1>Taiwan Township Challenge</h1>
          <p className="panel-subtitle">台灣鄉鎮挑戰</p>
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
            <div className="stat-lbl">elevation</div>
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

        {/* Controls */}
        <label className="toggle">
          <input type="checkbox" checked={showRides} onChange={() => setShowRides(!showRides)} />
          Show ride routes
        </label>

        {/* Legend */}
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

          {/* Towns — interactive for tooltips */}
          {townFeatures.length > 0 && (
            <GeoJSON
              key={`towns-${visitedTownIds.size}`}
              data={{ type: 'FeatureCollection', features: townFeatures }}
              style={townStyle}
              onEachFeature={onEachTown}
            />
          )}

          {/* Counties — non-interactive so town tooltips work */}
          {countyGeo && (
            <GeoJSON
              key={`counties-${visitedCountyIds.size}`}
              data={countyGeo}
              style={countyStyle}
              interactive={false}
            />
          )}

          {showRides && rideLines.map((pts, i) => (
            <Polyline
              key={i}
              positions={pts}
              pathOptions={{ color: '#16a34a', weight: 2, opacity: 0.7 }}
            />
          ))}
        </MapContainer>
      </main>
    </div>
  )
}
