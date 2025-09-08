#!/usr/bin/env python3
"""
Evergreen Village Units → Pinecone RAG ingestion

Usage:
  py ingest_units.py --dir . \
    --index new-chatbot-1536 \
    --namespace evergreen_village_units \
    --dataset evergreen_village_units \
    --version v1 \
    --language pt \
    --query "T2 com varanda"

Env:
  OPENAI_API_KEY, PINECONE_API_KEY (and PINECONE_ENVIRONMENT if your project requires it)

Notes:
  - Recursively discovers PDFs in --dir and ingests each
  - Windows-friendly: pdfplumber for extraction; char-window chunking with overlap
  - Idempotent IDs include file name + version + page + chunk
  - Robust upsert with retries and batch embedding
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


def discover_pdfs(root_dir: str) -> List[str]:
    pdfs: List[str] = []
    for base, _, files in os.walk(root_dir):
        for f in files:
            if f.lower().endswith(".pdf"):
                pdfs.append(os.path.join(base, f))
    return sorted(pdfs)


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


def ingest_file(index, oai: OpenAI, pdf_path: str, *, namespace: str, dataset: str, version: str,
                language: str, max_tokens: int, overlap: int, embed_batch_size: int, upsert_batch_size: int):
    pages = read_pdf_pages(pdf_path)
    print(f"[INFO] {os.path.basename(pdf_path)}: {len(pages)} pages")

    all_chunks: List[Chunk] = []
    for i, page_text in enumerate(pages, 1):
        all_chunks.extend(chunk_page(page_text, i, max_tokens, overlap))
    if not all_chunks:
        print(f"[WARN] {os.path.basename(pdf_path)}: no chunks; skipping")
        return 0

    file_id = os.path.splitext(os.path.basename(pdf_path))[0]
    texts = [c.text for c in all_chunks]
    embeddings = embed_batch(oai, texts, EMBEDDING_MODEL, size=embed_batch_size)

    vectors: List[dict] = []
    for c, vec in zip(all_chunks, embeddings):
        vid = compute_id(file_id, version, c.page, c.chunk_index)
        metadata = {
            "page_number": c.page,
            "source": os.path.basename(pdf_path),
            "dataset": dataset,
            "language": language,
            "version": version,
            "chunk_index": c.chunk_index,
            "text": c.text,
        }
        # Best effort: add unit identifier from filename (e.g., Fracao_AX → AX)
        try:
            name = os.path.basename(pdf_path)
            if "Fracao_" in name:
                unit = name.split("Fracao_")[1].split(".")[0]
                metadata["unit_id"] = unit
        except Exception:
            pass
        vectors.append({"id": vid, "values": vec, "metadata": metadata})

    total = 0
    for group in batch(vectors, upsert_batch_size):
        upsert_with_backoff(index, group, namespace=namespace)
        total += len(group)
    print(f"[INFO] {os.path.basename(pdf_path)}: upserted {total} vectors")
    return total


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description="Ingest Evergreen Village unit PDFs into Pinecone")
    ap.add_argument("--dir", default=".", help="Root directory to scan for PDFs")
    ap.add_argument("--index", default="new-chatbot-1536")
    ap.add_argument("--namespace", default="evergreen_village_units")
    ap.add_argument("--dataset", default="evergreen_village_units")
    ap.add_argument("--language", default="pt")
    ap.add_argument("--version", default="v1")
    ap.add_argument("--max-tokens", type=int, default=400)
    ap.add_argument("--overlap", type=int, default=60)
    ap.add_argument("--upsert-batch", type=int, default=100)
    ap.add_argument("--embed-batch", type=int, default=64)
    ap.add_argument("--query", default=None, help="Optional validation query to test at the end")
    args = ap.parse_args(argv)

    if not os.getenv("OPENAI_API_KEY"):
        print("[ERROR] OPENAI_API_KEY is required", file=sys.stderr)
        return 1
    if not os.getenv("PINECONE_API_KEY"):
        print("[ERROR] PINECONE_API_KEY is required", file=sys.stderr)
        return 1

    index = connect_pinecone(args.index)
    oai = OpenAI()

    pdfs = discover_pdfs(args.dir)
    if not pdfs:
        print(f"[WARN] No PDFs found under {args.dir}")
        return 0

    total_vectors = 0
    for pdf in pdfs:
        try:
            total_vectors += ingest_file(
                index,
                oai,
                pdf,
                namespace=args.namespace,
                dataset=args.dataset,
                version=args.version,
                language=args.language,
                max_tokens=args.max_tokens,
                overlap=args.overlap,
                embed_batch_size=args.embed_batch,
                upsert_batch_size=args.upsert_batch,
            )
        except Exception as e:
            print(f"[ERROR] Failed ingest for {pdf}: {e}")

    print(f"[INFO] Completed. Upserted total {total_vectors} vectors across {len(pdfs)} PDFs.")

    if args.query:
        print("\n[INFO] Validation query across namespace:")
        emb = oai.embeddings.create(model=EMBEDDING_MODEL, input=[args.query]).data[0].embedding
        try:
            res = index.query(vector=emb, top_k=5, include_metadata=True, namespace=args.namespace)
            matches = res.get("matches") or res.get("data") or []
        except TypeError:
            res = index.query(emb, top_k=5, include_metadata=True, namespace=args.namespace)  # type: ignore
            matches = res.get("matches") or []
        for r, m in enumerate(matches, 1):
            meta = m.get("metadata", {})
            pn = meta.get("page_number")
            src = meta.get("source")
            txt = (meta.get("text") or "").replace("\n", " ")
            prev = (txt[:220] + "…") if len(txt) > 220 else txt
            print(f"[{r}] page={pn} file={src} score={m.get('score')} -> {prev}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))


