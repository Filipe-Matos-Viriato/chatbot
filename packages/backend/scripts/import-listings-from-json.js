#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import supabase from '../src/config/supabase.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function extractIdFromUrl(urlStr) {
  if (!urlStr) return null;
  const match = urlStr.match(/\/(\d+)(?:#.*)?$/);
  return match ? match[1] : null;
}

function parsePrice(str) {
  if (!str) return null;
  const clean = String(str).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(clean);
  return Number.isFinite(num) ? num : null;
}

function parseBedsFromTipologia(tipologia) {
  if (!tipologia) return null;
  const m = String(tipologia).match(/T\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function parseBathsFromDivisoes(divisoes) {
  if (!Array.isArray(divisoes)) return null;
  // count items where nome starts with 'Casa de banho'
  return divisoes.filter(d => typeof d?.nome === 'string' && /^Casa de banho/i.test(d.nome)).length || null;
}

function toAmenities(array) {
  if (!Array.isArray(array)) return null;
  return array.map(String);
}

async function readJsonFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return readJsonFilesRecursive(full);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) return [full];
    return [];
  }));
  return files.flat(2);
}

async function main() {
  const args = parseArgs(process.argv);
  const dir = args.dir || args.directory;
  const clientId = args.clientId || args.clientid;
  const clientName = args.clientName || args.clientname || null;
  const developmentId = args.developmentId || args.developmentid || null;

  if (!dir || !clientId) {
    console.error('Usage: node scripts/import-listings-from-json.js --dir <folder> --clientId <uuid> [--clientName "Up Investments"] [--developmentId <uuid>]');
    process.exit(1);
  }

  const absDir = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  console.log(`[import] Reading JSON files from: ${absDir}`);
  const files = await readJsonFilesRecursive(absDir);
  if (files.length === 0) {
    console.warn('[import] No JSON files found.');
    process.exit(0);
  }

  console.log(`[import] Found ${files.length} JSON files.`);

  const rows = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const data = JSON.parse(raw);

      const id = extractIdFromUrl(data.url_pt) || extractIdFromUrl(data.url_en);
      if (!id) {
        console.warn(`[skip] Could not extract listing id from URLs in ${file}`);
        continue;
      }

      const price = parsePrice(data['preço'] || data.preco);
      const beds = parseBedsFromTipologia(data.tipologia);
      const baths = parseBathsFromDivisoes(data?.descricao?.divisoes);
      const amenities = toAmenities(data?.descricao?.detalhes_extra);
      const name = `${data.tipologia || ''} ${data.fracao || ''} - Bloco ${data.bloco || ''}`.trim();

      const row = {
        id: String(id),
        name,
        type: data.tipologia || null,
        price: price,
        beds: beds,
        baths: baths,
        amenities: amenities,
        client_id: clientId,
        client_name: clientName,
        development_id: developmentId || null,
        listing_status: 'available',
        current_state: 'project',
      };

      rows.push(row);
    } catch (err) {
      console.error(`[error] Failed to parse ${file}:`, err.message);
    }
  }

  if (rows.length === 0) {
    console.warn('[import] Nothing to insert.');
    process.exit(0);
  }

  console.log(`[import] Upserting ${rows.length} listings to Supabase...`);
  const { data, error } = await supabase
    .from('listings')
    .upsert(rows, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('[import] Supabase error:', error.message);
    process.exit(1);
  }

  console.log(`[import] Done. Upserted ${data?.length ?? 0} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


