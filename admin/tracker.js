// ═══════════════════════════════════════
// JKK Analytics Tracker — Lightweight
// Speichert Besucherdaten in localStorage
// Sichtbar im Admin Dashboard
// ═══════════════════════════════════════
(function() {
  'use strict';
  if (location.pathname.includes('/admin')) return; // Nicht im Admin tracken

  var entry = {
    t: Date.now(),
    p: location.pathname || '/',
    s: getSource(),
    d: getDevice(),
    c: navigator.language ? navigator.language.split('-')[1] || navigator.language.split('-')[0].toUpperCase() : 'XX',
    dur: 0,
    bounce: true
  };

  function getSource() {
    var ref = document.referrer || '';
    if (!ref) return 'direct';
    if (ref.includes('google')) return 'google';
    if (ref.includes('bing')) return 'bing';
    if (ref.includes('instagram') || ref.includes('ig.me')) return 'instagram';
    if (ref.includes('facebook') || ref.includes('fb.me')) return 'facebook';
    if (ref.includes('linkedin')) return 'linkedin';
    if (ref.includes('whatsapp') || ref.includes('wa.me')) return 'whatsapp';
    if (ref.includes('youtube')) return 'youtube';
    if (ref.includes('tiktok')) return 'tiktok';
    if (ref.includes('twitter') || ref.includes('t.co')) return 'twitter';
    if (ref.includes(location.hostname)) return 'intern';
    return 'other';
  }

  function getDevice() {
    var ua = navigator.userAgent || '';
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|android|iphone|ipod|opera mini|iemobile/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  // Track Verweildauer
  var startTime = Date.now();
  var interacted = false;

  function onInteract() {
    interacted = true;
    entry.bounce = false;
  }
  document.addEventListener('click', onInteract, { once: true });
  document.addEventListener('scroll', onInteract, { once: true });

  function save() {
    entry.dur = Math.round((Date.now() - startTime) / 1000);
    if (!interacted && entry.dur < 5) entry.bounce = true;

    try {
      var data = JSON.parse(localStorage.getItem('jkk_analytics') || '[]');
      // Max 5000 Eintraege behalten (aelteste loeschen)
      if (data.length > 5000) data = data.slice(-4000);
      data.push(entry);
      localStorage.setItem('jkk_analytics', JSON.stringify(data));
    } catch(e) {}
  }

  // Speichern beim Verlassen
  if (navigator.sendBeacon) {
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') save();
    });
  }
  window.addEventListener('beforeunload', save);

  // Auch nach 30s speichern (falls Tab offen bleibt)
  setTimeout(save, 30000);
})();
