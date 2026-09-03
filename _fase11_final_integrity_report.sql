-- ================================================================
-- FASE 11 FINAL DATA INTEGRITY REPORT SQL
-- Output: 1 row JSON (row_to_json) ONLY. Call psql -At -f this_file  →  output trim = valid JSON file.
-- ================================================================

WITH
schools_info AS (
  SELECT
    (SELECT COUNT(*) FROM schools)::bigint AS total_schools,
    (SELECT COUNT(*) FROM schools WHERE length(trim(npsn)) = 8)::bigint AS schools_npsn_len8
),
wsp_info AS (
  SELECT
    COUNT(*)::bigint AS total_wsp,
    COUNT(*) FILTER (WHERE version >= 1)::bigint AS wsp_version_ok,
    COUNT(*) FILTER (WHERE length(trim(data_sha256)) = 64)::bigint AS wsp_sha_ok,
    ROUND(100.0 * COUNT(*) FILTER (WHERE version >= 1) / GREATEST(1,COUNT(*)), 2) AS wsp_version_pct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE length(trim(data_sha256)) = 64) / GREATEST(1,COUNT(*)), 2) AS wsp_sha_pct,
    COUNT(*) FILTER (WHERE npsn IS NOT NULL)::bigint AS wsp_npsn_notnull
  FROM workspace_school_proposal_data
),
wse_info AS (
  SELECT
    COUNT(*)::bigint AS total_wse,
    COUNT(*) FILTER (WHERE version >= 1)::bigint AS wse_version_ok,
    COUNT(*) FILTER (WHERE length(trim(data_sha256)) = 64)::bigint AS wse_sha_ok,
    ROUND(100.0 * COUNT(*) FILTER (WHERE version >= 1) / GREATEST(1,COUNT(*)), 2) AS wse_version_pct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE length(trim(data_sha256)) = 64) / GREATEST(1,COUNT(*)), 2) AS wse_sha_pct,
    COUNT(*) FILTER (WHERE npsn IS NOT NULL)::bigint AS wse_npsn_notnull
  FROM workspace_school_equipment_data
),
users_info AS (
  SELECT
    COUNT(*)::bigint AS total_users,
    (SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code='SEKOLAH')::bigint AS users_sekolah_total,
    (SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE r.code='SEKOLAH' AND length(trim(u.npsn))=8)::bigint AS users_sekolah_npsn_len8,
    (SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code IN ('ADMIN','SUPERADMIN','FASILITATOR_ADMINISTRASI','FASILITATOR_ALAT','KOORDINATOR_ALAT','PPK'))::bigint AS users_admin_fasil_total
  FROM users
),
rls_info AS (
  SELECT
    COUNT(*) FILTER (WHERE relrowsecurity = true)::bigint AS rls_enabled_tables,
    COUNT(*) FILTER (WHERE relforcerowsecurity = true)::bigint AS rls_forced_tables,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename IN (
      'schools','users','workspace_school_proposal_data','workspace_school_equipment_data','docadmin_file_versions','konsentrasi_keahlian','organization_members','workspace_interview_assessments','workspace_verifikasi_online_reviews','workspace_school_assignments','equipment_items','equipment_proposals'
    ))::bigint AS total_tenant_tables_expected
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN (
    'schools','users','workspace_school_proposal_data','workspace_school_equipment_data','docadmin_file_versions','konsentrasi_keahlian','organization_members','workspace_interview_assessments','workspace_verifikasi_online_reviews','workspace_school_assignments','equipment_items','equipment_proposals'
  )
),
gin_info AS (
  SELECT COUNT(*)::bigint AS gin_indexes_count
  FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_wsp_prop_jsonb_path','idx_wsp_rpkp_jsonb_path','idx_wse_equip_jsonb_path')
),
partition_info AS (
  SELECT COUNT(*)::bigint AS partition_child_count
  FROM pg_inherits i
  JOIN pg_class p ON p.oid=i.inhparent
  WHERE p.relname IN ('workspace_school_proposal_data_history','workspace_school_equipment_data_history')
),
notify_triggers AS (
  SELECT COUNT(*)::bigint AS notify_trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema='public' AND trigger_name LIKE 'trg_notify_%' AND event_manipulation IN ('INSERT','UPDATE','DELETE')
),
school_id_remaining AS (
  SELECT COUNT(*)::bigint AS remaining_school_id_cols
  FROM information_schema.columns c
  WHERE c.table_schema='public'
    AND c.column_name = 'school_id'
    AND c.table_name IN (
      'workspace_school_proposal_data','workspace_school_equipment_data','workspace_interview_assessments',
      'workspace_verifikasi_online_reviews','workspace_school_assignments','schools'
    )
),
orphan_fk AS (
  SELECT COUNT(*)::bigint AS orphan_wsp_rows
  FROM workspace_school_proposal_data p
  LEFT JOIN schools s ON s.npsn = p.npsn
  WHERE s.npsn IS NULL
),
docadmin_counts AS (
  SELECT
    COUNT(*)::bigint AS docadmin_total,
    COUNT(*) FILTER (WHERE npsn IS NOT NULL)::bigint AS docadmin_npsn_notnull
  FROM school_profile_administrative_documents
),
misc_counts AS (
  SELECT
    (SELECT COUNT(*) FROM school_profile_concentrations)::bigint AS konsentrasi_total,
    (SELECT COUNT(*) FROM school_profile_organization_members)::bigint AS orgmembers_total,
    (SELECT COUNT(*) FROM workspace_interview_assessments)::bigint AS interview_total,
    (SELECT COUNT(*) FROM workspace_verifikasi_online_reviews)::bigint AS verifikasi_total,
    (SELECT COUNT(*) FROM workspace_school_assignments)::bigint AS assignments_total
)
SELECT row_to_json(q)
FROM (
  SELECT
    s.*,
    w.*,
    e.*,
    u.*,
    r.*,
    g.gin_indexes_count,
    p.partition_child_count,
    t.notify_trigger_count,
    sr.remaining_school_id_cols,
    o.orphan_wsp_rows,
    d.*,
    m.*,
    now()::timestamp(0) AS report_generated_at,
    CASE
      WHEN s.total_schools = s.schools_npsn_len8
       AND w.wsp_version_pct = 100.00 AND w.wsp_sha_pct = 100.00
       AND e.wse_version_pct = 100.00 AND e.wse_sha_pct = 100.00
       AND r.rls_enabled_tables = r.total_tenant_tables_expected
       AND r.rls_forced_tables = r.total_tenant_tables_expected
       AND g.gin_indexes_count >= 3
       AND p.partition_child_count = 8
       AND t.notify_trigger_count = 36
       AND sr.remaining_school_id_cols = 0
       AND o.orphan_wsp_rows = 0
       AND w.wsp_npsn_notnull = w.total_wsp
       AND e.wse_npsn_notnull = e.total_wse
       THEN 'EXIT 0'
      ELSE 'EXIT 1 FAIL'
    END AS overall_exit_status
  FROM schools_info s
  CROSS JOIN wsp_info w
  CROSS JOIN wse_info e
  CROSS JOIN users_info u
  CROSS JOIN rls_info r
  CROSS JOIN gin_info g
  CROSS JOIN partition_info p
  CROSS JOIN notify_triggers t
  CROSS JOIN school_id_remaining sr
  CROSS JOIN orphan_fk o
  CROSS JOIN docadmin_counts d
  CROSS JOIN misc_counts m
) q;
