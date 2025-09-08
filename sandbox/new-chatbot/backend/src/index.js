import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const port = process.env.PORT || 4107; // isolate from main app

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Services (minimal starter)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const supabase = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function getIndexName() {
  return process.env.PINECONE_INDEX || 'rachatbot-1536';
}

function getNamespaces() {
  const list = process.env.PINECONE_NAMESPACES;
  if (list && list.trim().length > 0) {
    return list.split(',').map(s => s.trim()).filter(Boolean);
  }
  const single = process.env.PINECONE_NAMESPACE;
  return single ? [single] : [];
}

app.get('/', (_req, res) => {
  res.json({ ok: true, name: 'new-chatbot-backend', status: 'running' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });

    // 1) embed
    const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query });
    const vector = emb.data?.[0]?.embedding;
    if (!Array.isArray(vector)) return res.status(500).json({ error: 'embedding failed' });

    // 2) retrieve (query across multiple namespaces if provided)
    const index = pinecone.index(getIndexName());
    const namespaces = getNamespaces();
    const topK = Number(process.env.RAG_TOPK || 8);
    const queryArgs = { topK, includeMetadata: true, vector };

    let matches = [];
    if (namespaces.length > 0) {
      const queries = namespaces.map(ns => index.namespace(ns).query(queryArgs));
      const settled = await Promise.allSettled(queries);
      for (const r of settled) {
        if (r.status === 'fulfilled') {
          matches = matches.concat(r.value?.matches || []);
        }
      }
      // De-duplicate by id and sort by score desc, then take topK overall
      const seen = new Set();
      matches = matches
        .filter(m => {
          if (!m?.id || seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        })
        .sort((a, b) => (b?.score || 0) - (a?.score || 0))
        .slice(0, topK);
    } else {
      const res = await index.query(queryArgs);
      matches = res.matches || [];
    }

    const context = matches
      .map(m => m?.metadata?.text || m?.metadata?.chunk || m?.metadata?.content || m?.metadata?.body || m?.metadata?.page_text)
      .filter(Boolean)
      .join('\n\n---\n\n');

    // 3) generate
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Use the provided context when relevant. If unsure, say so.' },
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }
      ],
      max_tokens: 400
    });
    const answer = completion.choices?.[0]?.message?.content || '';

    // 4) persist minimal logs (optional, safe to remove)
    try {
      await supabase.from('chat_messages').insert([{ sender_role: 'user', message_text: query, timestamp: new Date().toISOString() }]);
      await supabase.from('chat_messages').insert([{ sender_role: 'assistant', message_text: answer, timestamp: new Date().toISOString() }]);
    } catch (_) {}

    res.json({ response: answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'chat failed' });
  }
});

app.listen(port, () => console.log(`new-chatbot-backend listening on http://localhost:${port}`));


