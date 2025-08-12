import OpenAI from 'openai';
import pinecone from '../config/pinecone.js';
import supabase from '../config/supabase.js';
import { randomUUID } from 'crypto';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function classifyIntentHeuristic(userText) {
  const t = String(userText || '').toLowerCase();
  const action = /(agendar|marcar|reserva(r)?|visita|simular|financiamento|proposta|enviar proposta|book|schedule)/i.test(t);
  const infoFresh = /(dispon[ií]vel|pre[cç]o|quanto custa|entrega|prazo|cronograma|documento|condi[cç][oõ]es)/i.test(t);
  if (action) return 'ACTION';
  if (infoFresh) return 'INFO_FRESH';
  return 'STORY_COMPARE';
}

async function classifyIntentLLM(userText) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      max_tokens: 10,
      messages: [
        { role: 'system', content: 'Classifica a intenção do utilizador em {INFO_FRESH, STORY_COMPARE, ACTION}. Responde só com a label.' },
        { role: 'user', content: String(userText || '').slice(0, 1500) }
      ]
    });
    const label = (completion.choices?.[0]?.message?.content || '').trim().toUpperCase();
    if (['INFO_FRESH', 'STORY_COMPARE', 'ACTION'].includes(label)) return label;
  } catch (_) {}
  return classifyIntentHeuristic(userText);
}

// --- Supabase tools ---
export async function get_unit(params = {}) {
  const { id, filters = {} } = params;
  let q = supabase.from('units').select('id, project_id, typology, area_m2, floor, view, base_price, media_urls, features');
  if (id) q = q.eq('id', id);
  if (filters.project_id) q = q.eq('project_id', filters.project_id);
  if (filters.typology) q = q.ilike('typology', `${filters.typology}%`);
  if (filters.minArea) q = q.gte('area_m2', filters.minArea);
  if (filters.view) q = q.ilike('view', `%${filters.view}%`);
  if (filters.maxPrice) q = q.lte('base_price', filters.maxPrice);
  const { data, error } = await q.limit(10);
  if (error) throw new Error(`get_unit error: ${error.message}`);
  return data || [];
}

export async function get_availability(unit_id) {
  const { data, error } = await supabase
    .from('unit_status')
    .select('unit_id, status, price, last_update')
    .eq('unit_id', unit_id)
    .maybeSingle();
  if (error) throw new Error(`get_availability error: ${error.message}`);
  return data || null;
}

export async function get_timeline(project_id) {
  const { data, error } = await supabase
    .from('build_timeline')
    .select('phase, eta_date, notes')
    .eq('project_id', project_id);
  if (error) throw new Error(`get_timeline error: ${error.message}`);
  return data || [];
}

export async function simulate_mortgage(price, down, rate, termYears) {
  const principal = Math.max(0, Number(price || 0) - Number(down || 0));
  const monthlyRate = Number(rate || 0) / 100 / 12;
  const n = Number(termYears || 0) * 12;
  if (!principal || !monthlyRate || !n) {
    return { monthly: null, total_interest: null };
  }
  const monthly = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  const total_interest = monthly * n - principal;
  return { monthly: Math.round(monthly), total_interest: Math.round(total_interest) };
}

export async function schedule_visit(unit_id, when, contact) {
  const payload = {
    id: randomUUID(),
    unit_id,
    visitor_name: contact?.name || null,
    visitor_phone: contact?.phone || null,
    visitor_email: contact?.email || null,
    scheduled_at: when || null,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('visits').insert([payload]);
  if (error) throw new Error(`schedule_visit error: ${error.message}`);
  return { ok: true, id: payload.id };
}

export async function get_price_status(unit_id) {
  const [{ data: status }, { data: history }] = await Promise.all([
    supabase.from('unit_status').select('price, last_update').eq('unit_id', unit_id).maybeSingle(),
    supabase.from('price_history').select('dt, price').eq('unit_id', unit_id).order('dt', { ascending: false }).limit(2),
  ]);
  let trend = 'flat';
  let last_change = null;
  if (Array.isArray(history) && history.length >= 2) {
    const [latest, prev] = history;
    if (latest && prev) {
      trend = latest.price > prev.price ? 'up' : latest.price < prev.price ? 'down' : 'flat';
      last_change = latest.dt;
    }
  }
  return { price: status?.price ?? null, trend, last_change };
}

// --- Retrieval ---
async function retrieveFromPinecone(userQuery, filters = {}) {
  if (!pinecone) return [];
  const indexName = process.env.PINECONE_INDEX || 'viriato_chatbot_1536';
  const index = pinecone.index(indexName);
  // Embed query
  const embRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: String(userQuery || '') });
  const vector = embRes.data?.[0]?.embedding;
  const query = {
    vector,
    topK: 6,
    includeMetadata: true,
    filter: { ...(filters.project_id && { project_id: filters.project_id }), ...(filters.typology && { typology: filters.typology }) },
  };
  const res = await index.query(query);
  const matches = res.matches || [];
  return matches.map(m => ({ score: m.score, metadata: m.metadata, id: m.id, text: m.metadata?.text || '' }));
}

