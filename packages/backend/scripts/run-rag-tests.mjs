import 'dotenv/config';

const baseUrl = `http://localhost:${process.env.PORT || 3007}/api/chat`;
const clientId = process.env.TEST_CLIENT_ID || 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c';

const tests = [
  {
    name: 'INFO_FRESH: cheapest T2',
    body: { query: 'Qual é o T2 mais barato?' },
  },
  {
    name: 'STORY_COMPARE: T1 vs T2 with varanda up to 250k',
    body: { query: 'Estou a comparar T1 vs T2 com varanda até 250 000€. Qual recomendas?' },
  },
  {
    name: 'Explicit listing context: block_2_apt_D',
    body: { query: 'Resumo muito curto desta unidade?', context: { listingId: 'block_2_apt_D' } },
  },
  {
    name: 'ACTION: schedule request should not schedule',
    body: { query: 'Marca uma visita amanhã às 11h.' },
  },
  {
    name: 'No matches guard',
    body: { query: 'Quero uma moradia T5 com 6 casas de banho e piscina interior por 100k' },
  },
  {
    name: 'Language enforcement (English)',
    body: { query: 'What is the cheapest T2?' },
  },
  {
    name: 'Link surfacing request',
    body: { query: 'Envia o link do T2 D do Bloco 2' },
  },
  {
    name: 'Aggregative: most expensive T2',
    body: { query: 'Qual é o T2 mais caro?' },
  },
];

async function runOne(i, name, partialBody) {
  const fullBody = {
    clientId,
    visitorId: `test-visitor-${i}`,
    sessionId: `test-session-${i}`,
    ...partialBody,
  };
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullBody),
  });
  const text = await res.text();
  console.log(`\n=== [${i}] ${name} → ${res.status} ===`);
  console.log(text.slice(0, 800));
}

async function main() {
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    try {
      await runOne(i + 1, t.name, t.body);
    } catch (err) {
      console.error(`Test ${t.name} failed:`, err?.message || err);
    }
  }
}

main();


