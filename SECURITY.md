# Security Remediation Guide

This document describes the security issues found in this repository and provides instructions for remediation.

## Issues Found

### 1. Hardcoded Admin Password (Critical)

**Location:** `admin.html`

**Issue:** The admin password was hardcoded in client-side JavaScript:
```javascript
const ADMIN_PASSWORD = 'admin';
```

**Risk:** Anyone can view the page source and see the password. Additionally, the password 'admin' is trivially guessable.

**Remediation:**
- The password has been moved to an external configuration file (`config.js`)
- The configuration file is excluded from version control via `.gitignore`
- Choose a strong, unique password when deploying

### 2. Exposed Google Apps Script URL (Medium)

**Location:** `admin.html`, `teacher.html`, `student.html`

**Issue:** The Google Apps Script deployment URL was hardcoded and committed to version control:
```
https://script.google.com/macros/s/AKfycbx.../exec
```

**Risk:** While these URLs are designed to be public endpoints, exposing them in a public repository allows anyone to:
- Discover your backend API endpoints
- Potentially abuse the API if it lacks proper authorization
- Track your deployment IDs across commits

**Remediation:**
- The URL has been moved to an external configuration file (`config.js`)
- The configuration file is excluded from version control via `.gitignore`

---

## Required Actions

### Step 1: Revoke and Rotate the Google Apps Script Deployment

The exposed Google Apps Script URL should be considered compromised. Follow these steps:

1. **Go to Google Apps Script**
   - Open https://script.google.com
   - Navigate to your project

2. **Create a New Deployment**
   - Click "Deploy" > "New deployment"
   - Select "Web app" as the deployment type
   - Configure access settings appropriately
   - Click "Deploy" to create a new deployment
   - Copy the new Web App URL

3. **Delete the Old Deployment**
   - Click "Deploy" > "Manage deployments"
   - Find the old deployment (ending in `...sTiElxQ/exec`)
   - Click the three dots menu and select "Archive" or delete it

4. **Update Your Configuration**
   - Create your `config.js` file with the new URL (see Step 3 below)

### Step 2: Change the Admin Password

Since the old password ('admin') was exposed:

1. Choose a strong, unique password (minimum 12 characters, mix of letters, numbers, symbols)
2. Add this password to your `config.js` file

**Important Note:** The current authentication mechanism is client-side only and provides minimal security. For production use, consider implementing server-side authentication via Google Apps Script.

### Step 3: Create Your Configuration File

1. Copy the template file:
   ```bash
   cp config.template.js config.js
   ```

2. Edit `config.js` with your actual values:
   ```javascript
   const CONFIG = {
       GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_NEW_DEPLOYMENT_ID/exec',
       ADMIN_PASSWORD: 'your-strong-password-here'
   };
   ```

3. Verify `config.js` is in `.gitignore` (it should already be)

### Step 4: Verify the Fix

1. Open your HTML files in a browser
2. Check the browser console for any configuration errors
3. Test the admin login with the new password
4. Test that data loading works with the new script URL

---

## Using GitHub Secrets (For CI/CD Deployments)

If you deploy this application via GitHub Actions or similar CI/CD pipelines, you can use GitHub Secrets to manage sensitive configuration:

### Setting Up GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to "Settings" > "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Add the following secrets:
   - `GOOGLE_SCRIPT_URL`: Your Google Apps Script deployment URL
   - `ADMIN_PASSWORD`: Your admin password

### Example GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create config.js from secrets
        run: |
          cat > config.js << 'EOF'
          const CONFIG = {
              GOOGLE_SCRIPT_URL: '${{ secrets.GOOGLE_SCRIPT_URL }}',
              ADMIN_PASSWORD: '${{ secrets.ADMIN_PASSWORD }}'
          };
          EOF

      - name: Deploy to hosting
        # Add your deployment steps here
        # e.g., deploy to GitHub Pages, Netlify, Vercel, etc.
```

### Alternative: Environment Variables with Static Site Generators

If you use a build tool or static site generator:

1. Store secrets in `.env` file (gitignored):
   ```
   GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
   ADMIN_PASSWORD=your-password
   ```

2. Use a build script to inject values at build time

---

## Additional Security Recommendations

### 1. Implement Server-Side Authentication

The current client-side password check can be bypassed. For proper security:

- Move authentication logic to Google Apps Script
- Use session tokens or cookies
- Implement rate limiting on the backend

### 2. Add Authorization to Google Apps Script

Ensure your Google Apps Script validates requests:

```javascript
function doPost(e) {
  // Validate request origin
  // Check for authentication tokens
  // Implement rate limiting
}
```

### 3. Use HTTPS

Ensure all deployments serve content over HTTPS to protect data in transit.

### 4. Regular Security Audits

- Periodically review committed code for secrets
- Use tools like `git-secrets` or `trufflehog` to scan for credentials
- Consider using GitHub's secret scanning feature

---

## Summary Checklist

- [ ] Create new Google Apps Script deployment
- [ ] Delete/archive the old exposed deployment
- [ ] Create `config.js` from `config.template.js`
- [ ] Set a strong admin password
- [ ] Update the Google Script URL in `config.js`
- [ ] Test all functionality
- [ ] (Optional) Set up GitHub Secrets for CI/CD
- [ ] (Recommended) Implement server-side authentication

---

## Contact

If you have questions about this security remediation, please open an issue in this repository.
