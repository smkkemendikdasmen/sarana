-- V20260902 - MVC Clean Relational: Proposal TRAINING COSTS (Biaya Pendukung Pelatihan 1,5%)
-- Author: TRAE Team - MVC Cleanup per halaman
-- Struktur: 1 TABEL FLAT (bukan groups 1-N items) karena data = daftar alat + flag butuh pelatihan

BEGIN;

CREATE TABLE IF NOT EXISTS public.proposal_training_costs (
    id                  BIGSERIAL       PRIMARY KEY,
    npsn                CHAR(8)         NOT NULL REFERENCES public.schools(npsn) ON DELETE CASCADE,
    item_uuid           VARCHAR(32)     NOT NULL,
    product_name        VARCHAR(255)    NOT NULL DEFAULT '',
    unit_price          BIGINT          NOT NULL DEFAULT 0,
    requires_training   BOOLEAN         NOT NULL DEFAULT TRUE,
    training_cost       BIGINT          NOT NULL DEFAULT 0,
    sort_order          INTEGER         NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_prop_train_costs_npsn
    ON public.proposal_training_costs(npsn, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS ux_prop_train_costs_npsn_uuid
    ON public.proposal_training_costs(npsn, item_uuid);

-- Auto updated_at di-handle service secara eksplisit (setiap INSERT/UPDATE SET updated_at = NOW())

-- ============ ONE-TIME MIGRASI DATA LEGACY DARI JSONB ============
DO $$
DECLARE
    rec             RECORD;
    json_rows       JSONB;
    r               JSONB;
    i_uuid          TEXT;
    v_name          TEXT;
    v_price         BIGINT;
    v_req           BOOLEAN;
    v_tcost         BIGINT;
    any_migrated    INTEGER := 0;
    v_idx           INTEGER;
BEGIN
    FOR rec IN
        SELECT w.npsn, w.proposal_tables_json->'__global_biaya_pendukung_pelatihan' AS rows_json
        FROM public.workspace_school_proposal_data w
        WHERE jsonb_typeof(w.proposal_tables_json->'__global_biaya_pendukung_pelatihan') = 'array'
          AND jsonb_array_length(w.proposal_tables_json->'__global_biaya_pendukung_pelatihan') > 0
          AND NOT EXISTS (
              SELECT 1 FROM public.proposal_training_costs x WHERE x.npsn = w.npsn
          )
    LOOP
        CONTINUE WHEN rec.rows_json IS NULL;

        FOR i_uuid, r, v_idx IN
            SELECT
                substr(encode(sha256((rec.npsn || '-train-' || (COALESCE(o.elem->>'id', o.elem->>'name', md5(o.elem::text))))::bytea), 'hex'), 1, 32) AS u,
                o.elem AS elem,
                o.idx AS idx
            FROM jsonb_array_elements(rec.rows_json) WITH ORDINALITY o(elem, idx)
        LOOP
            -- product name
            v_name := COALESCE(r->>'name', '')::VARCHAR(255);
            CONTINUE WHEN v_name = '' AND COALESCE(r->>'productName','') = '';
            IF v_name = '' THEN v_name := COALESCE(r->>'productName','')::VARCHAR(255); END IF;

            -- unit_price fallback chain: shop1.priceWithTax / quantity / hargaSatuan
            v_price := COALESCE(
                NULLIF(regexp_replace(COALESCE(r->'shop1'->>'priceWithTax',''), '[^\d]','','g'), '')::BIGINT,
                NULLIF(regexp_replace(COALESCE(r->>'quantity',''), '[^\d]','','g'), '')::BIGINT,
                CASE WHEN jsonb_typeof(r->'unitPrice') = 'number' THEN (r->>'unitPrice')::BIGINT ELSE 0 END,
                NULLIF(regexp_replace(COALESCE(r->>'hargaSatuanRp',''), '[^\d]','','g'), '')::BIGINT,
                0
            );

            -- requires_training: name shop1 contains "Ya" / specification includes "YA" / shop2 totalPrice string "1.5"
            v_req := CASE
                WHEN lower(COALESCE(r->'shop1'->>'name','')) LIKE '%ya%' THEN TRUE
                WHEN lower(COALESCE(r->>'specification','')) LIKE '%ya%' THEN TRUE
                WHEN COALESCE(r->'shop2'->>'totalPrice','') LIKE '%1.5%' THEN TRUE
                WHEN COALESCE(r->>'butuhPelatihan','') = 'true' THEN TRUE
                WHEN COALESCE(r->>'butuhPelatihan','') = 'false' THEN FALSE
                ELSE TRUE
            END;

            -- training_cost fallback: shop3.totalPrice / totalBiayaPelatihanRp / 1.5% calculated
            v_tcost := COALESCE(
                NULLIF(regexp_replace(COALESCE(r->'shop3'->>'totalPrice',''), '[^\d]','','g'), '')::BIGINT,
                NULLIF(regexp_replace(COALESCE(r->>'totalBiayaPelatihanRp',''), '[^\d]','','g'), '')::BIGINT,
                CASE WHEN v_req THEN ((v_price * 15 + 999) / 1000) ELSE 0 END,
                0
            );

            IF v_price < 0 THEN v_price := 0; END IF;
            IF v_tcost < 0 THEN v_tcost := 0; END IF;
            IF v_req AND v_tcost = 0 AND v_price > 0 THEN v_tcost := ((v_price * 15 + 999) / 1000); END IF;

            INSERT INTO public.proposal_training_costs
                (npsn, item_uuid, product_name, unit_price, requires_training, training_cost, sort_order)
            VALUES
                (rec.npsn, i_uuid, v_name, v_price, v_req, v_tcost, COALESCE(v_idx, 0)::INTEGER);

            any_migrated := any_migrated + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Migration legacy biaya pelatihan selesai. Total item migrated: %', any_migrated;
END $$;

COMMIT;
