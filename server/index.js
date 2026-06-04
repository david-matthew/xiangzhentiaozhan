require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// ── Taiwan bounding box ───────────────────────────────────────────────────────
const TW = { latMin: 21.5, latMax: 25.6, lonMin: 119.0, lonMax: 122.5 };

function inTaiwan(lat, lon) {
  return lat >= TW.latMin && lat <= TW.latMax && lon >= TW.lonMin && lon <= TW.lonMax;
}

// ── Decode Google encoded polyline ───────────────────────────────────────────
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Step 1: redirect user to Strava
app.get("/auth/strava", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
  });
  res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
});

// Step 2: Strava redirects back here with ?code=...
app.get("/auth/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`${CLIENT_URL}/?error=access_denied`);
  }
  try {
    const { data } = await axios.post("https://www.strava.com/oauth/token", {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    });
    // Pass tokens to client via query params (fine for local use)
    const params = new URLSearchParams({
      access_token: data.access_token,
      athlete_name: data.athlete.firstname,
      athlete_id: data.athlete.id,
    });
    res.redirect(`${CLIENT_URL}/map?${params}`);
  } catch (err) {
    console.error("Token exchange failed:", err.response?.data || err.message);
    res.redirect(`${CLIENT_URL}/?error=token_exchange`);
  }
});

// Step 3: fetch and filter cycling activities in Taiwan
app.get("/activities", async (req, res) => {
  const { access_token } = req.query;
  if (!access_token) return res.status(400).json({ error: "Missing access_token" });

  try {
    const activities = [];
    let page = 1;

    // Fetch all activities (paginate)
    while (true) {
      const { data } = await axios.get("https://www.strava.com/api/v3/athlete/activities", {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { per_page: 100, page },
      });
      if (!data.length) break;
      activities.push(...data);
      if (data.length < 100) break;
      page++;
    }

    // Filter: cycling types only
    const cyclingTypes = ["Ride", "VirtualRide", "EBikeRide", "MountainBikeRide", "GravelRide"];
    const rides = activities.filter((a) => cyclingTypes.includes(a.type) || cyclingTypes.includes(a.sport_type));

    // Filter: must have a polyline with points in Taiwan
    const taiwanRides = rides
      .filter((a) => a.map?.summary_polyline)
      .filter((a) => {
        const pts = decodePolyline(a.map.summary_polyline);
        return pts.some(([lat, lon]) => inTaiwan(lat, lon));
      })
      .map((a) => ({
        id: a.id,
        name: a.name,
        date: a.start_date_local,
        distance: a.distance,
        elevation: a.total_elevation_gain,
        polyline: a.map.summary_polyline,
        points: decodePolyline(a.map.summary_polyline).filter(([lat, lon]) => inTaiwan(lat, lon)),
      }));

    res.json({ count: taiwanRides.length, activities: taiwanRides });
  } catch (err) {
    console.error("Activities fetch failed:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
