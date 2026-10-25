-- ALTER TRIGGER name ON table RENAME TO (RenameStmt OBJECT_TRIGGER keeps subname)
-- Ref: PostgreSQL regress triggers.sql
ALTER TRIGGER p ON grandp RENAME TO q;
ALTER TRIGGER "Mixed Trig" ON "My Schema"."My Table" RENAME TO "New Trig";
ALTER TRIGGER modified_a ON main_table RENAME TO modified_modified_a;
