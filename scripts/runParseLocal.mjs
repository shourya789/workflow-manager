import handler from '../api/parse.js';

const makeReqRes = () => {
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(obj) { console.log('RES JSON:', { status: statusCode, body: obj }); },
    end() { console.log('RES END', statusCode); }
  };

  const req = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { text: 'Pause: 00:05:00 Dispo: 00:02:00 Dead: 00:00:30 Total Login: 08:30:00 Login At: 09:00:00 Logout At: 17:30:00 Wait: 00:01:00 Talk: 00:20:00 Hold: 00:00:10 CustomerTalk: 00:19:00 Inbound Calls: 120 Outbound Calls: 45' }
  };

  return { req, res };
};

(async () => {
  try {
    console.log('Running local parse handler test...');
    const { req, res } = makeReqRes();
    await handler(req, res);
  } catch (e) {
    console.error('Handler threw:', e);
  }
})();
