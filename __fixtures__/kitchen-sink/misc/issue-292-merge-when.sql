-- Ref: constructive-io/pgsql-parser#292
MERGE INTO t AS target USING (SELECT 1 AS id) AS source ON target.id = source.id WHEN MATCHED THEN UPDATE SET name = 'x' WHEN NOT MATCHED THEN INSERT (id, name) VALUES (source.id, 'x');
MERGE INTO t AS target USING (SELECT 1 AS id) AS source ON target.id = source.id WHEN MATCHED AND cond THEN DELETE;
MERGE INTO t AS target USING (SELECT 1 AS id) AS source ON target.id = source.id WHEN NOT MATCHED BY SOURCE THEN UPDATE SET name = 'x';
MERGE INTO t AS target USING (SELECT 1 AS id) AS source ON target.id = source.id WHEN MATCHED THEN DO NOTHING;
MERGE INTO t AS target USING (SELECT 1 AS id) AS source ON target.id = source.id WHEN NOT MATCHED THEN INSERT DEFAULT VALUES;
