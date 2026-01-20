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
const useTranslationRegex = /useTranslation\s*\(\s*['"`]([^'"`]+)['"`]/;

const keysByNamespace = {};
const hardcodedPolish = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Skip if it doesn't useTranslation
  if (!content.includes('useTranslation')) {
    // Still check for hardcoded Polish strings in all files
    const polishRegex = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{3,}/g; // 3+ chars to avoid small false positives
    let pMatch;
    while ((pMatch = polishRegex.exec(content)) !== null) {
      hardcodedPolish.push({ file, text: pMatch[0], context: content.substring(Math.max(0, pMatch.index - 20), Math.min(content.length, pMatch.index + 40)).replace(/\n/g, ' ') });
    }
    return;
  }

  let match;
  let ns = 'common'; // default
  let nsMatch = content.match(useTranslationRegex);
  if (nsMatch) {
    ns = nsMatch[1];
  }

  tRegex.lastIndex = 0;
  while ((match = tRegex.exec(content)) !== null) {
    const key = match[1];
    
    // Ignore things like "content-type" or paths
    if (key.includes('/') || key.includes('-') && !key.includes(':')) continue;
    
    let fullKey = key;
    let actualNs = ns;

    if (key.includes(':')) {
      [actualNs, fullKey] = key.split(':');
    }

    if (!keysByNamespace[actualNs]) keysByNamespace[actualNs] = new Set();
    keysByNamespace[actualNs].add(fullKey);
  }
  
  // Check for hardcoded Polish strings
  const polishRegex = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{3,}/g;
  let pMatch;
  while ((pMatch = polishRegex.exec(content)) !== null) {
    hardcodedPolish.push({ file, text: pMatch[0], context: content.substring(Math.max(0, pMatch.index - 20), Math.min(content.length, pMatch.index + 40)).replace(/\n/g, ' ') });
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
    console.log(`Namespace [${ns}] NOT FOUND in JSON files! Used in keys like ${[...keysByNamespace[ns]].slice(0, 3).join(', ')}`);
    continue;
  }

  const enContent = JSON.parse(fs.readFileSync(enFile, 'utf8'));
  const jsonKeys = new Set(getJsonKeys(enContent));

  const missingInJson = [...keysByNamespace[ns]].filter(k => !jsonKeys.has(k));

  if (missingInJson.length > 0) {
    console.log(`\nNamespace [${ns}]: Missing in JSON (${missingInJson.length})`);
    missingInJson.forEach(k => console.log(`  - ${k}`));
  }
}

console.log('\n--- Hardcoded Polish Strings (Possible missing translations) ---');
const uniquePolish = [...new Map(hardcodedPolish.map(item => [item.file + item.text, item])).values()];
uniquePolish.forEach(item => {
  if (item.file.includes('locales')) return; // ignore locale files
  console.log(`File: ${item.file}`);
  console.log(`  - "${item.text}" (Context: ...${item.context}...)`);
});
