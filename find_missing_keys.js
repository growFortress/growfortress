import fs from 'fs';
import path from 'path';

const srcDir = 'c:/dev/arcade/apps/web/src';
const localesDir = 'c:/dev/arcade/apps/web/src/locales';

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

const files = getAllFiles(srcDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

const tRegex = /t\s*\(\s*['"`]([^'"`]+)['"`]/g;
const useTranslationRegex = /useTranslation\s*\(\s*['"`]([^'"`]+)['"`]/g;

const keysByNamespace = {};

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let match;

  // Find namespace in the file
  let ns = 'common'; // default
  let nsMatch = useTranslationRegex.exec(content);
  if (nsMatch) {
    ns = nsMatch[1];
  }
  // Reset regex
  useTranslationRegex.lastIndex = 0;

  while ((match = tRegex.exec(content)) !== null) {
    const key = match[1];
    let fullKey = key;
    let actualNs = ns;

    if (key.includes(':')) {
      [actualNs, fullKey] = key.split(':');
    }

    if (!keysByNamespace[actualNs]) keysByNamespace[actualNs] = new Set();
    keysByNamespace[actualNs].add(fullKey);
  }
});

function getJsonKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getJsonKeys(obj[key], `${prefix}${key}.`));
    } else {
      keys.push(`${prefix}${key}`);
    }
  }
  return keys;
}

console.log('--- Keys used in code vs JSON ---');

for (const ns in keysByNamespace) {
  const enFile = path.join(localesDir, 'en', `${ns}.json`);
  if (!fs.existsSync(enFile)) {
    console.log(`Namespace [${ns}] not found in JSON files! Used in code.`);
    continue;
  }

  const enContent = JSON.parse(fs.readFileSync(enFile, 'utf8'));
  const jsonKeys = new Set(getJsonKeys(enContent));

  const missingInJson = [...keysByNamespace[ns]].filter(k => !jsonKeys.has(k));

  if (missingInJson.length > 0) {
    console.log(`Namespace [${ns}]: Missing in JSON (${missingInJson.length})`);
    missingInJson.forEach(k => console.log(`  - ${k}`));
  }
}
