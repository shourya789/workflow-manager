// Improved regex-based data extraction
function extractDataWithRegex(text: string) {
  const result: any = {
    pause: '00:00:00',
    dispo: '00:00:00',
    dead: '00:00:00',
    currentLogin: '00:00:00',
    loginTimestamp: '00:00:00',
    logoutTimestamp: '00:00:00',
    wait: '00:00:00',
    talk: '00:00:00',
    hold: '00:00:00',
    customerTalk: '00:00:00',
    inbound: 0,
    outbound: 0
  };

  // Helper to extract and clean time in HH:MM:SS format
  const extractTime = (patterns: RegExp[]): string => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let time = match[1];
        // Clean up squashed text: "Time3:22:08" -> "3:22:08", "Pause2:15:30" -> "2:15:30"
        time = time.replace(/^[^\d]*(\d)/, '$1');
        const parts = time.split(':');
        if (parts.length === 3) {
          return parts.map(p => p.padStart(2, '0')).join(':');
        }
        if (parts.length === 2) {
          return '00:' + parts.map(p => p.padStart(2, '0')).join(':');
        }
      }
    }
    return '00:00:00';
  };

  // Helper to extract integer count
  const extractCount = (patterns: RegExp[]): number => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) return num;
      }
    }
    return 0;
  };

  // Extract each field with multiple pattern variations
  result.pause = extractTime([
    /(?:Total\s+)?Pause(?:\s+Time)?[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Pause[:\s]*(\d{1,2}:\d{2}:\d{2})/i,
    /(?:Total\s+)?Pause[^\d]*(\d{1,2}:\d{2}:\d{2})/i
  ]);

  result.dispo = extractTime([
    /(?:Total\s+)?Dispo(?:sition)?(?:\s+Time)?[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Dispo[:\s]*(\d{1,2}:\d{2}:\d{2})/i,
    /(?:Total\s+)?Dispo[^\d]*(\d{1,2}:\d{2}:\d{2})/i
  ]);

  result.dead = extractTime([
    /(?:Total\s+)?Dead(?:\s+Time)?[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Dead[:\s]*(\d{1,2}:\d{2}:\d{2})/i,
    /(?:Total\s+)?Dead[^\d]*(\d{1,2}:\d{2}:\d{2})/i
  ]);

  result.currentLogin = extractTime([
    /(?:Total\s+)?Login(?:\s+Time)?[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Login(?:\s+Duration)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i,
    /Duration[:\s]*(\d{1,2}:\d{2}:\d{2})/i,
    /(?:Total\s+)?Login[^\d]*(\d{1,2}:\d{2}:\d{2})/i
  ]);

  result.loginTimestamp = extractTime([
    /Login\s+At[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Session\s+Start[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Login(?:\s+Time)?[:\s-]*(\d{1,2}:\d{2}:\d{2})/i
  ]);

  result.logoutTimestamp = extractTime([
    /Logout\s+At[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Session\s+End[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Logout(?:\s+Time)?[:\s-]*(\d{1,2}:\d{2}:\d{2})/i
  ]);

  result.wait = extractTime([
    /(?:Total\s+)?Wait(?:ing)?(?:\s+Time)?[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Wait[:\s]*(\d{1,2}:\d{2}:\d{2})/i,
    /(?:Total\s+)?Wait[^\d]*(\d{1,2}:\d{2}:\d{2})/i
  ]);

  result.talk = extractTime([
    /(?:Total\s+)?Talk(?:ing)?(?:\s+Time)?[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Talk[:\s]*(\d{1,2}:\d{2}:\d{2})/i,
    /(?:Total\s+)?Talk[^\d]*(\d{1,2}:\d{2}:\d{2})/i
  ]);

  result.hold = extractTime([
    /(?:Total\s+)?Hold(?:\s+Time)?[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Hold[:\s]*(\d{1,2}:\d{2}:\d{2})/i,
    /(?:Total\s+)?Hold[^\d]*(\d{1,2}:\d{2}:\d{2})/i
  ]);

  result.customerTalk = extractTime([
    /Customer\s+Talk(?:\s+Time)?[:\s-]*(\d{1,2}:\d{2}:\d{2})/i,
    /Customer[:\s]*(\d{1,2}:\d{2}:\d{2})/i,
    /Cust(?:omer)?\s+Talk[^\d]*(\d{1,2}:\d{2}:\d{2})/i
  ]);

  result.inbound = extractCount([
    /Inbound\s+Calls?[:\s-]*(\d+)/i,
    /Inbound[:\s]*(\d+)/i,
    /In\s+Calls?[:\s]*(\d+)/i
  ]);

  result.outbound = extractCount([
    /Outbound\s+Calls?[:\s-]*(\d+)/i,
    /Outbound[:\s]*(\d+)/i,
    /Out\s+Calls?[:\s]*(\d+)/i
  ]);

  return result;
}

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

  try {
    console.log('Extracting data with regex - starting');
    const result = extractDataWithRegex(text);
    console.log('Extraction successful');
    return res.status(200).json(result);
  } catch (e: any) {
    console.error('Extraction error:', e);
    return res.status(500).json({ error: e?.message || 'Unknown extraction error' });
  }
}