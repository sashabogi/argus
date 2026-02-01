#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check for .argus/snapshot.txt in current directory
const snapshotPath = path.join(process.cwd(), '.argus', 'snapshot.txt');

if (fs.existsSync(snapshotPath)) {
  const stat = fs.statSync(snapshotPath);
  const ageMinutes = (Date.now() - stat.mtimeMs) / (1000 * 60);
  const ageHours = Math.round(ageMinutes / 60);

  if (ageMinutes > 60) {
    console.log(`[Argus] Snapshot is ${ageHours}h old. Consider refreshing with create_snapshot if codebase changed.`);
  } else {
    console.log(`[Argus] Snapshot ready (.argus/snapshot.txt) - ${Math.round(ageMinutes)}m old`);
  }
} else {
  console.log(`[Argus] No snapshot found. Create one with: argus snapshot . -o .argus/snapshot.txt`);
}
