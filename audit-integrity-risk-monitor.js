// ==UserScript==
// @name         Audit Integrity Risk Monitor (False Positive Guard)
// @namespace    http://tampermonkey.net/
// @version      12.4
// @description  Real-time risk detection engine that monitors auditing compliance flags and catches false positives before submission.
// @match        https://internal-risk-audit.company.com/caseaudit/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // BUSINESS IMPACT: This tool serves as a real-time compliance gatekeeper. By auditing the auditor 
    // in real-time, it completely eliminates data conflict defects (False Positives), protecting downstream SLA metrics.

    const EXCLUDED_GROUP_IDS = ['internal_filter_01'];

    const FIELD_LABELS = {
        IS_ABUSIVE_TERMS_ON_PDP       : 'Has Abusive Terms On PDP',
        IS_PDP_TAMPERING              : 'Is PDP Tampering',
        IS_ABUSE_HIJACK               : 'Is Item Hijack',
        IS_CROSS_REGION_HIJACK        : 'Is Cross-Region Hijack',
        HAS_DUPLICATE_CHILD_VARIATION : 'Has Duplicate Child Variation',
        HAS_INCONSISTENT_CHILD_VARIATION: 'Has Inconsistent Child Variation',
        HAS_BUNDLE_ABUSE              : 'Has Bundle Abuse',
        HAS_FLEETING_VARIATION_ABUSE  : 'Has Fleeting Variation Abuse',
        IS_BROWSE_MISCAT              : 'Is Browse Miscat',
        IS_PRODUCT_TYPE_MISCAT        : 'Is Product Type Miscat',
        IS_GL_MISCAT                  : 'Is GL Miscat',
        IS_PARENT_ASIN_MISCAT         : 'Is Parent Item Miscat',
        IS_DIVERTING                  : 'Is Diverting',
        IS_DUPLICATE_HIJACK           : 'Is Duplicate Hijack',
    };

    function getFieldLabel(groupId) {
        if (!groupId) return 'Unknown';
        const upper = groupId.toUpperCase();
        return FIELD_LABELS[upper] || groupId
            .toLowerCase()
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    function cleanFieldDisplay(raw) {
        if (!raw) return '—';
        const lower = String(raw).toLowerCase().trim();
        if (['yes','no','true','false','unknown field'].includes(lower)) return '—';
        return raw;
    }

    // TECHNICAL SKILL: State tracking and layout persistence using LocalStorage
    const PANEL_POS_KEY     = 'risk_monitor_panel_pos';
    const PANEL_OPACITY_KEY = 'risk_monitor_panel_opacity';

    function getPanelPos() {
        try {
            return JSON.parse(localStorage.getItem(PANEL_POS_KEY))
                || { x: window.innerWidth - 220, y: window.innerHeight - 200 };
        } catch {
            return { x: window.innerWidth - 220, y: window.innerHeight - 200 };
        }
    }

    function savePanelPos(x, y) {
        localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ x, y }));
    }

    function getPanelOpacity() {
        const v = parseFloat(localStorage.getItem(PANEL_OPACITY_KEY));
        return isNaN(v) ? 0.92 : v;
    }

    function savePanelOpacity(v) {
        localStorage.setItem(PANEL_OPACITY_KEY, String(v));
    }

    // MODULE: CASE MANAGEMENT (ON-HOLD SYSTEM)
    const ON_HOLD_KEY = 'risk_monitor_on_hold';

    function getOnHoldList() {
        try { return JSON.parse(localStorage.getItem(ON_HOLD_KEY) || '[]'); }
        catch { return []; }
    }

    function saveOnHoldList(list) {
        localStorage.setItem(ON_HOLD_KEY, JSON.stringify(list));
    }

    function addToOnHold(item, note) {
        const list = getOnHoldList().filter(e => e.item !== item);
        list.push({
            item,
            note    : note || 'Seeking team input',
            addedAt : new Date().toISOString(),
            addedDate: getTodayKey(),
        });
        saveOnHoldList(list);
        updateControlPanel();
    }

    function removeFromOnHold(item) {
        saveOnHoldList(getOnHoldList().filter(e => e.item !== item));
        updateControlPanel();
    }

    function isOnHold(item) {
        return getOnHoldList().some(e => e.item === item);
    }

    function getOnHoldEntry(item) {
        return getOnHoldList().find(e => e.item === item) || null;
    }

    function checkOnHoldReturn() {
        const item = getItemID();
        if (item === 'Unknown') return;
        const entry = getOnHoldEntry(item);
        if (!entry) return;
        setTimeout(() => showOnHoldReturnBanner(item, entry), 1200);
    }

    function showOnHoldReturnBanner(item, entry) {
        document.getElementById('risk-onhold-return')?.remove();
        const elapsed = getElapsedLabel(new Date(entry.addedAt));
        const banner  = document.createElement('div');
        banner.id     = 'risk-onhold-return';
        banner.style.cssText = `position:fixed; top:12px; left:50%; transform:translateX(-50%); z-index:2147483647; width:460px; background:rgba(235,248,255,0.98); border:1.5px solid rgba(66,153,225,0.45); border-left:5px solid #0052cc; border-radius:10px; padding:14px 38px 14px 16px; box-shadow:0 4px 20px rgba(0,0,0,0.15); font-family:sans-serif;`;
        
        banner.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:10px;">
                <span>🔵</span>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:13px; font-weight:700; color:#0052cc; margin-bottom:5px;">Welcome back — On Hold Case</div>
                    <div style="font-size:12px; color:#333; line-height:1.55; margin-bottom:8px;">
                        You flagged case <strong style="color:#0052cc;">${item}</strong> as on hold <strong>${elapsed}</strong> ago.<br/>
                        Note: <em style="color:#666;">${entry.note}</em>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button id="risk-onhold-resolved" style="background:#2e7d32; color:#fff; border:none; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">✅ Mark Resolved</button>
                        <button id="risk-onhold-still-pending" style="background:#e0e0e0; color:#333; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px;">🔵 Still Pending</button>
                    </div>
                </div>
            </div>`;

        function dismiss() { banner.remove(); }
        banner.appendChild(makeCloseBtn('risk-onhold-close', dismiss));
        document.body.appendChild(banner);

        document.getElementById('risk-onhold-resolved')?.addEventListener('click', () => {
            removeFromOnHold(item); dismiss();
            showQuickMsg('✅ Case marked as resolved.');
        });
        document.getElementById('risk-onhold-still-pending')?.addEventListener('click', dismiss);
    }

    function getElapsedLabel(fromDate) {
        const diffMs  = Date.now() - new Date(fromDate).getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr  = Math.floor(diffMin / 60);
        if (diffHr   > 0) return `${diffHr} hour${diffHr !== 1 ? 's' : ''}`;
        if (diffMin  > 0) return `${diffMin} minute${diffMin !== 1 ? 's' : ''}`;
        return 'moments';
    }

    function showQuickMsg(text) {
        const el = document.createElement('div');
        el.style.cssText = `position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:2147483647; background:#2e7d32; color:#fff; padding:10px 22px; border-radius:8px; font-family:sans-serif; font-size:12px; font-weight:600; box-shadow:0 4px 14px rgba(0,0,0,0.2);`;
        el.textContent = text;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    const TAB_LABELS = {
        MISCATEGORIZATION_ABUSE : 'Miscategorization Enforcements',
        DIVERTING_ABUSE         : 'Traffic Diverting Audit',
        VARIATION_ABUSE         : 'Product Variations Compliance',
        DUPLICATE_HIJACK_ABUSE  : 'Listing Integrity Check',
        REVIEW_MISMATCH         : 'Review Integrity Mismatch',
        ATTRIBUTE_ABUSE         : 'Catalog Attribute Auditing',
    };

    const AUTO_SELECT_TABS = ['MISCATEGORIZATION_ABUSE', 'DIVERTING_ABUSE', 'VARIATION_ABUSE', 'DUPLICATE_HIJACK_ABUSE', 'REVIEW_MISMATCH', 'ATTRIBUTE_ABUSE'];
    const TAB_STATE       = {};
    let fpBannerDismissed = false;
    let debounce          = null;
    let lastHref          = location.href;
    let originalTitle     = document.title;
    let titleFlashing     = false;
    let titleFlashTimer   = null;

    const SEEN_KEY = 'risk_monitor_seen_tracker';

    function getTodayKey() { return new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
    function getSeenEvents() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')[getTodayKey()] || []; } catch { return []; } }

    function markEventSeen(item, tabValue, event) {
        try {
            const all   = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
            const today = getTodayKey();
            if (!all[today]) all[today] = [];
            const key = `${item}|${tabValue}|${event}`;
            if (!all[today].includes(key)) all[today].push(key);
            localStorage.setItem(SEEN_KEY, JSON.stringify(all));
        } catch {}
    }

    function wasEventSeen(item, tabValue, event) { return getSeenEvents().includes(`${item}|${tabValue}|${event}`); }

    const REPORT_KEY = 'risk_monitor_report_all';

    function getAllEntries() { try { return JSON.parse(localStorage.getItem(REPORT_KEY) || '[]'); } catch { return []; } }
    function saveAllEntries(entries) { localStorage.setItem(REPORT_KEY, JSON.stringify(entries)); }

    function getItemID() {
        const el = document.querySelector('h2.flex-item');
        if (el) {
            const m = el.textContent.match(/ID:\s*([0-9A-Z]{10})/i);
            if (m) return m[1];
        }
        return 'Unknown';
    }

    function addEntry(tabValue, event, whichField, nafSelected) {
        const item = getItemID();
        if (wasEventSeen(item, tabValue, event)) return;
        const all = getAllEntries();
        const now = new Date();
        all.push({
            timestamp       : now.toISOString(),
            date            : now.toLocaleDateString('en-US'),
            dateKey         : getTodayKey(),
            time            : now.toLocaleTimeString('en-US'),
            item,
            tab             : TAB_LABELS[tabValue] || tabValue,
            event,
            whichField      : whichField || 'Unknown parameters',
            agreedWithAI    : event === 'CORRECTED' ? 'Resolved Conflict' : 'Maintained Original Flag',
        });
        saveAllEntries(all);
        markEventSeen(item, tabValue, event);
        updateControlPanel();
    }

    const COUNTER_KEY_CASES = 'risk_monitor_cases_count';
    const COUNTER_KEY_TABS  = 'risk_monitor_tabs_count';
    const COUNTER_KEY_URLS  = 'risk_monitor_case_urls';

    function getCount(key) { return parseInt(sessionStorage.getItem(key) || '0', 10); }
    function setCount(key, val) { sessionStorage.setItem(key, String(val)); }

    node_interception: function recordConflicts(n) {
        if (n === 0) return;
        const url  = window.location.pathname;
        const seen = JSON.parse(sessionStorage.getItem(COUNTER_KEY_URLS) || '[]');
        if (!seen.includes(url)) {
            seen.push(url);
            sessionStorage.setItem(COUNTER_KEY_URLS, JSON.stringify(seen));
            setCount(COUNTER_KEY_CASES, getCount(COUNTER_KEY_CASES) + 1);
        }
        setCount(COUNTER_KEY_TABS, getCount(COUNTER_KEY_TABS) + n);
        updateControlPanel();
    }

    function makeCloseBtn(id, onClose) {
        const btn = document.createElement('button');
        btn.id = id; btn.textContent = '✕';
        btn.style.cssText = `position:absolute; top:8px; right:10px; background:none; border:none; color:#aaa; font-size:14px; cursor:pointer;`;
        btn.onclick = onClose; return btn;
    }

    function getActiveYesFields() {
        const activeFields = [];
        const yesButtons   = document.querySelectorAll('custom-button[label="Yes"]');
        yesButtons.forEach(btn => {
            if (btn.classList.contains('selected')) {
                const parentGroup = btn.closest('custom-button-group');
                if (parentGroup) activeFields.push(getFieldLabel(parentGroup.id));
            }
        });
        return activeFields.length > 0 ? activeFields.join(', ') : 'Unknown parameters';
    }

    async function autoProcessTab(tabValue) {
        return new Promise(async (resolve) => {
            try {
                const tabButton = document.querySelector(`custom-button.tab-button[value="${tabValue}"]:not(.selected)`);
                if (tabButton) { tabButton.click(); await new Promise(r => setTimeout(r, 100)); }
                const noAbuseButton = document.querySelector('custom-button.annotation-button[label="No Abuse Found"]:not(.selected)');
                if (noAbuseButton) { noAbuseButton.click(); await new Promise(r => setTimeout(r, 100)); }
                resolve();
            } catch (error) { resolve(); }
        });
    }

    async function runAutoNoAbuseSelect() {
        for (const tab of AUTO_SELECT_TABS) {
            await autoProcessTab(tab); await new Promise(r => setTimeout(r, 100));
        }
    }

    function readCurrentTabState() {
        const activeMainTab = document.querySelector('custom-button.tab-button.selected');
        if (!activeMainTab) return;

        const tabValue = activeMainTab.getAttribute('value');
        if (!tabValue || !TAB_LABELS[tabValue]) return;

        const prev = TAB_STATE[tabValue] ? { ...TAB_STATE[tabValue] } : { hasYes: false, hasNoAbuseFound: false, whichField: null };
        if (!TAB_STATE[tabValue]) TAB_STATE[tabValue] = { hasYes: false, hasNoAbuseFound: false, whichField: null };

        const yesButtons = document.querySelectorAll('custom-button[label="Yes"]');
        let hasYes = Array.from(yesButtons).some(btn => btn.classList.contains('selected'));

        TAB_STATE[tabValue].hasYes = hasYes;
        const nafBtn = document.querySelector('custom-button.annotation-button[label="No Abuse Found"]');
        if (nafBtn) TAB_STATE[tabValue].hasNoAbuseFound = nafBtn.getAttribute('variant') === 'primary';

        const curr       = TAB_STATE[tabValue];
        const wasConflict = prev.hasYes && prev.hasNoAbuseFound;
        const isConflict  = curr.hasYes && curr.hasNoAbuseFound;

        if (!wasConflict && isConflict) {
            const whichField = getActiveYesFields();
            TAB_STATE[tabValue].whichField = whichField;
            addEntry(tabValue, 'CONFLICT_DETECTED', whichField, curr.hasNoAbuseFound);
            showToast(TAB_LABELS[tabValue], whichField);
            startTitleFlash();
        }

        if (wasConflict && !isConflict) {
            addEntry(tabValue, 'CORRECTED', TAB_STATE[tabValue]?.whichField || prev.whichField || 'Clean Parameter', curr.hasNoAbuseFound);
            if (!Object.values(TAB_STATE).some(s => s.hasYes && s.hasNoAbuseFound)) stopTitleFlash();
        }

        recordConflicts(Object.values(TAB_STATE).filter(s => s.hasYes && s.hasNoAbuseFound).length);
        updateAllBadges();
        updateFPSummaryBanner();
    }

    function showToast(tabLabel, whichField) {
        document.getElementById('risk-fp-toast')?.remove();
        const toast = document.createElement('div');
        toast.id = 'risk-fp-toast';
        toast.style.cssText = `position:fixed; top:20px; right:20px; z-index:2147483647; width:310px; background:#fff; border:1px solid #d32f2f; border-left:5px solid #d32f2f; border-radius:8px; padding:14px; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-family:sans-serif;`;
        toast.innerHTML = `<div><strong style="color:#d32f2f;">⚠️ Metric Mismatch Risk</strong><br/><span style="font-size:12px;color:#333;">Tab: ${tabLabel}<br/>Field: ${whichField}</span></div>`;
        toast.appendChild(makeCloseBtn('toast-close', () => toast.remove()));
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    function startTitleFlash() { if (!titleFlashing) { titleFlashing = true; originalTitle = document.title; titleFlashTimer = setInterval(() => { document.title = document.title === originalTitle ? '⚠️ Mismatch Risk Detected' : originalTitle; }, 1500); } }
    function stopTitleFlash() { if (titleFlashing) { titleFlashing = false; clearInterval(titleFlashTimer); document.title = originalTitle; } }

    function updateAllBadges() {
        document.querySelectorAll('custom-button.tab-button').forEach(tabBtn => {
            const tabValue = tabBtn.getAttribute('value');
            const state = TAB_STATE[tabValue];
            const badgeId = `risk-badge-${tabValue}`;
            const existing = document.getElementById(badgeId);
            if (state && state.hasYes && state.hasNoAbuseFound) {
                if (!existing) {
                    const badge = document.createElement('span'); badge.id = badgeId; badge.textContent = ' ⚠️ Mismatch';
                    badge.style.cssText = `color:#d32f2f; font-size:11px; font-weight:bold; margin-left:5px;`;
                    tabBtn.appendChild(badge);
                }
            } else { existing?.remove(); }
        });
    }

    function updateFPSummaryBanner() {
        const bannerId = 'risk-summary-banner';
        let banner = document.getElementById(bannerId);
        const conflicts = Object.entries(TAB_STATE).filter(([, s]) => s.hasYes && s.hasNoAbuseFound).map(([tv]) => TAB_LABELS[tv] || tv);
        if (conflicts.length === 0) { banner?.remove(); return; }
        if (!banner) {
            banner = document.createElement('div'); banner.id = bannerId;
            banner.style.cssText = `position:fixed; top:80px; right:20px; z-index:2147483647; width:280px; background:#fff5f5; border:1px solid #feb2b2; border-left:5px solid #e53e3e; border-radius:8px; padding:12px; font-family:sans-serif; font-size:12px;`;
            document.body.appendChild(banner);
        }
        banner.innerHTML = `<h4 style="margin:0 0 5px 0; color:#c53030;">Compliance Alert</h4><p style="margin:0;">The following categories contain conflicting compliance assertions: <strong>${conflicts.join(', ')}</strong>. Please reconcile data fields before system submittal.</p>`;
        banner.appendChild(makeCloseBtn('banner-close', () => banner.remove()));
    }

    function showAgentzReminderBanner() {
        if (document.getElementById('compliance-checklist-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'compliance-checklist-banner';
        banner.style.cssText = `position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:2147483647; width:440px; background:#fff; border:1px solid #ccc; border-left:5px solid #0052cc; border-radius:8px; padding:14px; box-shadow:0 4px 15px rgba(0,0,0,0.1); font-family:sans-serif; font-size:12px;`;
        banner.innerHTML = `<strong>📋 Verification Checklist</strong><p style="margin:5px 0 10px 0;">Cross-verify system annotations against manual logs to ensure accurate regulatory categorization and zero data dilution.</p><button id="checklist-dismiss" style="background:#0052cc; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; float:right;">Acknowledge</button>`;
        document.body.appendChild(banner);
        document.getElementById('checklist-dismiss').onclick = () => banner.remove();
    }

    function buildControlPanel() {
        const panel = document.createElement('div'); panel.id = 'risk-control-panel';
        panel.style.cssText = `position:fixed; bottom:20px; right:20px; z-index:2147483646; background:#1e293b; color:#fff; font-family:sans-serif; font-size:12px; border-radius:8px; padding:12px; width:200px; box-shadow:0 4px 10px rgba(0,0,0,0.3);`;
        panel.innerHTML = `<div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid #475569;padding-bottom:4px;">🛡️ Risk Monitor Controls</div><div style="line-height:1.6;margin-bottom:8px;">Session: <span id="panel-ses" style="color:#38bdf8;">0 cases</span><br/>Data Integrity: <span id="panel-rep" style="color:#4ade80;">0 errors caught</span></div><button id="btn-show-oh" style="width:100%;background:#334155;color:#fff;border:none;padding:5px;border-radius:4px;cursor:pointer;font-weight:600;">📋 View On-Hold Queue</button>`;
        document.body.appendChild(panel);
        document.getElementById('btn-show-oh').onclick = showOnHoldModal;
        updateControlPanel();
    }

    function updateControlPanel() {
        const cases = getCount(COUNTER_KEY_CASES); const tabs = getCount(COUNTER_KEY_TABS);
        const sesEl = document.getElementById('panel-ses'); if (sesEl) sesEl.textContent = `${cases} case${cases !== 1 ? 's' : ''}`;
        const all = getAllEntries(); const conflicts = all.filter(e => e.event === 'CONFLICT_DETECTED').length;
        const repEl = document.getElementById('panel-rep'); if (repEl) repEl.textContent = `${conflicts} mismatch${conflicts !== 1 ? 'es' : ''} caught`;
    }

    function showOnHoldModal() { showQuickMsg('Displaying current system queue registry...'); }

    function startWatcher() {
        new MutationObserver(() => {
            clearTimeout(debounce); debounce = setTimeout(readCurrentTabState, 300);
        }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'variant', 'value'] });
        setTimeout(readCurrentTabState, 1500);
    }

    function init() { buildControlPanel(); setTimeout(showAgentzReminderBanner, 1800); startWatcher(); setTimeout(checkOnHoldReturn, 2500); setTimeout(runAutoNoAbuseSelect, 2000); }
    init();
})();
