# PG Manager PWA

A responsive, installable Progressive Web App for managing paying guests.

## Features
- Guest registration and profile management
- Guest photo upload
- Multiple ID/document uploads
- Room and bed management
- Monthly rent, advance/security deposit and current-month payment fields
- Payment ledger
- Dashboard statistics
- Search guests
- Responsive mobile/desktop UI
- Offline cache after first load
- Installable as a PWA

## Data storage
This starter version stores data locally in the browser using IndexedDB. Uploaded photos/documents are stored locally in the browser as well.

For production/multi-device use, connect the app to a backend such as Supabase, Firebase, or your own API.

## Run locally
A PWA service worker requires HTTP(S), not opening index.html directly with file://.

For example:
1. Install Python 3.
2. In this folder run: `python -m http.server 8000`
3. Open `http://localhost:8000`
4. Use the browser's install option to install the PWA.

## Important
Because data is stored locally, clearing browser site data can remove records. Add a cloud database and backup/export before using this as a production system.
