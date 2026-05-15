-- Create password_resets table for OTP-based password reset flow
create table if not exists public.password_resets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reset_code varchar(6) not null,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Create index for faster lookups by user_id
create index if not exists password_resets_user_id_idx on public.password_resets(user_id);

-- Create index for faster lookups by reset_code
create index if not exists password_resets_reset_code_idx on public.password_resets(reset_code);

-- Enable RLS
alter table public.password_resets enable row level security;

-- RLS policies (admin only for security)
drop policy if exists "Password resets are admin only" on public.password_resets;
create policy "Password resets are admin only"
on public.password_resets
for all
using (false)
with check (false);

-- Note: The actual verification is handled by the backend API, not through direct database queries
-- This table stores the reset codes for verification purposes
