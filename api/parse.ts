import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  console.log('parse handler invoked', { method: req.method, headers: req.headers && Object.keys(req.headers).length });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Prefer parsed body but capture raw body for debugging if missing
  let text: string | undefined = undefined;
  if (req.body && typeof req.body === 'object' && 'text' in req.body) {
    text = req.body.text;
    console.log('body.text present');
  } else {
    try {
      let raw = '';
      req.on && req.on('data', (c: any) => raw += c);
      await new Promise((resolve) => req.on && req.on('end', resolve));
      console.log('raw body:', raw?.substring ? raw.substring(0, 200) : raw);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && 'text' in parsed) text = parsed.text;
    } catch (err) {
      console.warn('Failed to parse raw body', err && err.message);
    }
  }

  if (!text || !text.trim()) return res.status(400).json({ error: 'Missing `text` in request body' });

  // Accept either server-side GENAI_API_KEY, legacy API_KEY, or a Vite-provided VITE_GEMINI_API_KEY
  const apiKey = process.env.GENAI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration: missing GENAI_API_KEY (or VITE_GEMINI_API_KEY)' });

  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log('Invoking GenAI - starting request');
    const timeoutMs = 55_000; // preemptive timeout a bit under function max duration
    const genaiPromise = ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a specialized data extractor for dialer performance reports. 
      Look at the provided text and extract these 12 specific values. 
      Note that labels and values might be squashed together.
      
      FIELDS TO EXTRACT:
      1. pause: (HH:MM:SS) - Often labeled "Total Pause Time"
      2. dispo: (HH:MM:SS) - Often labeled "Total Dispo Time"
      3. dead: (HH:MM:SS) - Often labeled "Total Dead Time"
      4. currentLogin: (HH:MM:SS) - Often labeled "Total Login Time" (Duration)
      5. loginTimestamp: (HH:MM:SS) - Often labeled "Login At" or "Session Start"
      6. logoutTimestamp: (HH:MM:SS) - Often labeled "Logout At" or "Session End"
      7. wait: (HH:MM:SS) - Often labeled "Total Wait Time"
      8. talk: (HH:MM:SS) - Often labeled "Total Talk Time"
      9. hold: (HH:MM:SS) - Often labeled "Total Hold Time"
      10. customerTalk: (HH:MM:SS) - Often labeled "Customer Talk Time"
      11. inbound: (Integer) - Look for "Inbound Calls" count
      12. outbound: (Integer) - Look for "Outbound Calls" count

      RULES:
      - If a time value is missing, return "00:00:00".
      - If a call count is missing, return 0.
      - Clean up any squashed text (e.g., "Time3:22:08" -> "03:22:08").
      
      TEXT TO PARSE:
      """
      ${text}
      """`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pause: { type: Type.STRING },
            dispo: { type: Type.STRING },
            dead: { type: Type.STRING },
            currentLogin: { type: Type.STRING },
            loginTimestamp: { type: Type.STRING },
            logoutTimestamp: { type: Type.STRING },
            wait: { type: Type.STRING },
            talk: { type: Type.STRING },
            hold: { type: Type.STRING },
            customerTalk: { type: Type.STRING },
            inbound: { type: Type.INTEGER },
            outbound: { type: Type.INTEGER },
          },
          required: ["pause", "dispo", "dead", "currentLogin", "loginTimestamp", "logoutTimestamp", "wait", "talk", "hold", "customerTalk", "inbound", "outbound"]
        }
      }
    });

    const response = await Promise.race([
      genaiPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('genai_timeout')), timeoutMs))
    ]);

    const responseText = (response as any).text;
    if (!responseText) return res.status(502).json({ error: 'Empty AI response' });

    const rawResult = JSON.parse(responseText.trim());

    const sanitize = (val: any) => {
      if (typeof val !== 'string') return '00:00:00';
      const parts = val.split(':');
      if (parts.length >= 2) {
        return parts.map((p: string) => p.padStart(2, '0')).join(':').substring(0, 8);
      }
      return '00:00:00';
    };

    const result = {
      ...rawResult,
      pause: sanitize(rawResult.pause),
      dispo: sanitize(rawResult.dispo),
      dead: sanitize(rawResult.dead),
      currentLogin: sanitize(rawResult.currentLogin),
      loginTimestamp: sanitize(rawResult.loginTimestamp),
      logoutTimestamp: sanitize(rawResult.logoutTimestamp),
      wait: sanitize(rawResult.wait),
      talk: sanitize(rawResult.talk),
      hold: sanitize(rawResult.hold),
      customerTalk: sanitize(rawResult.customerTalk),
      inbound: rawResult.inbound || 0,
      outbound: rawResult.outbound || 0
    };

    return res.status(200).json(result);
  } catch (e: any) {
    console.error('Gemini server error:', e);
    if (e && e.message === 'genai_timeout') {
      console.error('GenAI request timed out after timeoutMs');
      return res.status(504).json({ error: 'GenAI request timed out' });
    }
    const status = e?.status || 500;
    const body = e?.response || e?.message || 'Unknown server error';
    return res.status(status === 400 || status === 401 || status === 403 ? status : 500).json({ error: body });
  }
}