# GlassTodo

A bilingual, browser-based todo app with a glass-style interface and PWA installation.

## Features

Tasks and subtasks, categories and tags, five task statuses, optional deadlines and time ranges, progress notes, local attachments, and reminders while the app runs.

## Data and updates

Tasks and attachments stay in this browser's IndexedDB. There are no accounts, cloud sync, or data export yet. Different browsers, devices, and website origins have separate data. Keep a separate record of important information during this demo.

The production build caches app resources for offline use. To activate a downloaded update, close every GlassTodo window and reopen. System reminders are not guaranteed when the app is fully closed or the computer is asleep.

## Development

Use Node.js 22.12 or later. Run npm ci, npm test, and npm run dev. Build with npm run build. Verify offline resources with node scripts/check-pwa-build.js.

## Deployment

In repository Settings → Pages, select GitHub Actions as the source. Push to main to test, build, and deploy the dist directory. The workflow publishes app assets only; personal task data is never part of the repository.
