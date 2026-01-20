import fs from 'fs';
import path from 'path';

const localesDir = 'c:/dev/arcade/apps/web/src/locales';
const languages = ['en', 'pl'];
const namespaces = ['auth', 'common', 'game', 'modals'];

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], `${prefix}${key}.`));
    } else {
      keys.push(`${prefix}${key}`);
    }
  }
  return keys;
}

const allKeys = {};

for (const lang of languages) {
  allKeys[lang] = {};
  for (const ns of namespaces) {
    const filePath = path.join(localesDir, lang, `${ns}.json`);
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      allKeys[lang][ns] = getKeys(content);
    } else {
      console.warn(`File missing: ${filePath}`);
    }
  }
}

console.log('--- Missing keys comparison ---');

for (const ns of namespaces) {
  const enKeys = new Set(allKeys['en'][ns] || []);
  const plKeys = new Set(allKeys['pl'][ns] || []);

  const missingInPl = [...enKeys].filter(key => !plKeys.has(key));
  const missingInEn = [...plKeys].filter(key => !enKeys.has(key));

  if (missingInPl.length > 0) {
    console.log(`\nNamespace [${ns}]: Missing in PL (${missingInPl.length})`);
    missingInPl.forEach(key => console.log(`  - ${key}`));
  }

  if (missingInEn.length > 0) {
    console.log(`\nNamespace [${ns}]: Missing in EN (${missingInEn.length})`);
    missingInEn.forEach(key => console.log(`  - ${key}`));
  }
}
