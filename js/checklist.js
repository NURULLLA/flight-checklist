/* JS for Checklist App */

function getUTCTime() {
    const now = new Date();
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    return `${hours}${minutes}`;
}

function setUTCTime(btnElement) {
    const wrapper = btnElement.parentElement;
    const input = wrapper.querySelector('input');
    if (input) {
        input.value = getUTCTime();
    }
}

function clearForm() {
    if (confirm("Are you sure you want to clear the form?")) {
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
    }
}

function generatePDF() {
    // Check if html2pdf is loaded
    if (typeof html2pdf === 'undefined') {
        alert("Error: html2pdf library not loaded. Please check your internet connection or local file.");
        return;
    }

    // Feedback to user
    const originalBtn = document.querySelector('.btn-word');
    if (originalBtn) originalBtn.innerText = "Generating...";


    const originalElement = document.getElementById('checklist-content');

    // 1. Create a deep clone of the element
    const clone = originalElement.cloneNode(true);

    // 2. Wrap clone in a fixed-width container to enforce A4 Landscape proportions
    // Crucial: Use min-width to prevent browser compression on small screens
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '794px';
    container.style.minWidth = '794px'; // Force non-collapsed width
    container.style.zIndex = '-9999';
    container.style.backgroundColor = '#ffffff';
    container.appendChild(clone);
    document.body.appendChild(container);

    // 3. Apply PDF mode class to the CLONE only
    clone.classList.add('pdf-mode');

    // 4. Manually sync values from original to clone
    const originalInputs = originalElement.querySelectorAll('input, textarea, select');
    const cloneInputs = clone.querySelectorAll('input, textarea, select');

    originalInputs.forEach((orig, index) => {
        const copy = cloneInputs[index];
        if (!copy) return;

        if (copy.tagName === 'SELECT') {
            copy.value = orig.value;
            const options = copy.querySelectorAll('option');
            options.forEach(opt => {
                if (opt.value === orig.value) opt.setAttribute('selected', 'selected');
            });
        } else if (copy.type === 'checkbox' || copy.type === 'radio') {
            copy.checked = orig.checked;
            if (orig.checked) copy.setAttribute('checked', 'checked');
        } else {
            copy.value = orig.value;
            copy.setAttribute('value', orig.value);
            if (copy.tagName === 'TEXTAREA') copy.innerText = orig.value;
        }
    });

    // 5. Handle Date Display Logic on Clone
    const dateInput = clone.querySelector('#flight-date-input');
    const dateDisplay = clone.querySelector('#pdf-date-display');
    if (dateInput && dateDisplay && dateInput.value) {
        const parts = dateInput.value.split('-');
        if (parts.length === 3) {
            dateDisplay.innerText = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
            dateDisplay.innerText = dateInput.value;
        }
    } else if (dateDisplay) {
        dateDisplay.innerText = '';
    }

    // 6. Generate PDF from Clone
    // We explicitly tell html2canvas the dimensions to capture
    const opt = {
        margin: 2,
        filename: `SGA_Flight_Summary_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            scale: 2,
            width: 794, // Force capture width
            windowWidth: 794, // Simulate desktop window
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        enableLinks: true
    };

    // Wait 500ms to ensure clone is rendered
    setTimeout(() => {
        html2pdf().set(opt).from(clone).save().then(() => {
            // 7. Cleanup
            document.body.removeChild(container);
            if (originalBtn) originalBtn.innerText = "Save as PDF";
        }).catch(err => {
            console.error("PDF Generation Error:", err);
            document.body.removeChild(container);
            alert("PDF Error: " + (err.message || err));
            if (originalBtn) originalBtn.innerText = "Save as PDF";
        });
    }, 500);
}

function calculateServiceTotal() {
    const startStr = document.getElementById('service-start').value;
    const endStr = document.getElementById('service-end').value;

    if (!startStr || !endStr) return; // Wait for both

    // Helper to parse HHMM
    function parseTime(tStr) {
        if (tStr.length !== 4) return null;
        const h = parseInt(tStr.substring(0, 2), 10);
        const m = parseInt(tStr.substring(2, 4), 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    }

    let startMin = parseTime(startStr);
    let endMin = parseTime(endStr);

    if (startMin === null || endMin === null) return;

    // Handle overnight (e.g. Start 2300, End 0100)
    let diff = endMin - startMin;
    if (diff < 0) {
        diff += 24 * 60;
    }

    const diffH = Math.floor(diff / 60);
    const diffM = diff % 60;

    document.getElementById('service-total').value = `${diffH}h ${diffM}m`;
}

function calculateLoadingTotal() {
    const startIds = ['load-fwd-start', 'load-main-start', 'load-aft-start'];
    const endIds = ['load-fwd-end', 'load-main-end', 'load-aft-end'];

    let startMins = [];
    let endMins = [];

    function parseTime(tStr) {
        // Strip non-digits
        const cleanStr = (tStr || '').replace(/\D/g, '');
        if (cleanStr.length !== 4) return null;
        const h = parseInt(cleanStr.substring(0, 2), 10);
        const m = parseInt(cleanStr.substring(2, 4), 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    }

    // 1. Gather all valid times
    for (let i = 0; i < 3; i++) {
        const sVal = document.getElementById(startIds[i]).value;
        const eVal = document.getElementById(endIds[i]).value;

        const sMin = parseTime(sVal);
        const eMin = parseTime(eVal);

        if (sMin !== null) startMins.push(sMin);
        if (eMin !== null) endMins.push(eMin);
    }

    if (startMins.length === 0 || endMins.length === 0) return;

    // 2. Overnight Heuristic
    // Combine all to check range
    const allTimes = [...startMins, ...endMins];
    const hasLate = allTimes.some(t => t > 1080); // > 18:00
    const hasEarly = allTimes.some(t => t < 540);  // < 09:00

    // If we have both Late Night and Early Morning times, shift Early times to next day
    if (hasLate && hasEarly) {
        startMins = startMins.map(t => (t < 540) ? t + 1440 : t);
        endMins = endMins.map(t => (t < 540) ? t + 1440 : t);
    }

    // 3. Find Global Min Start and Global Max End
    // Note: We use Math.min/max on the potentially shifted values
    const minStart = Math.min(...startMins);
    const maxEnd = Math.max(...endMins);

    // 4. Calculate Difference
    // If somehow maxEnd is still less than minStart (shouldn't happen with heuristic, but safe fallback), add 24h
    // But with the heuristic above, 23:55 (1435) and 00:20 (1460) are handled.
    // Case: Start 00:10, End 00:50. Late=false, Early=true. No shift. Diff 40. Correct.

    let diff = maxEnd - minStart;

    // Safety check for weird input order where Max End < Min Start roughly
    if (diff < 0) {
        diff += 1440;
    }

    const diffH = Math.floor(diff / 60);
    const diffM = diff % 60;

    document.getElementById('load-total-hrs').value = diffH;
    document.getElementById('load-total-min').value = diffM;
}

function calculateDelay() {
    const edStr = document.getElementById('move-ed').value;
    const adStr = document.getElementById('move-ad').value;
    const delayInput = document.getElementById('delay-time');

    if (!edStr || !adStr) return;

    function parseTime(tStr) {
        // Strip non-digits just in case
        const cleanStr = tStr.replace(/\D/g, '');
        if (cleanStr.length !== 4) return null;
        const h = parseInt(cleanStr.substring(0, 2), 10);
        const m = parseInt(cleanStr.substring(2, 4), 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    }

    const edMin = parseTime(edStr);
    const adMin = parseTime(adStr);

    if (edMin === null || adMin === null) return;

    let diff = adMin - edMin;

    // Overnight scenario assumption:
    // If Delay > 12 hours negative (e.g. ED 2300, AD 0100 -> -22 hours), assume next day (+24h).
    // If Delay is small negative (e.g. Early arrival ED 1400, AD 1350), it is not a delay.

    // However, usually we care about DELAY (Positive difference).
    // If AD < ED, flight left early -> No delay? Or negative delay?
    // Let's assume standard logic: 
    // If AD is shortly after ED, it's a delay.
    // If AD is shortly before ED, it's early (Delay 0?).
    // If AD is '0100' and ED is '2300', it's a 2 hour delay.

    if (diff < -720) { // If diff is less than -12 hours, assume overnight wrap
        diff += 1440;
    }

    if (diff > 0) {
        const diffH = Math.floor(diff / 60);
        const diffM = diff % 60;
        delayInput.value = `${diffH} HRS ${diffM} MIN`;
    } else {
        delayInput.value = ''; // No delay or early
    }
}

function updateUTCClock() {
    const now = new Date();
    const options = {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    // format: "24 Jan 2025 12:34:56 UTC"
    const timeString = now.toLocaleString('en-GB', options).replace(',', '') + ' UTC';
    const clockEl = document.getElementById('utc-clock');
    if (clockEl) {
        clockEl.innerText = timeString;
    }
}

// Start clock
setInterval(updateUTCClock, 1000);
updateUTCClock();
