import fetch from 'node-fetch';

const url = 'https://workflow-manager-q5jaqj3ig-shourya789s-projects.vercel.app/api/parse';

(async ()=>{
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hi' })
    });
    console.log('status', res.status);
    const t = await res.text();
    console.log('body:', t.slice(0,500));
  } catch (e) { console.error('err', e); }
})();