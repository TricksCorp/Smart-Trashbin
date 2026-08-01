/* =====================================================================
   SMART BIN MONITOR — front-end logic
   ===================================================================== */

// ======================= LABEL: FILL THESE IN =======================
const SUPABASE_URL      = "https://bxeaxpbmjgvqcrbqzjql.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZWF4cGJtamd2cWNyYnF6anFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTc0MzAsImV4cCI6MjEwMTA3MzQzMH0.qsEMpWHucU1obIZPqi_LtIthS26uoe2GPMVSQkvWyN8";
const TABLE_NAME         = "bin_data";
// ======================================================================

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Bin SVG geometry (must match the circle in index.html)
const BIN_TOP_Y = 12;
const BIN_BOTTOM_Y = 188;
const BIN_MAX_HEIGHT = BIN_BOTTOM_Y - BIN_TOP_Y;

const STATUS_META = {
  empty:      { label: "Empty",            color: "#4FB477", colorB: "#7FD3A5" },
  filled:     { label: "Filling up",       color: "#F2B705", colorB: "#F7CE52" },
  critical:   { label: "Critical — nearly full", color: "#E8862B", colorB: "#F0A85D" },
  full:       { label: "Full",             color: "#E23D3D", colorB: "#F16B6B" },
  processing: { label: "Checking sensor…", color: "#6B8CD9", colorB: "#96B0E6" },
};

const el = {
  percentageNum: document.getElementById("percentageNum"),
  fillRect: document.getElementById("fillRect"),
  statusBadge: document.getElementById("statusBadge"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  warningLine: document.getElementById("warningLine"),
  lidStatus: document.getElementById("lidStatus"),
  distanceStat: document.getElementById("distanceStat"),
  lastUpdated: document.getElementById("lastUpdated"),
  connDot: document.getElementById("connDot"),
  connLabel: document.getElementById("connLabel"),
  clockTime: document.getElementById("clockTime"),
  clockDate: document.getElementById("clockDate"),
};

let lastRecordedAt = null;

// ---------------------------------------------------------------------
// Render a reading onto the dashboard
// ---------------------------------------------------------------------
function renderReading(row) {
  if (!row) return;

  const pct = clamp(Number(row.percentage) || 0, 0, 100);
  const status = STATUS_META[row.status] ? row.status : "processing";
  const meta = STATUS_META[status];

  // Percentage number
  el.percentageNum.textContent = pct;

  // Bin fill
  const fillHeight = (pct / 100) * BIN_MAX_HEIGHT;
  el.fillRect.setAttribute("y", BIN_BOTTOM_Y - fillHeight);
  el.fillRect.setAttribute("height", fillHeight);
  document.documentElement.style.setProperty("--fill-color-a", meta.color);
  document.documentElement.style.setProperty("--fill-color-b", meta.colorB);

  // Status badge
  el.statusText.textContent = meta.label;
  el.statusDot.style.background = meta.color;

  // Full warning (all caps, per spec)
  el.warningLine.hidden = status !== "full";

  // Lid status (optional field)
  el.lidStatus.textContent = row.bin_status
    ? row.bin_status.charAt(0).toUpperCase() + row.bin_status.slice(1)
    : "—";

  // Raw distance
  el.distanceStat.textContent = row.distance_cm != null
    ? `${Number(row.distance_cm).toFixed(1)} cm`
    : "—";

  // Last reading timestamp
  if (row.recorded_at) {
    lastRecordedAt = new Date(row.recorded_at);
    el.lastUpdated.textContent = formatRelative(lastRecordedAt);
  }

  setConnection("live");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatRelative(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function setConnection(state) {
  el.connDot.classList.remove("live", "error");
  if (state === "live") {
    el.connDot.classList.add("live");
    el.connLabel.textContent = "Live";
  } else if (state === "error") {
    el.connDot.classList.add("error");
    el.connLabel.textContent = "Connection issue";
  } else {
    el.connLabel.textContent = "Connecting…";
  }
}

// ---------------------------------------------------------------------
// Fetch the most recent reading
// ---------------------------------------------------------------------
async function fetchLatest() {
  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Supabase fetch error:", error.message);
    setConnection("error");
    return;
  }

  if (data && data.length > 0) {
    renderReading(data[0]);
  }
}

// ---------------------------------------------------------------------
// Subscribe to realtime inserts so the dashboard updates instantly
// ---------------------------------------------------------------------
function subscribeRealtime() {
  supabaseClient
    .channel("bin_data_changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: TABLE_NAME },
      (payload) => renderReading(payload.new)
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnection("error");
      }
    });
}

// Fallback polling in case realtime is unavailable
setInterval(fetchLatest, 15000);

// Keep the "X ago" label ticking without needing new data
setInterval(() => {
  if (lastRecordedAt) el.lastUpdated.textContent = formatRelative(lastRecordedAt);
}, 1000);

// ---------------------------------------------------------------------
// Live browser clock (independent of sensor data)
// ---------------------------------------------------------------------
function tickClock() {
  const now = new Date();
  el.clockTime.textContent = now.toLocaleTimeString([], { hour12: false });
  el.clockDate.textContent = now.toLocaleDateString([], {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}
tickClock();
setInterval(tickClock, 1000);

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
fetchLatest();
subscribeRealtime();
