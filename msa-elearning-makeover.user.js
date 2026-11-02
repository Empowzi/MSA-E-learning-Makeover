// ==UserScript==
// @name         MSA E-learning Makeover
// @icon         https://msa.edu.eg/msauniversity/wp-content/uploads/2026/03/MSA-Logo-1.png
// @author       Empowzi
// @license      Copyright 2026 Empowzi. All rights reserved.
// @namespace    https://tampermonkey.net/
// @version      6.0
// @description  Clean UI, dark mode, subject artwork on course cards, deadline panel on My courses, auto login, plus pop-ups on any website for new MSA announcements and assignment alerts
// @match        *://*/*
// @noframes
// @connect      e-learning.msa.edu.eg
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_addValueChangeListener
// @run-at       document-end
// ==/UserScript==

/*
 * MSA E-learning Makeover
 * Copyright 2026 Empowzi. All rights reserved.
 * You may install and use this script for personal use.
 * Copying, modifying, or republishing it without permission is not allowed.
 */

(function () {
  'use strict';

  const LOG = (...a) => console.log('[CleanUI]', ...a);
  const isMoodle = () =>
    location.hostname === 'e-learning.msa.edu.eg' && document.body && (/moodle/i.test(document.body.className + document.body.id) ||
    document.querySelector('a[href*="course/view.php"], [data-region="drawer"], #page-wrapper, body[id^="page-"]'));
  /* =====================================================
     MAKEOVER UI (only on Moodle pages)
  ===================================================== */
  function initUI() {
    /* =====================================================
       PAGE TYPE
    ===================================================== */
    const body = document.body;
    const root = document.documentElement;
    const isInsideCourse =
      /^page-(course-view|mod-|course-edit|course-modedit)/.test(body.id) ||
      body.classList.contains('path-course-view') ||
      body.classList.contains('path-mod');
    const enableCards = !isInsideCourse;                       // dashboard / my courses cards
    const isCourse = body.classList.contains('path-course-view') || /^page-course-view/.test(body.id);
    const isMod = body.classList.contains('path-mod') || /^page-mod-/.test(body.id);
    const isAssign = body.classList.contains('path-mod-assign') || /^page-mod-assign/.test(body.id);

    // The course page opens each dated assignment's page in the background (same request your browser makes
    // when you click it) to learn whether you have submitted. Set to false to turn that off: statuses then
    // only update when you visit an assignment page yourself.
    const CHECK_SUBMISSIONS = true;

    // Soft animated background (drifting color glow + faint dot grid). Set to false to keep it still.
    const ANIMATE_BG = true;

    // selector helper: same rule for course pages and activity pages
    const bm = (sel, pre = '') => ['body.path-course-view', 'body.path-mod'].map((p) => `${pre}${p} ${sel}`).join(', ');

    /* =====================================================
       STYLES
    ===================================================== */
    const css = `
      html { background: #f3f5fa; }
      body, #page, #page-wrapper { background: transparent !important; }

      /* ================= BACKGROUND (soft glow + dot grid) ================= */
      body::before, body::after { content: ""; position: fixed; pointer-events: none; z-index: -1; }
      body::before {
        inset: -12%;
        background:
          radial-gradient(circle at 14% 16%, hsl(255 95% 82% / .55), transparent 38%),
          radial-gradient(circle at 88% 12%, hsl(205 100% 80% / .55), transparent 36%),
          radial-gradient(circle at 80% 90%, hsl(318 90% 84% / .45), transparent 40%),
          radial-gradient(circle at 8% 88%, hsl(170 80% 80% / .35), transparent 34%);
        animation: cp-drift 38s ease-in-out infinite alternate; will-change: transform;
      }
      body::after {
        inset: 0;
        background-image: radial-gradient(rgba(70,80,130,.16) 1.2px, transparent 1.4px);
        background-size: 28px 28px;
        -webkit-mask-image: linear-gradient(to bottom, #000, transparent 85%);
        mask-image: linear-gradient(to bottom, #000, transparent 85%);
      }
      html.cp-bg-still body::before { animation: none; }
      @keyframes cp-drift { from { transform: translate3d(-2%, -1%, 0) scale(1); } to { transform: translate3d(2%, 2%, 0) scale(1.08); } }
      @media (prefers-reduced-motion: reduce) { body::before { animation: none !important; } }

      /* ================= DASHBOARD CARDS ================= */
      .cp-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)) !important;
        gap: 22px !important; margin: 0 !important; padding: 8px 2px 24px !important;
      }
      .cp-card {
        width: auto !important; max-width: none !important; margin: 0 !important; flex: none !important;
        border: none !important; border-radius: 18px !important; overflow: hidden !important;
        background: #fff !important; box-shadow: 0 2px 10px rgba(20,30,60,.08) !important;
        transition: transform .18s ease, box-shadow .18s ease;
        min-height: 190px; display: flex !important; flex-direction: column !important;
      }
      .cp-card:hover { transform: translateY(-5px); box-shadow: 0 14px 28px rgba(20,30,60,.16) !important; }

      .cp-card .dashboard-card-img, .cp-card .card-img, .cp-card .card-img-top,
      .cp-card .course-card-img, .cp-card [class*="-img"] { display: none !important; }

      .cp-head {
        position: relative; height: 100px; padding: 14px 16px; overflow: hidden;
        display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff;
        background: linear-gradient(135deg, hsl(var(--h) 70% 48%), hsl(calc(var(--h) + 35) 75% 38%));
      }
      .cp-head::after {
        content: ""; position: absolute; right: -30px; top: -40px;
        width: 130px; height: 130px; border-radius: 50%; background: rgba(255,255,255,.12);
      }
      /* subject artwork behind the header (fades out behind the title text) */
      .cp-head::before {
        content: ""; position: absolute; inset: 0; pointer-events: none;
        background: var(--bg) right center / auto 110% no-repeat;
        -webkit-mask-image: linear-gradient(90deg, transparent 18%, #000 50%);
        mask-image: linear-gradient(90deg, transparent 18%, #000 50%);
        filter: drop-shadow(0 2px 6px rgba(0,0,0,.25));
        transition: transform .6s ease;
      }
      .cp-card:hover .cp-head::before { transform: scale(1.1) translateX(-8px); }
      .cp-left { display: flex; align-items: center; gap: 12px; z-index: 1; min-width: 0; flex: 1 1 0; }
      .cp-txt { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .cp-subcode {
        font-size: .78rem; font-weight: 600; opacity: .85; letter-spacing: .3px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .cp-icon {
        width: 50px; height: 50px; flex: none; border-radius: 14px;
        background: rgba(255,255,255,.22); display: flex; align-items: center; justify-content: center;
        font-size: 27px; line-height: 1; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25);
      }
      .cp-code {
        font-size: .95rem; font-weight: 700; line-height: 1.25; text-shadow: 0 1px 3px rgba(0,0,0,.25);
        overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: normal; overflow-wrap: normal;
      }
      /* category badge sits in the bottom-right corner so it never covers the artwork */
      .cp-badge {
        position: absolute; right: 12px; bottom: 10px; z-index: 1;
        font-size: .68rem; font-weight: 600; padding: 2px 9px; border-radius: 999px;
        max-width: 42%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        background: rgba(0,0,0,.3); backdrop-filter: blur(4px);
      }
      .cp-card .card-body { padding: 14px 16px 6px !important; flex: 1; }
      .cp-card .coursename, .cp-card a.aalink {
        font-size: 1rem !important; font-weight: 600; line-height: 1.35;
        color: #1d2740 !important; text-decoration: none !important;
      }
      .cp-card .coursename:hover { color: #6d4fe0 !important; }
      .cp-card .categoryname { color: #6b7690 !important; font-size: .82rem; }
      .cp-card .card-footer { background: transparent !important; border: 0 !important; }

      #cp-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 2px 6px; }
      .cp-chip {
        border: 1px solid #d5dbea; background: #fff; color: #36415d; padding: 6px 14px;
        border-radius: 999px; cursor: pointer; font-size: .85rem; font-weight: 600; transition: all .15s;
      }
      .cp-chip:hover { border-color: #6d4fe0; color: #6d4fe0; }
      .cp-chip.active { background: linear-gradient(135deg, #7a5af0, #3b82f6); border-color: #7a5af0; color: #fff; box-shadow: 0 4px 12px rgba(122,90,240,.35); }

      /* ================= TOP NAV (Home / Dashboard / My courses) = same pill buttons as the chips ================= */
      /* vertical alignment: a little breathing room under the browser tab, items centered in the bar */
      nav.navbar { padding-top: 8px !important; align-items: center !important; }
      .primary-navigation, .primary-navigation .navigation, .primary-navigation .moremenu,
      .primary-navigation .moremenu .nav, .primary-navigation .nav { align-items: center !important; height: auto !important; }
      .primary-navigation .nav-item:not(.d-none) { display: flex !important; align-items: center !important; }
      /* the "More" overflow button is not needed */
      .primary-navigation li.nav-item.dropdownmoremenu, .primary-navigation li.nav-item[data-region="morebutton"] { display: none !important; }

      .primary-navigation .nav-link {
        display: inline-flex !important; align-items: center;
        border: 1px solid #d5dbea !important; background: #fff !important; color: #36415d !important;
        padding: 6px 14px !important; margin: 0 4px !important; border-radius: 999px !important;
        font-size: .9rem !important; font-weight: 600 !important; line-height: 1.4 !important;
        height: auto !important; text-decoration: none !important;
        transition: transform .18s ease, box-shadow .18s ease, border-color .15s, color .15s, background .15s;
        animation: cp-pop .45s ease backwards;
      }
      .primary-navigation .nav-item:nth-child(2) .nav-link { animation-delay: 60ms; }
      .primary-navigation .nav-item:nth-child(3) .nav-link { animation-delay: 120ms; }
      .primary-navigation .nav-item:nth-child(4) .nav-link { animation-delay: 180ms; }
      .primary-navigation .nav-item:nth-child(5) .nav-link { animation-delay: 240ms; }
      .primary-navigation .nav-link:hover, .primary-navigation .nav-link:focus {
        border-color: #6d4fe0 !important; color: #6d4fe0 !important;
        transform: translateY(-3px); box-shadow: 0 8px 18px rgba(20,30,60,.18);
      }
      .primary-navigation .nav-link:active { transform: translateY(0) scale(.96); box-shadow: none; }
      .primary-navigation .nav-link.active, .primary-navigation .nav-link[aria-current="true"] {
        background: linear-gradient(135deg, #7a5af0, #3b82f6) !important; border-color: #7a5af0 !important; color: #fff !important;
        box-shadow: 0 4px 12px rgba(122,90,240,.35);
      }
      .primary-navigation .nav-link.active:hover, .primary-navigation .nav-link.active:focus { color: #fff !important; }
      /* remove Moodle's own underline marker on the active link */
      .primary-navigation .nav-link.active:not(.dropdown-toggle)::before,
      .primary-navigation .nav-link.active:not(.dropdown-toggle)::after { display: none !important; }
      @media (prefers-reduced-motion: reduce) { .primary-navigation .nav-link { animation: none !important; transition: none !important; } }

      /* ================= THEME BUTTON ================= */
      #cp-theme-btn {
        position: fixed; right: 18px; bottom: 18px; z-index: 99999;
        width: 46px; height: 46px; border-radius: 50%; border: none; cursor: pointer;
        background: #1d2740; color: #fff; font-size: 21px; line-height: 1;
        box-shadow: 0 6px 18px rgba(0,0,0,.3); transition: transform .15s;
      }
      #cp-theme-btn:hover { transform: scale(1.1); }

      /* ================= COURSE PAGE: safety reset (no card grid inside a course) ================= */
      body.path-course-view .cp-grid, body.path-mod .cp-grid,
      body[id^="page-course-view"] .cp-grid, body[id^="page-mod-"] .cp-grid {
        display: block !important; padding: 0 !important; gap: 0 !important; grid-template-columns: none !important;
      }
      body.path-course-view .cp-head, body.path-mod .cp-head,
      body.path-course-view #cp-chips, body.path-mod #cp-chips { display: none !important; }

      /* ================= COURSE PAGE: LAYOUT / ZOOM ================= */
      ${bm('#page')} { background: transparent !important; }
      ${bm('#topofscroll')}, ${bm('#page-content')}, ${bm('#region-main-box')}, ${bm('#region-main')} { background: transparent !important; }
      ${bm('#region-main')} {
        zoom: var(--cp-zoom, .9);
        max-width: 1180px; margin: 0 auto !important; line-height: 1.55;
      }

      /* ---------- hero banner ---------- */
      .cp-hero {
        position: relative; overflow: hidden; border-radius: 22px; padding: 22px 26px; margin: 6px 0 22px; color: #fff;
        background: linear-gradient(135deg, hsl(var(--h, 215) 70% 46%), hsl(calc(var(--h, 215) + 45) 72% 34%));
        box-shadow: 0 10px 26px hsl(var(--h, 215) 60% 30% / .35);
        animation: cp-pop .5s ease both;
      }
      .cp-hero::before, .cp-hero::after { content: ""; position: absolute; border-radius: 50%; background: rgba(255,255,255,.1); pointer-events: none; }
      .cp-hero::before { width: 220px; height: 220px; right: -60px; top: -90px; }
      .cp-hero::after  { width: 140px; height: 140px; right: 120px; bottom: -80px; }
      .cp-hero-top { display: flex; align-items: center; gap: 16px; position: relative; z-index: 1; }
      .cp-hero-emoji {
        width: 64px; height: 64px; flex: none; border-radius: 18px; background: rgba(255,255,255,.22);
        display: flex; align-items: center; justify-content: center; font-size: 36px; cursor: pointer; user-select: none;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.3); transition: transform .25s;
      }
      .cp-hero-emoji:hover { transform: rotate(-10deg) scale(1.1); }
      .cp-hero-title { font-size: 1.45rem; font-weight: 800; line-height: 1.2; text-shadow: 0 1px 3px rgba(0,0,0,.25); }
      .cp-hero-tip { font-size: .92rem; opacity: .92; margin-top: 4px; }
      .cp-hero-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; position: relative; z-index: 1; }
      .cp-hero-chip { background: rgba(255,255,255,.2); padding: 5px 13px; border-radius: 999px; font-size: .84rem; font-weight: 600; }
      /* subject artwork behind the course banner */
      .cp-hero-art {
        position: absolute; inset: 0; pointer-events: none;
        background: var(--bg) right center / auto 120% no-repeat;
        -webkit-mask-image: linear-gradient(90deg, transparent 25%, #000 60%);
        mask-image: linear-gradient(90deg, transparent 25%, #000 60%);
      }

      /* ================= SUBJECT PATTERNS: every course gets its own themed pattern =================
         Per-course variables (set from JS): --pat tile image, --p1/--p2 background colours,
         --acc accent colour (r,g,b), --dk darkest shade (r,g,b) used for the title plate. */
      /* course card header: pattern covers the whole header, title sits in a frosted plate */
      .cp-head.cp-pat { background: linear-gradient(135deg, var(--p1), var(--p2)); }
      .cp-head.cp-pat::before {
        background: var(--pat) 0 0 / 130px 130px repeat;
        -webkit-mask-image: none; mask-image: none; filter: none; opacity: .95;
        transition: background-position 1.4s ease;
      }
      .cp-card:hover .cp-head.cp-pat::before { transform: none; background-position: 46px 24px; }
      .cp-head.cp-pat::after {
        right: 0; top: 0; width: 100%; height: 100%; border-radius: 0;
        background: radial-gradient(ellipse at 26% 50%, rgba(var(--dk), .8), rgba(var(--dk), .3) 60%, transparent 85%);
      }
      .cp-head.cp-pat .cp-left {
        flex: 0 1 auto; max-width: 74%; padding: 8px 14px 8px 8px; border-radius: 16px;
        background: rgba(var(--dk), .66); backdrop-filter: blur(5px);
        box-shadow: inset 0 0 0 1px rgba(var(--acc), .45);
      }
      .cp-head.cp-pat .cp-icon {
        width: 42px; height: 42px; font-size: 23px; border-radius: 12px;
        background: rgba(var(--acc), .2); box-shadow: inset 0 0 0 1px rgba(var(--acc), .5);
      }
      .cp-head.cp-pat .cp-subcode { color: rgb(var(--acc)); opacity: 1; }
      .cp-head.cp-pat .cp-badge {
        background: rgba(var(--dk), .75); color: rgb(var(--acc)); box-shadow: inset 0 0 0 1px rgba(var(--acc), .4);
      }
      /* Moodle's own photo header is replaced by the themed banner */
      .cp-hdr-hidden { display: none !important; }
      .cp-nophoto, .cp-nophoto::before, .cp-nophoto::after { background-image: none !important; }
      .cp-nophoto > img, .cp-nophoto > picture, .cp-nophoto > video { display: none !important; }
      .cp-hero.cp-hero-out { width: min(1180px, calc(100% - 48px)); margin: 16px auto 10px; zoom: var(--cp-zoom, .9); }
      .cp-hero-crumbs { font-size: .74rem; font-weight: 600; letter-spacing: .2px; margin-bottom: 3px; }
      .cp-hero-crumbs a { color: rgb(var(--acc)) !important; opacity: .85; text-decoration: none !important; }
      .cp-hero-crumbs a:hover { opacity: 1; text-decoration: underline !important; }
      .cp-hero-crumbs span { opacity: .5; margin: 0 5px; }
      /* course page banner: same two-part card as the My courses cards (pattern header + solid strip) */
      .cp-hero.cp-pat {
        padding: 0; background: rgb(var(--dk)); border-radius: 20px;
        box-shadow: 0 10px 26px rgba(var(--dk), .5), 0 0 0 1px rgba(var(--acc), .25);
      }
      .cp-hero.cp-pat::before, .cp-hero.cp-pat::after { display: none; }
      .cp-hero-head {
        position: relative; overflow: hidden; min-height: 112px; padding: 16px 22px;
        display: flex; align-items: center;
        background: linear-gradient(135deg, var(--p1), var(--p2));
      }
      .cp-hero.cp-pat .cp-hero-art {
        background: var(--pat) 0 0 / 130px 130px repeat;
        -webkit-mask-image: none; mask-image: none; opacity: .95;
        transition: background-position 1.4s ease;
      }
      .cp-hero.cp-pat:hover .cp-hero-art { background-position: 46px 24px; }
      .cp-hero.cp-pat .cp-hero-art::after {
        content: ""; position: absolute; inset: 0;
        background: radial-gradient(ellipse at 26% 50%, rgba(var(--dk), .8), rgba(var(--dk), .3) 60%, transparent 85%);
      }
      .cp-hero.cp-pat .cp-hero-top {
        width: fit-content; max-width: 78%; padding: 8px 18px 8px 8px; gap: 12px; border-radius: 16px;
        background: rgba(var(--dk), .68); backdrop-filter: blur(5px);
        box-shadow: inset 0 0 0 1px rgba(var(--acc), .45);
      }
      .cp-hero.cp-pat .cp-hero-emoji {
        width: 46px; height: 46px; font-size: 26px; border-radius: 13px;
        background: rgba(var(--acc), .2); box-shadow: inset 0 0 0 1px rgba(var(--acc), .5);
      }
      .cp-hero.cp-pat .cp-hero-title { font-size: 1.15rem; line-height: 1.25; }
      .cp-hero.cp-pat .cp-hero-tip { color: rgb(var(--acc)); opacity: 1; font-weight: 600; font-size: .8rem; margin-top: 2px; letter-spacing: .3px; }
      .cp-hero.cp-pat .cp-hero-chips { margin: 0; padding: 12px 20px 14px; background: rgb(var(--dk)); }
      .cp-hero.cp-pat .cp-hero-chip {
        background: rgba(var(--acc), .12); box-shadow: inset 0 0 0 1px rgba(var(--acc), .35);
      }
      .cp-hero.cp-pat .cp-hero-chip.tip { background: transparent; box-shadow: none; opacity: .85; font-weight: 500; }

      /* ---------- week / section cards ---------- */
      body.path-course-view .course-content li.section.course-section {
        background: #fff !important; border: 1px solid #e1e6f2 !important;
        border-top: 5px solid hsl(var(--sh, 220) 70% 55%) !important;
        border-radius: 20px !important; padding: 14px 18px 8px !important; margin: 0 0 24px !important;
        box-shadow: 0 4px 16px rgba(20,30,60,.07);
        animation: cp-pop .5s ease both; animation-delay: calc(var(--i, 0) * 45ms);
      }
      body.path-course-view .course-content .course-section-header {
        background: linear-gradient(135deg, hsl(var(--sh, 220) 62% 38%), hsl(calc(var(--sh, 220) + 35) 66% 28%)) !important;
        border-radius: 16px !important; padding: 10px 16px !important; position: relative; overflow: hidden;
        box-shadow: 0 6px 14px hsl(var(--sh, 220) 60% 30% / .25);
      }
      body.path-course-view .course-content .course-section-header::after {
        content: ""; position: absolute; right: -30px; top: -50px; width: 140px; height: 140px;
        border-radius: 50%; background: rgba(255,255,255,.1); pointer-events: none;
      }
      body.path-course-view .course-content .course-section-header,
      body.path-course-view .course-content .course-section-header a,
      body.path-course-view .course-content .course-section-header h3,
      body.path-course-view .course-content .course-section-header .sectionname,
      body.path-course-view .course-content .course-section-header .sectionname a,
      body.path-course-view .course-content .course-section-header .icons-collapse-expand {
        color: #fff !important; text-decoration: none !important;
      }
      body.path-course-view .course-content .course-section-header .icons-collapse-expand,
      body.path-course-view .course-content .course-section-header .btn-icon {
        background: rgba(255,255,255,.2) !important; border-radius: 10px !important;
      }
      .cp-secbadge {
        display: inline-flex; align-items: center; gap: 6px; margin-right: 12px; padding: 3px 11px;
        border-radius: 999px; background: rgba(255,255,255,.2); color: #fff; font-size: .8rem; font-weight: 700;
        white-space: nowrap; position: relative; z-index: 1;
      }

      /* ---------- activity cards ---------- */
      body.path-course-view .course-content li.activity:not(.modtype_label) {
        background: #f7f9fe !important; border: 1px solid #e3e8f4 !important;
        border-left: 5px solid hsl(var(--c, 210) 70% 55%) !important;
        border-radius: 14px !important; margin: 10px 0 !important; padding: 8px 12px !important;
        transition: transform .15s ease, box-shadow .15s ease;
      }
      body.path-course-view .course-content li.activity:not(.modtype_label):hover {
        transform: translateX(4px); box-shadow: 0 6px 16px rgba(20,30,60,.1);
      }
      body.path-course-view .course-content li.activity:not(.modtype_label) .activity-item {
        border: 0 !important; background: transparent !important;
      }
      body.path-course-view .course-content li.activity .activityname a { font-weight: 600; }
      body.path-course-view .course-content .activity-description strong,
      body.path-course-view .course-content .activity-description b { font-weight: 650; }

      /* emoji replaces the tiny activity icon */
      body.path-course-view .course-content li.activity:not(.modtype_label) .activityiconcontainer {
        width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
        background: hsl(var(--c, 210) 75% 55% / .2) !important; border: 1px solid hsl(var(--c, 210) 70% 55% / .5) !important;
        padding: 0 !important; transition: transform .2s;
      }
      body.path-course-view .course-content li.activity:not(.modtype_label) .activityiconcontainer img,
      body.path-course-view .course-content li.activity:not(.modtype_label) .activityiconcontainer .activityicon { display: none !important; }
      body.path-course-view .course-content li.activity:not(.modtype_label) .activityiconcontainer::before {
        content: var(--e, '📌'); font-size: 24px; line-height: 1;
      }
      body.path-course-view .course-content li.activity:not(.modtype_label):hover .activityiconcontainer { transform: rotate(-8deg) scale(1.12); }

      body.path-course-view .course-content li.modtype_assign   { --c: 330; --e: '📝'; }
      body.path-course-view .course-content li.modtype_resource { --c: 205; --e: '📄'; }
      body.path-course-view .course-content li.modtype_folder   { --c: 40;  --e: '📁'; }
      body.path-course-view .course-content li.modtype_url      { --c: 180; --e: '🔗'; }
      body.path-course-view .course-content li.modtype_page     { --c: 150; --e: '📃'; }
      body.path-course-view .course-content li.modtype_quiz     { --c: 265; --e: '🧠'; }
      body.path-course-view .course-content li.modtype_forum    { --c: 130; --e: '💬'; }
      body.path-course-view .course-content li.modtype_book     { --c: 20;  --e: '📖'; }
      body.path-course-view .course-content li.modtype_lesson   { --c: 290; --e: '🎓'; }
      body.path-course-view .course-content li.modtype_h5pactivity { --c: 300; --e: '🎯'; }
      body.path-course-view .course-content li.modtype_zoom,
      body.path-course-view .course-content li.modtype_bigbluebuttonbn { --c: 230; --e: '🎥'; }
      body.path-course-view .course-content li.modtype_attendance { --c: 100; --e: '✅'; }
      body.path-course-view .course-content li.modtype_choice,
      body.path-course-view .course-content li.modtype_feedback { --c: 55; --e: '🗳️'; }

      /* ---------- due-date chips ---------- */
      .cp-due {
        display: inline-block; margin-left: 10px; padding: 2px 10px; border-radius: 999px;
        font-size: .76rem; font-weight: 700; color: #fff; vertical-align: middle; white-space: nowrap;
      }
      .cp-due.hot   { background: hsl(0 78% 50%); animation: cp-pulse 1.6s infinite; }
      .cp-due.soon  { background: hsl(25 90% 48%); }
      .cp-due.week  { background: hsl(215 75% 50%); }
      .cp-due.later { background: hsl(145 55% 38%); }
      .cp-due.past  { background: hsl(220 10% 52%); }
      .cp-due.done  { background: hsl(145 63% 34%); }
      .cp-due.miss  { background: hsl(350 70% 45%); }

      /* ---------- activities you've already submitted ---------- */
      body.path-course-view .course-content li.cp-done { --c: 145; --e: '✅'; }
      body.path-course-view .course-content li.cp-done:not(.modtype_label) { background: #f1faf4 !important; }

      /* ================= ASSIGNMENT PAGE ================= */
      body.path-mod-assign td.submissionstatussubmitted, body.path-mod-assign td.earlysubmission {
        background: hsl(145 62% 34%) !important; color: #fff !important; font-weight: 700;
      }
      body.path-mod-assign td.submissionstatussubmitted::before { content: '✅ '; }
      body.path-mod-assign td.earlysubmission::before { content: '⏱️ '; }
      body.path-mod-assign td.latesubmission { background: hsl(28 88% 42%) !important; color: #fff !important; font-weight: 700; }
      body.path-mod-assign td.latesubmission::before { content: '⚠️ '; }
      body.path-mod-assign td.submissionstatusdraft { background: hsl(38 90% 40%) !important; color: #fff !important; font-weight: 700; }
      body.path-mod-assign td.submissionstatusdraft::before { content: '📝 '; }
      .cp-banner {
        display: flex; align-items: center; gap: 16px; border-radius: 18px; padding: 16px 20px; margin: 12px 0 18px; color: #fff;
        background: linear-gradient(135deg, hsl(var(--bh, 145) 62% 36%), hsl(calc(var(--bh, 145) + 20) 65% 28%));
        box-shadow: 0 8px 22px hsl(var(--bh, 145) 60% 28% / .35); animation: cp-pop .5s ease both;
      }
      .cp-banner-icon { font-size: 38px; line-height: 1; flex: none; }
      .cp-banner-title { font-size: 1.25rem; font-weight: 800; }
      .cp-banner-sub { font-size: .92rem; opacity: .92; margin-top: 2px; }
      .cp-banner-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      .cp-banner-chip { background: rgba(255,255,255,.2); padding: 4px 12px; border-radius: 999px; font-size: .82rem; font-weight: 600; }

      /* ---------- zoom pill + confetti ---------- */
      #cp-zoom {
        position: fixed; right: 74px; bottom: 22px; z-index: 99999; display: flex; align-items: center; gap: 2px;
        background: #1d2740; color: #fff; border-radius: 999px; padding: 3px;
        box-shadow: 0 6px 18px rgba(0,0,0,.3); font: 600 12px/1 system-ui, sans-serif;
      }
      #cp-zoom button { border: 0; background: transparent; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 16px; }
      #cp-zoom button:hover { background: rgba(255,255,255,.2); }
      #cp-zoom span { min-width: 42px; text-align: center; cursor: pointer; }
      .cp-confetti { position: fixed; z-index: 100000; pointer-events: none; font-size: 22px; animation: cp-fly .9s ease-out forwards; }

      @keyframes cp-pop   { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      @keyframes cp-pulse { 0%, 100% { box-shadow: 0 0 0 0 hsl(0 80% 50% / .5); } 50% { box-shadow: 0 0 0 7px hsl(0 80% 50% / 0); } }
      @keyframes cp-fly   { to { transform: translate(var(--dx), var(--dy)) rotate(var(--r)); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) {
        .cp-hero, body.path-course-view .course-content li.section.course-section, .cp-due { animation: none !important; }
      }

      /* ================= DARK MODE =================
         Whole page is inverted, then images/media/colored blocks are inverted back.
         Colors below are written in "pre-inversion" values (light gray here = dark on screen). */
      html.cp-dark { filter: invert(1) hue-rotate(180deg); background: #e4e4e4; }
      html.cp-dark img, html.cp-dark video, html.cp-dark canvas, html.cp-dark iframe,
      html.cp-dark svg image, html.cp-dark .cp-head, html.cp-dark #cp-theme-btn,
      html.cp-dark .userpicture, html.cp-dark [style*="background-image"],
      html.cp-dark .cp-hero, html.cp-dark .cp-due, html.cp-dark #cp-zoom, html.cp-dark .cp-confetti,
      html.cp-dark .cp-banner,
      html.cp-dark body.path-mod-assign td.submissionstatussubmitted, html.cp-dark body.path-mod-assign td.earlysubmission,
      html.cp-dark body.path-mod-assign td.latesubmission, html.cp-dark body.path-mod-assign td.submissionstatusdraft,
      html.cp-dark .course-content .course-section-header,
      html.cp-dark .course-content li.activity .activityiconcontainer {
        filter: invert(1) hue-rotate(180deg);
      }
      html.cp-dark .cp-card { background: #d2d2d2 !important; box-shadow: 0 2px 10px rgba(0,0,0,.25) !important; }
      html.cp-dark .cp-chip { background: #d2d2d2; border-color: #bbb; color: #222; }
      html.cp-dark .cp-chip.active { background: linear-gradient(135deg, #9679fc, #448bff); border-color: #9679fc; color: #000; box-shadow: 0 4px 14px rgba(150,121,252,.45); }
      html.cp-dark .cp-chip:hover { border-color: #5f53a8; color: #5f53a8; }
      html.cp-dark .cp-card .coursename:hover { color: #5f53a8 !important; }
      html.cp-dark .primary-navigation .nav-link { background: #d2d2d2 !important; border-color: #bbb !important; color: #222 !important; }
      html.cp-dark .primary-navigation .nav-link:hover, html.cp-dark .primary-navigation .nav-link:focus {
        border-color: #5f53a8 !important; color: #5f53a8 !important;
      }
      html.cp-dark .primary-navigation .nav-link.active, html.cp-dark .primary-navigation .nav-link[aria-current="true"],
      html.cp-dark .primary-navigation .nav-link.active:hover, html.cp-dark .primary-navigation .nav-link.active:focus {
        background: linear-gradient(135deg, #9679fc, #448bff) !important; border-color: #9679fc !important; color: #000 !important;
        box-shadow: 0 4px 14px rgba(150,121,252,.45);
      }
      html.cp-dark #cp-theme-btn { background: #e8e0c8; color: #111; }

      /* softer dark course page: dark gray instead of pure black, layered cards, calmer text */
      ${bm('#region-main', 'html.cp-dark ')} { color: #2a2a2a; }
      html.cp-dark body.path-course-view .course-content li.section.course-section {
        background: #dedede !important; border-right-color: #c9c9c9 !important;
        border-bottom-color: #c9c9c9 !important; border-left-color: #c9c9c9 !important;
        box-shadow: 0 4px 16px rgba(0,0,0,.18);
      }
      html.cp-dark body.path-course-view .course-content li.activity:not(.modtype_label) {
        background: #d2d2d2 !important; border-top-color: #c2c2c2 !important;
        border-right-color: #c2c2c2 !important; border-bottom-color: #c2c2c2 !important;
      }
      html.cp-dark body.path-course-view .course-content li.cp-done:not(.modtype_label) { background: #cfd8d2 !important; }

      /* ================= DEADLINE ALERT PANEL ================= */
      .cp-alert {
        position: fixed; top: 76px; right: 18px; z-index: 99998;
        width: min(400px, calc(100vw - 36px)); max-height: 72vh; overflow: auto;
        background: #1d2740; color: #fff; border-radius: 18px; padding: 14px 14px 10px;
        box-shadow: 0 14px 34px rgba(0,0,0,.35); animation: cp-pop .4s ease both;
      }
      .cp-al-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .cp-al-title { font-size: 1.05rem; font-weight: 800; }
      .cp-al-x { border: 0; background: rgba(255,255,255,.15); color: #fff; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; }
      .cp-al-x:hover { background: rgba(255,255,255,.3); }
      .cp-al-empty { padding: 10px 4px 14px; opacity: .9; font-size: .92rem; }
      .cp-al-row {
        display: flex; align-items: center; gap: 10px; padding: 9px 10px; margin: 6px 0;
        background: rgba(255,255,255,.08); border-radius: 12px; color: #fff !important; text-decoration: none !important;
        transition: background .15s, transform .15s;
      }
      .cp-al-row:hover { background: rgba(255,255,255,.16); transform: translateX(3px); }
      .cp-al-ico { font-size: 22px; flex: none; }
      .cp-al-mid { flex: 1; min-width: 0; }
      .cp-al-name { font-weight: 700; font-size: .92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cp-al-sub { font-size: .78rem; opacity: .8; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cp-al-chip { flex: none; padding: 2px 9px; border-radius: 999px; font-size: .74rem; font-weight: 700; color: #fff; white-space: nowrap; }
      .cp-al-chip.hot   { background: hsl(0 78% 50%); }
      .cp-al-chip.soon  { background: hsl(25 90% 48%); }
      .cp-al-chip.week  { background: hsl(215 75% 50%); }
      .cp-al-chip.later { background: hsl(145 55% 38%); }
      .cp-al-chip.miss  { background: hsl(350 70% 45%); }
      html.cp-dark .cp-alert { filter: invert(1) hue-rotate(180deg); }
      html.cp-dark #msa-toast-host { filter: invert(1) hue-rotate(180deg); }

      /* ---------- deadline button (top bar, next to the bell) ---------- */
      .cp-alert-btn {
        position: relative; display: inline-flex; align-items: center; justify-content: center; flex: none;
        width: 40px; height: 40px; margin: 0 6px; padding: 0; border-radius: 50%;
        border: 1px solid #d5dbea; background: #fff; color: #36415d; font-size: 19px; line-height: 1; cursor: pointer;
        transition: transform .18s ease, box-shadow .18s ease, border-color .15s, background .15s;
      }
      .cp-alert-btn:hover { border-color: #6d4fe0; transform: translateY(-2px); box-shadow: 0 8px 18px rgba(20,30,60,.18); }
      .cp-alert-btn:active { transform: scale(.94); box-shadow: none; }
      .cp-alert-btn.on { background: linear-gradient(135deg, #7a5af0, #3b82f6); border-color: #7a5af0; box-shadow: 0 4px 12px rgba(122,90,240,.35); }
      .cp-alert-btn-fixed { position: fixed; top: 12px; right: 96px; margin: 0; z-index: 99997; }
      .cp-al-badge {
        position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
        background: hsl(0 78% 50%); color: #fff; font: 700 11px/18px system-ui, sans-serif; text-align: center; display: none;
      }
      .cp-al-badge.show { display: block; }
      .cp-al-tools { display: flex; gap: 6px; }
      html.cp-dark .cp-alert-btn { background: #d2d2d2; border-color: #bbb; }
      html.cp-dark .cp-alert-btn.on { background: linear-gradient(135deg, #9679fc, #448bff); border-color: #9679fc; }
      html.cp-dark .cp-al-emo, html.cp-dark .cp-al-badge { filter: invert(1) hue-rotate(180deg); }
    `;
    if (!ANIMATE_BG) root.classList.add('cp-bg-still');
    const style = document.createElement('style');
    style.id = 'cp-style';
    style.textContent = css;
    document.head.appendChild(style);

    /* =====================================================
       DARK MODE TOGGLE (remembered between visits)
    ===================================================== */
    const KEY = 'cp-dark-mode';
    const saved = localStorage.getItem(KEY);
    let dark = saved === null ? true : saved === '1';      // dark by default
    const btn = document.createElement('button');
    btn.id = 'cp-theme-btn';
    btn.title = 'Toggle dark / light mode';
    const applyTheme = () => {
      root.classList.toggle('cp-dark', dark);
      btn.textContent = dark ? '☀️' : '🌙';
    };
    btn.onclick = () => { dark = !dark; localStorage.setItem(KEY, dark ? '1' : '0'); applyTheme(); };
    document.body.appendChild(btn);
    applyTheme();

    /* =====================================================
       SUBJECT THEMES
       Every subject gets its own seamless pattern (drawn from line icons that fit the subject),
       its own colours and its own emoji. Covers every MSA faculty:
       Computer Science, Engineering, Pharmacy, Dentistry, Physiotherapy, Biotechnology,
       Nutrition & Food, Management Sciences, Languages, Mass Communication, Arts & Design,
       plus the university requirement courses.
       First match wins, so specific subjects come before general ones.
    ===================================================== */

    // Arabic subject: your gold geometric pattern (256px seamless tile, embedded so no network request is needed)
    // >>> PASTE YOUR ORIGINAL VALUE BETWEEN THE QUOTES (the long 'data:image/webp;base64,...' string from your old script).
    // >>> If you leave it empty, Arabic courses use a generated pattern instead.
    const ARABIC_PATTERN = '';

    const gearD = (r, n, t) => {
      const p = [];
      for (let i = 0; i < n * 4; i++) {
        const a = (i / (n * 4)) * Math.PI * 2, rr = i % 4 < 2 ? r + t : r;
        p.push(`${(rr * Math.cos(a)).toFixed(1)} ${(rr * Math.sin(a)).toFixed(1)}`);
      }
      return `<path d="M${p.join('L')}Z"/><circle r="${(r * .35).toFixed(1)}"/>`;
    };

    // line icons, each drawn around (0,0) inside roughly a 40 x 40 box
    const ICON = {
      atom: '<ellipse rx="19" ry="7"/><ellipse rx="19" ry="7" transform="rotate(60)"/><ellipse rx="19" ry="7" transform="rotate(120)"/><circle r="3" fill="currentColor"/>',
      flask: '<path d="M-5-18h10M-3-18v12L-16 14a4 4 0 0 0 3.5 6h25a4 4 0 0 0 3.5-6L3-6v-12M-11 6h22"/>',
      tube: '<g transform="rotate(25)"><path d="M-5-18h10M-4-18v28a4 4 0 0 0 8 0v-28M-4 2h8"/></g>',
      gear: gearD(13, 8, 5),
      bolt: '<path d="M5-20L-10 3h9L-5 20 12-6H3z"/>',
      code: '<path d="M-8-12L-20 0l12 12M8-12L20 0 8 12M3-16l-6 32"/>',
      book: '<path d="M0-12Q-10-18-20-14v28Q-10 10 0 16 10 10 20 14v-28Q10-18 0-12zM0-12V16"/>',
      cap: '<path d="M0-14L-22-5 0 4 22-5zM-12-1v10q12 8 24 0v-10M22-5v12"/>',
      dna: '<path d="M-10-18C10-8-10 8 10 18M10-18C-10-8 10 8-10 18M-6-12h12M-8 0h16M-6 12h12"/>',
      cell: '<circle r="17"/><circle cx="-4" cy="-3" r="6"/><circle cx="9" cy="8" r="2" fill="currentColor"/><circle cx="8" cy="-9" r="2" fill="currentColor"/>',
      microscope: '<path d="M-3-18l8 4-6 16-8-4zM-9 6c-6 2-8 10 4 10h12c8 0 12-6 10-14M-16 18h26"/>',
      tooth: '<path d="M-13-8c0-9 7-10 13-7 6-3 13-2 13 7 0 9-4 9-5 19-1 6-5 6-6 0-1-4-1-5-2-5s-1 1-2 5c-1 6-5 6-6 0-1-10-5-10-5-19z"/>',
      pill: '<g transform="rotate(-40)"><rect x="-18" y="-8" width="36" height="16" rx="8"/><path d="M0-8v16"/></g>',
      cross: '<path d="M-5-17h10v12h12v10H5v12H-5V5h-12V-5h12z"/>',
      pulse: '<path d="M-20 2h9l4-10 7 20 5-14 3 4h12"/>',
      heart: '<path d="M0 16C-22 2-16-14-6-13c4 0 6 3 6 5 0-2 2-5 6-5 10-1 16 11-6 24z"/>',
      runner: '<circle cx="5" cy="-15" r="4"/><path d="M3-9L-3 3l8 5-2 11M-3 3l-11 3M3-9l11 5"/>',
      chart: '<path d="M-16 16V4M-6 16V-6M4 16V-2M14 16V-14M-20 18h38"/>',
      trend: '<path d="M-20 12l10-10 8 6 16-18M6-12h10v10"/>',
      coin: '<circle r="16"/><text y="8" font-size="20" text-anchor="middle" fill="currentColor" stroke="none" font-family="Georgia,serif">$</text>',
      briefcase: '<rect x="-18" y="-8" width="36" height="24" rx="3"/><path d="M-7-8v-5h14v5M-18 2h36"/>',
      megaphone: '<path d="M-16-4h8l16-10v28L-8 4h-8zM-8 4l2 12h6"/>',
      camera: '<rect x="-18" y="-10" width="36" height="26" rx="4"/><circle cy="3" r="7"/><path d="M-8-10l3-5h10l3 5"/>',
      clapper: '<rect x="-18" y="-4" width="36" height="20"/><path d="M-18-4l36-10M-8-7l-4-6M2-10l-4-6M12-13l-4-6"/>',
      mic: '<rect x="-6" y="-18" width="12" height="22" rx="6"/><path d="M-12-2a12 12 0 0 0 24 0M0 10v8M-6 18h12"/>',
      news: '<rect x="-18" y="-14" width="36" height="28" rx="2"/><path d="M-12-6h12M-12 0h12M-12 6h12M6-6h6v12H6z"/>',
      pen: '<path d="M-14 16l2-8L10-14l6 6L-6 14zM6-10l6 6"/>',
      palette: '<path d="M0-16C-14-16-20-4-16 6c3 8 12 6 12 0 0-4 4-5 8-3 10 4 16-6 14-12-2-6-10-7-18-7z"/><circle cx="-8" cy="-4" r="2"/><circle cx="0" cy="-9" r="2"/><circle cx="8" cy="-4" r="2"/>',
      bubble: '<path d="M-18-14h36v22H-2l-10 8V8h-6z"/><path d="M-10-5h20M-10 1h12"/>',
      globe: '<circle r="17"/><ellipse rx="7" ry="17"/><path d="M-17 0h34M-14-9h28M-14 9h28"/>',
      scales: '<path d="M0-18v32M-8 16h16M-16-12h32M-16-12l-7 16h14zM16-12l-7 16h14z"/>',
      temple: '<path d="M-18-8L0-18l18 10zM-14-6v18M-5-6v18M5-6v18M14-6v18M-20 14h40"/>',
      pyramid: '<path d="M0-16L20 14H-20zM0-16L-6 14M-10 2h20"/>',
      compass: '<circle r="3"/><path d="M0-3L-12 18M0-3l12 21M-8 8h16M0-3v-12"/>',
      ruler: '<path d="M-16 16V-16L16 16z"/><path d="M-16 6h6M-16-2h4M-16-10h6"/>',
      city: '<path d="M-18 16V-2h10v18M-8 16V-16h12v32M4 16V2h12v14M-20 16h40M-4-8h4M-4 0h4M-4 8h4"/>',
      house: '<path d="M-18 0L0-16l18 16M-14-2v18h28V-2M-4 16v-9h8v9"/>',
      bridge: '<path d="M-20 6h40M-12 6V-14M12 6V-14M-12-14Q0 4 12-14M-20 6Q-12-4-12-14M20 6Q12-4 12-14M-20 14h40"/>',
      helmet: '<path d="M-16 6a16 16 0 0 1 32 0zM-20 6h40M-3-10v6"/>',
      drop: '<path d="M0-18C12-2 14 4 14 8a14 14 0 0 1-28 0c0-4 2-10 14-26z"/>',
      flame: '<path d="M0-18C4-6 14-2 12 8a12 12 0 0 1-24 0C-12 2-6-2-4-8-2-4 0-6 0-18z"/>',
      therm: '<rect x="-4" y="-18" width="8" height="26" rx="4"/><circle cy="12" r="7"/><path d="M0-8v18"/>',
      net: '<circle cx="-14" cy="-8" r="4"/><circle cx="14" cy="-8" r="4"/><circle cy="14" r="4"/><path d="M-10-8h20M-12-4l10 14M12-4L2 10"/>',
      db: '<ellipse cy="-12" rx="15" ry="5"/><path d="M-15-12v24c0 6 30 6 30 0v-24M-15 0c0 6 30 6 30 0"/>',
      shield: '<path d="M0-18l15 5v10c0 10-6 15-15 19-9-4-15-9-15-19v-10z"/><path d="M-6 0l4 5 8-10"/>',
      lock: '<rect x="-12" y="-4" width="24" height="18" rx="3"/><path d="M-7-4v-6a7 7 0 0 1 14 0v6"/>',
      chip: '<rect x="-11" y="-11" width="22" height="22" rx="2"/><path d="M-6-17v6M0-17v6M6-17v6M-6 11v6M0 11v6M6 11v6M-17-6h6M-17 0h6M-17 6h6M11-6h6M11 0h6M11 6h6"/>',
      monitor: '<rect x="-18" y="-14" width="36" height="24" rx="3"/><path d="M-6 16h12M0 10v6"/>',
      phone: '<rect x="-9" y="-17" width="18" height="34" rx="3"/><path d="M-3 12h6"/>',
      cloud: '<path d="M-12 10a8 8 0 0 1 0-16 11 11 0 0 1 21-2 8 8 0 0 1 3 18z"/>',
      robot: '<rect x="-14" y="-10" width="28" height="22" rx="4"/><circle cx="-5" cy="0" r="3"/><circle cx="5" cy="0" r="3"/><path d="M0-10v-6M-8 12v4M8 12v4"/>',
      resistor: '<path d="M-20 0h8l3-8 6 16 6-16 3 8h8"/>',
      sine: '<path d="M-20 0q5-14 10 0t10 0 10 0 10 0"/>',
      magnet: '<path d="M-14 16V-2a14 14 0 0 1 28 0v18h-9V-2a5 5 0 0 0-10 0v18z"/>',
      bulb: '<path d="M-8 8a12 12 0 1 1 16 0c-3 3-3 5-3 8h-10c0-3 0-5-3-8zM-5 20h10"/>',
      planet: '<circle r="10"/><ellipse rx="20" ry="6" transform="rotate(-20)"/>',
      leaf: '<path d="M-16 14C-16-6 0-16 16-16 16 0 6 14-16 14zM-16 14L4-6"/>',
      sun: '<circle r="8"/><path d="M0-18v5M0 13v5M-18 0h5M13 0h5M-13-13l4 4M9 9l4 4M13-13l-4 4M-9 9l-4 4"/>',
      microbe: '<rect x="-14" y="-6" width="28" height="12" rx="6"/><path d="M-14-2h-5M-14 2h-5M14-2h5M14 2h5M-4-10v4M4-10v4M-4 6v4M4 6v4"/>',
      virus: '<circle r="9"/><path d="M0-9v-8M0 9v8M-9 0h-8M9 0h8M-6-6l-5-5M6 6l5 5M6-6l5-5M-6 6l-5 5"/>',
      users: '<circle cx="-8" cy="-8" r="6"/><circle cx="10" cy="-6" r="5"/><path d="M-20 16a12 12 0 0 1 24 0M4 16a9 9 0 0 1 16-4"/>',
      target: '<circle r="16"/><circle r="9"/><circle r="2.5" fill="currentColor"/>',
      cart: '<path d="M-20-14h6l4 22h20l4-16H-12"/><circle cx="-6" cy="14" r="2"/><circle cx="10" cy="14" r="2"/>',
      truck: '<path d="M-20 8V-8h22v16M2-4h10l8 8v4H2"/><circle cx="-10" cy="10" r="3"/><circle cx="10" cy="10" r="3"/>',
      calc: '<rect x="-12" y="-17" width="24" height="34" rx="3"/><path d="M-7-10h14M-7-2h3M0-2h3M7-2h0M-7 6h3M0 6h3M-7 12h3M0 12h3"/>',
      doc: '<path d="M-12-17h16l8 8v26h-24zM4-17v8h8M-6-2h12M-6 4h12M-6 10h8"/>',
      dumbbell: '<path d="M-18-6v12M-12-9v18M12-9v18M18-6v12M-12 0h24"/>',
      spine: '<rect x="-7" y="-18" width="14" height="7" rx="3"/><rect x="-8" y="-8" width="16" height="7" rx="3"/><rect x="-7" y="2" width="14" height="7" rx="3"/><rect x="-5" y="12" width="10" height="6" rx="3"/>',
      mask: '<path d="M-16-12h32v12c0 10-8 16-16 16S-16 10-16 0zM-9-4h5M4-4h5M-6 6q6 5 12 0"/>',
      note: '<path d="M-6 14V-12l16-4v26M-6 14a5 4 0 1 1-.1 0M10 10a5 4 0 1 1-.1 0"/>',
      flag: '<path d="M-14 18V-16M-14-14h26l-6 8 6 8h-26"/>',
      hourglass: '<path d="M-10-16h20M-10 16h20M-8-16c0 12 8 12 8 16s-8 4-8 16M8-16c0 12-8 12-8 16s8 4 8 16"/>',
      pin: '<path d="M0 18C-10 6-14 0-14-6a14 14 0 0 1 28 0c0 6-4 12-14 24z"/><circle cy="-6" r="5"/>',
      mountain: '<path d="M-20 16L-6-10l8 12 6-8L20 16z"/>',
      eye: '<path d="M-20 0Q0-18 20 0Q0 18-20 0z"/><circle r="5"/>',
      firstaid: '<rect x="-16" y="-8" width="32" height="24" rx="3"/><path d="M-6-8v-5h12v5M0 0v10M-5 5h10"/>',
      apple: '<path d="M0-8C-10-14-18-6-16 4c2 10 8 16 16 12 8 4 14-2 16-12 2-10-6-18-16-12zM0-8c0-5 2-8 6-10"/>',
      fork: '<path d="M-8-18v12a4 4 0 0 0 8 0v-12M-4-18v34M10-18c-6 4-6 14 0 16v18"/>',
      lamp: '<path d="M-10-16h20l6 20h-32zM0 4v12M-8 18h16"/>',
      chair: '<path d="M-8-16v18h16v-18M-12 2h24M-10 2v14M10 2v14"/>',
      hanger: '<path d="M0-14a4 4 0 1 1 4 4c-2 1-4 2-4 4v3L-18 14h36L0 4"/>',
      scissors: '<circle cx="-8" cy="12" r="4"/><circle cx="8" cy="12" r="4"/><path d="M-5 9L10-16M5 9L-10-16"/>',
      search: '<circle cx="-4" cy="-4" r="11"/><path d="M5 5l12 12"/>',
      curve: '<path d="M-20 14C-10 14-8-14 0-14S10 14 20 14M-22 16h44"/>',
      dice: '<rect x="-14" y="-14" width="28" height="28" rx="5"/><circle cx="-6" cy="-6" r="2" fill="currentColor"/><circle cx="6" cy="6" r="2" fill="currentColor"/><circle r="2" fill="currentColor"/>',
      cube: '<path d="M0-18L16-9v18L0 18-16 9V-9zM0 0v18M0 0L16-9M0 0L-16-9"/>',
      layers: '<path d="M0-16L20-6 0 4-20-6zM-20 2l20 10 20-10M-20 9l20 10 20-10"/>',
      antenna: '<path d="M0-4v22M-6 18h12M-8-12a11 11 0 0 0 0 16M8-12a11 11 0 0 1 0 16M-14-18a20 20 0 0 0 0 28M14-18a20 20 0 0 1 0 28"/><circle cy="-4" r="2.5" fill="currentColor"/>',
      pylon: '<path d="M0-18L-10 18M0-18L10 18M-6-4h12M-8 6h16M-14-10h28"/>',
      turbine: '<path d="M0 0v18M0 0L-3-16M0 0l14 8M0 0L-14 8"/><circle r="2.5" fill="currentColor"/>',
      theodolite: '<path d="M0-6L-12 18M0-6l12 24M0-6v24"/><rect x="-6" y="-16" width="12" height="10" rx="2"/>',
      gauge: '<path d="M-18 8a18 18 0 0 1 36 0M0 8L8-8M-18 8h4M18 8h-4M0-10v4"/>',
      head: '<path d="M-10 16V8c-8-4-10-14-4-22 6-6 18-4 22 4 3 6 1 10-2 13l1 5-6 2v6z"/>',
      tree: '<circle cy="-13" r="4"/><circle cx="-12" cy="4" r="4"/><circle cx="12" cy="4" r="4"/><path d="M-2-9L-10 0M2-9l8 9M-14 8l-4 8M-10 8l4 8"/>',
      gamepad: '<rect x="-20" y="-9" width="40" height="22" rx="10"/><path d="M-11-2v8M-15 2h8"/><circle cx="8" cy="0" r="1.5" fill="currentColor"/><circle cx="13" cy="4" r="1.5" fill="currentColor"/>',
    };

    // [pattern, emoji, background 1, background 2, accent colour, icons]
    const SUBJECTS = [
      // ---------- university requirements ----------
      [/arabic|عرب|نحو|بلاغة/i, '📖', '#0c4a43', '#062b2c', '#ffd166', 'IMG'],
      [/egypt\w*\s+(civil|histor|heritage)|pharaoh|حضارة مصر/i, '🏺', '#854d0e', '#3d2005', '#fde68a', ['pyramid', 'sun', 'temple', 'hourglass']],
      [/human rights|(?<!media\s)ethic|moral|citizenship|حقوق الإنسان|أخلاق/i, '🕊️', '#1e3a8a', '#0f1f4d', '#fde68a', ['scales', 'users', 'flag', 'bulb']],
      [/critical thinking|philosoph|reasoning|فلسف|منطق|تفكير/i, '💡', '#374151', '#111827', '#fcd34d', ['bulb', '~?', 'book', 'head']],
      [/communication skills|presentation|public speaking|soft skills|interpersonal|study skills|career|employab|مهارات/i, '🎤', '#0369a1', '#082f49', '#bae6fd', ['mic', 'bubble', 'users', 'bulb']],
      [/first aid|physical education|fitness|wellness|safety|اللياقة/i, '⛑️', '#b91c1c', '#450a0a', '#fecaca', ['firstaid', 'runner', 'heart', 'shield']],
      [/research|methodolog|thesis|dissertation|capstone|graduation project|بحث/i, '🔎', '#334155', '#0f172a', '#93c5fd', ['search', 'doc', 'chart', 'book']],

      // ---------- Computer Science ----------
      [/machine learning|artificial intel|deep learning|neural|\bai\b|ذكاء/i, '🤖', '#2e1065', '#12052e', '#c084fc', ['robot', 'head', 'net', 'bulb']],
      [/bioinformatic|computational bio/i, '🧬', '#134e4a', '#042f2e', '#5eead4', ['dna', 'code', 'db', 'chart']],
      [/cyber|security|crypt|forensic|hacking|أمن/i, '🛡️', '#1f1d3a', '#0b0a1d', '#f87171', ['shield', 'lock', 'code', 'chip']],
      [/management information|\bmis\b|\berp\b|information systems?|enterprise (system|resource)/i, '🖥️', '#155e75', '#083344', '#a5f3fc', ['monitor', 'db', 'briefcase', 'chart']],
      [/database|\bsql\b|data ?warehouse|big data|information retrieval|قواعد/i, '🗄️', '#0f3d3e', '#041f20', '#5eead4', ['db', 'cloud', 'code', 'chart']],
      [/data (science|mining|analy|visuali)|analytics/i, '📈', '#0f4c75', '#07263d', '#67e8f9', ['chart', 'db', '~∑', 'search']],
      [/network|internet of|\biot\b|cloud|distributed|wireless sens/i, '🌐', '#0a2540', '#050f1c', '#22d3ee', ['net', 'cloud', 'antenna', 'globe']],
      [/\bweb\b|html|front.?end|back.?end|internet computing|javascript/i, '🕸️', '#1e3a8a', '#0b1a4a', '#93c5fd', ['globe', 'code', 'monitor', 'net']],
      [/mobile|android|\bios\b|app development/i, '📱', '#0f766e', '#042f2e', '#99f6e4', ['phone', 'code', 'cloud', 'bulb']],
      [/game|computer graphics|animation|3d|virtual real|augmented|human.computer|\bhci\b|\bux\b|user (interface|experience)/i, '🎮', '#4c1d95', '#1e0a4a', '#f0abfc', ['gamepad', 'cube', 'palette', 'monitor']],
      [/operating system|computer (architecture|organi)|logic design|digital (logic|system)|microprocessor|microcontroller|embedded|assembly|\bvlsi\b/i, '🔌', '#14532d', '#052e16', '#bef264', ['chip', 'code', 'gear', 'bolt']],
      [/software|agile|requirement|\buml\b|devops|systems? (analysis|design)|object.oriented|design pattern/i, '🧩', '#164e63', '#083344', '#67e8f9', ['code', 'gear', 'doc', 'tree']],
      [/algorithm|data struct|discrete|automata|theory of computation|compiler/i, '🧮', '#1e293b', '#0b1220', '#38bdf8', ['tree', 'code', '~∑', 'net']],

      // ---------- Mass Communication ----------
      [/journal|news|reporting|editing|\bpress\b|صحاف/i, '📰', '#1f2937', '#0b0f19', '#fca5a5', ['news', 'pen', 'mic', 'bubble']],
      [/broadcast|radio\b|television|\btv\b|podcast|webcast|audio|إذاعة|تلفزيون/i, '📻', '#7f1d1d', '#3b0a0a', '#fecaca', ['mic', 'antenna', 'camera', 'clapper']],
      [/public relation|\bpr\b|advertis|campaign|corporate communication|marketing communication|copywrit|إعلان|علاقات عامة/i, '📣', '#86198f', '#3b0764', '#f5d0fe', ['megaphone', 'target', 'bubble', 'bulb']],
      [/photograph|camera|cinematograph|تصوير/i, '📷', '#27272a', '#09090b', '#e4e4e7', ['camera', 'bulb', 'eye', 'sun']],
      [/\bfilms?\b|cinema|theat|stage|screenwrit|scriptwrit|video production|فيلم|سينما|مسرح/i, '🎬', '#450a0a', '#1c0404', '#fcd34d', ['clapper', 'mask', 'camera', '~★']],
      [/social media|digital (media|journalism|storytelling|content)|multimedia|new media|content (creation|strateg)|mass comm|\bmedia\b|إعلام|اعلام/i, '📱', '#1d4ed8', '#0b1f66', '#bfdbfe', ['phone', 'bubble', 'globe', 'camera']],

      // ---------- Arts & Design (specific) ----------
      [/fashion|textile|garment|costume|pattern making|apparel|fabric|أزياء/i, '👗', '#9d174d', '#500724', '#fbcfe8', ['hanger', 'scissors', 'palette', 'pen']],
      [/interior|furniture|space planning|decor|ديكور/i, '🛋️', '#78350f', '#2d1405', '#fed7aa', ['chair', 'lamp', 'house', 'ruler']],

      // ---------- Dentistry, Physiotherapy, Pharmacy, Biotechnology ----------
      [/dental|dentist|\boral\b|endodont|periodont|orthodont|prosthodont|tooth|teeth|caries|أسنان/i, '🦷', '#0e7490', '#083344', '#e0f2fe', ['tooth', 'cross', 'shield', 'bulb']],
      [/physical therapy|physiotherap|kinesio|biomechanic|rehabilit|exercise|orthop|sports|musculo|electrotherap|manual therapy|علاج طبيعي/i, '🏃', '#c2410c', '#431407', '#fed7aa', ['runner', 'dumbbell', 'spine', 'pulse']],
      [/pharmacolog|toxicolog|drug|therapeutic|pharmacotherap/i, '💊', '#4c1d95', '#1e0a4a', '#d8b4fe', ['pill', 'pulse', 'cell', 'flask']],
      [/pharmaceut|dosage|formulation|biopharm|pharmacokinetic|cosmetic/i, '⚗️', '#0f766e', '#042f2e', '#99f6e4', ['pill', 'tube', 'flask', 'drop']],
      [/medicinal|pharmacognos|phytochem|natural product|herbal|botan|plant (biology|science|physiolog)/i, '🌿', '#166534', '#052e16', '#bbf7d0', ['leaf', 'flask', 'pill', 'sun']],
      [/clinical|pharmacy|pharmacist|hospital|patient|صيدل/i, '⚕️', '#115e59', '#042f2e', '#99f6e4', ['cross', 'pill', 'heart', 'pulse']],
      [/biotech|bioprocess|fermentation|tissue|genetic engineering|bioreactor/i, '🧫', '#0e7490', '#083344', '#a5f3fc', ['dna', 'tube', 'cell', 'bulb']],

      // ---------- Engineering ----------
      [/engineering draw|technical draw|descriptive geom|\bcad\b|autocad|revit|رسم/i, '📐', '#1e3a5f', '#0b1b30', '#93c5fd', ['ruler', 'compass', 'cube', 'pen']],
      [/biomedical|medical (device|instrument|electronic|imaging)/i, '🩻', '#0f766e', '#042f2e', '#a7f3d0', ['pulse', 'chip', 'heart', 'gear']],
      [/telecom|signals?\b|antenna|microwave|radar|communications?\b|information theory|\bdsp\b|اتصالات/i, '📡', '#1e3a8a', '#0f1f4d', '#93c5fd', ['antenna', 'sine', 'chip', 'globe']],
      [/electronic|analog|semiconductor|amplifier|\bpcb\b|إلكترون|الكترون/i, '🔌', '#064e3b', '#022c22', '#fcd34d', ['chip', 'resistor', 'bolt', 'sine']],
      [/physic\w*\s*(ii\b|2\b)|electromagnet|electricity|electric (circuit|field)|circuit|magnet|كهرب|دوائر/i, '⚡', '#2b1b6b', '#14093a', '#fde047', ['bolt', 'magnet', 'resistor', 'sine']],
      [/electrical machine|power (system|electronic|plant|engineer)|high voltage|transformer|renewable|solar|wind energy|energy|قوى/i, '🔋', '#713f12', '#2e1a07', '#fde047', ['pylon', 'turbine', 'sun', 'bolt']],
      [/mechatron|robot|actuator|drone/i, '🦾', '#334155', '#0f172a', '#5eead4', ['robot', 'gear', 'chip', 'bolt']],
      [/control|automat|servo|\bplc\b|instrumentation|sensors?/i, '🎛️', '#334155', '#0f172a', '#5eead4', ['gauge', 'gear', 'sine', 'chip']],
      [/industrial|operations research|production|manufactur|workshop|lean\b|six sigma|ergonomic|facility|supply chain|logistic|inventory|quality|ورشة|إنتاج/i, '🏭', '#44403c', '#1c1917', '#fcd34d', ['gear', 'truck', 'gauge', 'calc']],
      [/thermo|\bheat|combustion|refrigerat|air.?condition|hvac|حرار/i, '🔥', '#7c1d12', '#3a0b06', '#fdba74', ['flame', 'therm', 'gear', 'drop']],
      [/fluid|hydraul|pneumat|hydrolog|water|pump|turbomachin|موائع|مياه/i, '💧', '#0c4a6e', '#06263a', '#7dd3fc', ['drop', 'gauge', 'sine', 'gear']],
      [/geotech|soil|foundation|survey|geodes|highway|transport|traffic|road/i, '🧭', '#57534e', '#1c1917', '#fdba74', ['theodolite', 'layers', 'mountain', 'pin']],
      [/mechanic|dynamic|statics|kinematic|machine (design|element)|vibration|strength of material|stress|ميكانيك/i, '⚙️', '#3a3f47', '#1c1f24', '#fb923c', ['gear', 'gauge', 'flame', 'ruler']],
      [/material|metal|crystal|polymer|ceramic|corrosion|مواد|معادن/i, '🧱', '#3f3f46', '#18181b', '#a5b4fc', ['cube', 'layers', 'atom', 'gear']],
      [/architect|urban|planning|landscape|housing|عمارة|معمار|عمران/i, '🏛️', '#374151', '#111827', '#e7e5e4', ['house', 'city', 'ruler', 'compass']],
      [/structur|concrete|steel|civil|bridge|construction|مدني|إنشاء|خرسانة/i, '🏗️', '#5b3a1a', '#2c1a0a', '#fbbf24', ['bridge', 'city', 'helmet', 'ruler']],
      [/environment|sustainab|climate|ecolog|waste|pollution|بيئة/i, '🌱', '#166534', '#052e16', '#bbf7d0', ['leaf', 'globe', 'drop', 'sun']],

      // ---------- basic medical / life sciences ----------
      [/biochem|molecular|genetic|\bdna\b|genom|cell biology|proteom|enzym|\bgene\b/i, '🧬', '#0e7490', '#083344', '#a5f3fc', ['dna', 'cell', 'tube', 'flask']],
      [/microb|bacteri|virolog|parasit|mycolog|infect|antibiotic|فيروس|ميكروب/i, '🦠', '#365314', '#1a2e05', '#d9f99d', ['microbe', 'virus', 'microscope', 'tube']],
      [/immun|serolog/i, '🛡️', '#9f1239', '#4c0519', '#fda4af', ['shield', 'cell', 'virus', 'cross']],
      [/anatom|physiolog|histolog|embryolog|patholog|cytolog|hematolog|radiolog/i, '🫀', '#7f1d1d', '#3b0a0a', '#fecaca', ['heart', 'spine', 'head', 'microscope']],
      [/\bbio|zoolog|life science|أحياء|احياء|بيولوج/i, '🔬', '#166534', '#052e16', '#bbf7d0', ['cell', 'leaf', 'dna', 'microscope']],
      [/nutrition|food|diet|culinary|gastronom|bakery|غذاء|تغذية/i, '🥗', '#3f6212', '#1a2e05', '#fde68a', ['apple', 'leaf', 'fork', 'flask']],
      [/medic|surgery|health|nursing|emergency|epidemiolog|(^|\s)طب(\s|$)|صحة/i, '🩺', '#b91c1c', '#450a0a', '#fee2e2', ['cross', 'pulse', 'firstaid', 'heart']],

      // ---------- basic sciences ----------
      [/astro|space|aero|satellite|فلك|فضاء/i, '🚀', '#1e1b4b', '#0a0820', '#c7d2fe', ['planet', 'sun', 'atom', 'bulb']],
      [/physic|quantum|nuclear|optic|wave|فيزياء/i, '⚛️', '#1e2a78', '#0e1544', '#7dd3fc', ['atom', 'sine', 'planet', 'magnet']],
      [/chem|organic|كيمياء/i, '🧪', '#14532d', '#052e16', '#bef264', ['flask', 'atom', 'tube', 'drop']],
      [/statistic|probab|biostat|إحصاء|احصاء|احتمال/i, '📊', '#0f4c75', '#07263d', '#67e8f9', ['curve', 'chart', '~σ', 'dice']],
      [/math|calculus|algebra|geometr|differential|numerical|trigon|optimi[sz]|رياضيات|تفاضل|تكامل|جبر/i, '🧮', '#3b1d6e', '#1b0c3a', '#f0abfc', ['~∑', '~π', '~∫', '~∞']],

      // ---------- general computing ----------
      [/program|coding|computer (science|skills|application)|computing|informat|\bit\b|\bict\b|برمج|حاسب|حاسوب/i, '💻', '#0b2a3f', '#04121e', '#38f5a1', ['code', 'monitor', '~{ }', 'chip']],

      // ---------- Languages ----------
      [/translat|interpret|subtitl|ترجمة/i, '🌍', '#0f766e', '#042f2e', '#99f6e4', ['bubble', '~Aa', 'globe', 'book']],
      [/linguist|phonetic|phonolog|syntax|semantic|morpholog|pragmatic|discourse|لغويات/i, '🗣️', '#7c2d12', '#2d1405', '#fed7aa', ['bubble', 'mic', '~Aa', 'book']],
      [/french|français|francais/i, '🗼', '#1e3a8a', '#0b1a4a', '#fca5a5', ['bubble', '~é', 'book', 'pen']],
      [/german|deutsch/i, '🏰', '#292524', '#0c0a09', '#fcd34d', ['bubble', '~ß', 'book', 'pen']],
      [/spanish|español|espanol/i, '💃', '#b91c1c', '#450a0a', '#fde047', ['bubble', '~ñ', 'book', 'pen']],
      [/italian/i, '🍕', '#166534', '#052e16', '#fca5a5', ['bubble', '~à', 'book', 'pen']],
      [/chinese|mandarin/i, '🏮', '#991b1b', '#450a0a', '#fde047', ['bubble', '~你', 'book', 'pen']],
      [/japanese/i, '🗾', '#9f1239', '#4c0519', '#fecdd3', ['bubble', '~あ', 'book', 'pen']],
      [/russian/i, '🪆', '#1e3a8a', '#0f1f4d', '#e2e8f0', ['bubble', '~Ж', 'book', 'pen']],
      [/turkish/i, '🕌', '#b91c1c', '#450a0a', '#fef3c7', ['bubble', '~ğ', 'book', 'pen']],
      [/english|writing|composition|grammar|reading|speaking|essay|ielts|academic|tefl|teaching|pedagog|انجليز|إنجليز/i, '✍️', '#78350f', '#2d1405', '#fde68a', ['book', 'pen', 'bubble', '~Aa']],
      [/literatur|poetry|drama|novel|shakespear|folklore|comparative|أدب/i, '📚', '#581c87', '#2e1065', '#e9d5ff', ['book', 'mask', 'pen', '~“']],
      [/language|لغة/i, '🗣️', '#0369a1', '#082f49', '#bae6fd', ['bubble', '~Aa', 'globe', 'book']],

      // ---------- Law, Management Sciences ----------
      [/\blaws?\b|legal|legislat|constitution|jurisprud|contract|قانون|حقوق/i, '⚖️', '#422006', '#1c0d03', '#fcd34d', ['scales', 'doc', 'temple', 'flag']],
      [/account|audit|bookkeep|\btax|costing|محاسب/i, '🧾', '#14532d', '#052e16', '#86efac', ['calc', 'coin', 'doc', 'chart']],
      [/financ|invest|banking|\bbank|insurance|portfolio|capital|stock|monetary|fintech|مال/i, '💰', '#064e3b', '#022c22', '#6ee7b7', ['coin', 'trend', 'chart', 'briefcase']],
      [/econom|trade|اقتصاد/i, '📊', '#1e40af', '#0b1f66', '#fcd34d', ['trend', 'coin', 'globe', 'chart']],
      [/marketing|consumer|sales|retail|brand|e-?commerce|تسويق/i, '🛍️', '#9d174d', '#500724', '#fbcfe8', ['megaphone', 'cart', 'target', 'chart']],
      [/human resource|\bhr\b|organi[sz]ational|leadership|negotiation|personnel|recruit|موارد بشرية/i, '🧑‍🤝‍🧑', '#6b21a8', '#2e0a4f', '#e9d5ff', ['users', 'target', 'bulb', 'briefcase']],
      [/manage|business|entrepreneur|strateg|project|operations|administration|enterprise|startup|innovation|إدارة|ادارة/i, '💼', '#1e3a5f', '#0b1b30', '#fcd34d', ['briefcase', 'target', 'users', 'chart']],

      // ---------- Humanities ----------
      [/politic|government|diplomac|international relations|public policy|سياس/i, '🏛️', '#1e3a8a', '#0f1f4d', '#bfdbfe', ['flag', 'globe', 'users', 'scales']],
      [/sociolog|anthropolog|\bsocial|society|community|population|gender|اجتماع/i, '👥', '#365314', '#1a2e05', '#d9f99d', ['users', 'globe', 'bubble', 'heart']],
      [/psycholog|neuro|cogniti|behavio|counsel|mental|نفس/i, '🧠', '#581c87', '#2e1065', '#e9d5ff', ['head', 'bulb', 'eye', 'heart']],
      [/histor|archaeolog|ancient|civiliz|heritage|تاريخ|حضارة/i, '🏛️', '#78350f', '#2d1405', '#fde68a', ['temple', 'hourglass', 'pyramid', 'book']],
      [/geograph|geolog|geospatial|\bgis\b|earth|جغراف|جيولوج/i, '🌍', '#0f766e', '#042f2e', '#99f6e4', ['globe', 'pin', 'mountain', 'compass']],
      [/music|singing|choir|موسيق/i, '🎵', '#581c87', '#2e1065', '#e9d5ff', ['note', 'sine', 'mic', '~♪']],

      // ---------- Arts & Design (general) ----------
      [/graphic|typograph|illustrat|visual|layout|logo|colou?r|design|\barts?\b|paint|sculpt|aesthetic|(^|\s)فن(ون)?(\s|$)/i, '🎨', '#6d28d9', '#2e1065', '#ddd6fe', ['palette', 'pen', 'ruler', 'bulb']],
    ];
    const DEFAULT_SUBJECT = [null, '📘', '#1e3a8a', '#0f1f4d', '#93c5fd', ['book', 'cap', 'bulb', 'target']];

    const subjectFor = (text) => SUBJECTS.find(([re]) => re.test(text)) || DEFAULT_SUBJECT;
    const iconFor = (text) => subjectFor(text)[1];

    // 160 x 160 seamless tile: four subject icons + tiny sparkles, nothing touches the tile edge
    function tileSvg(s) {
      const slots = [[40, 40, -10], [120, 40, 9], [40, 120, 8], [120, 120, -9]];
      const names = s[5];
      const glyph = (n) => (n[0] === '~'
        ? `<text y="9" font-size="27" text-anchor="middle" font-family="Georgia,'Segoe UI',serif" fill="currentColor" stroke="none">${n.slice(1)}</text>`
        : (ICON[n] || ICON.bulb));
      const g = slots.map(([x, y, r], i) => `<g transform="translate(${x} ${y}) rotate(${r})">${glyph(names[i % names.length])}</g>`).join('');
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">' +
        `<g color="${s[4]}" stroke="currentColor" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">` +
        `<g opacity=".92">${g}</g>` +
        '<g fill="currentColor" stroke="none" opacity=".5"><circle cx="80" cy="80" r="2.6"/><circle cx="80" cy="30" r="1.6"/><circle cx="80" cy="130" r="1.6"/><circle cx="30" cy="80" r="1.6"/><circle cx="130" cy="80" r="1.6"/></g>' +
        '</g></svg>';
    }

    const hexRgb = (h, k = 1) => [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * k)).join(',');
    const patCache = {};
    // paints a course card header / course banner with its subject theme (colours, accent, pattern)
    function themeNode(node, text) {
      const s = subjectFor(text);
      const isImg = s[5] === 'IMG';
      const useImg = isImg && ARABIC_PATTERN;
      const tile = isImg ? [s[0], s[1], s[2], s[3], s[4], ['book', 'pen', 'bubble', '~ع']] : s;
      const key = s[2] + s[4] + (isImg ? 'IMG' : s[5]);
      const url = useImg
        ? `url("${ARABIC_PATTERN}")`
        : (patCache[key] || (patCache[key] = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(tileSvg(tile))}")`));
      node.classList.add('cp-pat');
      node.style.setProperty('--pat', url);
      node.style.setProperty('--p1', s[2]);
      node.style.setProperty('--p2', s[3]);
      node.style.setProperty('--acc', hexRgb(s[4]));
      node.style.setProperty('--dk', hexRgb(s[3], .45));
    }

    /* =====================================================
       HELPERS
    ===================================================== */
    const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

    // Real visible course name (ignores hidden screen-reader text and title attribute)
    function getName(link) {
      const ml = link.querySelector('.multiline');
      if (ml && ml.textContent.trim()) return ml.textContent.replace(/\s+/g, ' ').trim();
      const clone = link.cloneNode(true);
      clone.querySelectorAll('.sr-only, .visually-hidden, .accesshide, .sr-only-focusable, .visually-hidden-focusable')
        .forEach((n) => n.remove());
      return clone.textContent.replace(/\s+/g, ' ').replace(/^Course name\s*/i, '').trim();
    }

    function parseTitle(raw) {
      const m = raw.match(/^\s*([A-Z]{2,4}\s?\d{2,4}[A-Za-z]?(?:\s*\/\s*[A-Z]{2,4}\s?\d{2,4}[A-Za-z]?)*)\s*[-–:]\s*(.+)$/);
      if (m) return { code: m[1].replace(/\s+/g, ''), title: m[2].trim() };
      const m2 = raw.match(/\(\s*([A-Z]{2,4}\s?\d{2,4})/);
      if (m2) {
        return { code: m2[1].replace(/\s+/g, ''), title: raw.replace(/\s*\(.*$/, '').trim() };
      }
      return { code: '', title: raw.trim() };
    }

    // Subject name only: strips course codes like GSE022/BSC162 and de-duplicates "Chemistry - Chemistry"
    const CODE_RE = /[A-Z]{2,4}\s?\d{2,4}[A-Za-z]?(?:\s*\/\s*[A-Z]{2,4}\s?\d{2,4}[A-Za-z]?)*/g;
    // Course code(s) found anywhere in the title, e.g. "GSE022/BSC162"
    function codeOf(raw) {
      const m = raw.match(CODE_RE) || [];
      return [...new Set(m.map((x) => x.replace(/\s+/g, '')))].join(' · ');
    }
    function cleanName(raw) {
      const parts = raw.replace(CODE_RE, ' ').replace(/\(\s*\)/g, ' ')
        .split(/\s[-–:]\s|^\s*[-–:]\s|\s[-–:]\s*$/)
        .map((x) => x.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      const uniq = [];
      parts.forEach((x) => { if (!uniq.some((u) => u.toLowerCase() === x.toLowerCase())) uniq.push(x); });
      if (!uniq.length) return raw.trim();
      return uniq.sort((a, b) => b.length - a.length)[0];
    }

    // Areas that must never be turned into cards (sidebar, nav, course sections...)
    const EXCLUDE =
      '[data-region="drawer"], [data-region="drawer-container"], .drawer, #theme_boost-drawers-courseindex, ' +
      '.courseindex, nav, .navbar, .breadcrumb, .secondary-navigation, .course-content, ' +
      '.activity, .section, [data-for="section"], [data-region="blocks-column"], #block-region-side-pre';

    const isCourseLink = (a) => {
      const href = a.getAttribute('href') || '';
      return /course\/view\.php/.test(href) && !/[?&]section=/.test(href) && !/#section/.test(href) && !a.closest(EXCLUDE);
    };

    const getLink = (el) => {
      const cn = el.querySelector('.coursename');
      if (cn && !cn.closest(EXCLUDE)) return cn;
      return [...el.querySelectorAll('a[href*="course/view.php"]')].find(isCourseLink) || null;
    };

    function findCards() {
      const set = new Set();
      document.querySelectorAll('a[href*="course/view.php"]').forEach((a) => {
        if (!isCourseLink(a)) return;
        let el = a;
        while (el.parentElement && el.parentElement !== document.body) {
          const p = el.parentElement;
          if (p.matches(EXCLUDE)) break;
          const n = [...p.children].filter((c) => [...c.querySelectorAll('a[href*="course/view.php"]')].some(isCourseLink)).length;
          if (n >= 2) { set.add(el); break; }
          el = p;
        }
      });
      if (!set.size) {
        document.querySelectorAll('[data-region="course-content"], .dashboard-card, .course-card')
          .forEach((c) => { if (!c.closest(EXCLUDE)) set.add(c); });
      }
      return [...set].filter((c) => getLink(c));
    }

    /* =====================================================
       DASHBOARD: ENHANCE CARDS
    ===================================================== */
    function enhance() {
      const cards = findCards().filter((c) => !c.dataset.cp);
      if (!cards.length) return;
      LOG('cards found:', cards.length);

      cards.forEach((card) => {
        card.dataset.cp = '1';
        card.classList.add('cp-card');
        card.parentElement.classList.add('cp-grid');

        const link = getLink(card);
        const raw = getName(link);
        const cat = (card.querySelector('.categoryname')?.textContent || '').trim();
        const { code } = parseTitle(raw);
        const name = cleanName(raw);
        const codeTxt = codeOf(raw);
        const first = code.split('/')[0];

        const head = document.createElement('div');
        head.className = 'cp-head';
        head.style.setProperty('--h', hash(first || cat || raw) % 360);
        themeNode(head, name + ' ' + raw);

        const left = document.createElement('div'); left.className = 'cp-left';
        const ic = document.createElement('div'); ic.className = 'cp-icon'; ic.textContent = iconFor(raw);
        const cd = document.createElement('div'); cd.className = 'cp-code'; cd.textContent = name; cd.title = codeTxt ? `${name} (${codeTxt})` : name;
        const txtBox = document.createElement('div'); txtBox.className = 'cp-txt';
        txtBox.append(cd);
        if (codeTxt) {
          const sc = document.createElement('div'); sc.className = 'cp-subcode'; sc.textContent = codeTxt;
          txtBox.append(sc);
        }
        left.append(ic, txtBox);

        const bd = document.createElement('span'); bd.className = 'cp-badge';
        bd.textContent = cat.replace(/\s*\(.*?\)\s*/g, '') || 'Course';

        head.append(left, bd);
        card.prepend(head);

        card.dataset.cpCat = cat || 'Other';
        link.title = raw;
        const label = link.querySelector('.multiline') || link;
        label.textContent = name;
      });
      buildChips();
    }

    function buildChips() {
      const cards = [...document.querySelectorAll('.cp-card[data-cp-cat]')];
      if (!cards.length) return;
      const cats = [...new Set(cards.map((c) => c.dataset.cpCat))].sort();
      let bar = document.getElementById('cp-chips');
      const sig = cats.join('|') + cards.length;
      if (bar && bar.dataset.sig === sig) return;
      const active = bar?.querySelector('.active')?.dataset.cat || 'All';
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'cp-chips';
        cards[0].parentElement.parentElement.insertBefore(bar, cards[0].parentElement);
      }
      bar.dataset.sig = sig;
      bar.innerHTML = '';
      ['All', ...cats].forEach((cat) => {
        const b = document.createElement('button');
        b.className = 'cp-chip' + (cat === active ? ' active' : '');
        b.dataset.cat = cat;
        const n = cat === 'All' ? cards.length : cards.filter((c) => c.dataset.cpCat === cat).length;
        b.textContent = `${cat} (${n})`;
        b.onclick = () => {
          bar.querySelectorAll('.cp-chip').forEach((x) => x.classList.toggle('active', x === b));
          cards.forEach((c) => (c.style.display = cat === 'All' || c.dataset.cpCat === cat ? '' : 'none'));
        };
        bar.appendChild(b);
      });
    }

    /* =====================================================
       COURSE PAGE: hero banner, colorful weeks, due chips, zoom
    ===================================================== */
    const SEC_EMOJI = ['🚀', '📚', '🧠', '🎯', '🔬', '🎨', '⚡', '🌟', '🧩', '🛠️'];
    const TIPS = [
      'Small steps every day beat all-nighters. ☕',
      'Future you says thanks for starting today. 🚀',
      'Submit early, sleep well. 😴',
      'Deadlines are just plot twists. Plan ahead. 🎬',
      'One lab at a time. You’ve got this. 💪',
      'Save your file. Save it again. Then once more. 💾',
      'Done is good. Done and named correctly is better. 📝',
      'Hydrate, then iterate. 💧',
    ];

    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };

    // "Tuesday, 27 October 2026, 11:00 AM" -> Date
    function parseMoodleDate(s) {
      const t = s.replace(/^[A-Za-z]+,\s*/, '').replace(/,/g, '').trim();
      const d = new Date(t);
      return isNaN(d) ? null : d;
    }
    function rel(ms) {
      const h = ms / 36e5;
      if (h < 1) return Math.max(1, Math.round(ms / 6e4)) + ' min';
      if (h < 24) return Math.round(h) + 'h';
      return Math.ceil(ms / 864e5) + 'd';
    }
    function chipFor(ts) {
      const ms = ts - Date.now();
      if (ms < 0) return { cls: 'past', txt: '⌛ Closed ' + rel(-ms) + ' ago' };
      if (ms < 864e5) return { cls: 'hot', txt: '🔥 ' + rel(ms) + ' left' };
      if (ms < 3 * 864e5) return { cls: 'soon', txt: '⏰ ' + rel(ms) + ' left' };
      if (ms < 7 * 864e5) return { cls: 'week', txt: '📅 ' + rel(ms) + ' left' };
      return { cls: 'later', txt: '🗓️ in ' + rel(ms) };
    }

    function confetti(x, y) {
      const E = ['🎉', '✨', '⭐', '🎓', '📚', '💡'];
      for (let i = 0; i < 16; i++) {
        const s = el('span', 'cp-confetti', E[i % E.length]);
        const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 110;
        s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 40}px;--r:${(Math.random() * 720 - 360) | 0}deg`;
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 1000);
      }
    }

    // the whole block Moodle uses for its photo header (photo wrapper + card + breadcrumb + title);
    // climbs to the outermost wrapper that holds neither the course content nor the tabs
    function headerBlock() {
      const cc = document.querySelector('.course-content');
      if (!cc) return null;
      const hdr = document.querySelector('#page-header');
      const h1 = [...document.querySelectorAll('h1')].find((h) => !h.closest('#cp-hero'));
      let e = hdr && !hdr.contains(cc) ? hdr : h1;
      if (!e) return null;
      while (e.parentElement && e.parentElement !== document.body &&
             !e.parentElement.contains(cc) && !e.parentElement.querySelector('.secondary-navigation')) {
        e = e.parentElement;
      }
      return e;
    }

    // belt and braces: no photo background / image may survive anywhere around the banner
    function stripPhotos() {
      const hero = document.getElementById('cp-hero');
      if (!hero) return;
      for (let a = hero.parentElement; a && a !== document.body; a = a.parentElement) {
        if (!a.classList.contains('cp-nophoto')) a.classList.add('cp-nophoto');
      }
    }

    function buildHero(sections, total, upcoming, assigns, known, done) {
      const main = document.querySelector('#region-main');
      if (!main) return;
      upcoming.sort((a, b) => a.ts - b.ts);
      const next = upcoming[0];
      const sig = [sections, total, upcoming.length, next && next.ts, assigns, known, done].join('|');
      let hero = document.getElementById('cp-hero');
      if (hero && hero.dataset.sig === sig) return;

      const h1 = document.querySelector('.page-header-headings h1, #page-header h1, h1');
      const name = ((h1 && h1.textContent) || document.title).replace(/\s+/g, ' ').replace(/^Course:\s*/i, '').trim();

      if (!hero) {
        hero = el('div', 'cp-hero'); hero.id = 'cp-hero';
        const blk = headerBlock();
        if (blk && blk.parentElement) {
          blk.parentElement.insertBefore(hero, blk);
          blk.classList.add('cp-hdr-hidden');
          hero.classList.add(main.contains(hero) ? 'cp-hero-in' : 'cp-hero-out');
        } else {
          main.prepend(hero);
        }
      }
      hero.dataset.sig = sig;
      hero.style.setProperty('--h', hash(name) % 360);
      themeNode(hero, name);
      hero.textContent = '';

      const top = el('div', 'cp-hero-top');
      const em = el('div', 'cp-hero-emoji', iconFor(name));
      em.title = 'Click me 🎉';
      em.onclick = (e) => confetti(e.clientX, e.clientY);
      const txt = el('div');
      const tipTxt = TIPS[Math.floor(Date.now() / 864e5) % TIPS.length];
      const heroCode = codeOf(name);
      const heroName = heroCode ? cleanName(name) : name;
      const crumbLinks = [...document.querySelectorAll('.breadcrumb a')].filter((a) => !a.closest('#cp-hero')).slice(0, 2);
      if (crumbLinks.length) {
        const cr = el('div', 'cp-hero-crumbs');
        crumbLinks.forEach((a, i) => {
          if (i) cr.append(el('span', '', '/'));
          const l = el('a', '', a.textContent.trim());
          l.href = a.href;
          cr.append(l);
        });
        txt.append(cr);
      }
      txt.append(el('div', 'cp-hero-title', heroName), el('div', 'cp-hero-tip', heroCode || tipTxt));
      top.append(em, txt);

      const chips = el('div', 'cp-hero-chips');
      chips.append(el('span', 'cp-hero-chip', `📅 ${sections} ${sections === 1 ? 'week' : 'weeks'}`));
      chips.append(el('span', 'cp-hero-chip', `📚 ${total} items`));
      chips.append(el('span', 'cp-hero-chip',
        upcoming.length ? `⏰ ${upcoming.length} upcoming deadline${upcoming.length > 1 ? 's' : ''}` : '🎉 No upcoming deadlines'));
      if (assigns && known === assigns) {
        chips.append(el('span', 'cp-hero-chip',
          done === assigns ? '🏆 All assignments submitted!' : `✅ ${done}/${assigns} assignments submitted`));
      }
      if (next) {
        const nm = next.name.length > 38 ? next.name.slice(0, 36) + '…' : next.name;
        chips.append(el('span', 'cp-hero-chip', `🎯 Next: ${nm} · ${rel(next.ts - Date.now())} left`));
      }
      if (heroCode) chips.append(el('span', 'cp-hero-chip tip', tipTxt));
      const headBox = el('div', 'cp-hero-head');
      headBox.append(el('div', 'cp-hero-art'), top);
      hero.append(headBox, chips);
    }

    /* ---------- submission status (assignments) ---------- */
    const subKey = (id) => 'cp-sub-' + id;
    function cachedStatus(id) {
      try {
        const o = JSON.parse(localStorage.getItem(subKey(id)));
        if (o && Date.now() - o.t < 15 * 60e3) return o.s;
      } catch (e) { /* ignore */ }
      return null;
    }
    function saveStatus(id, st) {
      try { localStorage.setItem(subKey(id), JSON.stringify({ s: st, t: Date.now() })); } catch (e) { /* ignore */ }
    }
    function cmidOf(href) {
      try { return new URL(href, location.href).searchParams.get('id'); } catch (e) { return null; }
    }
    // works on a fetched document or on the live page
    function statusFromDoc(doc) {
      if (doc.querySelector('.submissionstatussubmitted')) return 'submitted';
      if (doc.querySelector('.submissionstatusdraft')) return 'draft';
      if (doc.querySelector('.submissionstatustable')) return 'none';
      return null;
    }
    function doneByCompletion(li) {
      if (li.querySelector('[data-toggletype="manual:undo"]')) return true;
      const ci = li.querySelector('[data-region="completion-info"]');
      return !!(ci && /^\s*Done\b/i.test(ci.textContent));
    }

    const inflight = new Set();
    const queue = [];
    let active = 0;
    function enqueue(li, id, href) {
      if (inflight.has(id)) return;
      inflight.add(id);
      queue.push({ li, id, href });
      pump();
    }
    function pump() {
      while (active < 2 && queue.length) {
        const j = queue.shift();
        active++;
        fetch(j.href, { credentials: 'same-origin' })
          .then((r) => (r.ok ? r.text() : null))
          .then((html) => {
            if (!html) return;
            const st = statusFromDoc(new DOMParser().parseFromString(html, 'text/html'));
            if (!st) return;
            saveStatus(j.id, st);
            j.li.dataset.cpSub = st;
            paint(j.li);
            refreshHero();
          })
          .catch(() => {})
          .finally(() => { active--; pump(); });
      }
    }

    function initStatus(li, link) {
      if (li.dataset.cpChecked || !li.dataset.cpTs) return;          // only activities with a date
      li.dataset.cpChecked = '1';
      if (doneByCompletion(li)) { li.dataset.cpSub = 'submitted'; return; }
      if (!li.classList.contains('modtype_assign') || !link) return;
      const id = cmidOf(link.href);
      if (!id) return;
      const cached = cachedStatus(id);
      if (cached) { li.dataset.cpSub = cached; return; }
      if (CHECK_SUBMISSIONS) enqueue(li, id, link.href);
    }

    // write only when something changed (keeps the MutationObserver quiet)
    function paint(li) {
      const st = li.dataset.cpSub;
      li.classList.toggle('cp-done', st === 'submitted');
      li.querySelectorAll('.cp-due').forEach((chip) => {
        const ts = +chip.dataset.ts;
        let c;
        if (st === 'submitted') c = { cls: 'done', txt: '✅ Done' };
        else if (st === 'draft') c = { cls: 'soon', txt: '📝 Draft – not submitted' };
        else if (st === 'none' && ts < Date.now()) c = { cls: 'miss', txt: '⚠️ Not submitted' };
        else c = chipFor(ts);
        const cls = 'cp-due ' + c.cls;
        if (chip.className !== cls) chip.className = cls;
        if (chip.textContent !== c.txt) chip.textContent = c.txt;
      });
    }

    function refreshHero() {
      const content = document.querySelector('.course-content');
      if (!content) return;
      let sections = 0, total = 0, assigns = 0, known = 0, done = 0;
      const upcoming = [];
      content.querySelectorAll('li.section.course-section').forEach((li) => {
        if (parseInt(li.dataset.number, 10) > 0) sections++;
      });
      content.querySelectorAll('li.activity').forEach((li) => {
        if (!li.classList.contains('modtype_label')) total++;
        const st = li.dataset.cpSub;
        if (li.classList.contains('modtype_assign') && li.dataset.cpTs) {
          assigns++;
          if (st) known++;
          if (st === 'submitted') done++;
        }
        const ts = +li.dataset.cpTs;
        if (ts > Date.now() && st !== 'submitted') upcoming.push({ ts, name: li.dataset.cpName || '' });
      });
      buildHero(sections, total, upcoming, assigns, known, done);
    }

    /* ---------- assignment page: big green "submitted" banner ---------- */
    function enhanceAssign() {
      const box = document.querySelector('.submissionstatustable');
      if (!box) return;
      const st = statusFromDoc(document);
      const id = new URL(location.href).searchParams.get('id');
      if (st && id) saveStatus(id, st);                              // keeps the course page in sync
      if (!st || document.getElementById('cp-banner')) return;

      const cellText = (sel) => {
        const c = box.querySelector(sel);
        return c ? c.textContent.replace(/\s+/g, ' ').trim() : '';
      };
      const timing = cellText('td.earlysubmission, td.latesubmission');
      const when = (timing.match(/submitted\s+(.+)$/i) || [])[1] || timing;
      const files = [...box.querySelectorAll('td')].map((td) => td.textContent.match(/\b(\d+)\s+files?\b/i)).find(Boolean);
      const modified = cellText('td.submissionlastmodified');

      const cfg = {
        submitted: { h: 145, icon: '✅', title: 'Submitted for grading', sub: 'You’re all set. Nothing more to do here 🎉' },
        draft:     { h: 38,  icon: '📝', title: 'Draft saved, not submitted yet', sub: 'Press “Submit assignment” when you’re ready.' },
        none:      { h: 5,   icon: '📤', title: 'Nothing submitted yet', sub: 'Upload your file and press Save / Submit.' },
      }[st];

      const b = el('div', 'cp-banner');
      b.id = 'cp-banner';
      b.style.setProperty('--bh', cfg.h);
      const txt = el('div');
      txt.append(el('div', 'cp-banner-title', cfg.title), el('div', 'cp-banner-sub', cfg.sub));
      const chips = el('div', 'cp-banner-chips');
      if (st === 'submitted') {
        if (files) chips.append(el('span', 'cp-banner-chip', `📎 ${files[1]} file${files[1] === '1' ? '' : 's'}`));
        if (when) chips.append(el('span', 'cp-banner-chip', (/late/i.test(when) ? '⚠️ ' : '⏱️ ') + when));
        if (modified) chips.append(el('span', 'cp-banner-chip', '🕒 ' + modified));
      }
      if (chips.childElementCount) txt.append(chips);
      b.append(el('div', 'cp-banner-icon', cfg.icon), txt);
      const h = box.querySelector('h2, h3, h4');
      if (h) h.after(b); else box.prepend(b);
    }

    function enhanceCourse() {
      const content = document.querySelector('.course-content');
      if (!content) return;
      const isWeeks = /weeks/.test(body.id);

      // sections
      let sectionCount = 0;
      content.querySelectorAll('li.section.course-section').forEach((li, idx) => {
        const n = parseInt(li.dataset.number, 10);
        const num = isNaN(n) ? idx : n;
        if (num > 0) sectionCount++;
        if (!li.dataset.cpSec) {
          li.dataset.cpSec = '1';
          li.style.setProperty('--sh', (num * 47 + 200) % 360);
          li.style.setProperty('--i', Math.min(idx, 12));
        }
        const hdr = li.querySelector('.course-section-header');
        const title = hdr && hdr.querySelector('.sectionname');
        if (title && !hdr.querySelector('.cp-secbadge')) {
          const label = num === 0
            ? '📌 Start here'
            : `${SEC_EMOJI[(num - 1) % SEC_EMOJI.length]} ${isWeeks ? 'Week' : 'Topic'} ${num}`;
          title.parentElement.insertBefore(el('span', 'cp-secbadge', label), title);
        }
      });

      // activities + due-date chips + submission status
      content.querySelectorAll('li.activity').forEach((li) => {
        const link = li.querySelector('.activityname a, a.aalink');
        if (link && !li.dataset.cpName) li.dataset.cpName = getName(link);
        li.querySelectorAll('[data-region="activity-dates"] div').forEach((d) => {
          if (d.querySelector('div')) return;                         // skip wrappers
          if (d.dataset.cpDue) return;
          const txt = d.textContent.trim();
          if (!/^(Due|Closes?):/i.test(txt)) return;
          const dt = parseMoodleDate(txt.replace(/^[A-Za-z]+:\s*/, ''));
          if (!dt) return;
          const ts = dt.getTime();
          d.dataset.cpDue = ts;
          const chip = el('span', 'cp-due');
          chip.dataset.ts = ts;
          d.appendChild(chip);
          if (/^Due:/i.test(txt) || !li.dataset.cpTs) li.dataset.cpTs = ts;
        });
        initStatus(li, link);
        paint(li);
      });
      refreshHero();
    }

    /* ---------- zoom control (remembered) ---------- */
    if (isCourse || isMod) {
      const ZK = 'cp-zoom';
      let zoom = parseFloat(localStorage.getItem(ZK));
      if (!(zoom >= 0.6 && zoom <= 1.3)) zoom = 0.9;
      const pill = el('div'); pill.id = 'cp-zoom';
      const minus = el('button', '', '−'); minus.title = 'Zoom out';
      const plus = el('button', '', '+');  plus.title = 'Zoom in';
      const label = el('span'); label.title = 'Reset to 90%';
      const setZoom = (z) => {
        zoom = Math.min(1.3, Math.max(0.6, Math.round(z * 100) / 100));
        root.style.setProperty('--cp-zoom', zoom);
        localStorage.setItem(ZK, zoom);
        label.textContent = Math.round(zoom * 100) + '%';
      };
      minus.onclick = () => setZoom(zoom - 0.05);
      plus.onclick = () => setZoom(zoom + 0.05);
      label.onclick = () => setZoom(0.9);
      pill.append(minus, label, plus);
      document.body.appendChild(pill);
      setZoom(zoom);
    }

    /* =====================================================
       DEADLINE ALERT (button in the top bar, next to the bell)
    ===================================================== */
    const isMyCourses = /^page-my-(courses|index)$/.test(body.id) || /\/my\/(courses\.php)?\/?$/.test(location.pathname);
    const COURSES_KEY = 'cp-courses';
    let autoDone = false, autoT, scanning = false, lastScan = null;     // lastScan = { t, todo }

    // course list: live cards when visible, otherwise the list remembered from My courses
    function liveCourses() {
      return [...document.querySelectorAll('.cp-card')].map((c) => {
        const l = getLink(c);
        return l && { subject: l.title || getName(l), href: l.href || (l.closest('a') || {}).href };
      }).filter((c) => c && c.href);
    }
    function saveCourses() {
      const c = liveCourses();
      if (!c.length) return;
      try {
        const j = JSON.stringify(c);
        if (localStorage.getItem(COURSES_KEY) !== j) localStorage.setItem(COURSES_KEY, j);
      } catch (e) { /* ignore */ }
    }
    function getCourses() {
      const live = liveCourses();
      if (live.length) return live;
      try { return JSON.parse(localStorage.getItem(COURSES_KEY)) || []; } catch (e) { return []; }
    }

    async function fetchDoc(href) {
      const r = await fetch(href, { credentials: 'same-origin' });
      if (!r.ok) return null;
      return new DOMParser().parseFromString(await r.text(), 'text/html');
    }

    // run fn over list with at most n requests at once
    async function pool(list, n, fn) {
      let i = 0;
      await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => {
        while (i < list.length) await fn(list[i++]);
      }));
    }

    // all dated assignments in a fetched course page
    function scanCourse(doc, subject, force) {
      const out = [];
      doc.querySelectorAll('li.activity.modtype_assign').forEach((li) => {
        const link = li.querySelector('.activityname a, a.aalink');
        if (!link) return;
        let ts = null;
        li.querySelectorAll('[data-region="activity-dates"] div').forEach((d) => {
          if (d.querySelector('div')) return;
          const txt = d.textContent.trim();
          if (!/^Due:/i.test(txt)) return;
          const dt = parseMoodleDate(txt.replace(/^[A-Za-z]+:\s*/, ''));
          if (dt) ts = dt.getTime();
        });
        if (!ts) return;
        const href = new URL(link.getAttribute('href'), location.href).href;
        const id = cmidOf(href);
        out.push({
          name: getName(link), ts, href, id, subject,
          status: doneByCompletion(li) ? 'submitted' : (!force && id && cachedStatus(id)) || null,
        });
      });
      return out;
    }

    // read every course, work out what is still pending (force = ignore the 15-minute status cache)
    async function collect(force) {
      const items = [];
      await pool(getCourses(), 3, async (c) => {
        try {
          const doc = await fetchDoc(c.href);
          if (doc) items.push(...scanCourse(doc, c.subject, force));
        } catch (e) { /* ignore */ }
      });

      const now = Date.now();
      const recent = (a) => a.ts > now - 7 * 864e5;
      if (CHECK_SUBMISSIONS) {
        await pool(items.filter((a) => !a.status && a.id && recent(a)), 3, async (a) => {
          try {
            const doc = await fetchDoc(a.href);
            const st = doc && statusFromDoc(doc);
            if (st) { a.status = st; saveStatus(a.id, st); }
          } catch (e) { /* ignore */ }
        });
      }

      // upcoming (not submitted) + recently overdue and definitely not submitted
      return items
        .filter((a) => a.status !== 'submitted')
        .filter((a) => a.ts > now || (recent(a) && (a.status === 'none' || a.status === 'draft')))
        .sort((a, b) => a.ts - b.ts);
    }

    /* ---------- button ---------- */
    const alertPanel = () => document.getElementById('cp-alert');
    function setBtnOn(on) {
      const b = document.getElementById('cp-alert-btn');
      if (b) b.classList.toggle('on', on);
    }
    function updateBadge(n) {
      const bd = document.querySelector('#cp-alert-btn .cp-al-badge');
      if (!bd) return;
      bd.textContent = n > 99 ? '99+' : String(n);
      bd.classList.toggle('show', n > 0);
    }
    function closeAlert() {
      const p = alertPanel();
      if (p) p.remove();
      setBtnOn(false);
    }

    function mountAlertBtn() {
      const bell = document.querySelector('#nav-notification-popover-container');
      let b = document.getElementById('cp-alert-btn');
      if (!b) {
        b = el('button', 'cp-alert-btn');
        b.id = 'cp-alert-btn';
        b.type = 'button';
        b.title = 'Assignment deadlines';
        b.setAttribute('aria-label', 'Assignment deadlines');
        b.append(el('span', 'cp-al-emo', '⏰'), el('span', 'cp-al-badge'));
        b.onclick = () => (alertPanel() ? closeAlert() : openAlert(false));
        if (lastScan) { /* keep badge after a re-mount */ setTimeout(() => updateBadge(lastScan.todo.length), 0); }
      }
      const host = bell ? bell.parentElement : document.querySelector('#usernavigation');
      if (host) {
        b.classList.remove('cp-alert-btn-fixed');
        if (b.parentElement !== host || (bell && b.nextElementSibling !== bell)) {
          if (bell) host.insertBefore(b, bell); else host.prepend(b);
        }
      } else if (!b.parentElement) {
        b.classList.add('cp-alert-btn-fixed');                   // fallback: floating, top right
        document.body.appendChild(b);
      }
    }

    /* ---------- panel ---------- */
    function setBody(panel, ...nodes) {
      panel.textContent = '';
      const head = el('div', 'cp-al-head');
      const tools = el('div', 'cp-al-tools');
      const rf = el('button', 'cp-al-x', '🔄');
      rf.title = 'Check again';
      rf.onclick = () => openAlert(true);
      const x = el('button', 'cp-al-x', '✕');
      x.title = 'Close';
      x.onclick = closeAlert;
      tools.append(rf, x);
      head.append(el('div', 'cp-al-title', '⏰ Assignment deadlines'), tools);
      panel.append(head, ...nodes);
    }

    function renderTodo(panel, todo) {
      if (!todo.length) {
        setBody(panel, el('div', 'cp-al-empty', '🎉 No pending assignment deadlines. Nice!'));
        return;
      }
      const now = Date.now();
      const rows = todo.map((a) => {
        const subjectName = cleanName(a.subject);
        const overdue = a.ts < now;
        const c = overdue ? { cls: 'miss', txt: '⚠️ Overdue ' + rel(now - a.ts) } : chipFor(a.ts);
        const when = new Date(a.ts).toLocaleString([], {
          weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        const row = el('a', 'cp-al-row');
        row.href = a.href;
        const mid = el('div', 'cp-al-mid');
        mid.append(
          el('div', 'cp-al-name', a.name),
          el('div', 'cp-al-sub', `${subjectName} · ${when}${a.status === 'draft' ? ' · 📝 draft' : ''}`)
        );
        row.append(el('div', 'cp-al-ico', iconFor(a.subject)), mid, el('span', 'cp-al-chip ' + c.cls, c.txt.replace(/^⌛ /, '')));
        return row;
      });
      setBody(panel, ...rows);
    }

    // open the panel; reuses the last result if it is under 3 minutes old, force = check everything again
    async function openAlert(force) {
      let panel = alertPanel();
      if (!panel) {
        panel = el('div', 'cp-alert');
        panel.id = 'cp-alert';
        document.body.appendChild(panel);
      }
      setBtnOn(true);

      if (scanning) { setBody(panel, el('div', 'cp-al-empty', 'Checking your courses…')); return; }
      if (!force && lastScan && Date.now() - lastScan.t < 3 * 60e3) { renderTodo(panel, lastScan.todo); return; }
      if (!getCourses().length) {
        setBody(panel, el('div', 'cp-al-empty', 'Open “My courses” once so I can learn your course list, then press this button again.'));
        return;
      }

      scanning = true;
      setBody(panel, el('div', 'cp-al-empty', 'Checking your courses…'));
      try {
        const todo = await collect(force);
        lastScan = { t: Date.now(), todo };
        updateBadge(todo.length);
        const cur = alertPanel();                                // may have been closed / re-opened meanwhile
        if (cur) renderTodo(cur, todo);
      } catch (e) {
        const cur = alertPanel();
        if (cur) setBody(cur, el('div', 'cp-al-empty', '⚠️ Couldn’t check your courses. Press 🔄 to try again.'));
      } finally {
        scanning = false;
      }
    }

    /* =====================================================
       RUN
    ===================================================== */
    function hideMore() {
      document.querySelectorAll('.primary-navigation .nav-item').forEach((li) => {
        if (/^\s*more\s*$/i.test(li.textContent)) li.style.setProperty('display', 'none', 'important');
      });
    }

    const run = () => {
      hideMore();
      if (enableCards) { enhance(); saveCourses(); }
      mountAlertBtn();
      if (isCourse) { enhanceCourse(); stripPhotos(); }
      if (isAssign) enhanceAssign();
      // on My courses / Dashboard: once the cards have loaded, open the deadline panel automatically (one time)
      if (isMyCourses && !autoDone) {
        clearTimeout(autoT);
        autoT = setTimeout(() => {
          if (!document.querySelector('.cp-card')) return;
          autoDone = true;
          openAlert(false);
        }, 1500);
      }
    };
    let t;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 200); })
      .observe(document.body, { childList: true, subtree: true });
    run();
    LOG('v6.0 loaded | ' + (isCourse ? 'course page' : enableCards ? 'cards ON' : 'inside course/activity'));
  }

  /* =====================================================
     AUTO LOGIN (merged from "MSA E-Learning Auto Login" v1.8)
     Only runs on e-learning.msa.edu.eg. The saved login is also used by the
     notifier to log in silently in the background when the session expires.
  ===================================================== */
  const USER_KEY = 'msa_username';
  const PASS_KEY = 'msa_password';

  function initAutoLogin() {
    const TRIED_FLAG = 'msa_autologin_tried';
    const log = (...a) => console.log('[MSA autologin]', ...a);

    function findElements() {
      const passInput = document.querySelector('input[type="password"]');
      if (!passInput) return null;
      const form = passInput.closest('form');
      if (!form) return null;
      const userInput =
        form.querySelector('#username, input[name="username"], #login_form__username') ||
        form.querySelector('input[type="text"], input[type="email"]');
      const submitBtn =
        form.querySelector('#loginbtn, button[type="submit"], input[type="submit"], button.smscButton');
      if (!userInput || !submitBtn) return null;
      return { form, userInput, passInput, submitBtn };
    }

    // Not on the login page: if logged out, jump to the login page
    if (!location.pathname.startsWith('/login/')) {
      setTimeout(() => {
        const loginLink =
          document.querySelector('a[href*="/login/index.php"]') ||
          Array.from(document.querySelectorAll('a')).find((a) => /^\s*log\s*in\s*$/i.test(a.textContent));
        const hasLogout = !!document.querySelector('a[href*="logout.php"]');
        const loggedOut = document.body.classList.contains('notloggedin') || !hasLogout;
        if (loginLink && loggedOut) {
          log('logged out, clicking the Log in button');
          loginLink.click();
        } else {
          log('no redirect: loginLink =', !!loginLink, ', hasLogout =', hasLogout);
        }
      }, 500);
      return;
    }

    // Wait up to 15 seconds for the login form to appear
    let attempts = 0;
    const timer = setInterval(() => {
      const els = findElements();
      attempts++;
      if (els) {
        clearInterval(timer);
        log('login form found');
        fillAndSubmit(els);
      } else if (attempts >= 75) {
        clearInterval(timer);
        log('no login form on this page');
        sessionStorage.removeItem(TRIED_FLAG);
      }
    }, 200);

    function fillAndSubmit({ form, userInput, passInput, submitBtn }) {
      function setValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      function addBanner(message, withReset) {
        const box = document.createElement('div');
        box.style.cssText = 'text-align:center;margin:10px auto;color:#c00;';
        const p = document.createElement('p');
        p.textContent = message;
        box.append(p);
        if (withReset) {
          const b = document.createElement('button');
          b.id = 'msa-reset'; b.type = 'button'; b.textContent = 'Reset saved login data';
          b.addEventListener('click', () => {
            GM_deleteValue(USER_KEY);
            GM_deleteValue(PASS_KEY);
            sessionStorage.removeItem(TRIED_FLAG);
            location.reload();
          });
          box.append(b);
        }
        form.insertAdjacentElement('beforebegin', box);
      }

      const savedUser = GM_getValue(USER_KEY);
      const savedPass = GM_getValue(PASS_KEY);

      if (!savedUser || !savedPass) {
        addBanner('Enter your login details once and press login. They will be saved for next time.', false);
        const saveNow = (source) => {
          if (userInput.value && passInput.value) {
            GM_setValue(USER_KEY, userInput.value);
            GM_setValue(PASS_KEY, passInput.value);
            log('login data saved (' + source + ')');
          } else {
            log('nothing saved (' + source + '): a field is empty');
          }
        };
        form.addEventListener('submit', () => saveNow('submit'), true);
        submitBtn.addEventListener('click', () => saveNow('click'), true);
        form.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveNow('enter'); }, true);
        return;
      }

      // Loop guard: stop if Moodle shows a login error, or after 3 tries in a minute
      const now = Date.now();
      let history = [];
      try {
        const parsed = JSON.parse(sessionStorage.getItem(TRIED_FLAG) || '[]');
        if (Array.isArray(parsed)) history = parsed.filter((t) => now - t < 60000);
      } catch (e) { /* ignore */ }
      const hasError = !!document.querySelector('#loginerrormessage, .loginerrors');

      if (hasError || history.length >= 3) {
        log('not auto-filling. error shown:', hasError, ', recent tries:', history.length);
        addBanner('Auto-login failed. If your saved login data is wrong, reset it.', true);
        return;
      }

      history.push(now);
      sessionStorage.setItem(TRIED_FLAG, JSON.stringify(history));
      addBanner('Logging in automatically…', true);

      let tries = 0;
      let stable = 0;
      const filler = setInterval(() => {
        tries++;
        const cur = findElements();   // look the fields up again, in case the page replaced them
        if (!cur) return;

        if (cur.userInput.value !== savedUser) setValue(cur.userInput, savedUser);
        if (cur.passInput.value !== savedPass) setValue(cur.passInput, savedPass);

        if (cur.userInput.value === savedUser && cur.passInput.value === savedPass) stable++;
        else stable = 0;

        if (stable >= 4) {
          clearInterval(filler);
          log('fields filled and stable, submitting');
          cur.submitBtn.click();
        } else if (tries >= 60) {
          clearInterval(filler);
          log('could not fill the fields after', tries, 'checks');
          addBanner('Could not fill the login fields. Try reloading the page.', false);
        }
      }, 150);
    }
  }

  /* =====================================================
     MSA NOTIFIER: announcements + bell alerts as pop-ups on ANY website
  ===================================================== */
  function initNotifier() {
    // ---------- SETTINGS ----------
    const CONFIG = {
      checkEveryMinutes: 5,
      importantWords: ['assignment', 'deadline', 'due', 'overdue', 'quiz', 'submission', 'exam', 'midterm', 'project'],
      toastMaxChars: 700,     // how much text the on-page pop-up shows
      systemMaxChars: 250     // how much text the system notification shows
    };
    // ------------------------------

    const BASE = 'https://e-learning.msa.edu.eg';
    const ON_ELEARNING = location.hostname === 'e-learning.msa.edu.eg';
    const ON_MOODLE = !!isMoodle();

    const COURSES_KEY = 'msa_courses';
    const SEEN_KEY = 'msa_seen';
    const BELL_KEY = 'msa_bell_seen';
    const TOAST_KEY = 'msa_toast';
    const LOCK_KEY = 'msa_lock';
    const LAST_KEY = 'msa_last_check';
    const WARN_KEY = 'msa_login_warn';
    const LOGIN_TRY_KEY = 'msa_bg_login';
    const DISCOVER_KEY = 'msa_discovered';
    const TAB_ID = Math.random().toString(36).slice(2);

    const load = (k, d) => { try { const v = JSON.parse(GM_getValue(k, 'null')); return v === null || v === undefined ? d : v; } catch (e) { return d; } };
    const save = (k, v) => GM_setValue(k, JSON.stringify(v));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const isImportant = (t) => CONFIG.importantWords.some((w) => t.toLowerCase().includes(w));

    function htmlToText(html) {
      const s = (html || '').replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n');
      const t = new DOMParser().parseFromString(s, 'text/html').body.textContent || '';
      return t.split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean).join('\n');
    }

    // ---------- Network (works from any website) ----------
    function request(url, opts = {}) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: opts.method || 'GET',
          url: url,
          headers: opts.headers || {},
          data: opts.body,
          timeout: 30000,
          onload: resolve,
          onerror: () => reject(new Error('network error')),
          ontimeout: () => reject(new Error('timeout'))
        });
      });
    }

    async function fetchDoc(url) {
      const r = await request(url);
      if (/\/login\//.test(r.finalUrl || '')) throw new Error('NOT_LOGGED_IN');
      return new DOMParser().parseFromString(r.responseText, 'text/html');
    }

    // ---------- Silent background login (uses the login saved by the auto login) ----------
    async function backgroundLogin() {
      const user = GM_getValue(USER_KEY, '');
      const pass = GM_getValue(PASS_KEY, '');
      if (!user || !pass) return false;

      const last = load(LOGIN_TRY_KEY, { t: 0, fails: 0 });
      if (Date.now() - last.t < 60000) return false;                              // never hammer the server
      if (last.fails >= 2 && Date.now() - last.t < 6 * 3600 * 1000) return false; // wrong password? stop for a while
      save(LOGIN_TRY_KEY, { t: Date.now(), fails: last.fails });

      try {
        const page = await request(`${BASE}/login/index.php`);
        if (!/\/login\//.test(page.finalUrl || '')) { save(LOGIN_TRY_KEY, { t: Date.now(), fails: 0 }); return true; }
        const doc = new DOMParser().parseFromString(page.responseText, 'text/html');
        const pw = doc.querySelector('input[type="password"]');
        const form = pw && pw.closest('form');
        if (!form) return false;
        const u = form.querySelector('#username, input[name="username"], #login_form__username') ||
                  form.querySelector('input[type="text"], input[type="email"]');

        const data = new URLSearchParams();
        form.querySelectorAll('input[type="hidden"]').forEach((i) => { if (i.name) data.set(i.name, i.value); });
        data.set((u && u.name) || 'username', user);
        data.set(pw.name || 'password', pass);
        const action = new URL(form.getAttribute('action') || '/login/index.php', `${BASE}/login/index.php`).href;

        const r = await request(action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: data.toString()
        });
        const ok = !/\/login\//.test(r.finalUrl || '') && !/loginerrormessage/.test(r.responseText || '');
        save(LOGIN_TRY_KEY, { t: Date.now(), fails: ok ? 0 : last.fails + 1 });
        console.log('[MSA notifier] Background login', ok ? 'worked' : 'failed');
        return ok;
      } catch (e) {
        console.warn('[MSA notifier] Background login error:', e);
        return false;
      }
    }

    // run fn; if the session turned out to be expired, log in silently and run it once more
    async function authed(fn) {
      try { return await fn(); } catch (e) {
        if (e.message !== 'NOT_LOGGED_IN') throw e;
        if (!(await backgroundLogin())) throw e;
        return await fn();
      }
    }

    // ---------- Pop-up UI: same look as the deadline panel, on whatever site you are on ----------
    // Lives in a shadow root so no website's CSS can change it.
    const TOAST_CSS = `
      :host { all: initial; }
      .box { display: flex; flex-direction: column; gap: 10px; width: 360px; max-width: calc(100vw - 36px);
             font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; direction: ltr; }
      .toast {
        position: relative; overflow: hidden; display: flex; gap: 12px; align-items: flex-start;
        padding: 12px 40px 16px 12px; border-radius: 18px; background: #1d2740; color: #fff; cursor: pointer;
        box-shadow: 0 14px 34px rgba(0,0,0,.35); animation: pop .4s ease both; transition: transform .15s ease, background .15s;
      }
      .toast:hover { transform: translateX(-3px); background: #25304f; }
      .toast.out { animation: out .25s ease forwards; }
      .ico {
        width: 44px; height: 44px; flex: none; border-radius: 14px; display: flex; align-items: center; justify-content: center;
        font-size: 22px; line-height: 1; background: hsl(var(--c) 75% 55% / .25); border: 1px solid hsl(var(--c) 70% 55% / .55);
        transition: transform .2s;
      }
      .toast:hover .ico { transform: rotate(-8deg) scale(1.1); }
      .mid { min-width: 0; flex: 1; }
      .h { font-weight: 800; font-size: .95rem; line-height: 1.3; }
      .sub { font-size: .78rem; opacity: .8; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chip {
        display: inline-block; margin-top: 6px; padding: 2px 9px; border-radius: 999px; font-size: .72rem; font-weight: 700;
        color: #fff; background: hsl(var(--c) 70% 45%);
      }
      .toast.imp .chip { background: hsl(0 78% 50%); animation: pulse 1.6s infinite; }
      .p {
        margin-top: 8px; font-size: .84rem; line-height: 1.5; opacity: .93; white-space: pre-wrap; unicode-bidi: plaintext;
        max-height: 200px; overflow: auto; word-break: break-word; background: rgba(255,255,255,.08); border-radius: 12px; padding: 8px 10px;
      }
      .x {
        position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border: 0; border-radius: 50%;
        background: rgba(255,255,255,.15); color: #fff; font-size: 14px; line-height: 1; cursor: pointer;
      }
      .x:hover { background: rgba(255,255,255,.3); }
      .bar { position: absolute; left: 0; bottom: 0; height: 4px; width: 100%; transform-origin: left;
             background: linear-gradient(90deg, #7a5af0, #3b82f6); animation: shrink 60s linear forwards; }
      .toast.imp .bar { background: linear-gradient(90deg, hsl(0 78% 50%), hsl(25 90% 48%)); }
      .toast:hover .bar { animation-play-state: paused; }
      @keyframes pop    { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      @keyframes out    { to { opacity: 0; transform: translateX(40px); } }
      @keyframes shrink { to { transform: scaleX(0); } }
      @keyframes pulse  { 0%, 100% { box-shadow: 0 0 0 0 hsl(0 80% 50% / .5); } 50% { box-shadow: 0 0 0 6px hsl(0 80% 50% / 0); } }
      @media (prefers-reduced-motion: reduce) { .toast, .chip { animation: none !important; } .bar { animation-duration: 60s !important; } }
    `;

    let toastBox = null;
    function getToastBox() {
      if (toastBox && toastBox.isConnected) return toastBox;
      if (!document.documentElement) return null;
      const host = document.createElement('div');
      host.id = 'msa-toast-host';
      // on the e-learning site, sit above the theme / zoom buttons
      host.style.cssText = `position:fixed;right:18px;bottom:${ON_MOODLE ? 78 : 20}px;z-index:2147483647;`;
      const sr = host.attachShadow({ mode: 'open' });
      const st = document.createElement('style');
      st.textContent = TOAST_CSS;
      toastBox = document.createElement('div');
      toastBox.className = 'box';
      sr.append(st, toastBox);
      document.documentElement.appendChild(host);
      return toastBox;
    }

    function toastKind(heading, important) {
      let k = { e: '🎓', c: 230, tag: 'E-learning' };
      if (/announcement/i.test(heading)) k = { e: '📢', c: 265, tag: 'Announcement' };
      else if (/alert|notification/i.test(heading)) k = { e: '🔔', c: 205, tag: 'Alert' };
      if (important) k = { e: k.e, c: 0, tag: '⚠️ Important' };
      return k;
    }

    function showToast(heading, text, href) {
      const box = getToastBox();
      if (!box) return;
      const important = isImportant(heading + ' ' + text);
      const kind = toastKind(heading, important);

      // "New announcement – Course name" -> title + course on its own line
      const split = heading.split(/\s[–-]\s(.+)/);
      const title = split[0];
      const course = split[1] || '';

      const t = document.createElement('div');
      t.className = 'toast' + (important ? ' imp' : '');
      t.style.setProperty('--c', kind.c);

      const ico = document.createElement('div'); ico.className = 'ico'; ico.textContent = kind.e;
      const mid = document.createElement('div'); mid.className = 'mid';
      const h = document.createElement('div'); h.className = 'h'; h.textContent = title; h.dir = 'auto';
      mid.append(h);
      if (course) { const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = course; sub.title = course; mid.append(sub); }
      const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = kind.tag;
      mid.append(chip);
      const p = document.createElement('div'); p.className = 'p'; p.dir = 'auto';
      p.textContent = text.length > CONFIG.toastMaxChars ? text.slice(0, CONFIG.toastMaxChars) + '… (click to read all)' : text;
      mid.append(p);
      const x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '✕'; x.title = 'Dismiss';
      const bar = document.createElement('div'); bar.className = 'bar';

      const dismiss = () => { if (t.classList.contains('out')) return; t.classList.add('out'); setTimeout(() => t.remove(), 260); };
      x.onclick = (e) => { e.stopPropagation(); dismiss(); };
      t.onclick = () => { if (href) window.open(href, '_blank'); dismiss(); };
      bar.addEventListener('animationend', dismiss);

      t.append(ico, mid, x, bar);
      box.appendChild(t);
      while (box.children.length > 5) box.firstElementChild.remove();    // keep the stack tidy
    }

    // Every open tab shows the pop-up when one is broadcast
    GM_addValueChangeListener(TOAST_KEY, (name, oldV, newV) => {
      try { const d = JSON.parse(newV); showToast(d.heading, d.text, d.href); } catch (e) { /* ignore */ }
    });

    function notify(heading, text, href) {
      GM_notification({
        title: (isImportant(heading + ' ' + text) ? '⚠️ ' : '') + heading,
        text: text.slice(0, CONFIG.systemMaxChars),
        timeout: 20000,
        onclick: () => { if (href) window.open(href, '_blank'); }
      });
      save(TOAST_KEY, { id: Date.now() + Math.random(), heading, text, href });
    }

    function warnLogin(force) {
      const last = load(WARN_KEY, 0);
      if (force || Date.now() - last > 6 * 3600 * 1000) {
        save(WARN_KEY, Date.now());
        const saved = GM_getValue(USER_KEY, '') && GM_getValue(PASS_KEY, '');
        notify('MSA e-learning',
          saved
            ? 'You are logged out and the silent login did not work. Open the site once so I can log in again.'
            : 'You are logged out. Open the site and log in once (your login will be saved) so I can keep checking.',
          BASE + '/');
      }
    }

    // ---------- Courses ----------
    // learns the course list from links on the page (when you visit the site)
    function collectCourses() {
      const courses = load(COURSES_KEY, {});
      document.querySelectorAll('a[href*="/course/view.php?id="]').forEach((a) => {
        const id = new URL(a.href).searchParams.get('id');
        const name = a.textContent.trim().replace(/\s+/g, ' ');
        if (id && (name.length > 3 || !courses[id])) courses[id] = name.length > 3 ? name : (courses[id] || 'Course ' + id);
      });
      save(COURSES_KEY, courses);
      return courses;
    }

    // asks Moodle for your enrolled courses, so you never have to visit "My courses" first
    async function discoverCourses(session) {
      const courses = load(COURSES_KEY, {});
      const fresh = Date.now() - load(DISCOVER_KEY, 0) < 12 * 3600 * 1000;
      if (fresh && Object.keys(courses).length) return;
      try {
        const method = 'core_course_get_enrolled_courses_by_timeline_classification';
        const res = await request(`${BASE}/lib/ajax/service.php?sesskey=${encodeURIComponent(session.sesskey)}&info=${method}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ index: 0, methodname: method,
            args: { offset: 0, limit: 0, classification: 'inprogress', sort: 'fullname', customfieldname: '', customfieldvalue: '' } }])
        });
        const json = JSON.parse(res.responseText);
        const list = (json[0] && json[0].data && json[0].data.courses) || [];
        list.forEach((c) => { if (c.id) courses[c.id] = String(c.fullname || c.shortname || 'Course ' + c.id).replace(/\s+/g, ' ').trim(); });
        save(COURSES_KEY, courses);
        save(DISCOVER_KEY, Date.now());
        console.log('[MSA notifier] Course list updated:', list.length, 'courses');
      } catch (e) {
        console.warn('[MSA notifier] Could not fetch the course list:', e);
      }
    }

    // ---------- Part 1: course announcements ----------
    const ANNOUNCE_RE = /announce|news|إعلان|اعلان/i;

    async function findAnnouncementsUrl(courseId) {
      const find = (doc, url) => {
        const m = [...doc.querySelectorAll('a[href*="/mod/forum/view.php"]')].find((a) => ANNOUNCE_RE.test(a.textContent));
        return m ? new URL(m.getAttribute('href'), url).href : null;
      };
      const url = `${BASE}/course/view.php?id=${courseId}`;
      const found = find(await fetchDoc(url), url);
      if (found) return found;
      const idx = `${BASE}/mod/forum/index.php?id=${courseId}`;    // fallback: the course's forum list
      return find(await fetchDoc(idx), idx);
    }

    function getDiscussions(doc, baseUrl) {
      const items = new Map();
      doc.querySelectorAll('a[href*="/mod/forum/discuss.php"]').forEach((a) => {
        const u = new URL(a.getAttribute('href'), baseUrl);
        const id = u.searchParams.get('d');
        const title = a.textContent.trim().replace(/\s+/g, ' ');
        if (!id) return;
        if (!items.has(id) || (!items.get(id).title && title)) {
          items.set(id, { title, href: `${u.origin}${u.pathname}?d=${id}` });
        }
      });
      return items;
    }

    async function getAnnouncementText(href) {
      try {
        const doc = await fetchDoc(href);
        const el = doc.querySelector('.post-content-container') ||
                   doc.querySelector('.forumpost .posting') ||
                   doc.querySelector('.posting');
        return el ? htmlToText(el.innerHTML) : '';
      } catch (e) {
        if (e.message === 'NOT_LOGGED_IN') throw e;
        return '';
      }
    }

    async function checkAnnouncements(stats) {
      const courses = load(COURSES_KEY, {});
      const seen = load(SEEN_KEY, {});
      stats.courses = Object.keys(courses).length;
      for (const [id, name] of Object.entries(courses)) {
        try {
          const forumUrl = await findAnnouncementsUrl(id);
          if (!forumUrl) { console.log('[MSA notifier] No announcements forum found for', name); continue; }
          stats.forums++;
          const items = getDiscussions(await fetchDoc(forumUrl), forumUrl);
          stats.posts += items.size;
          const firstTime = !seen[forumUrl];
          if (firstTime) stats.baseline++;
          const known = new Set(seen[forumUrl] || []);
          for (const [did, item] of items) {
            if (known.has(did)) continue;
            if (!firstTime) {
              const body = await getAnnouncementText(item.href);
              const title = item.title || 'New announcement';
              notify('New announcement – ' + name, body ? `${title}\n${body}` : title + '\n(click to open)', item.href);
              stats.newAnn++;
            }
            known.add(did);
          }
          seen[forumUrl] = [...known];
          save(SEEN_KEY, seen);
        } catch (e) {
          if (e.message === 'NOT_LOGGED_IN') throw e;
          console.warn('[MSA notifier] Announcement check failed for course', id, e);
        }
      }
    }

    // ---------- Part 2: bell notifications ----------
    async function getSession() {
      const r = await request(`${BASE}/my/`);
      if (/\/login\//.test(r.finalUrl || '')) throw new Error('NOT_LOGGED_IN');
      const html = r.responseText;
      const sesskey = (html.match(/"sesskey":"([^"]+)"/) || [])[1];
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const el = doc.querySelector('#nav-notification-popover-container[data-userid]') || doc.querySelector('[data-userid]');
      return { sesskey, userid: el && el.getAttribute('data-userid') };
    }

    async function checkBell(session, stats) {
      const { sesskey, userid } = session;
      if (!sesskey || !userid) {
        console.warn('[MSA notifier] Could not read session info for bell notifications', { sesskey: !!sesskey, userid });
        stats.problem = 'Could not read your session info from the e-learning site.';
        return;
      }
      const method = 'message_popup_get_popup_notifications';
      const res = await request(`${BASE}/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}&info=${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ index: 0, methodname: method, args: { useridto: Number(userid), newestfirst: 1, limit: 20, offset: 0 } }])
      });
      const json = JSON.parse(res.responseText);
      if (!json[0] || json[0].error) {
        console.warn('[MSA notifier] Bell request failed:', json[0] && json[0].exception);
        stats.problem = 'The bell request was rejected by the site.';
        return;
      }
      const list = json[0].data.notifications || [];
      const unread = json[0].data.unreadcount || 0;
      const allUrl = `${BASE}/message/output/popup/notifications.php`;

      const seen = load(BELL_KEY, null);
      if (!seen) {
        save(BELL_KEY, list.map((n) => n.id));
        stats.bellBaseline = true;
        if (unread > 0) notify('MSA e-learning', `You have ${unread} unread notification${unread > 1 ? 's' : ''}`, allUrl);
        return;
      }

      const seenSet = new Set(seen);
      const fresh = list.filter((n) => !seenSet.has(n.id)).reverse();
      stats.newBell += fresh.length;
      if (fresh.length > 3) {
        notify('MSA e-learning', `${fresh.length} new notifications`, allUrl);
      } else {
        fresh.forEach((n) => {
          const subject = htmlToText(n.subject || n.shortenedsubject);
          const body = htmlToText(n.fullmessagehtml || n.text || n.fullmessage || n.smallmessage);
          const text = body && body !== subject ? `${subject}\n${body}` : subject;
          notify('MSA alert', text, n.contexturl || allUrl);
        });
      }
      fresh.forEach((n) => seenSet.add(n.id));
      save(BELL_KEY, [...seenSet].slice(-300));
    }

    // ---------- Running: only ONE open tab does the checking ----------
    let running = false;
    async function checkAll(manual) {
      if (running) { if (manual) showToast('MSA checker', 'A check is already running…'); return; }
      running = true;
      save(LAST_KEY, Date.now());
      const stats = { courses: 0, forums: 0, posts: 0, baseline: 0, newAnn: 0, newBell: 0, bellBaseline: false, problem: '' };
      try {
        const session = await authed(getSession);
        await discoverCourses(session);
        await checkBell(session, stats);
        await authed(() => checkAnnouncements(stats));
        const msg = stats.problem ||
          `Checked ${stats.courses} courses and ${stats.forums} announcement forums (${stats.posts} posts seen).\n` +
          `New announcements: ${stats.newAnn}. New alerts: ${stats.newBell}.` +
          (stats.baseline || stats.bellBaseline
            ? '\nFirst run: existing items were saved as the starting point, so only things posted from now on will notify.'
            : '');
        console.log('[MSA notifier] Check finished at', new Date().toLocaleTimeString(), stats);
        if (manual) showToast('MSA checker', msg);
      } catch (e) {
        if (e.message === 'NOT_LOGGED_IN') warnLogin(manual);
        else {
          console.warn('[MSA notifier] Check failed:', e);
          if (manual) showToast('MSA checker – error', String((e && e.message) || e));
        }
      } finally {
        running = false;
      }
    }

    function claimLeader() {
      const now = Date.now();
      const l = load(LOCK_KEY, null);
      if (!l || l.id === TAB_ID || now - l.t > 70000) {
        save(LOCK_KEY, { id: TAB_ID, t: now });
        return true;
      }
      return false;
    }

    async function tick() {
      if (!claimLeader()) return;
      await sleep(500);
      const l = load(LOCK_KEY, null);
      if (!l || l.id !== TAB_ID) return;
      save(LOCK_KEY, { id: TAB_ID, t: Date.now() });
      if (Date.now() - load(LAST_KEY, 0) >= CONFIG.checkEveryMinutes * 60000 - 5000) checkAll(false);
    }

    window.addEventListener('beforeunload', () => {
      const l = load(LOCK_KEY, null);
      if (l && l.id === TAB_ID) save(LOCK_KEY, null);
    });

    GM_registerMenuCommand('Check now (shows a result pop-up)', () => checkAll(true));
    GM_registerMenuCommand('Send test notification', () =>
      notify('New announcement – Engineering Physics II', 'Test: assignment due soon\nThis is where the message text will appear.', BASE));
    GM_registerMenuCommand('Reset (forget everything)', () => {
      save(SEEN_KEY, {});
      save(COURSES_KEY, {});
      save(BELL_KEY, null);
      save(LAST_KEY, 0);
      save(DISCOVER_KEY, 0);
      save(LOGIN_TRY_KEY, { t: 0, fails: 0 });
      alert('Reset done. The next check will save what exists now as the starting point.');
    });

    setTimeout(() => {
      if (ON_ELEARNING) collectCourses(); // also learns your course list when you visit the site
      tick();
    }, 8000);
    setInterval(tick, 30000);
  }

  /* =====================================================
     START: each part is isolated, so one crashing can't stop the others
  ===================================================== */
  const safe = (name, fn) => { try { fn(); } catch (e) { console.error('[MSA]', name, 'crashed:', e); } };
  safe('autologin', () => { if (location.hostname === 'e-learning.msa.edu.eg') initAutoLogin(); });
  safe('makeover', () => { if (isMoodle()) initUI(); });
  safe('notifier', initNotifier);
})();
