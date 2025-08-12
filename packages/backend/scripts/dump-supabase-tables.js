/*
  Dumps all public schema tables from Supabase into individual SQL files under
  packages/backend/supabase_sql_tables/.

  Requirements:
  - Node 18+.
  - One of the following database connection configurations:
    - SUPABASE_DB_URL (full Postgres URL)
    - SUPABASE_DB_HOST and SUPABASE_DB_PASSWORD (optionally SUPABASE_DB_USER, SUPABASE_DB_PORT, SUPABASE_DB_NAME)
    - SUPABASE_URL (to derive project ref) and SUPABASE_DB_PASSWORD (uses db.<ref>.supabase.co)

  Usage:
    npm run dump:supabase:tables --workspace=packages/backend

  Notes:
  - This script invokes `npx supabase@latest db dump --db-url <postgres-url>` to
    obtain a schema-only dump, then splits it by table into individual files.
*/

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(__dirname, '..');
const outputDir = path.resolve(backendDir, 'supabase_sql_tables');

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readEnvSupabaseUrl() {
  // Attempt to read .env colocated in packages/backend
  const envPath = path.resolve(backendDir, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const m = content.match(/\bSUPABASE_URL\s*=\s*([^\n\r]+)/);
    if (m) {
      const raw = m[1].trim().replace(/^['\"]|['\"]$/g, '');
      return raw;
    }
  }
  // Fallback to process.env
  return process.env.SUPABASE_URL || null;
}

function getProjectRefFromUrl(url) {
  if (!url) return null;
  // Typical: https://<project-ref>.supabase.co
  const match = url.match(/https?:\/\/(?<ref>[a-z0-9-]{15,})\.supabase\./i);
  return match?.groups?.ref ?? null;
}

function buildDbUrl() {
  // Priority 1: Use SUPABASE_DB_URL directly if provided
  const directUrl = process.env.SUPABASE_DB_URL;
  if (directUrl) return directUrl.trim();

  // Priority 2: Construct from individual parts if provided
  const host = process.env.SUPABASE_DB_HOST;
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const dbName = process.env.SUPABASE_DB_NAME || 'postgres';
  const user = process.env.SUPABASE_DB_USER || 'postgres';
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (host && password) {
    const encUser = encodeURIComponent(user);
    const encPass = encodeURIComponent(password);
    return `postgresql://${encUser}:${encPass}@${host}:${port}/${dbName}`;
  }

  // Priority 3: Derive from SUPABASE_URL + SUPABASE_DB_PASSWORD
  const supabaseUrl = readEnvSupabaseUrl();
  const ref = getProjectRefFromUrl(supabaseUrl);
  const supabaseDbPassword = process.env.SUPABASE_DB_PASSWORD;
  if (ref && supabaseDbPassword) {
    const encUser = encodeURIComponent('postgres');
    const encPass = encodeURIComponent(supabaseDbPassword);
    const derivedHost = `db.${ref}.supabase.co`;
    return `postgresql://${encUser}:${encPass}@${derivedHost}:5432/postgres`;
  }

  return null;
}

async function runSupabaseDump(dbUrl, tempFile) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      'supabase@latest',
      'db',
      'dump',
      '--db-url',
      dbUrl,
      '--schema',
      'public',
      '--file',
      tempFile,
    ];

    const child = spawn('npx', args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: process.env,
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`supabase db dump exited with code ${code}`));
    });
  });
}

