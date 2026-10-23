/* Super 6 opt-in browser push notifications.
   Independent from predictions, payments, scoring and existing app navigation. */
(() => {
  "use strict";
  const cfg = window.SUPER6_CONFIG;
  if (!cfg || !document.getElementById("appScreen")) return;
  const api = cfg.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/super6-push";
  const authStorageKey = "sb-" + new URL(cfg.SUPABASE_URL).hostname.split(".")[0] + "-auth-token";
  const onIphone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const standalone = () => window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const kinds = [
    ["new_round", "New rounds"],
    ["deadline_24h", "24-hour reminders"],
    ["deadline_2h", "2-hour final warnings"],
    ["results", "Results & tables"],
    ["manual", "Admin reminders"]
  ];
  let busy = false;

  function token() {
    try {
      const session = JSON.parse(localStorage.getItem(authStorageKey) || "null");
      return session && typeof session.access_token === "string" ? session.access_token : null;
    } catch (_) { return null; }
  }
  async function call(action, extra = {}, authorized = true) {
    const jwt = token();
    if (authorized && !jwt) throw new Error("Please log in again to enable notifications.");
    const headers = { "Content-Type": "application/json", "apikey": cfg.SUPABASE_PUBLISHABLE_KEY };
    if (authorized) headers.Authorization = "Bearer " + jwt;
    const res = await fetch(api, {
      method: "POST", headers, body: JSON.stringify({ action, ...extra }), cache: "no-store"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "The notification service is unavailable.");
    return data;
  }
  function putStatus(el, message, isError = false) {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("s6-notify-error", !!isError);
  }
  function setBusy(working) {
    busy = working;
    document.querySelectorAll(".s6-notify-btn").forEach(b => b.disabled = working);
  }
  function prefsFromForm() {
    const prefs = {};
    document.querySelectorAll("#s6NotifyPrefs input[data-notify-pref]").forEach(input => {
      prefs[input.dataset.notifyPref] = input.checked;
    });
    return prefs;
  }
  function prefsHtml() {
    return kinds.map(([key, label]) =>
      '<label class="s6-notify-choice"><input type="checkbox" data-notify-pref="' +
      key + '" checked /><span>' + label + '</span></label>'
    ).join("");
  }
  function isLoggedIn() {
    return !document.getElementById("appScreen").classList.contains("hidden");
  }
  function ensureCards() {
    const playerHome = document.getElementById("playerHome");
    if (playerHome && !document.getElementById("s6NotifyCard")) {
      const card = document.createElement("section");
      card.id = "s6NotifyCard";
      card.className = "card s6-notify-card";
      card.innerHTML =
        '<div class="section-head"><div><div class="kicker">Never miss a round</div>' +
        '<h3>🔔 Phone notifications</h3></div></div>' +
        '<p class="muted s6-notify-copy">Get a reminder before predictions close. Once your predictions are in, the outstanding-entry reminders stop automatically.</p>' +
        '<div id="s6NotifySupport" class="muted"></div>' +
        '<div class="s6-notify-actions"><button type="button" id="s6NotifyEnable" class="big-action s6-notify-btn">Enable phone notifications</button>' +
        '<button type="button" id="s6NotifyDisable" class="secondary s6-notify-btn hidden">Turn off</button></div>' +
        '<div id="s6NotifyPrefs" class="s6-notify-prefs hidden"><div class="kicker">Choose your alerts</div>' +
        '<div class="s6-notify-choices">' + prefsHtml() + '</div>' +
        '<button type="button" class="secondary s6-notify-btn" id="s6NotifySavePrefs">Save preferences</button></div>' +
        '<div id="s6NotifyMessage" role="status" class="muted s6-notify-message"></div>';
      const prediction = document.getElementById("predictionCard");
      if (prediction) prediction.insertAdjacentElement("afterend", card);
      else playerHome.appendChild(card);
      document.getElementById("s6NotifyEnable").addEventListener("click", enable);
      document.getElementById("s6NotifyDisable").addEventListener("click", disable);
      document.getElementById("s6NotifySavePrefs").addEventListener("click", savePrefs);
    }
    const panel = document.querySelector('[data-admin-panel="overview"]');
    if (panel && !document.getElementById("s6AdminNotifyCard")) {
      const card = document.createElement("section");
      card.id = "s6AdminNotifyCard";
      card.className = "card s6-notify-card";
      card.innerHTML =
        '<div class="section-head"><div><div class="kicker">Admin · entry reminders</div>' +
        '<h3>🔔 Remind outstanding players</h3></div></div>' +
        '<p class="muted s6-notify-copy">Only players without submitted predictions who have opted in to phone notifications can be nudged. Maximum once per player per day.</p>' +
        '<div class="s6-notify-admin-count" id="s6NotifyAdminCount">Checking the current round…</div>' +
        '<div class="s6-notify-actions"><button type="button" class="big-action s6-notify-btn" id="s6NotifyAdminSend">Remind outstanding players</button>' +
        '<button type="button" class="secondary s6-notify-btn" id="s6NotifyAdminRefresh">Refresh numbers</button></div>' +
        '<div id="s6NotifyAdminMessage" role="status" class="muted s6-notify-message"></div>';
      panel.appendChild(card);
      document.getElementById("s6NotifyAdminSend").addEventListener("click", sendAdmin);
      document.getElementById("s6NotifyAdminRefresh").addEventListener("click", refreshAdmin);
    }
  }
  async function registration() {
    let reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) reg = await navigator.serviceWorker.register("/super6-sw.js", { scope: "/" });
    return reg;
  }
  async function currentSubscription() {
    if (!supported) return null;
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ? await reg.pushManager.getSubscription() : null;
  }
  function keyBytes(value) {
    const pad = "=".repeat((4 - value.length % 4) % 4);
    const raw = atob((value + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, ch => ch.charCodeAt(0));
  }
  async function enable() {
    if (busy) return;
    const message = document.getElementById("s6NotifyMessage");
    if (!token()) return putStatus(message, "Please log in again, then try enabling notifications.", true);
    if (onIphone && !standalone())
      return putStatus(message, "On iPhone: open Super 6 in Safari → Share → Add to Home Screen. Open it from the new icon, then tap Enable.", true);
    if (!supported)
      return putStatus(message, "This browser cannot receive push notifications. Try installing Super 6 to your phone Home Screen.", true);
    setBusy(true);
    try {
      // Always request permission straight from the user-initiated button tap (required on iOS).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications were not allowed. You can enable them in your phone's notification settings.");
      const reg = await registration();
      const { publicKey } = await call("config", {}, false);
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      await call("subscribe", { subscription: sub.toJSON(), prefs: prefsFromForm() });
      putStatus(message, "Notifications are on! Your phone will receive the alerts you've selected.");
      await refreshPlayer();
    } catch (error) { putStatus(message, error.message || String(error), true); }
    finally { setBusy(false); }
  }
  async function disable() {
    if (busy) return;
    const message = document.getElementById("s6NotifyMessage");
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await call("unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      putStatus(message, "Notifications are off on this device.");
      await refreshPlayer();
    } catch (error) { putStatus(message, error.message || String(error), true); }
    finally { setBusy(false); }
  }
  async function savePrefs() {
    if (busy) return;
    const message = document.getElementById("s6NotifyMessage");
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (!sub) throw new Error("Enable phone notifications first.");
      await call("preferences", { endpoint: sub.endpoint, prefs: prefsFromForm() });
      putStatus(message, "Your notification preferences are saved.");
    } catch (error) { putStatus(message, error.message || String(error), true); }
    finally { setBusy(false); }
  }
  async function refreshPlayer() {
    const support = document.getElementById("s6NotifySupport");
    const enableButton = document.getElementById("s6NotifyEnable");
    const disableButton = document.getElementById("s6NotifyDisable");
    const prefs = document.getElementById("s6NotifyPrefs");
    if (!support || !enableButton || !disableButton || !prefs) return;
    if (onIphone && !standalone()) {
      support.textContent = "iPhone: first add Super 6 to your Home Screen using Safari’s Share menu, then open that icon.";
    } else if (!supported) {
      support.textContent = "Push notifications are not supported by this browser.";
    } else {
      support.textContent = "Opt in once per device. You can switch individual reminders off at any time.";
    }
    let sub = null;
    try { sub = await currentSubscription(); }
    catch (_) { /* browser might deny access */ }
    const enabled = !!sub && Notification.permission === "granted";
    enableButton.classList.toggle("hidden", enabled);
    disableButton.classList.toggle("hidden", !enabled);
    prefs.classList.toggle("hidden", !enabled);
  }
  async function refreshAdmin() {
    const counter = document.getElementById("s6NotifyAdminCount");
    const send = document.getElementById("s6NotifyAdminSend");
    if (!counter || !send || !isLoggedIn()) return;
    if (!token()) { counter.textContent = "Log in to view reminder numbers."; send.disabled = true; return; }
    try {
      const data = await call("status");
      if (!data.round) { counter.textContent = "No published round currently open."; send.disabled = true; return; }
      counter.textContent = data.outstanding + " outstanding · " + data.reachable +
        " opted-in player" + (data.reachable === 1 ? "" : "s") + " reachable by phone · " + data.round;
      send.disabled = data.reachable === 0;
    } catch (error) {
      counter.textContent = "Could not load reminder numbers: " + (error.message || error);
      send.disabled = true;
    }
  }
  async function sendAdmin() {
    if (busy || !confirm("Send one phone reminder to outstanding players who opted in?")) return;
    const message = document.getElementById("s6NotifyAdminMessage");
    setBusy(true);
    try {
      const result = await call("manual");
      putStatus(message, "Sent to " + result.sent + " device" + (result.sent === 1 ? "" : "s") +
        ". Already reminded today: " + result.skipped + ". Failed: " + result.failed + ".");
      await refreshAdmin();
    } catch (error) { putStatus(message, error.message || String(error), true); }
    finally { setBusy(false); }
  }
  function init() {
    ensureCards();
    refreshPlayer().catch(() => {});
    const screen = document.getElementById("appScreen");
    if (screen) new MutationObserver(() => {
      if (isLoggedIn()) {
        refreshPlayer().catch(() => {});
        if (!document.getElementById("adminArea")?.classList.contains("hidden"))
          refreshAdmin().catch(() => {});
      }
    }).observe(screen, { attributes: true, attributeFilter: ["class"] });
    const admin = document.getElementById("adminArea");
    if (admin) new MutationObserver(() => {
      if (!admin.classList.contains("hidden") && isLoggedIn())
        refreshAdmin().catch(() => {});
    }).observe(admin, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && isLoggedIn()) refreshPlayer().catch(() => {});
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
