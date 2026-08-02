/* =====================================================================
   ALERT.JS — Full-screen "Collect the Trash" overlay
   Pops up inside the dashboard page when the bin becomes critical/full.
   This is the IN-PAGE alert only — see notif.js for OS-level notifications.
   ===================================================================== */

// ======================= LABEL: already filled in =======================
// (Using the same project values you gave me earlier. If you ever rotate
// your Supabase keys, update these three lines.)
const ALERT_SUPABASE_URL      = "https://bxeaxpbmjgvqcrbqzjql.supabase.co";
const ALERT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZWF4cGJtamd2cWNyYnF6anFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTc0MzAsImV4cCI6MjEwMTA3MzQzMH0.qsEMpWHucU1obIZPqi_LtIthS26uoe2GPMVSQkvWyN8";
const ALERT_TABLE_NAME         = "bin_data";
// ==========================================================================

// Which statuses trigger the overlay. You asked for "critical" — I also
// included "full" since that's even more urgent. Remove it below if you
// only want the alert at critical, not full.
const ALERT_TRIGGER_STATUSES = ["critical", "full"];

// Optional: point this at your own sound file (e.g. "alert.mp3") if you'd
// rather not use the generated beep. Leave as null to use the beep.
const ALERT_SOUND_URL = null;

const alertSupabase = supabase.createClient(ALERT_SUPABASE_URL, ALERT_SUPABASE_ANON_KEY);

let lastAlertedRowId = localStorage.getItem("binAlert:lastRowId") || null;

// ---------------------------------------------------------------------
// Styles + overlay markup, built entirely from JS so this file can be
// dropped into any page with just a <script> tag.
// ---------------------------------------------------------------------
function injectAlertStyles() {
  const style = document.createElement("style");
  style.textContent = `
    #binAlertOverlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(10, 11, 12, 0.82);
      display: none; align-items: center; justify-content: center;
      padding: 1rem; font-family: 'IBM Plex Sans', sans-serif;
      backdrop-filter: blur(3px);
    }
    #binAlertOverlay.show { display: flex; }
    .bin-alert-card {
      background: #24272A; border: 1px solid #E23D3D;
      border-radius: 16px; padding: 1.75rem; max-width: 380px; width: 100%;
      color: #ECEEF0; position: relative;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      animation: binAlertPop 0.25s ease;
    }
    @keyframes binAlertPop {
      from { transform: scale(0.92); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }
    .bin-alert-close {
      position: absolute; top: 0.75rem; right: 0.75rem;
      background: none; border: none; color: #B7BDC6;
      font-size: 1.3rem; line-height: 1; cursor: pointer;
      width: 32px; height: 32px; border-radius: 50%;
    }
    .bin-alert-close:hover { background: #3A3F44; color: #ECEEF0; }
    .bin-alert-icon { font-size: 2.2rem; margin-bottom: 0.5rem; }
    .bin-alert-title {
      font-family: 'IBM Plex Mono', monospace; font-weight: 700;
      font-size: 1.15rem; text-transform: uppercase; letter-spacing: 0.03em;
      color: #E23D3D; margin: 0 0 0.5rem;
    }
    .bin-alert-body { font-size: 0.92rem; color: #B7BDC6; margin: 0 0 1rem; line-height: 1.5; }
    .bin-alert-time {
      font-family: 'IBM Plex Mono', monospace; font-size: 0.78rem;
      color: #F2B705; border-top: 1px dashed #3A3F44; padding-top: 0.75rem;
    }
  `;
  document.head.appendChild(style);
}

function buildAlertOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "binAlertOverlay";
  overlay.innerHTML = `
    <div class="bin-alert-card" role="alertdialog" aria-labelledby="binAlertTitle">
      <button class="bin-alert-close" id="binAlertClose" aria-label="Dismiss alert">✕</button>
      <div class="bin-alert-icon">🗑️</div>
      <h2 class="bin-alert-title" id="binAlertTitle">Collect the Trash</h2>
      <p class="bin-alert-body" id="binAlertBody">The bin has reached a level that needs emptying.</p>
      <p class="bin-alert-time" id="binAlertTime">—</p>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("binAlertClose").addEventListener("click", hideAlert);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideAlert(); // clicking the backdrop also dismisses
  });
}

function showAlert(row) {
  const overlay = document.getElementById("binAlertOverlay");
  const body = document.getElementById("binAlertBody");
  const timeLine = document.getElementById("binAlertTime");

  const now = new Date();
  localStorage.setItem("binAlert:lastAlertedAt", now.toISOString());
  localStorage.setItem("binAlert:lastRowId", String(row.id));
  lastAlertedRowId = row.id;

  body.textContent = `Bin is at ${row.percentage}% (${row.status.toUpperCase()}). Please empty it soon.`;
  timeLine.textContent = `Last alerted: ${now.toLocaleTimeString()} · ${now.toLocaleDateString()}`;

  overlay.classList.add("show");
  playAlertSound();
}

function hideAlert() {
  document.getElementById("binAlertOverlay").classList.remove("show");
}

// ---------------------------------------------------------------------
// Sound — generated with the Web Audio API, so no external audio file
// is required. Set ALERT_SOUND_URL above to use your own sound instead.
// ---------------------------------------------------------------------
function playAlertSound() {
  if (ALERT_SOUND_URL) {
    new Audio(ALERT_SOUND_URL).play().catch(() => {});
    return;
  }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.2);
    });
  } catch (e) {
    console.warn("Could not play alert sound:", e);
  }
}

// ---------------------------------------------------------------------
// Watch for critical/full readings
// ---------------------------------------------------------------------
function maybeAlert(row) {
  if (!row || !ALERT_TRIGGER_STATUSES.includes(row.status)) return;
  if (row.id === lastAlertedRowId) return; // already alerted for this exact reading
  showAlert(row);
}

async function checkLatestForAlert() {
  const { data, error } = await alertSupabase
    .from(ALERT_TABLE_NAME)
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Alert fetch error:", error.message);
    return;
  }
  if (data && data.length > 0) maybeAlert(data[0]);
}

function subscribeAlertRealtime() {
  alertSupabase
    .channel("bin_data_alert_channel")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: ALERT_TABLE_NAME },
      (payload) => maybeAlert(payload.new)
    )
    .subscribe();
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
injectAlertStyles();
buildAlertOverlay();
checkLatestForAlert();
subscribeAlertRealtime();
setInterval(checkLatestForAlert, 15000); // fallback poll in case realtime drops
