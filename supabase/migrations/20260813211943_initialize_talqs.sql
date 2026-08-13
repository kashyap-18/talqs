create extension if not exists vector with schema extensions;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'text/plain', 'text/markdown')),
  page_count integer not null default 1 check (page_count between 1 and 5000),
  chunking_strategy text not null check (chunking_strategy in ('paragraph', 'sentence', 'fixed')),
  chunk_size integer not null check (chunk_size between 60 and 240),
  overlap integer not null check (overlap between 0 and 60 and overlap < chunk_size),
  chunk_count integer not null check (chunk_count between 1 and 200),
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_user_created_idx
  on public.documents (user_id, created_at desc);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index between 0 and 199),
  content text not null check (char_length(content) between 1 and 12000),
  token_estimate integer not null check (token_estimate between 1 and 4000),
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index document_chunks_document_idx
  on public.document_chunks (document_id, chunk_index);

create index document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

create table public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'groq', 'openrouter', 'gemini', 'anthropic')),
  model text not null check (model ~ '^[A-Za-z0-9._:/-]{2,100}$'),
  encrypted_key text not null check (char_length(encrypted_key) between 20 and 4096),
  key_iv text not null check (char_length(key_iv) between 16 and 128),
  key_hint text not null check (char_length(key_hint) between 4 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, provider, model)
);

create index provider_credentials_user_idx
  on public.provider_credentials (user_id, updated_at desc);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.provider_credentials enable row level security;

revoke all on table public.documents from anon;
revoke all on table public.document_chunks from anon;
revoke all on table public.provider_credentials from anon;

grant select, insert, update, delete on table public.documents to authenticated;
grant select, insert, update, delete on table public.document_chunks to authenticated;
grant usage, select on sequence public.document_chunks_id_seq to authenticated;

create policy "documents_select_own"
  on public.documents for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "documents_insert_own"
  on public.documents for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "documents_update_own"
  on public.documents for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "documents_delete_own"
  on public.documents for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "document_chunks_select_own"
  on public.document_chunks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "document_chunks_insert_own"
  on public.document_chunks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.documents
      where documents.id = document_id
        and documents.user_id = (select auth.uid())
    )
  );

create policy "document_chunks_update_own"
  on public.document_chunks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "document_chunks_delete_own"
  on public.document_chunks for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.match_document_chunks(
  p_document_id uuid,
  p_query_embedding extensions.vector(384),
  p_match_threshold double precision default 0.55,
  p_match_count integer default 5
)
returns table (
  id bigint,
  document_id uuid,
  chunk_index integer,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    chunks.id,
    chunks.document_id,
    chunks.chunk_index,
    chunks.content,
    1 - (chunks.embedding <=> p_query_embedding) as similarity
  from public.document_chunks as chunks
  where chunks.document_id = p_document_id
    and chunks.user_id = (select auth.uid())
    and 1 - (chunks.embedding <=> p_query_embedding) >= p_match_threshold
  order by chunks.embedding <=> p_query_embedding
  limit least(greatest(p_match_count, 1), 20);
$$;

revoke all on function public.match_document_chunks(uuid, extensions.vector, double precision, integer) from public;
grant execute on function public.match_document_chunks(uuid, extensions.vector, double precision, integer) to authenticated;
