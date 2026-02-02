
// Client-side wrapper that calls the serverless parse API.
// This avoids bundling server-only SDKs and keeps the API key secure on the server.

export const parseRawTimeData = async (text: string) => {
  if (!text || !text.trim()) throw new Error('No text provided for parsing');

  const res = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Parse API failed:', res.status, body);
    throw new Error(`Parse API failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  if (data?.error) {
    console.error('Parse API returned error:', data.error);
    throw new Error(data.error);
  }
  return data;
};
