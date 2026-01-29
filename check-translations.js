const fs = require('fs');
const en = JSON.parse(fs.readFileSync('./src/i18n/locales/en.json', 'utf-8'));
const fr = JSON.parse(fs.readFileSync('./src/i18n/locales/fr.json', 'utf-8'));

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const key in obj) {
    const newKey = prefix ? prefix + '.' + key : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...flattenKeys(obj[key], newKey));
    } else {
      keys.push(newKey);
    }
  }
  return keys;
}

function flattenObj(obj, prefix = '') {
  const result = {};
  for (const key in obj) {
    const newKey = prefix ? prefix + '.' + key : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObj(obj[key], newKey));
    } else {
      result[newKey] = obj[key];
    }
  }
  return result;
}

const enKeys = new Set(flattenKeys(en));
const frKeys = new Set(flattenKeys(fr));
const enFlat = flattenObj(en);
const frFlat = flattenObj(fr);

console.log('=== MISSING KEYS IN FRENCH ===');
const missing = Array.from(enKeys).filter(k => !frKeys.has(k)).sort();
console.log('Total missing:', missing.length);

if (missing.length > 0) {
  console.log('\nMissing translations:');
  missing.forEach(key => {
    console.log(`\n"${key}": "${enFlat[key]}"`);
  });
}
