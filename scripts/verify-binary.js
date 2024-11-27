// src/scripts/verify-binary.js
const fs = require('fs');
const path = require('path');

const APP_ROOT = path.join(__dirname, '..');
const binPath = path.join(APP_ROOT, 'bin', 'kopia.exe');

console.log('Verifying Kopia binary...');
console.log('Looking in:', binPath);

if (!fs.existsSync(binPath)) {
    console.error('ERROR: Kopia binary not found!');
    console.error('Expected location:', binPath);
    console.error('Please ensure kopia.exe is placed in the bin directory.');
    process.exit(1);
}

console.log('✓ Kopia binary found');
process.exit(0);
