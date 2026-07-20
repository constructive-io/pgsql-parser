-- MergeWhenClause deparse support (previously: "Deparser does not handle node type: MergeWhenClause")
MERGE INTO tgt.users u USING src.staged s ON u.id = s.id WHEN MATCHED THEN UPDATE SET name = s.name WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);
MERGE INTO tgt.users u USING src.staged s ON u.id = s.id WHEN MATCHED AND s.deleted THEN DELETE WHEN MATCHED THEN UPDATE SET name = s.name, updated_at = now() WHEN NOT MATCHED THEN DO NOTHING;
MERGE INTO tgt.users u USING src.staged s ON u.id = s.id WHEN NOT MATCHED BY SOURCE THEN DELETE WHEN NOT MATCHED THEN INSERT (id) VALUES (s.id);
MERGE INTO tgt.users u USING src.staged s ON u.id = s.id WHEN NOT MATCHED THEN INSERT DEFAULT VALUES;
MERGE INTO tgt.users u USING src.staged s ON u.id = s.id WHEN MATCHED THEN UPDATE SET name = s.name RETURNING u.id, u.name;

-- SecLabelStmt qualified object names must be dot-joined (previously emitted "schema", table, column)
SECURITY LABEL FOR anon ON COLUMN myschema.users.name IS 'MASKED WITH FUNCTION anon.fake_name()';
SECURITY LABEL FOR anon ON TABLE myschema.users IS 'sensitive';
SECURITY LABEL ON FUNCTION myschema.fn() IS 'labeled';
