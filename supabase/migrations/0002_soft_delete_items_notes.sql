-- ================================================================
-- 0002 — soft delete i pro suroviny receptu a poznámky (pravidlo 7)
-- ================================================================
-- Suroviny odebrané při úpravě receptu a smazané poznámky se dřív mazaly natvrdo.
-- Při synchronizaci by je druhé zařízení vzkřísilo, proto i tady jen deleted_at.
-- Všechny dotazy filtrují deleted_at is null.

alter table recipe_items add column deleted_at timestamptz;
alter table recipe_notes add column deleted_at timestamptz;
