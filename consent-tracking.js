/* ─── CONSENT + TRACKING LOADER (shared, alle Unterseiten) ───
   Lädt Google Analytics 4 (G-WVG3Q55RV9) erst nach Cookie-Zustimmung.
   Nutzt denselben Consent-Key wie die Startseite ('jkk_consent'),
   d.h. eine einmal getroffene Entscheidung gilt auf der ganzen Website. */
(function(){
  'use strict';

  // ── Config ──
  var GA4_ID      = 'G-WVG3Q55RV9';
  var CONSENT_KEY = 'jkk_consent_v2';

  // Pfad zur Datenschutzerklärung relativ zum Seitenstandort ermitteln
  var segs = location.pathname.split('/').filter(Boolean);
  // letzter Eintrag ist die Datei (z.B. leistung.html); Tiefe = Anzahl Unterordner
  var depth = location.pathname.charAt(location.pathname.length - 1) === '/'
    ? segs.length
    : Math.max(0, segs.length - 1);
  var prefix = depth > 0 ? new Array(depth + 1).join('../') : '';
  var privacyHref = prefix + 'legal/datenschutz.html';

  function injectBanner(){
    if(document.getElementById('consent-banner')) return; // schon vorhanden

    var style = document.createElement('style');
    style.textContent =
      '#consent-banner{position:fixed;bottom:0;left:0;right:0;z-index:9998;' +
      'background:rgba(8,8,10,.96);backdrop-filter:blur(12px);border-top:1px solid rgba(255,255,255,.1);' +
      'padding:22px 28px;display:none;align-items:center;gap:20px;flex-wrap:wrap;' +
      'font-family:var(--sans,"IBM Plex Sans",system-ui,sans-serif);font-size:14px;line-height:1.56;color:#b8b8b8;}' +
      '#consent-banner.show{display:flex}' +
      '#consent-banner a{color:var(--gold,#d0d6de);text-decoration:underline;text-underline-offset:3px}' +
      '#consent-banner .cb-text{flex:1;min-width:280px}' +
      '#consent-banner .cb-btns{display:flex;gap:10px;flex-wrap:wrap}' +
      '.cb-btn{font-family:var(--mono,"IBM Plex Mono",monospace);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;' +
      'padding:12px 22px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;cursor:pointer;' +
      'transition:all .25s;white-space:nowrap}' +
      '.cb-btn:hover{border-color:#fff;background:rgba(255,255,255,.06)}' +
      '.cb-btn.accept{background:var(--gold,#d0d6de);color:#0a0a0a;border-color:transparent;font-weight:500}' +
      '.cb-btn.accept:hover{opacity:.88}';
    document.head.appendChild(style);

    var lang = document.documentElement.lang === 'en' ? 'en' : 'de';
    var banner = document.createElement('div');
    banner.id = 'consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie-Einstellungen');
    banner.innerHTML =
      '<div class="cb-text">' +
        (lang === 'de'
          ? 'Ich nutze Cookies und Analysetools, um diese Website zu verbessern. Mehr dazu in der <a href="' + privacyHref + '">Datenschutzerklärung</a>.'
          : 'I use cookies and analytics tools to improve this website. More in the <a href="' + privacyHref + '">privacy policy</a>.') +
      '</div>' +
      '<div class="cb-btns">' +
        '<button class="cb-btn" id="consent-decline" type="button">' + (lang === 'de' ? 'Nur notwendige' : 'Essential only') + '</button>' +
        '<button class="cb-btn accept" id="consent-accept" type="button">' + (lang === 'de' ? 'Alle akzeptieren' : 'Accept all') + '</button>' +
      '</div>';
    document.body.appendChild(banner);
    return banner;
  }

  function init(){
    var saved = null;
    try { saved = localStorage.getItem(CONSENT_KEY); } catch(e){}

    var banner = injectBanner();

    if(!saved && banner){
      banner.classList.add('show');
      document.getElementById('consent-accept').addEventListener('click', function(){ setConsent('all'); });
      document.getElementById('consent-decline').addEventListener('click', function(){ setConsent('essential'); });
    }

    if(saved === 'all') loadTracking();

    function setConsent(level){
      try { localStorage.setItem(CONSENT_KEY, level); } catch(e){}
      if(banner) banner.classList.remove('show');
      if(level === 'all') loadTracking();
    }
  }

  function loadTracking(){
    if(!GA4_ID || window.__jkkGAloaded) return;
    window.__jkkGAloaded = true;
    var gs = document.createElement('script');
    gs.async = true;
    gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(gs);
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', GA4_ID, { anonymize_ip: true });
    window.gtag = gtag;
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
