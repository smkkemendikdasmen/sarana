-- V20260902 - MVC Clean Relational: Preparation Groups + Items (per-halaman Biaya Persiapan)
-- Author: TRAE Team - MVC Cleanup per halaman

BEGIN;

CREATE TABLE IF NOT EXISTS public.proposal_preparation_groups (
    id              BIGSERIAL       PRIMARY KEY,
    npsn            CHAR(8)         NOT NULL REFERENCES public.schools(npsn) ON DELETE CASCADE,
    group_uuid      VARCHAR(32)     NOT NULL,
    name            VARCHAR(255)    NOT NULL DEFAULT '',
    sort_order      INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.proposal_preparation_items (
    id              BIGSERIAL       PRIMARY KEY,
    group_id        BIGINT          NOT NULL REFERENCES public.proposal_preparation_groups(id) ON DELETE CASCADE,
    item_uuid       VARCHAR(32)     NOT NULL,
    description     VARCHAR(500)    NOT NULL DEFAULT '',
    quantity        INTEGER         NOT NULL DEFAULT 0,
    unit_price      BIGINT          NOT NULL DEFAULT 0,
    sort_order      INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_prop_prep_groups_npsn
    ON public.proposal_preparation_groups(npsn, sort_order);

CREATE INDEX IF NOT EXISTS ix_prop_prep_items_group
    ON public.proposal_preparation_items(group_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS ux_prop_prep_groups_npsn_uuid
    ON public.proposal_preparation_groups(npsn, group_uuid);

CREATE UNIQUE INDEX IF NOT EXISTS ux_prop_prep_items_group_uuid
    ON public.proposal_preparation_items(group_id, item_uuid);

-- Auto updated_at di-handle service secara eksplisit (setiap UPDATE SET updated_at = NOW())
-- Realtime notify trigger optional (butuh GRANT USAGE schema saranasmk) — di-enable secara terpisah jika diperlukan

-- ============ ONE-TIME MIGRASI DATA LEGACY DARI JSONB ============
DO $$
DECLARE
    rec             RECORD;
    json_rows       JSONB;
    r               JSONB;
    header_id       BIGINT;
    g_uuid          TEXT;
    i_uuid          TEXT;
    qty_num         INTEGER;
    price_num       BIGINT;
    any_migrated    INTEGER := 0;
    v_idx           INTEGER;
BEGIN
    FOR rec IN
        SELECT w.npsn, w.proposal_tables_json->'__global_biaya_persiapan_pelaporan' AS rows_json
        FROM public.workspace_school_proposal_data w
        WHERE jsonb_typeof(w.proposal_tables_json->'__global_biaya_persiapan_pelaporan') = 'array'
          AND jsonb_array_length(w.proposal_tables_json->'__global_biaya_persiapan_pelaporan') > 0
          AND NOT EXISTS (
              SELECT 1 FROM public.proposal_preparation_groups x WHERE x.npsn = w.npsn
          )
    LOOP
        -- Skip jika rows json kosong
        CONTINUE WHEN rec.rows_json IS NULL;

        g_uuid := 'mig-' || encode(sha256(('prep-default-group-' || rec.npsn)::bytea), 'hex');
        g_uuid := substr(g_uuid, 1, 32);

        INSERT INTO public.proposal_preparation_groups (npsn, group_uuid, name, sort_order)
        VALUES (rec.npsn, g_uuid, 'Biaya Persiapan & Pelaporan', 0)
        RETURNING id INTO header_id;

        FOR i_uuid, r, v_idx IN
            SELECT
                substr(encode(sha256((rec.npsn || '-' || (COALESCE(o.elem->>'id', o.elem->>'name', md5(o.elem::text))))::bytea), 'hex'), 1, 32) AS u,
                o.elem AS elem,
                o.idx AS idx
            FROM jsonb_array_elements(rec.rows_json) WITH ORDINALITY o(elem, idx)
        LOOP
            -- quantity: accept number or string digits
            qty_num := CASE
                WHEN jsonb_typeof(r->'quantity') = 'number' THEN COALESCE((r->>'quantity')::INTEGER, 0)
                ELSE COALESCE(NULLIF(regexp_replace(COALESCE(r->>'quantity',''), '[^\d]','','g'), '')::INTEGER, 0)
            END;

            -- unit_price chain fallback: price (legacy v1) / shop1.priceWithTax / shop1.totalPrice / hargaSatuan / harga
            price_num := COALESCE(
                NULLIF(regexp_replace(COALESCE(r->>'price',''), '[^\d]','','g'), '')::BIGINT,
                CASE WHEN jsonb_typeof(r->'price') = 'number' THEN (r->>'price')::BIGINT ELSE 0 END,
                NULLIF(regexp_replace(COALESCE(r->'shop1'->>'priceWithTax',''), '[^\d]','','g'), '')::BIGINT,
                NULLIF(regexp_replace(COALESCE(r->'shop1'->>'totalPrice',''), '[^\d]','','g'), '')::BIGINT,
                NULLIF(regexp_replace(COALESCE(r->>'hargaSatuan',''), '[^\d]','','g'), '')::BIGINT,
                NULLIF(regexp_replace(COALESCE(r->>'harga',''), '[^\d]','','g'), '')::BIGINT,
                0
            );

            IF qty_num < 0 THEN qty_num := 0; END IF;
            IF price_num < 0 THEN price_num := 0; END IF;

            INSERT INTO public.proposal_preparation_items
                (group_id, item_uuid, description, quantity, unit_price, sort_order)
            VALUES
                (header_id,
                 i_uuid,
                 COALESCE(r->>'name', '')::VARCHAR(500),
                 qty_num,
                 price_num,
                 COALESCE(v_idx, 0)::INTEGER
                );

            any_migrated := any_migrated + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Migration legacy biaya persiapan selesai. Total item migrated: %', any_migrated;
END $$;

COMMIT;
