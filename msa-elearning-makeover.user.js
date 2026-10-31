// ==UserScript==
// @name         MSA E-learning Makeover
// @icon         https://msa.edu.eg/msauniversity/wp-content/uploads/2026/03/MSA-Logo-1.png
// @author       Ninoooozzzz
// @license      Copyright 2026 Ninoooozzzz. All rights reserved.
// @namespace    https://tampermonkey.net/
// @version      5.0
// @description  Clean UI, dark mode, deadline panel on My courses, plus pop-ups on any website for new MSA announcements and assignment alerts
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
 * Copyright 2026 Ninoooozzzz. All rights reserved.
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
      .cp-badge {
        z-index: 1; font-size: .72rem; font-weight: 600; background: rgba(255,255,255,.22);
        padding: 3px 10px; border-radius: 999px; max-width: 34%; flex: 0 1 auto; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
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
       SUBJECT ICONS
    ===================================================== */
    const ICONS = [
      [/physic/i, '⚛️'],
      [/chem/i, '🧪'],
      [/mechanic|dynamic|statics|kinematic/i, '⚙️'],
      [/draw|graphic|cad/i, '📐'],
      [/english|writing|research|composition|language|literature/i, '✍️'],
      [/math|calculus|algebra|statistic|probab/i, '🧮'],
      [/program|comput|coding|software|informat/i, '💻'],
      [/electric|circuit|electron/i, '⚡'],
      [/thermo|heat/i, '🔥'],
      [/fluid|hydraul/i, '💧'],
      [/material|metal/i, '🧱'],
      [/bio/i, '🧬'],
      [/econom|manage|business|account/i, '📊'],
      [/arabic/i, '📖'],
    ];
    const iconFor = (text) => (ICONS.find(([re]) => re.test(text)) || [0, '📘'])[1];

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
        main.prepend(hero);
      }
      hero.dataset.sig = sig;
      hero.style.setProperty('--h', hash(name) % 360);
      hero.textContent = '';

      const top = el('div', 'cp-hero-top');
      const em = el('div', 'cp-hero-emoji', iconFor(name));
      em.title = 'Click me 🎉';
      em.onclick = (e) => confetti(e.clientX, e.clientY);
      const txt = el('div');
      txt.append(el('div', 'cp-hero-title', name),
                 el('div', 'cp-hero-tip', TIPS[Math.floor(Date.now() / 864e5) % TIPS.length]));
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
      hero.append(top, chips);
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
      if (isCourse) enhanceCourse();
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
    LOG('v5.0 loaded | ' + (isCourse ? 'course page' : enableCards ? 'cards ON' : 'inside course/activity'));
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
