-- Gruppen
create table gruppen (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

insert into gruppen (name) values ('Garten 1');

-- Nutzer-Profile (erweitert auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rolle text not null check (rolle in ('trainer', 'volti', 'eltern')),
  vorname text not null,
  nachname text not null,
  bild text,
  gruppe_id uuid references gruppen(id)
);

-- Kind-Profile (für Eltern-Accounts mit mehreren Kindern)
create table kind_profile (
  id uuid primary key default gen_random_uuid(),
  eltern_user_id uuid references auth.users(id) on delete cascade,
  vorname text not null,
  nachname text not null,
  bild text,
  gruppe_id uuid references gruppen(id)
);

-- Trainings & Anlässe
create table trainings_anlaesse (
  id uuid primary key default gen_random_uuid(),
  gruppe_id uuid references gruppen(id),
  typ text check (typ in ('training', 'anlass', 'turnier')),
  titel text not null,
  start timestamptz not null,
  ende timestamptz,
  ist_dauerauftrag boolean default false,
  verfalldatum date,
  ausnahme_von_id uuid references trainings_anlaesse(id)
);

-- Abwesenheiten
create table abwesenheiten (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references trainings_anlaesse(id) on delete cascade,
  kind_profile_id uuid references kind_profile(id) on delete cascade,
  status text check (status in ('anwesend', 'abwesend')) default 'anwesend',
  grund text,
  ist_privat boolean default true,
  gemeldet_von uuid references auth.users(id),
  timestamp timestamptz default now()
);

-- Packliste
create table packliste_items (
  id uuid primary key default gen_random_uuid(),
  gruppe_id uuid references gruppen(id),
  name text not null,
  abgehakt boolean default false,
  abgehakt_von uuid references auth.users(id),
  abgehakt_am timestamptz
);