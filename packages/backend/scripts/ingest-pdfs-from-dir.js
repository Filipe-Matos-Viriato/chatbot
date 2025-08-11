#!/usr/bin/env node
/**
 * Bulk-ingest PDFs (or text files) from a directory into Pinecone using the
 * simplified PDF ingestion service. Optionally logs metadata to Supabase.
 *
 * Usage:
 *   node -r dotenv/config packages/backend/scripts/ingest-pdfs-from-dir.js \
 *     --dir "packages/backend/client-data/Up Investments/knowledge-base" \
 *     --clientId e6f484a3-c3cb-4e01-b8ce-a276f4b7355c \
 *     --documentCategory client
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { processDocument } from '../src/services/ingestion-service-pdf.js';
import { getClientConfig } from '../src/services/client-config-service.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        args[key] = val;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function readFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const list = await Promise.all(entries.map(async (e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return readFilesRecursive(full);
    if (e.isFile()) return [full];
    return [];
  }));
  return list.flat(2);
}

async function main() {
  const args = parseArgs(process.argv);
  const dir = args.dir;
  const clientId = args.clientId;
  const documentCategory = args.documentCategory || 'client';
  if (!dir || !clientId) {
    console.error('Usage: node scripts/ingest-pdfs-from-dir.js --dir <folder> --clientId <uuid> [--documentCategory client|development|listing]');
    process.exit(1);
  }

  const absDir = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  const files = await readFilesRecursive(absDir);
  const targetFiles = files.filter(f => f.toLowerCase().endsWith('.pdf') || f.toLowerCase().endsWith('.txt'));
  if (targetFiles.length === 0) {
    console.warn('[ingest] No PDF/TXT files found.');
    return;
  }

  console.log(`[ingest] Will process ${targetFiles.length} files from ${absDir}`);

  const clientConfig = await getClientConfig(clientId);
  let ok = 0, fail = 0;
  for (const filePath of targetFiles) {
    try {
      const buffer = await fs.readFile(filePath);
      const fileObj = {
        originalname: path.basename(filePath),
        mimetype: filePath.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain',
        buffer,
      };
      const result = await processDocument({ clientConfig, file: fileObj, documentCategory, metadata: {} });
      if (result?.success) {
        ok++;
        console.log(`  ✅ ${fileObj.originalname} → ${result.message}`);
      } else {
        fail++;
        console.warn(`  ❌ ${fileObj.originalname} → ${result?.message || 'Unknown error'}`);
      }
    } catch (err) {
      fail++;
      console.error(`  ❌ ${path.basename(filePath)} → ${err.message}`);
    }
  }
  console.log(`\n[ingest] Completed. Success: ${ok}, Failures: ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


