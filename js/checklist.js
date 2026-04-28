/* JS for Checklist App v2.0 */
console.log("Flight Checklist v2.0 Loaded");

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
        saveFormData(); // Save when time is set
    }
}

function setUTCTimeById(id) {
    const input = document.getElementById(id);
    if (input) {
        input.value = getUTCTime();
        saveFormData();
        // Trigger specific calculations if needed
        if (id.includes('service')) calculateServiceTotal();
    }
}

function showClearModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('show');
}

function closeClearModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.remove('show');
}

function clearForm() {
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });
    localStorage.removeItem('flightChecklistData');
    closeClearModal();
}

function generatePDF() {
    if (typeof html2pdf === 'undefined') {
        alert("Error: html2pdf library not loaded. Please check your internet connection or local file.");
        return;
    }

    const originalBtn = document.getElementById('btn-pdf');
    if (originalBtn) originalBtn.innerText = "Generating...";

    // Use CSS for styling instead of JS injection
    document.body.classList.add('pdf-export-mode');

    const originalElement = document.getElementById('checklist-content');
    const clone = originalElement.cloneNode(true);

    // Sync input values to the clone
    const originalInputs = originalElement.querySelectorAll('input, textarea, select');
    const cloneInputs = clone.querySelectorAll('input, textarea, select');
    originalInputs.forEach((orig, index) => {
        const copy = cloneInputs[index];
        if (!copy) return;
        if (copy.type === 'checkbox' || copy.type === 'radio') {
            copy.checked = orig.checked;
            if (orig.checked) copy.setAttribute('checked', 'checked');
        } else {
            copy.value = orig.value;
            copy.setAttribute('value', orig.value);
            if (copy.tagName === 'TEXTAREA') copy.innerText = orig.value;
        }
    });

    const container = document.createElement('div');
    container.className = 'pdf-export-mode'; // Apply the styles to the container too
    container.style.cssText = 'position:absolute; top:0; left:0; z-index:-9999; width:190mm; background:white;';
    container.appendChild(clone);
    document.body.appendChild(container);

    const opt = {
        margin: [0, 0, 0, 0],
        filename: `SGA_Flight_Summary_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            scrollX: 0,
            scrollY: 0,
            backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    setTimeout(() => {
        html2pdf().set(opt).from(clone).save().then(() => {
            document.body.removeChild(container);
            document.body.classList.remove('pdf-export-mode');
            if (originalBtn) originalBtn.innerText = "Save as PDF";
        }).catch(err => {
            console.error("PDF Generation Error:", err);
            document.body.removeChild(container);
            document.body.classList.remove('pdf-export-mode');
            alert("PDF Error: " + (err.message || err));
            if (originalBtn) originalBtn.innerText = "Save as PDF";
        });
    }, 600);
}

function calculateServiceTotal() {
    const startStr = document.getElementById('service-start').value;
    const endStr = document.getElementById('service-end').value;
    const target = document.getElementById('service-total');

    if (!startStr || !endStr || !target) return;

    const startMin = robustParseTime(startStr);
    const endMin = robustParseTime(endStr);

    if (startMin === null || endMin === null) return;

    let diff = endMin - startMin;
    if (diff < 0) diff += 1440;

    const diffH = Math.floor(diff / 60);
    const diffM = diff % 60;

    target.value = `${diffH}h ${diffM}m`;
    saveFormData();
}

function calculateLoadingTotal() {
    const startIds = ['load-fwd-start', 'load-main-start', 'load-aft-start'];
    const endIds = ['load-fwd-end', 'load-main-end', 'load-aft-end'];

    let startMins = [];
    let endMins = [];

    for (let i = 0; i < startIds.length; i++) {
        const sVal = document.getElementById(startIds[i]).value;
        const eVal = document.getElementById(endIds[i]).value;
        const sMin = robustParseTime(sVal);
        const eMin = robustParseTime(eVal);
        if (sMin !== null) startMins.push(sMin);
        if (eMin !== null) endMins.push(eMin);
    }

    const hrsEl = document.getElementById('load-total-hrs');
    const minEl = document.getElementById('load-total-min');
    if (!hrsEl || !minEl) return;

    if (startMins.length === 0 || endMins.length === 0) {
        hrsEl.value = '';
        minEl.value = '';
        return;
    }

    const allTimes = [...startMins, ...endMins];
    const hasLate = allTimes.some(t => t > 1080); // > 18:00
    const hasEarly = allTimes.some(t => t < 540);  // < 09:00

    if (hasLate && hasEarly) {
        startMins = startMins.map(t => (t < 540) ? t + 1440 : t);
        endMins = endMins.map(t => (t < 540) ? t + 1440 : t);
    }

    const minStart = Math.min(...startMins);
    const maxEnd = Math.max(...endMins);

    let diff = maxEnd - minStart;
    if (diff < 0) diff += 1440;

    hrsEl.value = Math.floor(diff / 60);
    minEl.value = diff % 60;
    saveFormData();
}

function calculateDelay() {
    const edStr = document.getElementById('move-ed').value;
    const adStr = document.getElementById('move-ad').value;
    const delayInput = document.getElementById('delay-time');

    if (!edStr || !adStr || !delayInput) return;

    const edMin = robustParseTime(edStr);
    const adMin = robustParseTime(adStr);

    if (edMin === null || adMin === null) return;

    let diff = adMin - edMin;
    if (diff < -720) diff += 1440;

    if (diff > 0) {
        delayInput.value = `${Math.floor(diff / 60)} HRS ${diff % 60} MIN`;
    } else {
        delayInput.value = '';
    }
    saveFormData();
}

function calculateEA() {
    const edStr = document.getElementById('move-ed').value;
    const eeStr = document.getElementById('move-ee').value;
    const eaInput = document.getElementById('move-ea');

    if (!edStr || !eeStr || !eaInput) return;

    const edMin = robustParseTime(edStr);
    const eeMin = robustParseTime(eeStr);

    if (edMin === null || eeMin === null) return;

    let totalMin = (edMin + eeMin) % 1440;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    
    eaInput.value = `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
    saveFormData();
}

function robustParseTime(tStr) {
    if (!tStr) return null;
    // Strip colons and other non-digits
    const cleanStr = tStr.replace(/:/g, '').replace(/\D/g, '');
    let h, m;
    if (cleanStr.length === 3) {
        h = parseInt(cleanStr.substring(0, 1), 10);
        m = parseInt(cleanStr.substring(1, 3), 10);
    } else if (cleanStr.length === 4) {
        h = parseInt(cleanStr.substring(0, 2), 10);
        m = parseInt(cleanStr.substring(2, 4), 10);
    } else {
        return null;
    }
    if (isNaN(h) || isNaN(m) || h >= 24 || m >= 60) return null;
    return h * 60 + m;
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
    const timeString = now.toLocaleString('en-GB', options).replace(',', '') + ' UTC';
    const clockEl = document.getElementById('utc-clock');
    if (clockEl) clockEl.innerText = timeString;
}

setInterval(updateUTCClock, 1000);
updateUTCClock();

function saveFormData() {
    const data = {};
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        const key = input.id || input.name;
        if (!key) return;
        if (input.type === 'checkbox' || input.type === 'radio') {
            data[key] = input.checked;
        } else {
            data[key] = input.value;
        }
    });
    localStorage.setItem('flightChecklistData', JSON.stringify(data));
}

