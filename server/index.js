require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const axios    = require("axios");
const session  = require("express-session");
const { v4: uuidv4 } = require("uuid");

const app         = express();
const PORT        = process.env.PORT || 3001;
const CLIENT_URL  = process.env.CLIENT_URL  || "http://localhost:5173";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || CLIENT_URL;
const IS_PROD     = process.env.NODE_ENV === "production";

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

// ── Session ───────────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret-change-in-prod",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
    maxAge:   7 * 24 * 60 * 60 * 1000,
  },
}));

// ── Short-lived exchange token store (in-memory, expires in 2 minutes) ───────
const pendingExchanges = new Map();
function createExchangeToken(payload) {
  const token = uuidv4();
  pendingExchanges.set(token, { ...payload, createdAt: Date.now() });
  setTimeout(() => pendingExchanges.delete(token), 2 * 60 * 1000);
  return token;
}

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

// ── Refresh Strava token if expired ──────────────────────────────────────────
async function getValidToken(req) {
  const { access_token, refresh_token, token_expires_at } = req.session;
  if (!access_token) throw new Error("Not authenticated");
  if (Date.now() / 1000 > token_expires_at - 300) {
    console.log("Token expired — refreshing…");
    const { data } = await axios.post("https://www.strava.com/oauth/token", {
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type:    "refresh_token",
      refresh_token,
    });
    req.session.access_token     = data.access_token;
    req.session.refresh_token    = data.refresh_token;
    req.session.token_expires_at = data.expires_at;
  }
  return req.session.access_token;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Step 1: redirect to Strava
app.get("/auth/strava", (req, res) => {
  const params = new URLSearchParams({
    client_id:       process.env.STRAVA_CLIENT_ID,
    redirect_uri:    process.env.REDIRECT_URI,
    response_type:   "code",
    approval_prompt: "auto",
    scope:           "activity:read_all",
  });
  res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
});

// Step 2: Strava callback — exchange code for tokens, create exchange token,
//         redirect to client with a short-lived one-time code (not the real token)
app.get("/auth/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${CLIENT_URL}/#/?error=access_denied`);
  try {
    const { data } = await axios.post("https://www.strava.com/oauth/token", {
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    });
    const athleteName = [data.athlete.firstname, data.athlete.lastname]
      .filter(Boolean).join(" ");
    const exchangeToken = createExchangeToken({
      access_token:     data.access_token,
      refresh_token:    data.refresh_token,
      token_expires_at: data.expires_at,
    });
    const params = new URLSearchParams({ name: athleteName, exchange: exchangeToken });
    res.redirect(`${CLIENT_URL}/#/map?${params}`);
  } catch (err) {
    console.error("Token exchange failed:", err.response?.data || err.message);
    res.redirect(`${CLIENT_URL}/#/?error=token_exchange`);
  }
});

// Step 3: client calls this with the one-time exchange token to get a session cookie
app.post("/auth/exchange", (req, res) => {
  const { token } = req.body;
  const payload = pendingExchanges.get(token);
  if (!payload) return res.status(400).json({ error: "Invalid or expired exchange token" });
  pendingExchanges.delete(token);
  req.session.access_token     = payload.access_token;
  req.session.refresh_token    = payload.refresh_token;
  req.session.token_expires_at = payload.token_expires_at;
  req.session.save((err) => {
    if (err) return res.status(500).json({ error: "Session save failed" });
    res.json({ ok: true });
  });
});

// Step 4: logout
app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Step 5: fetch Taiwan cycling activities
app.get("/activities", async (req, res) => {
  try {
    const access_token = await getValidToken(req);
    const activities = [];
    let page = 1;
    while (true) {
      const { data } = await axios.get("https://www.strava.com/api/v3/athlete/activities", {
        headers: { Authorization: `Bearer ${access_token}` },
        params:  { per_page: 100, page },
      });
      if (!data.length) break;
      activities.push(...data);
      if (data.length < 100) break;
      page++;
    }
    const cyclingTypes = ["Ride", "VirtualRide", "EBikeRide", "MountainBikeRide", "GravelRide"];
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
      }));
    res.json({ count: taiwanRides.length, activities: taiwanRides });
  } catch (err) {
    const status = err.message === "Not authenticated" ? 401 : 500;
    console.error("Activities fetch failed:", err.response?.data || err.message);
    res.status(status).json({ error: err.message || "Failed to fetch activities" });
  }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
