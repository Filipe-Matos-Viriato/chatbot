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

    // 2) retrieve (namespace optional env)
    const index = pinecone.index(getIndexName());
    const namespace = process.env.PINECONE_NAMESPACE || undefined;
    const queryArgs = { topK: 8, includeMetadata: true, vector };
    const results = namespace ? await index.namespace(namespace).query(queryArgs) : await index.query(queryArgs);
    const context = (results.matches || []).map(m => m.metadata?.text).filter(Boolean).join('\n\n---\n\n');

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