function whereCmd(cmd) {
  return new Promise((resolve) => {
    const program = process.platform === 'win32' ? 'where' : 'command';
    const args = process.platform === 'win32' ? [cmd] : ['-v', cmd];
    const child = spawn(program, args, { stdio: 'ignore', shell: process.platform === 'win32' });
    child.on('exit', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function runPgDump(dbUrl, schemasCsv, tempFile) {
  const hasPgDump = await whereCmd('pg_dump');
  if (!hasPgDump) return false;

  return new Promise((resolve, reject) => {
    const args = [
      '--schema-only',
      '--no-owner',
      '--no-acl',
      '--file', tempFile,
      '--dbname', dbUrl,
    ];

    // Add one --schema per schema
    for (const schemaName of schemasCsv.split(',').map((s) => s.trim()).filter(Boolean)) {
      args.push('--schema', schemaName);
    }

    const child = spawn('pg_dump', args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: process.env,
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`pg_dump exited with code ${code}`));
    });
  });
}

function splitDumpByTable(dumpSql) {
  const lines = dumpSql.split(/\r?\n/);
  const createTableRegex = /^CREATE\s+TABLE\s+([a-zA-Z0-9_\"]+)\.(\"?[a-zA-Z0-9_]+\"?)\s*\(/;
  const alterTableRegex = /^ALTER\s+TABLE\s+(ONLY\s+)?([a-zA-Z0-9_\"]+)\.(\"?[a-zA-Z0-9_]+\"?)\b/;
  const indexOnRegex = /^CREATE\s+INDEX\s+[^\s]+\s+ON\s+([a-zA-Z0-9_\"]+)\.(\"?[a-zA-Z0-9_]+\"?)\b/;
  const commentOnTableRegex = /^COMMENT\s+ON\s+TABLE\s+([a-zA-Z0-9_\"]+)\.(\"?[a-zA-Z0-9_]+\"?)\b/;

  // Map key: `${schema}.${table}` (without quotes)
  const tableToStatements = new Map();

  function pushStmt(schemaName, tableName, stmt) {
    const key = `${schemaName}.${tableName}`;
    const arr = tableToStatements.get(key) || [];
    arr.push(stmt.trim());
    tableToStatements.set(key, arr);
  }

  // Pass 1: collect CREATE TABLE blocks
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(createTableRegex);
    if (!m) continue;
    const schemaName = m[1].replace(/\"/g, '');
    const tableName = m[2].replace(/\"/g, '');

    const block = [line];
    let openParens = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;

    i += 1;
    while (i < lines.length) {
      const ln = lines[i];
      block.push(ln);
      openParens += (ln.match(/\(/g) || []).length - (ln.match(/\)/g) || []).length;
      if (openParens <= 0 && /;\s*$/.test(ln)) break;
      i += 1;
    }

    pushStmt(schemaName, tableName, block.join('\n'));
  }

  // Pass 2: collect ALTER TABLE, CREATE INDEX, COMMENT ON TABLE and append to corresponding tables
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let m = line.match(alterTableRegex);
    if (m) {
      const schemaName = m[2] ? m[2].replace(/\"/g, '') : m[1].replace(/\"/g, '');
      const tableName = m[3].replace(/\"/g, '');
      // capture until semicolon
      const block = [line];
      while (i < lines.length && !/;\s*$/.test(lines[i])) {
        i += 1;
        if (i < lines.length) block.push(lines[i]);
      }
      pushStmt(schemaName, tableName, block.join('\n'));
      continue;
    }

    m = line.match(indexOnRegex);
    if (m) {
      const schemaName = m[1].replace(/\"/g, '');
      const tableName = m[2].replace(/\"/g, '');
      const block = [line];
      while (i < lines.length && !/;\s*$/.test(lines[i])) {
        i += 1;
        if (i < lines.length) block.push(lines[i]);
      }
      pushStmt(schemaName, tableName, block.join('\n'));
      continue;
    }

    m = line.match(commentOnTableRegex);
    if (m) {
      const schemaName = m[1].replace(/\"/g, '');
      const tableName = m[2].replace(/\"/g, '');
      const block = [line];
      while (i < lines.length && !/;\s*$/.test(lines[i])) {
        i += 1;
        if (i < lines.length) block.push(lines[i]);
      }
      pushStmt(schemaName, tableName, block.join('\n'));
    }
  }

  return tableToStatements;
}

function writePerTableFiles(tableToStatements) {
  ensureDirExists(outputDir);
  // Clear existing .sql files in outputDir
  const existing = fs.readdirSync(outputDir).filter((f) => f.endsWith('.sql'));
  for (const f of existing) {
    fs.unlinkSync(path.join(outputDir, f));
  }

  for (const [key, statements] of tableToStatements.entries()) {
    const [schemaName, tableName] = key.split('.');
    const safeSchema = schemaName.replace(/\"/g, '').replace(/[^a-zA-Z0-9_]/g, '_');
    const safeTable = tableName.replace(/\"/g, '').replace(/[^a-zA-Z0-9_]/g, '_');
    const filePath = path.join(outputDir, `${safeSchema}.${safeTable}.sql`);
    const header = `-- Auto-generated from Supabase schema dump\n-- Table: ${schemaName}.${tableName}\n\n`;
    const content = header + statements.join('\n\n') + '\n';
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

async function main() {
  const dbUrl = buildDbUrl();
  if (!dbUrl) {
    console.error('Missing database connection URL.');
    console.error('Set one of the following:');
    console.error('- SUPABASE_DB_URL (full postgres URL)');
    console.error('- SUPABASE_DB_HOST and SUPABASE_DB_PASSWORD (optionally SUPABASE_DB_USER, SUPABASE_DB_PORT, SUPABASE_DB_NAME)');
    console.error('- SUPABASE_URL and SUPABASE_DB_PASSWORD (host derived as db.<project-ref>.supabase.co)');
    process.exit(1);
  }

  ensureDirExists(outputDir);
  const tempFile = path.join(os.tmpdir(), `supabase_dump_${Date.now()}.sql`);

  const schemasCsv = (process.env.SUPABASE_SCHEMAS || 'public');

  console.log('Dumping schema from database URL ...');
  let dumped = false;
  try {
    dumped = await runPgDump(dbUrl, schemasCsv, tempFile);
  } catch (e) {
    // If pg_dump exists but failed, rethrow
    if (e && /pg_dump exited/.test(String(e.message))) throw e;
  }
  if (!dumped) {
    console.log('pg_dump not available, falling back to Supabase CLI...');
    await new Promise((resolve, reject) => {
      const args = [
        '-y', 'supabase@latest', 'db', 'dump',
        '--db-url', dbUrl,
        '--schema', schemasCsv,
        '--file', tempFile,
      ];
      const child = spawn('npx', args, {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: process.env,
        shell: process.platform === 'win32',
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`supabase db dump exited with code ${code}`));
      });
    });
  }

  const dumpSql = fs.readFileSync(tempFile, 'utf8');
  fs.unlinkSync(tempFile);

  const tableToStatements = splitDumpByTable(dumpSql);
  if (tableToStatements.size === 0) {
    console.warn('No tables found in dump. Check that your database has tables in the public schema.');
  }

  writePerTableFiles(tableToStatements);
  console.log(`Wrote ${tableToStatements.size} table file(s) to ${path.relative(rootDir, outputDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


