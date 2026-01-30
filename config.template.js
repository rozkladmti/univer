/**
 * Configuration Template
 *
 * INSTRUCTIONS:
 * 1. Copy this file to 'config.js' in the same directory
 * 2. Replace the placeholder values with your actual configuration
 * 3. NEVER commit config.js to version control
 *
 * The config.js file is excluded from git via .gitignore
 */

const CONFIG = {
    // Google Apps Script Web App URL
    // Get this from: Google Apps Script > Deploy > Manage deployments
    GOOGLE_SCRIPT_URL: 'YOUR_GOOGLE_SCRIPT_URL_HERE',

    // Admin password for the admin panel
    // IMPORTANT: This is client-side only and provides minimal security
    // Consider implementing server-side authentication for production use
    ADMIN_PASSWORD: 'CHANGE_THIS_PASSWORD'
};
