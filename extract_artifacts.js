const fs = require('fs');
const path = require('path');

const artifactsPath = 'packages/sim-core/src/data/artifacts.ts';
const content = fs.readFileSync(artifactsPath, 'utf8');

const enArtifacts = {};
const plArtifacts = {};

// Regex to find artifact definitions
const artifactRegex = /id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*polishName:\s*'([^']+)',[\s\S]*?effects:\s*\[([\s\S]*?)\]/g;
let match;

while ((match = artifactRegex.exec(content)) !== null) {
    const id = match[1];
    const enName = match[2];
    const plName = match[3];
    const effectsContent = match[4];

    enArtifacts[id] = {
        name: enName,
        effects: {}
    };
    plArtifacts[id] = {
        name: plName,
        effects: {}
    };

    const effectDescRegex = /description:\s*'([^']+)'/g;
    let effectMatch;
    let idx = 0;
    while ((effectMatch = effectDescRegex.exec(effectsContent)) !== null) {
        // We use object for effects to match "effects.0", "effects.1" in i18next
        enArtifacts[id].effects[idx] = effectMatch[1]; // Using same for now, or could try to translate
        plArtifacts[id].effects[idx] = effectMatch[1];
        idx++;
    }
}

console.log(JSON.stringify({ en: enArtifacts, pl: plArtifacts }, null, 2));
