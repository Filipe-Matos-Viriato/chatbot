import 'dotenv/config';

const port = process.env.TEST_PORT || '3007';
const url = `http://localhost:${port}/api/chat`;
const body = {
  clientId: 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c',
  query: 'Qual é o T2 mais barato?',
  visitorId: 'test-visitor',
  sessionId: 'test-session'
};

async function main() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log('[status]', res.status);
    console.log(text);
  } catch (err) {
    console.error('Request failed:', err);
    process.exit(1);
  }
}

main();


