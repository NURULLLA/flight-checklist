// ==UserScript==
// @name         AviaBit -> Flight Checklist Export
// @namespace    skyguard.checklist
// @version      1.0
// @description  Pull flight data from ab-web.aviastartu.ru and push it into the Loadmaster Flight Summary checklist app.
// @match        https://ab-web.aviastartu.ru/flight-card*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const CHECKLIST_URL = 'https://nurullla.github.io/flight-checklist/';

    function getPlanFlightId() {
        const params = new URLSearchParams(window.location.search);
        return params.get('planFlightId');
    }

    function toHHMM(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const h = String(d.getUTCHours()).padStart(2, '0');
        const m = String(d.getUTCMinutes()).padStart(2, '0');
        return `${h}${m}`;
    }

    function toDateStr(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        return `${dd}.${mm}.${d.getUTCFullYear()}`;
    }

    async function fetchJSON(path) {
        const res = await fetch(`https://ab-web.aviastartu.ru/api/${path}`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
        return res.json();
    }

    function parseCrewXML(xmlStr) {
        if (!xmlStr) return [];
        const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
        return Array.from(doc.getElementsByTagName('employee')).map(el => el.textContent.trim());
    }

    async function exportFlight() {
        const planFlightId = getPlanFlightId();
        if (!planFlightId) {
            alert('No planFlightId found in URL.');
            return;
        }

        try {
            const [card, airports, crewLoad] = await Promise.all([
                fetchJSON(`flight-card?planFlightId=${planFlightId}&eng=false`),
                fetchJSON(`flight-airports?planFlightId=${planFlightId}&eng=false`),
                fetchJSON(`preliminary-crew-load?planFlightId=${planFlightId}&eng=false`)
            ]);

            const firstLeg = Array.isArray(airports) && airports.length ? airports[0] : {};
            const lastLeg = Array.isArray(airports) && airports.length ? airports[airports.length - 1] : {};

            const crewNames = (crewLoad.crew || []).map(c => c.personnel);

            const plnMatch = /№\s*(\S+)/.exec(card.plnName || '');

            const payload = {
                'flight-no': card.flightName || '',
                'ac-reg': plnMatch ? plnMatch[1] : '',
                'flight-date': toDateStr(card.dateUtc),
                'embark': firstLeg.AirportIATA || firstLeg.AirportICAO || '',
                'disembark': lastLeg.AirportIATA || lastLeg.AirportICAO || '',
                'crew-1': crewNames[0] || '',
                'crew-2': crewNames[1] || '',
                'move-ed': toHHMM(firstLeg.TakeoffUTC || firstLeg.TakeoffCalculationUTC),
                'move-ad': toHHMM(firstLeg.TakeoffUTCReal),
                'move-aa': toHHMM(lastLeg.LandingUTCReal)
            };

            // Drop empty values so we don't blank out fields the user already filled.
            Object.keys(payload).forEach(k => {
                if (!payload[k]) delete payload[k];
            });

            const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
            window.open(`${CHECKLIST_URL}#import=${encoded}`, '_blank');
        } catch (err) {
            console.error(err);
            alert(`Export failed: ${err.message}`);
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
