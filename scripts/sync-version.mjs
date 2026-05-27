import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const manifestPath = 'public/manifest.json';
const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (!/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
  throw new Error(`Chrome manifest version must be numeric SemVer, got "${packageJson.version}"`);
}

manifestJson.version = packageJson.version;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifestJson, null, 2)}\n`);
