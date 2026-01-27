import { GoogleGenAI, Type } from "@google/genai";

/**
 * Parses raw text from dialer reports using Gemini AI.
 * This version includes the required SDK initialization to prevent "Extraction failed" errors.
 */
export const parseRawTimeData = async (text: string) => {
  // 1. Get the API Key from Vite environment variables
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error("API Key is missing. Check your Vercel Environment Variables.");
    return null;
  }

  // 2. Initialize the Google GenAI client (The missing piece in the original code)
  const genAI = new GoogleGenAI(apiKey);
  
  // 3. Initialize the model. Gemini 1.5 Flash is highly stable for data extraction
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    // 4. Generate content with a strict JSON schema for 12 call metrics
    const result = await model.generateContent({
      contents: [{ 
        role: "user", 
        parts: [{ 
          text: `You are a specialized data extractor for dialer performance reports. 
          Look at the provided text and extract these 12 specific values. 
          Note that labels and values might be squashed together.

          FIELDS TO EXTRACT:
          1. pause: (HH:MM:SS) - Often labeled "Total Pause Time"
          2. dispo: (HH:MM:SS) - Often labeled "Total Dispo Time"
          3. dead: (HH:MM:SS) - Often labeled "Total Dead Time"
          4. currentLogin: (HH:MM:SS) - Often labeled "Total Login Time"
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

    // 5. Correctly wait for and extract the response text
    const response = await result.response;
    const responseText = response.text();
    
    if (!responseText) {
      console.warn("AI returned empty response text");
      return null;
    }
    
    const rawResult = JSON.parse(responseText.trim());
    
    // 6. Ensure HH:MM:SS format consistency
    const sanitize = (val: string) => {
      if (typeof val !== 'string') return '00:00:00';
      const parts = val.split(':');
      if (parts.length >= 2) {
        return parts.map(p => p.padStart(2, '0')).join(':');
      }
      return val;
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
    console.error("Failed to parse AI response:", e);
    // Rethrow to trigger the 'alert("Extraction failed")' in App.tsx
    return null; 
  }
};
