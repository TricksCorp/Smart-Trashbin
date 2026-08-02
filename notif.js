/* =====================================================================
   NOTIF.JS — OS/system-level notifications (the ones that show up in
   your phone's or computer's notification tray), separate from the
   in-page overlay in alert.js.

   IMPORTANT LIMITATION: this fires while the browser is running, even
   if the dashboard tab isn't focused (or is in another tab). It does
   NOT work if the browser itself is fully closed — true "push while
   browser is closed" requires a backend server + VAPID keys, which is
   beyond a front-end-only setup. This covers the common case of
   "browser open, tab in the background."
   ===================================================================== */

// ======================= LABEL: already filled in =======================
const NOTIF_SUPABASE_URL      = "https://bxeaxpbmjgvqcrbqzjql.supabase.co";
const NOTIF_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZWF4cGJtamd2cWNyYnF6anFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTc0MzAsImV4cCI6MjEwMTA3MzQzMH0.qsEMpWHucU1obIZPqi_LtIthS26uoe2GPMVSQkvWyN8";
const NOTIF_TABLE_NAME         = "bin_data";
// ==========================================================================

const NOTIF_TRIGGER_STATUSES = ["critical", "full"];

const notifSupabase = supabase.createClient(NOTIF_SUPABASE_URL, NOTIF_SUPABASE_ANON_KEY);

let lastNotifiedRowId = localStorage.getItem("binNotif:lastRowId") || null;

// ---------------------------------------------------------------------
// Ask for notification permission. Browsers generally allow this on
// page load, but Safari/iOS is stricter and may need it tied to a
// button click instead — see the note at the bottom of this file.
// ---------------------------------------------------------------------
async function ensureNotifPermission() {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications.");
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

// ---------------------------------------------------------------------
// Fire the system notification via the service worker (keeps it
// actionable/clickable), falling back to a plain Notification if no
// service worker is registered yet.
// ---------------------------------------------------------------------
async function fireSystemNotification(row) {
  const title = "🗑️ Smart Bin Alert";
  const options = {
    body: `Bin is ${row.status.toUpperCase()} at ${row.percentage}%. Time to collect it.`,
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: "smart-bin-alert", // reuses the same notification instead of stacking duplicates
    timestamp: Date.now(),
  };

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    } catch (e) {
      console.warn("Falling back to plain Notification:", e);
    }
  }

  new Notification(title, options);
}

function maybeNotify(row) {
  if (!row || !NOTIF_TRIGGER_STATUSES.includes(row.status)) return;
  if (row.id === lastNotifiedRowId) return; // already notified for this exact reading

  lastNotifiedRowId = row.id;
  localStorage.setItem("binNotif:lastRowId", String(row.id));

  fireSystemNotification(row);
}

async function checkLatestForNotif() {
  const { data, error } = await notifSupabase
    .from(NOTIF_TABLE_NAME)
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Notif fetch error:", error.message);
    return;
  }
  if (data && data.length > 0) maybeNotify(data[0]);
}

function subscribeNotifRealtime() {
  notifSupabase
    .channel("bin_data_notif_channel")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: NOTIF_TABLE_NAME },
      (payload) => maybeNotify(payload.new)
    )
    .subscribe();
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
ensureNotifPermission().then((granted) => {
  if (!granted) {
    console.warn("Notification permission not granted — system alerts disabled.");
    return;
  }
  checkLatestForNotif();
  subscribeNotifRealtime();
  setInterval(checkLatestForNotif, 15000);
});
