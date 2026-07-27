/* AviaBit Flight History integration for the Loadmaster Flight Summary.
 *
 * The checklist app is a static page on github.io and cannot call
 * ab-web.aviastartu.ru directly (cross-origin + session cookie).
 * A Tampermonkey bridge (tools/aviabit-bridge.user.js) runs on this page,
 * performs the requests with GM_xmlhttpRequest, and answers over postMessage.
 *
 * Protocol
 *   page   -> bridge : {type:'AVIABIT_REQ',  id, path}
 *   bridge -> page   : {type:'AVIABIT_RES',  id, ok, data|error}
 *   page   -> bridge : {type:'AVIABIT_PING'}
 *   bridge -> page   : {type:'AVIABIT_BRIDGE_READY'}
 */
(function () {
    'use strict';

    var BRIDGE_TIMEOUT = 15000;
    var bridgeReady = false;
    var pending = {};
    var reqSeq = 0;
    var flightCache = [];

    /* ---------- bridge plumbing ---------- */

    window.addEventListener('message', function (e) {
        if (e.source !== window) return;
        var msg = e.data;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'AVIABIT_BRIDGE_READY') {
            bridgeReady = true;
            return;
        }
        if (msg.type === 'AVIABIT_RES' && pending[msg.id]) {
            var p = pending[msg.id];
            delete pending[msg.id];
            clearTimeout(p.timer);
            if (msg.ok) p.resolve(msg.data);
            else p.reject(new Error(msg.error || 'Request failed'));
        }
    });

    window.postMessage({ type: 'AVIABIT_PING' }, '*');

    function apiGet(path) {
        return new Promise(function (resolve, reject) {
            var id = 'r' + (++reqSeq);
            var timer = setTimeout(function () {
                delete pending[id];
                reject(new Error('AviaBit did not respond. Check that the bridge userscript is installed and that you are logged in to ab-web.aviastartu.ru.'));
            }, BRIDGE_TIMEOUT);
            pending[id] = { resolve: resolve, reject: reject, timer: timer };
            window.postMessage({ type: 'AVIABIT_REQ', id: id, path: path }, '*');
        });
    }

    /* ---------- formatting helpers ---------- */

    function hhmm(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0');
    }

    function hhmmColon(iso) {
        var v = hhmm(iso);
        return v ? v.slice(0, 2) + ':' + v.slice(2) : '--:--';
    }

    function dateStr(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return String(d.getUTCDate()).padStart(2, '0') + '.' +
               String(d.getUTCMonth() + 1).padStart(2, '0') + '.' +
               d.getUTCFullYear();
    }

    function dayLabel(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return String(d.getUTCDate()).padStart(2, '0') + '.' +
               String(d.getUTCMonth() + 1).padStart(2, '0');
    }

    // Duration between two ISO timestamps, rendered HHMM (the format the form parses).
    function durationHHMM(fromIso, toIso) {
        if (!fromIso || !toIso) return '';
        var a = new Date(fromIso).getTime();
        var b = new Date(toIso).getTime();
        if (isNaN(a) || isNaN(b)) return '';
        var mins = Math.round((b - a) / 60000);
        while (mins < 0) mins += 1440;
        if (mins >= 1440) return '';
        return String(Math.floor(mins / 60)).padStart(2, '0') + String(mins % 60).padStart(2, '0');
    }

    function firstIso() {
        for (var i = 0; i < arguments.length; i++) {
            if (arguments[i]) return arguments[i];
        }
        return null;
    }

    // AviaBit stores crew as an XML fragment on the plan-flight row.
    function parseCrewXML(xml) {
        if (!xml) return [];
        try {
            var doc = new DOMParser().parseFromString(xml, 'text/xml');
            return Array.from(doc.getElementsByTagName('employee'))
                .map(function (el) {
                    return {
                        name: (el.textContent || '').trim(),
                        seat: el.getAttribute('armChair') || '',
                        order: parseInt(el.getAttribute('orderNumber') || '0', 10)
                    };
                })
                .filter(function (c) { return c.name; })
                .sort(function (a, b) { return a.order - b.order; });
        } catch (err) {
            return [];
        }
    }

    /* ---------- the mapping: AviaBit leg -> checklist field IDs ---------- */

    function mapLegToForm(leg, detail) {
        var crew = parseCrewXML(leg.crew);

        // ATD / ATA: block (air-parking) time first, then the real airborne
        // time. The *Calculation fields are deliberately NOT used here — for
        // flights that have not operated yet AviaBit fills them with the
        // scheduled time, which would put fabricated "actual" times and a
        // zero delay into the form.
        var actualDep = firstIso(leg.dateTakeoffAirParking, leg.dateTakeoffReal);
        var actualArr = firstIso(leg.dateLandingAirParking, leg.dateLandingReal);

        var data = {
            'flight-no':   leg.flight || '',
            'ac-reg':      leg.pln || '',
            'flight-date': dateStr(leg.dateTakeoff),
            'embark':      leg.airPortTOCode || '',
            'disembark':   leg.airPortLACode || '',
            'crew-1':      crew[0] ? crew[0].name : '',
            'crew-2':      crew[1] ? crew[1].name : '',
            // ED/AD = scheduled vs actual departure. EE/AT = scheduled vs
            // actual time enroute (durations). EA and DELAY are derived by the
            // app from these four, so they are deliberately not set here.
            'move-ed':     hhmm(leg.dateTakeoff),
            'move-ad':     hhmm(actualDep),
            'move-ee':     durationHHMM(leg.dateTakeoff, leg.dateLanding),
            'move-at':     durationHHMM(actualDep, actualArr),
            'move-aa':     hhmm(actualArr)
        };

        // Delay reason and stand come from the per-flight detail call.
        if (detail && detail.legAirport) {
            var a = detail.legAirport;
            if (a.DelayTakeoffName) data['delay-reason'] = a.DelayTakeoffName;
            if (a.StandName) data['rem-36'] = 'STAND ' + a.StandName;
        }

        Object.keys(data).forEach(function (k) {
            if (!data[k]) delete data[k];
        });
        return data;
    }

    /* ---------- data fetching ---------- */

    function fetchFlights(days) {
        var now = Date.now();
        var begin = now - days * 86400000;
        var end = now + 7 * 86400000; // include the week ahead
        var path = '/api/plan-flight?dateBegin=' + begin + '&dateEnd=' + end +
                   '&eng=false&apCode=3&apId=0&template=0&showCancel=false';
        return apiGet(path).then(function (rows) {
            if (!Array.isArray(rows)) return [];
            return rows.slice().sort(function (a, b) {
                return new Date(b.dateTakeoff) - new Date(a.dateTakeoff);
            });
        });
    }

    // Pull the airport rows for a flight and pick the one matching this leg,
    // so multi-leg flights get the right delay reason and stand.
    function fetchLegDetail(leg) {
        if (!leg.pfRecordId) return Promise.resolve(null);
        return apiGet('/api/flight-airports?planFlightId=' + leg.pfRecordId + '&eng=false')
            .then(function (airports) {
                if (!Array.isArray(airports)) return null;
                var match = airports.filter(function (a) {
                    return a.AirportIATA === leg.airPortTOCode;
                })[0];
                return { legAirport: match || airports[0] || null };
            })
            .catch(function () { return null; });
    }

    /* ---------- UI ---------- */

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function openPanel() {
        var overlay = document.getElementById('ab-history-overlay');
        if (overlay) {
            overlay.classList.add('show');
            loadList(parseInt(document.getElementById('ab-range').value, 10));
            return;
        }
        buildPanel();
        loadList(30);
    }

    function closePanel() {
        var overlay = document.getElementById('ab-history-overlay');
        if (overlay) overlay.classList.remove('show');
    }

    function buildPanel() {
        var overlay = el('div', 'ab-overlay show');
        overlay.id = 'ab-history-overlay';
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closePanel();
        });

        var panel = el('div', 'ab-panel');

        var head = el('div', 'ab-head');
        head.appendChild(el('h3', null, 'Flight History — AviaBit'));

        var range = document.createElement('select');
        range.id = 'ab-range';
        [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']].forEach(function (o) {
            var opt = document.createElement('option');
            opt.value = o[0];
            opt.textContent = o[1];
            if (o[0] === 30) opt.selected = true;
            range.appendChild(opt);
        });
        range.addEventListener('change', function () {
            loadList(parseInt(range.value, 10));
        });
        head.appendChild(range);

        var close = el('button', 'ab-close', '✕');
        close.addEventListener('click', closePanel);
        head.appendChild(close);

        panel.appendChild(head);

        var body = el('div', 'ab-body');
        body.id = 'ab-body';
        panel.appendChild(body);

        panel.appendChild(el('div', 'ab-foot',
            'Click a flight to fill the form. Payload, fuel and loading times are not stored in AviaBit and stay manual.'));

        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    function setBody(node) {
        var body = document.getElementById('ab-body');
        if (!body) return;
        body.innerHTML = '';
        body.appendChild(node);
    }

    function loadList(days) {
        setBody(el('div', 'ab-msg', 'Loading flights…'));
        fetchFlights(days).then(function (rows) {
            flightCache = rows;
            if (!rows.length) {
                setBody(el('div', 'ab-msg', 'No flights found in this period.'));
                return;
            }
            setBody(renderTable(rows));
        }).catch(function (err) {
            var box = el('div', 'ab-msg ab-err');
            box.appendChild(el('div', null, err.message));
            if (!bridgeReady) {
                box.appendChild(el('div', 'ab-hint',
                    'Install tools/aviabit-bridge.user.js in Tampermonkey, then reload this page.'));
            }
            setBody(box);
        });
    }

    function renderTable(rows) {
        var table = el('table', 'ab-table');
        var thead = el('thead');
        var hr = el('tr');
        ['DATE', 'FLIGHT', 'ROUTE', 'STD / STA', 'ATD / ATA', 'A/C'].forEach(function (h) {
            hr.appendChild(el('th', null, h));
        });
        thead.appendChild(hr);
        table.appendChild(thead);

        var tbody = el('tbody');
        rows.forEach(function (leg, i) {
            var tr = el('tr');
            tr.appendChild(el('td', null, dayLabel(leg.dateTakeoff)));
            tr.appendChild(el('td', 'ab-flt', leg.flight || ''));
            tr.appendChild(el('td', null, (leg.airPortTOCode || '?') + ' → ' + (leg.airPortLACode || '?')));
            tr.appendChild(el('td', null, hhmmColon(leg.dateTakeoff) + ' / ' + hhmmColon(leg.dateLanding)));
            tr.appendChild(el('td', null,
                hhmmColon(firstIso(leg.dateTakeoffAirParking, leg.dateTakeoffReal)) + ' / ' +
                hhmmColon(firstIso(leg.dateLandingAirParking, leg.dateLandingReal))));
            tr.appendChild(el('td', null, leg.pln || ''));
            tr.addEventListener('click', function () { pickFlight(i, tr); });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    function pickFlight(index, tr) {
        var leg = flightCache[index];
        if (!leg) return;
        tr.classList.add('ab-loading');
        fetchLegDetail(leg).then(function (detail) {
            var data = mapLegToForm(leg, detail);
            if (typeof window.applyFlightData === 'function') {
                window.applyFlightData(data);
            }
            closePanel();
            toast('Filled from ' + (leg.flight || 'flight') + ' — payload & fuel still need entering.');
        }).catch(function (err) {
            tr.classList.remove('ab-loading');
            alert('Could not load flight details: ' + err.message);
        });
    }

    function toast(text) {
        var t = el('div', 'ab-toast', text);
        document.body.appendChild(t);
        setTimeout(function () { t.classList.add('show'); }, 10);
        setTimeout(function () {
            t.classList.remove('show');
            setTimeout(function () { t.remove(); }, 300);
        }, 4000);
    }

    /* ---------- boot ---------- */

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('btn-history');
        if (btn) btn.addEventListener('click', openPanel);
    });

    window.openFlightHistory = openPanel;
})();
