/* Super 6 Fright Night 2026
   Visual-only seasonal skin. 26 October 00:00 – 2 November 00:00 Europe/London.
   ?halloween=on previews it at any time; ?halloween=off previews the normal theme.
   Never reads or writes predictions, accounts, payments or other competition state. */
(() => {
  'use strict';
  const CLASS_NAME = 'super6-halloween';
  const BANNER_ID = 's6HalloweenBanner';
  const themeColour = document.querySelector('meta[name="theme-color"]');
  const normalColour = themeColour?.content || '#173f2a';
  const params = new URLSearchParams(location.search);
  const override = (params.get('halloween') || '').toLowerCase();

  function londonStamp() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date());
      const get = key => parts.find(part => part.type === key)?.value || '';
      return Number(get('year') + get('month') + get('day'));
    } catch (_) {
      // Unexpected old browser: fail safely to the normal theme, except preview.
      return 0;
    }
  }

  function applyTheme() {
    const stamp = londonStamp();
    const scheduled = stamp >= 20261026 && stamp <= 20261101;
    const enabled = override === 'off' ? false : (override === 'on' || scheduled);
    document.documentElement.classList.toggle(CLASS_NAME, enabled);
    if (themeColour) themeColour.content = enabled ? '#201625' : normalColour;

    if (!document.body) return;
    const app = document.getElementById('app');
    let banner = document.getElementById(BANNER_ID);
    if (!enabled || !app) {
      banner?.remove();
      return;
    }
    if (!banner) {
      banner = document.createElement('aside');
      banner.id = BANNER_ID;
      banner.className = 's6-halloween-banner';
      banner.setAttribute('aria-label', 'Super 6 Fright Night seasonal theme');
      banner.innerHTML = '<span class="s6-halloween-left" aria-hidden="true">🕸️ 🦇</span>'
        + '<div class="s6-halloween-wordmark"><span class="s6-halloween-pumpkin" aria-hidden="true">🎃</span>'
        + '<div><strong>SUPER 6 <span>FRIGHT NIGHT</span></strong><small id="s6HalloweenSubtitle"></small></div></div>'
        + '<span class="s6-halloween-right" aria-hidden="true">👻 🕷️</span>';
      app.insertBefore(banner, app.firstChild);
    }
    const subtitle = banner.querySelector('#s6HalloweenSubtitle');
    if (subtitle) {
      subtitle.textContent = override === 'on' && !scheduled
        ? 'PREVIEW · LIVE 26 OCT – 1 NOV'
        : '26 OCT – 1 NOV · THE HAUNTED SIX';
    }
  }

  // Set the theme immediately; fill in the non-interactive banner once DOM exists.
  applyTheme();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTheme, { once: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyTheme();
  });
  // An already-open tab also switches itself off after Halloween.
  window.setInterval(applyTheme, 60 * 1000);
})();
