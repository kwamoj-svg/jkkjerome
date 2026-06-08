// ═══════════════════════════════════════
// JKK Analytics Tracker v2 — Robust
// Speichert Besucherdaten in localStorage
// Sichtbar im Admin Dashboard
// ═══════════════════════════════════════
(function() {
  'use strict';

  // Nicht im Admin tracken
  if (location.pathname.indexOf('/admin') !== -1) return;

  // Einzigartige Visit ID um Duplikate zu verhindern
  var vid = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  var saved = false;
  var startTime = Date.now();
  var interacted = false;

  function getSource() {
    var ref = document.referrer || '';
    // UTM Parameter pruefen
    try {
      var params = new URLSearchParams(location.search);
      var utm = params.get('utm_source');
      if (utm) return utm.toLowerCase();
    } catch(e) {}
    if (!ref) return 'direct';
    if (ref.indexOf(location.hostname) !== -1) return 'intern';
    if (ref.indexOf('google') !== -1) return 'google';
    if (ref.indexOf('bing') !== -1) return 'bing';
    if (ref.indexOf('instagram') !== -1 || ref.indexOf('ig.me') !== -1) return 'instagram';
    if (ref.indexOf('facebook') !== -1 || ref.indexOf('fb.me') !== -1) return 'facebook';
    if (ref.indexOf('linkedin') !== -1) return 'linkedin';
    if (ref.indexOf('whatsapp') !== -1 || ref.indexOf('wa.me') !== -1) return 'whatsapp';
    if (ref.indexOf('youtube') !== -1) return 'youtube';
    if (ref.indexOf('tiktok') !== -1) return 'tiktok';
    if (ref.indexOf('twitter') !== -1 || ref.indexOf('t.co') !== -1) return 'twitter';
    if (ref.indexOf('pinterest') !== -1) return 'pinterest';
    return 'other';
  }

  function getDevice() {
    var ua = navigator.userAgent || '';
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|android|iphone|ipod|opera mini|iemobile|windows phone/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  // Interaktion erkennen (kein Bounce)
  function onInteract() {
    interacted = true;
    document.removeEventListener('click', onInteract);
    document.removeEventListener('scroll', onInteract);
    document.removeEventListener('keydown', onInteract);
  }
  document.addEventListener('click', onInteract);
  document.addEventListener('scroll', onInteract);
  document.addEventListener('keydown', onInteract);

  function save() {
    // Nur EINMAL speichern pro Visit
    if (saved) return;
    saved = true;

    var duration = Math.round((Date.now() - startTime) / 1000);
    var entry = {
      id: vid,
      t: startTime,
      p: location.pathname || '/',
      s: getSource(),
      d: getDevice(),
      c: navigator.language ? navigator.language.split('-')[1] || navigator.language.split('-')[0].toUpperCase() : 'XX',
      dur: duration,
      bounce: !interacted && duration < 10,
      real: true  // Markierung: echte Daten, keine Demo
    };

    try {
      var data = JSON.parse(localStorage.getItem('jkk_analytics') || '[]');
      // Duplikat Check anhand der Visit ID
      var exists = false;
      for (var i = data.length - 1; i >= Math.max(0, data.length - 50); i--) {
        if (data[i] && data[i].id === vid) { exists = true; break; }
      }
      if (exists) return;

      // Max 10000 Eintraege behalten (aelteste loeschen)
      if (data.length > 10000) data = data.slice(-8000);
      data.push(entry);
      localStorage.setItem('jkk_analytics', JSON.stringify(data));
    } catch(e) {
      // localStorage voll oder Fehler — still ignorieren
    }
  }

  // Spaeter nochmal speichern mit aktualisierter Verweildauer
  // (ersetzt den ersten Eintrag)
  function updateDuration() {
    if (!saved) return;
    try {
      var data = JSON.parse(localStorage.getItem('jkk_analytics') || '[]');
      for (var i = data.length - 1; i >= Math.max(0, data.length - 50); i--) {
        if (data[i] && data[i].id === vid) {
          data[i].dur = Math.round((Date.now() - startTime) / 1000);
          data[i].bounce = !interacted && data[i].dur < 10;
          localStorage.setItem('jkk_analytics', JSON.stringify(data));
          break;
        }
      }
    } catch(e) {}
  }

  // Speichern nach 5 Sekunden (fruehe Erfassung)
  setTimeout(save, 5000);

  // Verweildauer aktualisieren nach 30s, 60s, 120s
  setTimeout(updateDuration, 30000);
  setTimeout(updateDuration, 60000);
  setTimeout(updateDuration, 120000);

  // Speichern beim Tab-Wechsel oder Schliessen
  if (typeof document.visibilityState !== 'undefined') {
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        if (!saved) save(); else updateDuration();
      }
    });
  }

  window.addEventListener('beforeunload', function() {
    if (!saved) save(); else updateDuration();
  });

  // Sofort speichern wenn Seite fertig geladen
  if (document.readyState === 'complete') {
    setTimeout(save, 100);
  } else {
    window.addEventListener('load', function() { setTimeout(save, 100); });
  }
})();
