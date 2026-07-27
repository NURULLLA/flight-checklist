// ==UserScript==
// @name         AviaBit Bridge for Loadmaster Flight Summary
// @namespace    skyguard.checklist
// @version      1.0
// @description  Lets the Flight Checklist app read your AviaBit flight history. Runs only on the checklist page; forwards read-only GET requests to ab-web.aviastartu.ru using your existing login session.
// @author       SkyGuard
// @match        https://nurullla.github.io/flight-checklist*
// @connect      ab-web.aviastartu.ru
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

/*
 * Why this exists
 * ---------------
 * The checklist app is served from github.io. A normal fetch() to
 * ab-web.aviastartu.ru from that origin is blocked by CORS, and the AviaBit
 * session cookie would not be sent anyway. Tampermonkey's GM_xmlhttpRequest
 * is exempt from CORS and does send your cookies, so this script acts as a
 * narrow, read-only bridge between the two.
 *
 * Safety notes
 * ------------
 *  - GET only. Any other method is refused.
 *  - Only paths starting with /api/ on ab-web.aviastartu.ru are allowed.
 *  - Only the endpoints in ALLOWED_PATHS are permitted.
 *  - Nothing is sent anywhere else; no credentials are read or stored.
 */

(function () {
    'use strict';

    var API_ORIGIN = 'https://ab-web.aviastartu.ru';

    // Read-only endpoints the checklist app is allowed to call.
    var ALLOWED_PATHS = [
        '/api/plan-flight',
        '/api/flight-airports',
        '/api/flight-card',
        '/api/preliminary-crew-load'
    ];

    function isAllowed(path) {
        if (typeof path !== 'string') return false;
        if (path.indexOf('/api/') !== 0) return false;
        if (path.indexOf('..') !== -1) return false;
        var base = path.split('?')[0];
        return ALLOWED_PATHS.indexOf(base) !== -1;
    }

    function reply(id, ok, payload) {
        var msg = { type: 'AVIABIT_RES', id: id, ok: ok };
        if (ok) msg.data = payload;
        else msg.error = payload;
        window.postMessage(msg, window.location.origin);
    }

    function announce() {
        window.postMessage({ type: 'AVIABIT_BRIDGE_READY' }, window.location.origin);
    }

    window.addEventListener('message', function (e) {
        // Only accept messages posted by the page itself.
        if (e.source !== window) return;
        var msg = e.data;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'AVIABIT_PING') {
            announce();
            return;
        }

        if (msg.type !== 'AVIABIT_REQ') return;

        if (!isAllowed(msg.path)) {
            reply(msg.id, false, 'Blocked: this endpoint is not on the bridge allow-list.');
            return;
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: API_ORIGIN + msg.path,
            headers: { 'Accept': 'application/json' },
            timeout: 20000,
            onload: function (res) {
                if (res.status === 401 || res.status === 403) {
                    reply(msg.id, false, 'Not signed in to AviaBit. Open ab-web.aviastartu.ru, log in, then try again.');
                    return;
                }
                if (res.status < 200 || res.status >= 300) {
                    reply(msg.id, false, 'AviaBit returned HTTP ' + res.status + '.');
                    return;
                }
                try {
                    reply(msg.id, true, JSON.parse(res.responseText));
                } catch (err) {
                    reply(msg.id, false, 'AviaBit returned a response that was not valid JSON (you may have been logged out).');
                }
            },
            onerror: function () {
                reply(msg.id, false, 'Network error contacting AviaBit. Check your connection or VPN.');
            },
            ontimeout: function () {
                reply(msg.id, false, 'AviaBit request timed out.');
            }
        });
    });

    announce();
    document.addEventListener('DOMContentLoaded', announce);
    window.addEventListener('load', announce);
})();
