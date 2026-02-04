import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)=(?:"([^"]*)"|'([^']*)'|(.*))\s*$/);
    if (m) process.env[m[1]] = (m[2] || m[3] || m[4] || '').trim();
  });
}

const apiKey = process.env.GENAI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
console.log('Using API Key from:', process.env.GENAI_API_KEY ? 'GENAI_API_KEY' : process.env.API_KEY ? 'API_KEY' : 'VITE_GEMINI_API_KEY');
console.log('API Key starts with:', apiKey ? apiKey.substring(0, 8) : 'None');
if (!apiKey) {
  console.error('No API key found in .env.local or environment. Aborting.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const text = `Pause: 00:05:00 Dispo: 00:02:00 Dead: 00:00:30 Total Login: 08:30:00 Login At: 09:00:00 Logout At: 17:30:00 Wait: 00:01:00 Talk: 00:20:00 Hold: 00:00:10 CustomerTalk: 00:19:00 Inbound Calls: 120 Outbound Calls: 45`;

(async () => {
  try {
    console.log('Sending test request to GenAI (won\'t log API key)');
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `You are a specialized data extractor for dialer performance reports. Extract the 12 values from the text. TEXT: "${text}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { pause: { type: Type.STRING }, dispo: { type: Type.STRING }, dead: { type: Type.STRING }, currentLogin: { type: Type.STRING }, loginTimestamp: { type: Type.STRING }, logoutTimestamp: { type: Type.STRING }, wait: { type: Type.STRING }, talk: { type: Type.STRING }, hold: { type: Type.STRING }, customerTalk: { type: Type.STRING }, inbound: { type: Type.INTEGER }, outbound: { type: Type.INTEGER } },
          required: ["pause", "dispo", "dead", "currentLogin", "loginTimestamp", "logoutTimestamp", "wait", "talk", "hold", "customerTalk", "inbound", "outbound"]
        }
      }
    });

    console.log('GenAI responded. Response text length:', (response.text || '').length);
    if (response.text) {
      try {
        const parsed = JSON.parse(response.text);
        console.log('Parsed keys:', Object.keys(parsed));
        console.log('Sample values:', Object.fromEntries(Object.entries(parsed).slice(0, 6)));
      } catch (e) {
        console.warn('Could not parse response text as JSON:', e.message);
        console.log('Raw text:', response.text.substring(0, 200));
      }
    }
  } catch (e) {
    console.error('GenAI call failed:', e?.status || e?.message || e);
    if (e?.response) console.error('Error response:', typeof e.response === 'string' ? e.response : JSON.stringify(e.response).slice(0, 400));
    process.exit(1);
  }
})();
