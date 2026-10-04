-- Exporta as definições reais do banco (somente leitura). Cada linha é DDL pronto para reaplicar.
WITH
fn AS (
  SELECT 1 AS ord, 'function' AS tipo, p.proname::text AS nome,
         pg_get_functiondef(p.oid) || ';' AS ddl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
),
vw AS (
  SELECT 2, 'view', c.relname::text,
         'CREATE OR REPLACE VIEW public.' || quote_ident(c.relname)
         || COALESCE(' WITH (' || array_to_string(c.reloptions, ', ') || ')', '')
         || ' AS ' || pg_get_viewdef(c.oid, true)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'v'
),
trg AS (
  SELECT 3, 'trigger', tn.nspname || '.' || c.relname || '.' || t.tgname,
         pg_get_triggerdef(t.oid) || ';'
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace tn ON tn.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
  WHERE NOT t.tgisinternal AND pn.nspname = 'public'
),
rls AS (
  SELECT 4, 'rls', c.relname::text,
         'ALTER TABLE public.' || quote_ident(c.relname) || ' ENABLE ROW LEVEL SECURITY;'
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
),
pol AS (
  SELECT 5, 'policy', schemaname || '.' || tablename || '.' || policyname,
         'CREATE POLICY ' || quote_ident(policyname) || ' ON ' || schemaname || '.' || quote_ident(tablename)
         || ' AS ' || permissive || ' FOR ' || cmd || ' TO ' || array_to_string(roles, ', ')
         || COALESCE(' USING (' || qual || ')', '')
         || COALESCE(' WITH CHECK (' || with_check || ')', '') || ';'
  FROM pg_policies
  WHERE schemaname IN ('public', 'storage')
),
bkt AS (
  SELECT 6, 'bucket', b.id::text,
         format('INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (%L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
                b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types)
  FROM storage.buckets b
),
acl AS (
  SELECT 7, 'function_acl', p.proname::text,
         '-- ' || p.oid::regprocedure::text || ' ACL: ' || COALESCE(p.proacl::text, '(padrão)')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
),
col AS (
  SELECT 8, 'columns', c.table_name::text,
         '-- ' || c.table_name || ': ' || string_agg(c.column_name || ' ' || c.data_type, ', ' ORDER BY c.ordinal_position)
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  GROUP BY c.table_name
)
SELECT ord, tipo, nome, ddl FROM (
  SELECT * FROM fn UNION ALL SELECT * FROM vw UNION ALL SELECT * FROM trg
  UNION ALL SELECT * FROM rls UNION ALL SELECT * FROM pol UNION ALL SELECT * FROM bkt
  UNION ALL SELECT * FROM acl UNION ALL SELECT * FROM col
) x
ORDER BY ord, nome;
