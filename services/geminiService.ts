import { GoogleGenAI, Type } from "@google/genai";

export const parseRawTimeData = async (text: string) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error("API Key is missing in Environment Variables");
    return null;
  }

  // Proper initialization using the SDK
  const genAI = new GoogleGenAI(apiKey);
  
  // Use 'gemini-1.5-flash' for maximum stability on Free Tier
  // Or 'gemini-3-flash-preview' if you want the latest version shown in your screenshot
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const result = await model.generateContent({
      contents: [{ 
        role: "user", 
        parts: [{ 
          text: `You are a specialized data extractor for dialer performance reports. 
          Extract the following 12 fields from the text:
          pause, dispo, dead, currentLogin, loginTimestamp, logoutTimestamp, 
          wait, talk, hold, customerTalk, inbound, outbound.
          
          TEXT:
          """
          ${text}
          """` 
        }] 
      }],
      generationConfig: {
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

    const response = await result.response;
    const responseText = response.text();
    
    if (!responseText) return null;
    
    const rawResult = JSON.parse(responseText.trim());
    
    const sanitize = (val: any) => {
      if (typeof val !== 'string') return '00:00:00';
      const parts = val.split(':');
      return parts.length >= 2 ? parts.map(p => p.padStart(2, '0')).join(':') : val;
    };

    return {
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
    };
  } catch (e) {
    console.error("Gemini Extraction Error:", e);
    throw e; 
  }
};
