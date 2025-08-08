import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Ensure .env is loaded for standalone usage
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function regexHeuristic(text) {
  const t = text.toLowerCase();
  const num = (s) => {
    if (!s) return null;
    const n = Number(String(s).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const get = (re, idx = 1) => {
    const m = t.match(re);
    return m ? m[idx] : null;
  };
  const out = {
    price_eur: num(get(/preç(?:o|\.)[^0-9]*([0-9][0-9\.,]*)\s*€/i) || get(/([0-9][0-9\.,]*)\s*€/i)),
    typology: get(/\b(t\s*\d)\b/i)?.toUpperCase() || null,
    num_bedrooms: null,
    num_bathrooms: null,
    total_area_sqm: num(get(/área\s*(?:bruta|total)[^0-9]*([0-9][0-9\.,]*)\s*m²/i)),
    private_area_sqm: num(get(/área\s*privativa[^0-9]*([0-9][0-9\.,]*)\s*m²/i)),
    terrace_area_sqm: num(get(/terraç(?:o|os)[^0-9]*([0-9][0-9\.,]*)\s*m²/i)),
    block: get(/bloco\s*(\w+)/i),
    fraction: get(/fraç(?:ão|ao)\s*([a-z])/i)?.toUpperCase() || null,
    has_garage: /garagem/i.test(text) || null,
    has_balcony: /varanda/i.test(text) || null,
    has_terrace: /terraç/i.test(text) || null,
    has_garden: /jardim/i.test(text) || null,
    has_pool: /piscina/i.test(text) || null,
    has_gym: /ginásio|gimnásio|gym/i.test(text) || null,
    pets_allowed: /animais\s+permitidos/i.test(text) || null,
  };
  // Derive bedrooms/bathrooms loosely
  const bedMatch = get(/(\d+)\s*quartos/i);
  if (bedMatch) out.num_bedrooms = Number(bedMatch);
  const bathMatch = get(/(\d+)\s*casas?\s*de\s*banho/i);
  if (bathMatch) out.num_bathrooms = Number(bathMatch);
  if (!out.num_bedrooms && out.typology) {
    const m = out.typology.match(/t\s*(\d)/i);
    if (m) out.num_bedrooms = Number(m[1]);
  }
  return out;
}

export async function extractStructuredListingData(text, locale = 'pt') {
  // First, quick regex pass
  const heur = regexHeuristic(text);
  try {
    const sys = `Extract structured real-estate fields from the text. Return a single JSON object with keys:
{
  "price_eur": number|null,
  "typology": string|null,        // e.g., T1, T2, T3
  "num_bedrooms": number|null,
  "num_bathrooms": number|null,
  "total_area_sqm": number|null,
  "private_area_sqm": number|null,
  "terrace_area_sqm": number|null,
  "block": string|null,
  "fraction": string|null,
  "has_garage": boolean|null,
  "has_balcony": boolean|null,
  "has_terrace": boolean|null,
  "has_garden": boolean|null,
  "has_gym": boolean|null,
  "has_pool": boolean|null,
  "pets_allowed": boolean|null
}
Rules: currency is EUR; areas in m². If not present, use null.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: text.slice(0, 8000) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    const raw = completion.choices[0].message.content;
    const parsed = JSON.parse(raw);
    return { ...heur, ...parsed };
  } catch (_) {
    return heur;
  }
}

export default { extractStructuredListingData };


