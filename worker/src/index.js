const TW = { latMin: 21.5, latMax: 25.6, lonMin: 119.0, lonMax: 122.5 }

function inTaiwan(lat, lon) {
  return lat >= TW.latMin && lat <= TW.latMax && lon >= TW.lonMin && lon <= TW.lonMax
}

function decodePolyline(encoded) {
  const points = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url

    const CLIENT_URL    = env.CLIENT_URL    || 'http://localhost:5173'
    const CLIENT_ORIGIN = env.CLIENT_ORIGIN || CLIENT_URL

    const corsHeaders = {
      'Access-Control-Allow-Origin':  CLIENT_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const redirect = (location) =>
      new Response(null, { status: 302, headers: { Location: location } })

    // ── GET /auth/strava ───────────────────────────────────────────────────────
    if (pathname === '/auth/strava' && request.method === 'GET') {
      const params = new URLSearchParams({
        client_id:       env.STRAVA_CLIENT_ID,
        redirect_uri:    env.REDIRECT_URI,
        response_type:   'code',
        approval_prompt: 'auto',
        scope:           'activity:read_all',
      })
      return redirect(`https://www.strava.com/oauth/authorize?${params}`)
    }

    // ── GET /auth/callback ─────────────────────────────────────────────────────
    if (pathname === '/auth/callback' && request.method === 'GET') {
      const code  = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      if (error || !code) return redirect(`${CLIENT_URL}/#/challenge?error=access_denied`)

      try {
        const r = await fetch('https://www.strava.com/oauth/token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            client_id:     env.STRAVA_CLIENT_ID,
            client_secret: env.STRAVA_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
          }),
        })
        const data = await r.json()
        if (!data.access_token) return redirect(`${CLIENT_URL}/#/challenge?error=token_exchange`)

        const athleteName = [data.athlete?.firstname, data.athlete?.lastname]
          .filter(Boolean).join(' ')
        const fragment = new URLSearchParams({
          name:          athleteName,
          access_token:  data.access_token,
          refresh_token: data.refresh_token,
          expires_at:    data.expires_at,
        })
        return redirect(`${CLIENT_URL}/#/map?${fragment}`)
      } catch {
        return redirect(`${CLIENT_URL}/#/challenge?error=token_exchange`)
      }
    }

    // ── POST /auth/refresh ─────────────────────────────────────────────────────
    if (pathname === '/auth/refresh' && request.method === 'POST') {
      const { refresh_token } = await request.json()
      if (!refresh_token) return json({ error: 'Missing refresh_token' }, 400)

      try {
        const r = await fetch('https://www.strava.com/oauth/token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            client_id:     env.STRAVA_CLIENT_ID,
            client_secret: env.STRAVA_CLIENT_SECRET,
            grant_type:    'refresh_token',
            refresh_token,
          }),
        })
        const data = await r.json()
        return json({
          access_token:  data.access_token,
          refresh_token: data.refresh_token,
          expires_at:    data.expires_at,
        })
      } catch {
        return json({ error: 'Token refresh failed' }, 401)
      }
    }

    // ── GET /activities ────────────────────────────────────────────────────────
    if (pathname === '/activities' && request.method === 'GET') {
      const auth = request.headers.get('Authorization')
      if (!auth?.startsWith('Bearer ')) return json({ error: 'Missing token' }, 401)
      const access_token = auth.slice(7)

      try {
        const activities = []
        let page = 1
        while (true) {
          const r = await fetch(
            `https://www.strava.com/api/v3/athlete/activities?per_page=100&page=${page}`,
            { headers: { Authorization: `Bearer ${access_token}` } }
          )
          if (r.status === 401) return json({ error: 'Unauthorized' }, 401)
          const data = await r.json()
          if (!data.length) break
          activities.push(...data)
          if (data.length < 100) break
          page++
        }

        const cyclingTypes = ['Ride', 'VirtualRide', 'EBikeRide', 'MountainBikeRide', 'GravelRide']
        const taiwanRides = activities
          .filter((a) => cyclingTypes.includes(a.type) || cyclingTypes.includes(a.sport_type))
          .filter((a) => a.map?.summary_polyline)
          .filter((a) => decodePolyline(a.map.summary_polyline).some(([lat, lon]) => inTaiwan(lat, lon)))
          .map((a) => ({
            id:        a.id,
            name:      a.name,
            date:      a.start_date_local,
            distance:  a.distance,
            elevation: a.total_elevation_gain,
            points:    decodePolyline(a.map.summary_polyline).filter(([lat, lon]) => inTaiwan(lat, lon)),
          }))

        return json({ count: taiwanRides.length, activities: taiwanRides })
      } catch (err) {
        const status = err?.status === 401 ? 401 : 500
        return json({ error: 'Failed to fetch activities' }, status)
      }
    }

    return new Response('Not found', { status: 404 })
  },
}
