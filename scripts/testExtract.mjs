function extractData(text) {
  const result = {
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

  // Helper to extract time in HH:MM:SS format, handling squashed text
  const extractTime = (pattern) => {
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
  const extractCount = (pattern) => {
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
  result.wait = extractTime(/(?:Total\s+)?Wait(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.talk = extractTime(/(?:Total\s+)?Talk(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.hold = extractTime(/(?:Total\s+)?Hold(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.customerTalk = extractTime(/Customer(?:\s+)?Talk(?:\s+Time)?[:\s]*(\d{1,2}:\d{2}:\d{2})/i);
  result.inbound = extractCount(/Inbound\s+Calls?[:\s]*(\d+)/i);
  result.outbound = extractCount(/Outbound\s+Calls?[:\s]*(\d+)/i);

  return result;
}

// Test cases
const testCases = [
  {
    input: 'Pause: 00:05:00 Dispo: 00:02:00 Dead: 00:00:30 Total Login: 08:30:00 Login At: 09:00:00 Logout At: 17:30:00 Wait: 00:01:00 Talk: 00:20:00 Hold: 00:00:10 CustomerTalk: 00:19:00 Inbound Calls: 120 Outbound Calls: 45',
    expected: {
      pause: '00:05:00',
      dispo: '00:02:00',
      dead: '00:00:30',
      currentLogin: '08:30:00',
      loginTimestamp: '09:00:00',
      logoutTimestamp: '17:30:00',
      wait: '00:01:00',
      talk: '00:20:00',
      hold: '00:00:10',
      customerTalk: '00:19:00',
      inbound: 120,
      outbound: 45
    }
  },
  {
    input: 'Total Pause Time3:22:08 Total Dispo Time: 01:15:30 Dead Time: 00:05:00 Login Time: 07:45:00 Session Start: 08:00:00 Session End: 16:00:00 Total Wait Time: 00:10:00 Total Talk Time: 02:30:00 Total Hold Time: 00:05:00 Customer Talk Time: 02:25:00 Inbound Calls: 200 Outbound Calls: 150',
    expected: {
      pause: '03:22:08',
      dispo: '01:15:30',
      dead: '00:05:00',
      currentLogin: '07:45:00',
      loginTimestamp: '08:00:00',
      logoutTimestamp: '16:00:00',
      wait: '00:10:00',
      talk: '02:30:00',
      hold: '00:05:00',
      customerTalk: '02:25:00',
      inbound: 200,
      outbound: 150
    }
  },
  {
    input: 'No relevant data here.',
    expected: {
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
    }
  }
];

console.log('Testing extractData function...\n');

testCases.forEach((test, index) => {
  console.log(`Test Case ${index + 1}:`);
  console.log('Input:', test.input);
  const result = extractData(test.input);
  console.log('Result:', result);
  console.log('Expected:', test.expected);
  const passed = JSON.stringify(result) === JSON.stringify(test.expected);
  console.log('Passed:', passed ? 'YES' : 'NO');
  if (!passed) {
    console.log('Differences:');
    Object.keys(test.expected).forEach(key => {
      if (result[key] !== test.expected[key]) {
        console.log(`  ${key}: got ${result[key]}, expected ${test.expected[key]}`);
      }
    });
  }
  console.log('---\n');
});
