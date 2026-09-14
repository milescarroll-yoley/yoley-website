/* ============================================================
   YOLEY.COM — Interactions
   ============================================================ */

(function () {
  'use strict';

  // ---- Navbar scroll effect ----
  var navbar = document.getElementById('navbar');
  var scrollThreshold = 60;

  function updateNavbar() {
    if (window.scrollY > scrollThreshold) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', updateNavbar, { passive: true });
  updateNavbar();

  // ---- Mobile menu toggle ----
  var mobileToggle = document.getElementById('mobileToggle');
  var navLinks = document.getElementById('navLinks');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', function () {
      navLinks.classList.toggle('open');
      mobileToggle.setAttribute(
        'aria-expanded',
        navLinks.classList.contains('open').toString()
      );
    });

    // Close menu when a link is tapped
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---- Intersection Observer — reveal on scroll ----
  var revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    revealElements.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback: show everything immediately
    revealElements.forEach(function (el) {
      el.classList.add('visible');
    });
  }

  // ---- Animated counters ----
  var counterElements = document.querySelectorAll('[data-count]');

  function animateCounter(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var isDecimal = target % 1 !== 0;
    var duration = 1500;
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = start + (target - start) * eased;

      if (isDecimal) {
        el.textContent = current.toFixed(2);
      } else {
        el.textContent = Math.round(current);
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window && counterElements.length) {
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counterElements.forEach(function (el) {
      counterObserver.observe(el);
    });
  }

  // ---- Smooth scroll for anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        var navHeight = navbar.offsetHeight;
        var targetPos =
          targetEl.getBoundingClientRect().top + window.scrollY - navHeight - 20;
        window.scrollTo({ top: targetPos, behavior: 'smooth' });
      }
    });
  });
})();

// ---- App Store go-live switch ----
// Asks Apple's public iTunes lookup whether Yoley (id 6789192466) is on sale
// in the UK store. Until it is, the lookup returns resultCount 0 and nothing
// changes. Once Apple releases the app, every "Download" button on the site
// starts pointing at the listing and the homepage launch banner switches to
// "live" — no edit needed on launch day. Uses JSONP because the lookup API
// doesn't send CORS headers.
(function () {
  var APP_ID = '6789192466';
  var APP_URL = 'https://apps.apple.com/gb/app/yoley-invoice-quote-app/id' + APP_ID;

  function isDownloadLink(a) {
    var href = a.getAttribute('href') || '';
    var cls = ' ' + (a.className || '') + ' ';
    var looksLikeDownload =
      /\s(nav-cta|btn-appstore|btn-pricing)\s/.test(cls) || /download/i.test(a.textContent || '');
    var placeholder = href === '#' || /(^|\/)index\.html$/.test(href);
    return looksLikeDownload && placeholder && !/tool-talk|blog/.test(href);
  }

  function goLive() {
    document.documentElement.classList.add('yoley-live');
    document.querySelectorAll('a').forEach(function (a) {
      if (isDownloadLink(a)) {
        a.href = APP_URL;
        a.rel = 'noopener';
      }
    });
    function setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }
    setText('launch-tag', ' Out now on the App Store');
    setText('launch-title', 'Yoley is live on the App Store.');
    setText('launch-sub', 'Two years of building and testing with real UK tradespeople — free, with nothing held back. Download it today. The Android app is in beta testing, with general release to follow.');
    var cta = document.getElementById('launch-cta');
    if (cta) {
      cta.textContent = 'Download on the App Store →';
      cta.href = APP_URL;
    }
    // iOS being live doesn't end the Android beta, so make sure the beta route
    // is showing rather than letting the App Store button replace it. The markup
    // already shows it since 14 Sept 2026; this is here for any page that still
    // ships it hidden.
  }

  function check() {
    window.__yoleyAppLookup = function (res) {
      if (res && res.resultCount > 0) goLive();
    };
    var s = document.createElement('script');
    // Cache-buster is REQUIRED, not belt-and-braces. Apple's CDN caches the
    // lookup response per exact URL, so on 14 Sept 2026 the un-busted URL was
    // still returning resultCount 0 hours after the app went on sale, while the
    // same query with a different callback name returned 1. Bucketed to 5
    // minutes so we still get some caching without pinning a stale answer.
    var bucket = Math.floor(Date.now() / 300000);
    s.src = 'https://itunes.apple.com/lookup?id=' + APP_ID + '&country=gb&_=' + bucket + '&callback=__yoleyAppLookup';
    s.async = true;
    document.body.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  } else {
    check();
  }
})();
