function exportToWord() {
    // 1. Target the specific content div
    const sourceEl = document.getElementById('checklist-content');
    if (!sourceEl) {
        alert("Content not found!");
        return;
    }

    // 2. Clone to modify for export without changing view
    const clone = sourceEl.cloneNode(true);

    // 3. Persist Input Values (Text and Checkbox)
    // Word does not auto-capture 'value' of inputs, we must bake it into attributes
    const inputs = clone.querySelectorAll('input');
    inputs.forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            if (input.checked) {
                input.setAttribute('checked', 'checked');
                // Replace checkbox with a character for better Word compatibility if needed
                // input.outerHTML = "[ X ]"; 
            } else {
                input.removeAttribute('checked');
                // input.outerHTML = "[__]";
            }
        } else {
            input.setAttribute('value', input.value);
        }
    });

    // 4. Define minimal CSS for the Word document
    const css = `
        <style>
            body { font-family: Arial, sans-serif; font-size: 11pt; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid black; padding: 5px; text-align: left; }
            th { background-color: #f0f0f0; }
            h1 { text-align: center; }
            .header-info { margin-bottom: 20px; }
            .header-info div { margin-bottom: 5px; font-weight: bold; }
        </style>
    `;

    // 5. Build full HTML blob
    const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset="utf-8">
            <title>Checklist Export</title>
            ${css}
        </head>
        <body>
            ${clone.innerHTML}
        </body>
        </html>
    `;

    // 6. Download
    const blob = new Blob(['\ufeff', html], {
        type: 'application/msword'
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Loadmaster_Checklist_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
