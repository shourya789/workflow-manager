import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([A-Za-z0-9_]+)=(?:"([^"]*)"|'([^']*)'|(.*))\s*$/);
        if (m) process.env[m[1]] = (m[2] || m[3] || m[4] || '').trim();
    });
}

const apiKey = process.env.GENAI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
console.log('Key:', apiKey ? apiKey.substring(0, 5) + '...' : 'NONE');

const ai = new GoogleGenAI({ apiKey });

(async () => {
    try {
        console.log('Listing models (iterating)...');
        const resp = await ai.models.list();
        let count = 0;
        // The SDK documentation suggests it returns an iterable
        let i = 0;
        const modelNames = [];
        for await (const model of resp) {
            modelNames.push(model.name);
        }
        fs.writeFileSync('models.txt', modelNames.join('\n'));
        console.log('Wrote ' + modelNames.length + ' models to models.txt');
    } catch (e) {
        console.error('Iteration failed:', e);
        // Fallback inspection
        try {
            const resp = await ai.models.list();
            console.log('Raw response keys:', Object.keys(resp));
        } catch (e2) { }
    }
})();
