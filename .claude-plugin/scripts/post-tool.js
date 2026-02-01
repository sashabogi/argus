#!/usr/bin/env node

const http = require('http');
const path = require('path');
const fs = require('fs');

// Check if snapshot exists
const snapshotPath = path.join(process.cwd(), '.argus', 'snapshot.txt');
if (!fs.existsSync(snapshotPath)) {
  process.exit(0);
}

// Try to notify worker (if running)
const workerUrl = process.env.ARGUS_WORKER_URL || 'http://localhost:37778';

const req = http.request(`${workerUrl}/notify-change`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  timeout: 1000,
}, (res) => {
  // Ignore response
});

req.on('error', () => {
  // Worker not running - that's fine, mark file as stale instead
  const stalePath = path.join(process.cwd(), '.argus', '.stale');
  fs.writeFileSync(stalePath, new Date().toISOString());
});

req.write(JSON.stringify({
  projectPath: process.cwd(),
  timestamp: Date.now(),
}));

req.end();
