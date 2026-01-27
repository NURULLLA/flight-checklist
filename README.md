# SkyGuard Flight Summary Checklist

A professional, mobile-responsive web application for Loadmasters to digitally manage flight checklists, calculate delays, and generate PDF summaries offline.

## Features
-   **Mobile optimized**: Works perfectly on smartphones and tablets.
-   **Offline Capable**: Helper libraries are bundled, so "Save as PDF" works without internet.
-   **Smart Calculations**:
    -   Automatically calculates Service Times and Loading Durations.
    -   Handles overnight time shifts (e.g. 23:00 to 01:00).
    -   Computes Flight Delays (`AD - ED`).
-   **PDF Export**: Generates a standard A4 flight report using `html2pdf`.

## How to Use
1.  Open `checklist.html` in any modern web browser.
2.  Fill in the flight details.
3.  Use the logical checkboxes and time inputs.
4.  Click **Save as PDF** to download your report.

## Tech Stack
-   **HTML5 / CSS3 / JavaScript (Vanilla)**
-   **html2pdf.js** (Local bundle for offline support)