function loadFormData() {
    const stored = localStorage.getItem('flightChecklistData');
    if (!stored) return;
    const data = JSON.parse(stored);
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        const key = input.id || input.name;
        if (key && data.hasOwnProperty(key)) {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = data[key];
            } else {
                input.value = data[key];
            }
        }
    });
    // Trigger calculations
    calculateServiceTotal();
    calculateLoadingTotal();
    calculateDelay();
    calculateEA();
}

// Auto-save and auto-calculate
document.addEventListener('input', function(e) {
    if (e.target.matches('input, textarea')) {
        saveFormData();
        const id = e.target.id;
        if (id.includes('service')) calculateServiceTotal();
        if (id.includes('load')) calculateLoadingTotal();
        if (id.includes('move')) {
            calculateDelay();
            calculateEA();
        }
    }
});

document.addEventListener('change', function(e) {
    if (e.target.matches('input[type="checkbox"], input[type="radio"]')) {
        saveFormData();
    }
});

// Run load on start
document.addEventListener('DOMContentLoaded', function() {
    loadFormData();

    // Wire up custom modal buttons
    const btnYes = document.getElementById('btn-confirm-yes');
    const btnNo = document.getElementById('btn-confirm-no');
    if (btnYes) btnYes.addEventListener('click', clearForm);
    if (btnNo) btnNo.addEventListener('click', closeClearModal);
});
