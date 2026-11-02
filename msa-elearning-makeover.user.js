// ==UserScript==
// @name         MSA E-learning Makeover
// @icon         https://msa.edu.eg/msauniversity/wp-content/uploads/2026/03/MSA-Logo-1.png
// @author       Empowzi
// @license      Copyright 2026 Empowzi. All rights reserved.
// @namespace    https://tampermonkey.net/
// @version      5.9
// @description  Clean UI, dark mode, subject artwork on course cards, deadline panel on My courses, plus pop-ups on any website for new MSA announcements and assignment alerts
// @match        *://*/*
// @noframes
// @connect      e-learning.msa.edu.eg
// @grant        GM_getValue
// @grant        GM_setValue
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
    document.body && (/moodle/i.test(document.body.className + document.body.id) ||
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
    const ARABIC_PATTERN = 'data:image/webp;base64,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';

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
      const key = s[2] + s[4] + s[5];
      const url = s[5] === 'IMG'
        ? `url("${ARABIC_PATTERN}")`
        : (patCache[key] || (patCache[key] = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(tileSvg(s))}")`));
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
    LOG('v5.9 loaded | ' + (isCourse ? 'course page' : enableCards ? 'cards ON' : 'inside course/activity'));
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

    function warnLogin() {
      const last = load(WARN_KEY, 0);
      if (Date.now() - last > 6 * 3600 * 1000) {
        save(WARN_KEY, Date.now());
        notify('MSA e-learning', 'You are logged out. Open the site and log in so I can keep checking.', BASE + '/');
      }
    }

    // ---------- Part 1: course announcements ----------
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

    async function findAnnouncementsUrl(courseId) {
      const url = `${BASE}/course/view.php?id=${courseId}`;
      const doc = await fetchDoc(url);
      const match = [...doc.querySelectorAll('a[href*="/mod/forum/view.php"]')].find((a) => /announce|news/i.test(a.textContent));
      return match ? new URL(match.getAttribute('href'), url).href : null;
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

    async function checkAnnouncements() {
      const courses = load(COURSES_KEY, {});
      const seen = load(SEEN_KEY, {});
      for (const [id, name] of Object.entries(courses)) {
        try {
          const forumUrl = await findAnnouncementsUrl(id);
          if (!forumUrl) { console.log('[MSA notifier] No announcements forum found for', name); continue; }
          const items = getDiscussions(await fetchDoc(forumUrl), forumUrl);
          const firstTime = !seen[forumUrl];
          const known = new Set(seen[forumUrl] || []);
          for (const [did, item] of items) {
            if (known.has(did)) continue;
            if (!firstTime) {
              const body = await getAnnouncementText(item.href);
              const title = item.title || 'New announcement';
              notify('New announcement – ' + name, body ? `${title}\n${body}` : title + '\n(click to open)', item.href);
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

    async function checkBell() {
      try {
        const { sesskey, userid } = await getSession();
        if (!sesskey || !userid) {
          console.warn('[MSA notifier] Could not read session info for bell notifications', { sesskey: !!sesskey, userid });
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
          return;
        }
        const list = json[0].data.notifications || [];
        const unread = json[0].data.unreadcount || 0;
        const allUrl = `${BASE}/message/output/popup/notifications.php`;

        const seen = load(BELL_KEY, null);
        if (!seen) {
          save(BELL_KEY, list.map((n) => n.id));
          if (unread > 0) notify('MSA e-learning', `You have ${unread} unread notification${unread > 1 ? 's' : ''}`, allUrl);
          return;
        }

        const seenSet = new Set(seen);
        const fresh = list.filter((n) => !seenSet.has(n.id)).reverse();
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
      } catch (e) {
        if (e.message === 'NOT_LOGGED_IN') throw e;
        console.warn('[MSA notifier] Bell check failed:', e);
      }
    }

    // ---------- Running: only ONE open tab does the checking ----------
    let running = false;
    async function checkAll() {
      if (running) return;
      running = true;
      save(LAST_KEY, Date.now());
      try {
        await checkBell();
        await checkAnnouncements();
        console.log('[MSA notifier] Check finished at', new Date().toLocaleTimeString());
      } catch (e) {
        if (e.message === 'NOT_LOGGED_IN') warnLogin();
        else console.warn('[MSA notifier] Check failed:', e);
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
      if (Date.now() - load(LAST_KEY, 0) >= CONFIG.checkEveryMinutes * 60000 - 5000) checkAll();
    }

    window.addEventListener('beforeunload', () => {
      const l = load(LOCK_KEY, null);
      if (l && l.id === TAB_ID) save(LOCK_KEY, null);
    });

    GM_registerMenuCommand('Check now', checkAll);
    GM_registerMenuCommand('Send test notification', () =>
      notify('New announcement – Engineering Physics II', 'Test: assignment due soon\nThis is where the message text will appear.', BASE));
    GM_registerMenuCommand('Reset (forget everything)', () => {
      save(SEEN_KEY, {});
      save(COURSES_KEY, {});
      save(BELL_KEY, null);
      save(LAST_KEY, 0);
      alert('Reset done. Open your My courses page again.');
    });

    setTimeout(() => {
      if (ON_ELEARNING) collectCourses(); // learns your course list when you visit the site
      tick();
    }, 8000);
    setInterval(tick, 30000);
  }

  if (isMoodle()) initUI();
  initNotifier();
})();
