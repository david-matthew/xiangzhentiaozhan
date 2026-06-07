require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const axios    = require("axios");
const session  = require("express-session");
const { v4: uuidv4 } = require("uuid");

const app       = express();
const PORT        = process.env.PORT || 3001;
const CLIENT_URL  = process.env.CLIENT_URL  || "http://localhost:5173";  // full app URL for redirects
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || CLIENT_URL;           // origin only for CORS
const IS_PROD     = process.env.NODE_ENV === "production";

// ── CORS — allow credentials so session cookie works cross-origin ────────────
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
}));
app.use(express.json());

// ── Session — stores Strava tokens server-side ───────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret-change-in-prod",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: IS_PROD,      // HTTPS only in production
    sameSite: IS_PROD ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

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

  // Refresh if token expires within 5 minutes
  if (Date.now() / 1000 > token_expires_at - 300) {
    console.log("Token expired — refreshing…");
    const { data } = await axios.post("https://www.strava.com/oauth/token", {
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type:    "refresh_token",
      refresh_token,
    });
    req.session.access_token    = data.access_token;
    req.session.refresh_token   = data.refresh_token;
    req.session.token_expires_at = data.expires_at;
    return data.access_token;
  }
  return access_token;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Step 1: redirect user to Strava
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

// Step 2: Strava redirects back with ?code= — exchange for tokens, store in session
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

    // Store tokens in server-side session — never sent to the browser
    req.session.access_token     = data.access_token;
    req.session.refresh_token    = data.refresh_token;
    req.session.token_expires_at  = data.expires_at;

    // Only send safe, non-secret info to the client
    const athleteName = [data.athlete.firstname, data.athlete.lastname]
      .filter(Boolean).join(" ");
    const params = new URLSearchParams({ name: athleteName });
    res.redirect(`${CLIENT_URL}/#/map?${params}`);
  } catch (err) {
    console.error("Token exchange failed:", err.response?.data || err.message);
    res.redirect(`${CLIENT_URL}/#/?error=token_exchange`);
  }
});

// Step 3: Check auth status (client calls this on load to verify session is alive)
app.get("/auth/me", (req, res) => {
  if (!req.session.access_token) return res.status(401).json({ error: "Not authenticated" });
  res.json({ ok: true });
});

// Step 4: Log out — destroy session
app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Step 5: Fetch Taiwan cycling activities
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
