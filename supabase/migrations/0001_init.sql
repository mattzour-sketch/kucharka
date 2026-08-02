-- ================================================================
-- 0001_init.sql — počáteční schéma (SPEC 7.4)
--
-- Neporušitelné body promítnuté do schématu:
--   * recipe_items.raw_text je NOT NULL; food_id, sub_recipe_id i amount_g
--     jsou NULLABLE. Recept musí jít uložit bez jediné napojené potraviny.
--   * recipes.servings je NULLABLE (ne default 1, ne not null).
--   * deleted_at všude, kde se synchronizuje (soft delete, E-08).
--   * log_entries.logged_on je DATE v lokálním čase, ne timestamptz (E-07).
--   * log_entries drží spočítaný snapshot, ne odkaz (E-01).
-- ================================================================

-- ----------------------------------------------------------------
-- POTRAVINY
-- ----------------------------------------------------------------
create table foods (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  brand         text,
  barcode       text,
  -- všechny hodnoty jsou na 100 g nebo 100 ml podle sloupce basis
  basis         text        not null default 'g' check (basis in ('g','ml')),
  energy_kcal   numeric     not null,
  protein_g     numeric     not null default 0,
  carbs_g       numeric     not null default 0,
  fat_g         numeric     not null default 0,
  sugar_g       numeric,
  satfat_g      numeric,
  fiber_g       numeric,
  salt_g        numeric,
  source        text        not null default 'custom'
                check (source in ('custom','openfoodfacts','nutridatabaze','usda','import')),
  source_ref    text,       -- id/kód v původní databázi
  is_favorite   boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz -- soft delete kvůli synchronizaci
);

create index foods_name_idx on foods (lower(name));
create unique index foods_barcode_idx on foods (barcode)
  where barcode is not null and deleted_at is null;

-- Domácí míry: "1 ks", "1 lžíce", "1 hrnek"
create table food_portions (
  id       uuid primary key default gen_random_uuid(),
  food_id  uuid not null references foods(id) on delete cascade,
  label    text not null,      -- 'ks', 'lžíce', 'plátek'
  grams    numeric not null
);

-- ----------------------------------------------------------------
-- RECEPTY
-- ----------------------------------------------------------------
create table recipes (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,          -- jediné povinné pole
  source          text,        -- "babička Marie", "kamarád Petr", odkaz na web
  captured_on     date        not null default current_date,

  -- Původní zachycený text tak, jak byl napsán. NIKDY se nepřepisuje
  -- strukturováním — je to doklad o tom, co bylo doopravdy řečeno. Viz E-17
  raw_capture     text,

  instructions    text,        -- postup; pro režim vaření se dělí po řádcích
  servings        numeric      check (servings is null or servings > 0),  -- NEPOVINNÉ
  cooked_weight_g numeric,     -- zvážená hmotnost po uvaření; NULL = použij součet surovin
  photo_url       text,        -- fotka kartičky nebo hotového jídla
  audio_url       text,
  tags            text[]       not null default '{}',
  is_favorite     boolean      not null default false,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now(),
  deleted_at      timestamptz
);

create index recipes_tags_idx  on recipes using gin (tags);
create index recipes_source_idx on recipes (lower(source));

-- Položka receptu.
-- POZOR: raw_text je jediné povinné pole. food_id, sub_recipe_id a amount_g
-- jsou NEPOVINNÉ obohacení, které se doplňuje až později (nebo nikdy).
-- Viz E-12 — tohle je nejdůležitější rozhodnutí v celém modelu.
create table recipe_items (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipes(id) on delete cascade,

  raw_text      text not null,   -- "hrst hladký mouky" — zdroj pravdy, needituje se automaticky

  food_id       uuid references foods(id),      -- nepovinné napojení
  sub_recipe_id uuid references recipes(id),    -- nepovinné napojení
  amount_g      numeric check (amount_g is null or amount_g > 0),
  is_skipped    boolean not null default false, -- koření, voda — nepočítá se do úplnosti

  note          text,
  sort_order    integer not null default 0,
  constraint at_most_one_target check (num_nonnulls(food_id, sub_recipe_id) <= 1)
);

-- Poznámky k receptu z jednotlivých vaření (R-24)
create table recipe_notes (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references recipes(id) on delete cascade,
  noted_on   date not null default current_date,
  body       text not null
);

-- ----------------------------------------------------------------
-- DENÍK
-- ----------------------------------------------------------------
create table log_entries (
  id           uuid primary key default gen_random_uuid(),
  logged_on    date not null,          -- lokální datum, ne timestamp! viz E-07
  meal         text not null check (meal in ('breakfast','lunch','dinner','snack')),
  food_id      uuid references foods(id),
  recipe_id    uuid references recipes(id),
  amount_g     numeric not null,

  -- SNAPSHOT: spočítáno v okamžiku zápisu a NIKDY se nepřepočítává. Viz E-01
  display_name text    not null,
  energy_kcal  numeric not null,
  protein_g    numeric not null,
  carbs_g      numeric not null,
  fat_g        numeric not null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint one_source check (num_nonnulls(food_id, recipe_id) <= 1)
);

create index log_entries_date_idx on log_entries (logged_on)
  where deleted_at is null;

-- ----------------------------------------------------------------
-- CÍLE A HMOTNOST
-- ----------------------------------------------------------------
create table goals (
  id          uuid primary key default gen_random_uuid(),
  valid_from  date    not null,   -- nový cíl = nový řádek, staré dny se nemění
  energy_kcal numeric not null,
  protein_g   numeric,
  carbs_g     numeric,
  fat_g       numeric
);

create table weight_entries (
  id           uuid primary key default gen_random_uuid(),
  measured_on  date    not null unique,
  weight_kg    numeric not null
);

-- ================================================================
-- ROW LEVEL SECURITY (SPEC 7.8)
--
-- RLS je zapnutá na VŠECH tabulkách, i když je uživatel jeden: bez ní je
-- anon klíč v prohlížeči přístup k celé databázi pro kohokoli. Přístup má
-- jen přihlášený uživatel (magic link).
--
-- Až přibude druhý účet, doplní se sloupec user_id a politiky se zúží na
-- `auth.uid() = user_id` (SPEC, otevřené rozhodnutí 4). Zatím schéma odpovídá
-- 7.4, kde user_id není.
-- ================================================================
alter table foods          enable row level security;
alter table food_portions  enable row level security;
alter table recipes        enable row level security;
alter table recipe_items   enable row level security;
alter table recipe_notes   enable row level security;
alter table log_entries    enable row level security;
alter table goals          enable row level security;
alter table weight_entries enable row level security;

create policy "authenticated_all" on foods
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on food_portions
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on recipes
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on recipe_items
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on recipe_notes
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on log_entries
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on goals
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on weight_entries
  for all to authenticated using (true) with check (true);
