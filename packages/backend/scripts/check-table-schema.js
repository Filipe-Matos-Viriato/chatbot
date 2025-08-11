#!/usr/bin/env node
import supabase from '../src/config/supabase.js';
import fs from 'fs/promises';
import path from 'path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
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

async function trySupabaseDescribe(table, schema) {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('ordinal_position,column_name,data_type,udt_name,is_nullable,character_maximum_length,column_default')
    .eq('table_schema', schema)
    .eq('table_name', table)
    .order('ordinal_position', { ascending: true });
  if (error) throw error;
  return data;
}

async function fallbackLocalSql(table) {
  const sqlPath = path.join(process.cwd(), 'packages', 'backend', 'supabase_sql_tables', `${table}.sql`);
  try {
    const content = await fs.readFile(sqlPath, 'utf8');
    return { sqlPath, content };
  } catch (err) {
    return { sqlPath, content: null };
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const table = args.table || args.t || 'listings';
  const schema = args.schema || args.s || 'public';

  console.log(`[schema] Describing ${schema}.${table} ...`);
  try {
    const cols = await trySupabaseDescribe(table, schema);
    if (!cols || cols.length === 0) {
      console.warn('[schema] No rows returned from information_schema.columns. Falling back to local SQL file.');
      const fb = await fallbackLocalSql(table);
      if (fb.content) {
        console.log(`[schema] Local SQL (${fb.sqlPath}):\n`);
        console.log(fb.content);
      } else {
        console.error('[schema] Could not find local SQL file for table:', table);
        process.exit(2);
      }
      return;
    }

    console.log('\nColumns:');
    for (const c of cols) {
      const len = c.character_maximum_length ? `(${c.character_maximum_length})` : '';
      const type = c.data_type === 'USER-DEFINED' ? c.udt_name : c.data_type;
      console.log(`- ${c.column_name}: ${type}${len}, nullable=${c.is_nullable}, default=${c.column_default ?? 'NULL'}`);
    }
  } catch (err) {
    console.warn('[schema] Supabase describe failed:', err.message);
    const fb = await fallbackLocalSql(table);
    if (fb.content) {
      console.log(`[schema] Local SQL (${fb.sqlPath}):\n`);
      console.log(fb.content);
    } else {
      console.error('[schema] Could not find local SQL file for table:', table);
      process.exit(2);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


