function extractData(text: string) {
  const result: any = {
    pause: '00:00:00',
    dispo: '00:00:00',
    dead: '00:00:00',
    currentLogin: '00:00:00',
    loginTimestamp: '00:00:00',
    logoutTimestamp: '00:00:00',
    loginAt: '00:00:00',
    logoutAt: '00:00:00',
    wait: '00:00:00',
    talk: '00:00:00',
    hold: '00:00:00',
    customerTalk: '00:00:00',
    inbound: 0,
    outbound: 0
  };

  // Helper to extract time in HH:MM:SS format, handling squashed text
  const extractTime = (pattern: RegExp): string => {
    const match = text.match(pattern);
    if (match) {
      let time = match[1];
      // Clean up squashed text, e.g., "Time3:22:08" -> "3:22:08"
      time = time.replace(/^[^\d]*(\d)/, '$1');
      const parts = time.split(':');
      if (parts.length === 3) {
        return parts.map(p => p.padStart(2, '0')).join(':');
      }
    }
    return '00:00:00';
  };

  // Helper to extract integer count
  const extractCount = (pattern: RegExp): number => {
    const match = text.match(pattern);
    return match ? parseInt(match[1], 10) || 0 : 0;
  };

  // Define patterns for each field (more flexible to match variations)
  result.pause = extractTime(/(?:Total\s+)?Pause(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.dispo = extractTime(/(?:Total\s+)?Dispo(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.dead = extractTime(/(?:Total\s+)?Dead(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.currentLogin = extractTime(/(?:Total\s+)?Login(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.loginTimestamp = extractTime(/(?:Login\s+At|Session\s+Start)[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.logoutTimestamp = extractTime(/(?:Logout\s+At|Session\s+End)[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.loginAt = extractTime(/Login\s+At[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.logoutAt = extractTime(/Logout[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.wait = extractTime(/(?:Total\s+)?Wait(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.talk = extractTime(/(?:Total\s+)?Talk(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.hold = extractTime(/(?:Total\s+)?Hold(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.customerTalk = extractTime(/Customer(?:\s+)?Talk(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.inbound = extractCount(/Inbound\s+Calls?[:\s]*(\d+)/i);
  result.outbound = extractCount(/Outbound\s+Calls?[:\s]*(\d+)/i);

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
    console.log('Extracting data using regex - starting');
    const result = extractData(text);
    return res.status(200).json(result);
  } catch (e: any) {
    console.error('Extraction error:', e);
    return res.status(500).json({ error: e?.message || 'Unknown extraction error' });
  }
}