function buildSystemPrompt() {
  return 'És um agente imobiliário persuasivo e honesto. Responde em pt-PT. Usa dados fresh dos tools para preço/stock. Conclui com um único próximo passo claro (CTA). Evita floreados; foca em valor, escassez legítima e utilidade.';
}

function truncatePassages(passages, maxChars = 4000) {
  const out = [];
  let total = 0;
  for (const p of passages) {
    const t = String(p.text || '');
    if (!t) continue;
    if (total + t.length > maxChars) break;
    out.push(t);
    total += t.length;
  }
  return out;
}

export async function answerWithRag({ userText, clientConfig, context }) {
  const label = await classifyIntentLLM(userText);

  // Default filters inferred from context or config
  const filters = { project_id: context?.developmentId || clientConfig?.defaultDevelopmentId || undefined };

  if (label === 'ACTION') {
    // Heuristic: detect schedule or mortgage
    if (/agend|visita|schedule|book/i.test(userText)) {
      const when = context?.when || new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const unitId = context?.unitId || context?.listingId || null;
      if (!unitId) {
        return { text: 'Posso agendar uma visita — prefere 11h ou 18h no próximo dia útil?', label };
      }
      await schedule_visit(unitId, when, { name: context?.name, phone: context?.phone, email: context?.email });
      return { text: 'Visita agendada. Posso enviar confirmação por email?', label };
    }
    if (/simul|financiamento|mortgage|prest/i.test(userText)) {
      const price = context?.price || context?.maxPrice || 300000;
      const sim = await simulate_mortgage(price, context?.down || 60000, context?.rate || 3.5, context?.termYears || 30);
      return { text: `Prestação estimada ~ €${sim.monthly} / mês. Quer que calcule também com entrada diferente?`, label };
    }
  }

  if (label === 'INFO_FRESH') {
    // Try to extract unit id from context and answer with status/price
    const unitId = context?.unitId || context?.listingId || null;
    if (unitId) {
      const [st, tl] = await Promise.all([get_availability(unitId), get_timeline(filters.project_id)]);
      const priceStr = st?.price != null ? `€${Number(st.price).toLocaleString('pt-PT')}` : '—';
      const eta = Array.isArray(tl) && tl[0]?.eta_date ? tl[0].eta_date : 'a confirmar';
      return { text: `Preço atual: ${priceStr}. Estado: ${st?.status || '—'}. Entrega estimada: ${eta}. Quer que agende uma visita (11h ou 18h)?`, label };
    }
    // Otherwise, fetch some units matching rough filters
    const units = await get_unit({ filters: { project_id: filters.project_id, typology: context?.typology, maxPrice: context?.maxPrice } });
    if (units.length) {
      const first = units[0];
      const st = await get_availability(first.id);
      const priceStr = st?.price != null ? `€${Number(st.price).toLocaleString('pt-PT')}` : '—';
      return { text: `Encontrei ${units.length} opções. Ex.: ${first.typology}, ${first.area_m2} m², vista ${first.view}. Preço: ${priceStr}. Quer que mostre 2–3 alternativas e marque uma visita?`, label };
    }
  }

  // STORY_COMPARE or fallback → Retrieval
  const passages = await retrieveFromPinecone(userText, { project_id: filters.project_id, typology: context?.typology });
  const contextText = truncatePassages(passages);
  const system = clientConfig?.prompts?.systemInstruction || buildSystemPrompt();
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: `Pergunta: ${userText}\n\nContexto:\n${contextText.join('\n\n')}` }
  ];
  const completion = await openai.chat.completions.create({ model: 'gpt-3.5-turbo', messages, max_tokens: 500 });
  const text = (completion.choices?.[0]?.message?.content || '').trim();
  return { text: text || 'Posso ajudar a comparar tipologias e marcar uma visita. Prefere 11h ou 18h?', label };
}

export default { answerWithRag };


