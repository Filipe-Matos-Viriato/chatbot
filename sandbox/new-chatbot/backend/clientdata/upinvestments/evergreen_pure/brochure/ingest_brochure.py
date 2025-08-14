#!/usr/bin/env python3
"""
Brochure → Pinecone RAG ingestion (Evergreen Pure)

Usage:
  py ingest_brochure.py "C:\\path\\to\\Evergreen-Pure-Brochure.pdf" \
     --index new-chatbot-1536 \
     --namespace evergreen_pure_marketing \
     --dataset evergreen_pure_marketing \
     --version v1 \
     --language pt \
     --query "apartamento T2 com varanda"

Env:
  OPENAI_API_KEY, PINECONE_API_KEY (and PINECONE_ENVIRONMENT if you use environment-based projects)

Notes:
  - Uses pdfplumber (pure Python) for Windows-friendly PDF extraction
  - Char-based chunking with overlap (avoids native tokenizers)
  - Idempotent, versioned IDs: {file_id}:{version}:p{page}:c{chunk}:{hash8}
  - Compatible with common Pinecone SDK variants
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
import time
from dataclasses import dataclass
from typing import Iterable, List, Tuple

import pdfplumber
from openai import OpenAI


EMBEDDING_MODEL = "text-embedding-3-small"  # 1536 dims


def connect_pinecone(index_name: str):
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        raise RuntimeError("PINECONE_API_KEY is required")
    import pinecone as pc  # type: ignore
    env = os.getenv("PINECONE_ENVIRONMENT", "us-east-1")

    # Preferred: configure global config then construct Index
    if hasattr(pc, 'Index'):
        try:
            if hasattr(pc, 'Config'):
                try:
                    pc.config = pc.Config(api_key=api_key, environment=env)
                except Exception:
                    pass
            if (not getattr(pc, 'config', None)) and hasattr(pc, 'ConfigBuilder'):
                try:
                    builder = pc.ConfigBuilder()
                    pc.config = builder.with_api_key(api_key).with_environment(env).build()
                except Exception:
                    pass
            os.environ.setdefault('PINECONE_API_KEY', api_key)
            os.environ.setdefault('PINECONE_ENVIRONMENT', env)
            return pc.Index(index_name)
        except Exception:
            if hasattr(pc, 'init'):
                pc.init(api_key=api_key, environment=env)
                return pc.Index(index_name)

    # Some variants expose a callable `index(name)` factory
    create_fn = getattr(pc, 'index', None)
    if callable(create_fn):
        return create_fn(index_name)

    # v2 client fallback
    try:
        from pinecone import Pinecone  # type: ignore
        client = Pinecone(api_key=api_key)
        return client.Index(index_name)
    except Exception as e:
        raise RuntimeError(f"Unsupported pinecone package installed: {e}")


def read_pdf_pages(pdf_path: str) -> List[str]:
    pages: List[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            txt = page.extract_text() or ""
            txt = txt.strip()
            lines = [ln.rstrip() for ln in txt.splitlines()]
            paras: List[str] = []
            buf: List[str] = []
            for ln in lines:
                if ln.strip():
                    buf.append(ln)
                else:
                    if buf:
                        paras.append(" ".join(buf))
                        buf.clear()
            if buf:
                paras.append(" ".join(buf))
            pages.append("\n\n".join(paras))
    return pages


def tokens_to_chars(tokens: int, chars_per_token: int = 4) -> int:
    return max(tokens * chars_per_token, 1)


@dataclass
class Chunk:
    page: int
    text: str
    chunk_index: int


def chunk_page(text: str, page: int, max_tokens: int = 400, overlap_tokens: int = 60) -> List[Chunk]:
    if not text:
        return []
    max_chars = tokens_to_chars(max_tokens)
    ov_chars = tokens_to_chars(overlap_tokens)
    chunks: List[Chunk] = []

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    buf = ""
    idx = 0

    def flush(b: str) -> List[Chunk]:
        out: List[Chunk] = []
        nonlocal idx
        i = 0
        while i < len(b):
            w = b[i : i + max_chars]
            if not w:
                break
            out.append(Chunk(page=page, text=w, chunk_index=idx))
            idx += 1
            if i + max_chars >= len(b):
                break
            i += max_chars - ov_chars
        return out

    for para in paragraphs:
        if len(para) <= max_chars:
            if len(buf) + len(para) + 2 <= max_chars:
                buf = (buf + "\n\n" + para) if buf else para
            else:
                chunks.extend(flush(buf))
                buf = para
        else:
            if buf:
                chunks.extend(flush(buf))
                buf = ""
            i = 0
            while i < len(para):
                w = para[i : i + max_chars]
                chunks.append(Chunk(page=page, text=w, chunk_index=idx))
                idx += 1
                if i + max_chars >= len(para):
                    break
                i += max_chars - ov_chars
    if buf:
        chunks.extend(flush(buf))
    return chunks


def compute_id(file_id: str, version: str, page: int, chunk_index: int) -> str:
    base = f"{file_id}:{version}:p{page}:c{chunk_index}"
    digest = hashlib.md5(base.encode("utf-8")).hexdigest()[:8]
    return f"{base}:{digest}"


def batch(iterable: Iterable, size: int) -> Iterable[List]:
    buf = []
    for item in iterable:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def embed_batch(client: OpenAI, texts: List[str], model: str, size: int = 64) -> List[List[float]]:
    out: List[List[float]] = []
    for group in batch(texts, size):
        resp = client.embeddings.create(model=model, input=group)
        out.extend([d.embedding for d in resp.data])
    return out


def upsert_with_backoff(index, vectors: List[dict], namespace: str, retries: int = 5, backoff: float = 1.5):
    attempt = 0
    while True:
        try:
            try:
                index.upsert(vectors=vectors, namespace=namespace)
            except TypeError:
                index.upsert(vectors)  # type: ignore
            return
        except Exception as e:
            attempt += 1
            if attempt > retries:
                raise
            wait = backoff ** attempt
            print(f"[WARN] upsert failed (attempt {attempt}/{retries}): {e}. retrying in {wait:.1f}s...")
            time.sleep(wait)


def validate_query(index, namespace: str, oai: OpenAI, query: str):
    emb = oai.embeddings.create(model=EMBEDDING_MODEL, input=[query]).data[0].embedding
    try:
        res = index.query(vector=emb, top_k=5, include_metadata=True, namespace=namespace)
        matches = res.get("matches") or res.get("data") or []
    except TypeError:
        res = index.query(emb, top_k=5, include_metadata=True, namespace=namespace)  # type: ignore
        matches = res.get("matches") or []
    for r, m in enumerate(matches, 1):
        meta = m.get("metadata", {})
        pn = meta.get("page_number")
        txt = (meta.get("text") or "").replace("\n", " ")
        prev = (txt[:220] + "…") if len(txt) > 220 else txt
        print(f"[{r}] page={pn} score={m.get('score')} -> {prev}")


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description="Ingest the Evergreen Pure brochure PDF into Pinecone for RAG")
    ap.add_argument("pdf", help="Path to PDF file")
    ap.add_argument("--index", default="new-chatbot-1536")
    ap.add_argument("--namespace", default="evergreen_pure_marketing")
    ap.add_argument("--dataset", default="evergreen_pure_marketing")
    ap.add_argument("--language", default="pt")
    ap.add_argument("--version", default="v1")
    ap.add_argument("--max-tokens", type=int, default=400)
    ap.add_argument("--overlap", type=int, default=60)
    ap.add_argument("--upsert-batch", type=int, default=100)
    ap.add_argument("--embed-batch", type=int, default=64)
    ap.add_argument("--query", default=None, help="Optional validation query")
    args = ap.parse_args(argv)

    if not os.getenv("OPENAI_API_KEY"):
        print("[ERROR] OPENAI_API_KEY is required", file=sys.stderr)
        return 1
    if not os.getenv("PINECONE_API_KEY"):
        print("[ERROR] PINECONE_API_KEY is required", file=sys.stderr)
        return 1

    oai = OpenAI()
    index = connect_pinecone(args.index)

    pages = read_pdf_pages(args.pdf)
    print(f"[INFO] extracted {len(pages)} pages")

    all_chunks: List[Chunk] = []
    for i, page_text in enumerate(pages, 1):
        all_chunks.extend(chunk_page(page_text, i, args.max_tokens, args.overlap))
    print(f"[INFO] created {len(all_chunks)} chunks")
    if not all_chunks:
        print("[WARN] no chunks to embed")
        return 0

    file_id = os.path.splitext(os.path.basename(args.pdf))[0]
    texts = [c.text for c in all_chunks]
    print(f"[INFO] embedding {len(texts)} chunks…")
    vectors: List[dict] = []
    embeddings = []
    for group in batch(texts, args.embed_batch):
        resp = oai.embeddings.create(model=EMBEDDING_MODEL, input=group)
        embeddings.extend([d.embedding for d in resp.data])
    for c, vec in zip(all_chunks, embeddings):
        vid = compute_id(file_id, args.version, c.page, c.chunk_index)
        metadata = {
            "page_number": c.page,
            "source": os.path.basename(args.pdf),
            "dataset": args.dataset,
            "language": args.language,
            "version": args.version,
            "chunk_index": c.chunk_index,
            "text": c.text,
        }
        vectors.append({"id": vid, "values": vec, "metadata": metadata})

    total = 0
    for group in batch(vectors, args.upsert_batch):
        upsert_with_backoff(index, group, namespace=args.namespace)
        total += len(group)
        print(f"[INFO] upserted {total}/{len(vectors)} vectors to index='{args.index}' ns='{args.namespace}'")

    if args.query:
        print("\n[INFO] validation results:")
        validate_query(index, args.namespace, oai, args.query)

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))


