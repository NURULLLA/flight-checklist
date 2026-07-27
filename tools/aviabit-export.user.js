// ==UserScript==
// @name         AviaBit -> Flight Checklist Export
// @namespace    skyguard.checklist
// @version      2.0
// @description  Adds an "Export to Checklist" button on an AviaBit flight card. Opens the Loadmaster Flight Summary with the flight already filled in.
// @match        https://ab-web.aviastartu.ru/flight-card*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 * This is the push direction: start on AviaBit, land in the checklist.
 * The pull direction (Flight History button inside the checklist app) is
 * handled by tools/aviabit-bridge.user.js.
 *
 * Both use the same field mapping — see js/aviabit.js -> mapLegToForm().
 */

(function () {
    'use strict';

    const CHECKLIST_URL = 'https://nurullla.github.io/flight-checklist/';

    function getPlanFlightId() {
        return new URLSearchParams(window.location.search).get('planFlightId');
    }

    function hhmm(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0');
    }

    function dateStr(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return String(d.getUTCDate()).padStart(2, '0') + '.' +
               String(d.getUTCMonth() + 1).padStart(2, '0') + '.' +
               d.getUTCFullYear();
    }

    // Elapsed time between two timestamps, as HHMM.
    function durationHHMM(fromIso, toIso) {
        if (!fromIso || !toIso) return '';
        const a = new Date(fromIso).getTime();
        const b = new Date(toIso).getTime();
        if (isNaN(a) || isNaN(b)) return '';
        let mins = Math.round((b - a) / 60000);
        while (mins < 0) mins += 1440;
        if (mins >= 1440) return '';
        return String(Math.floor(mins / 60)).padStart(2, '0') + String(mins % 60).padStart(2, '0');
    }

    function firstOf() {
        for (let i = 0; i < arguments.length; i++) {
            if (arguments[i]) return arguments[i];
        }
        return null;
    }

    async function fetchJSON(path) {
        const res = await fetch('https://ab-web.aviastartu.ru/api/' + path, { credentials: 'include' });
        if (!res.ok) throw new Error(path + ' failed: ' + res.status);
        return res.json();
    }

    async function exportFlight() {
        const planFlightId = getPlanFlightId();
        if (!planFlightId) {
            alert('No planFlightId found in the URL.');
            return;
        }

        try {
            const [card, airports, crewLoad] = await Promise.all([
                fetchJSON(`flight-card?planFlightId=${planFlightId}&eng=false`),
                fetchJSON(`flight-airports?planFlightId=${planFlightId}&eng=false`),
                fetchJSON(`preliminary-crew-load?planFlightId=${planFlightId}&eng=false`)
            ]);

            const legs = Array.isArray(airports) ? airports : [];
            const first = legs[0] || {};
            const last = legs.length ? legs[legs.length - 1] : {};

            // Only genuine actual times. The *Calculation fields mirror the
            // schedule on flights that have not operated yet, so using them
            // would write fabricated departure/arrival times into the form.
            const actualDep = firstOf(first.DepartUTC, first.TakeoffUTCReal);
            const actualArr = firstOf(last.ArriveUTC, last.LandingUTCReal);
            const schedDep = first.TakeoffUTC;
            const schedArr = last.LandingUTC;

            const crewNames = (crewLoad.crew || [])
                .filter(c => c.personnel)
                .map(c => c.personnel);

            const plnMatch = /№\s*(\S+)/.exec(card.plnName || '');

            const payload = {
                'flight-no':   card.flightName || '',
                'ac-reg':      plnMatch ? plnMatch[1] : '',
                'flight-date': dateStr(card.dateUtc),
                'embark':      first.AirportIATA || first.AirportICAO || '',
                'disembark':   last.AirportIATA || last.AirportICAO || '',
                'crew-1':      crewNames[0] || '',
                'crew-2':      crewNames[1] || '',
                'move-ed':     hhmm(schedDep),
                'move-ad':     hhmm(actualDep),
                'move-ee':     durationHHMM(schedDep, schedArr),
                'move-at':     durationHHMM(actualDep, actualArr),
                'move-aa':     hhmm(actualArr)
            };

            if (first.DelayTakeoffName) payload['delay-reason'] = first.DelayTakeoffName;
            if (first.StandName) payload['rem-36'] = 'STAND ' + first.StandName;

            // Drop empties so we never blank out something already filled in.
            Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k]; });

            const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
            // Cache-busting query param defeats any stale Service Worker cache
            // on the checklist app, regardless of its own cache version.
            window.open(`${CHECKLIST_URL}?t=${Date.now()}#import=${encoded}`, '_blank');
        } catch (err) {
            console.error(err);
            alert('Export failed: ' + err.message);
        }
    }

    function addButton() {
        if (document.getElementById('checklist-export-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'checklist-export-btn';
        btn.textContent = '📋 Export to Checklist';
        btn.style.cssText = [
            'position:fixed', 'top:80px', 'right:20px', 'z-index:99999',
            'background:#0056b3', 'color:#fff', 'border:none', 'border-radius:6px',
            'padding:10px 16px', 'font-weight:bold', 'cursor:pointer',
            'box-shadow:0 2px 8px rgba(0,0,0,0.3)'
        ].join(';');
        btn.onclick = exportFlight;
        document.body.appendChild(btn);
    }

    addButton();
    // The page is an SPA; re-add the button if the app re-renders the body.
    new MutationObserver(addButton).observe(document.body, { childList: true });
})();
