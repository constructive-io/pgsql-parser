-- XMLSERIALIZE ... INDENT (XmlSerialize.indent)
-- Ref: PostgreSQL regress xml.sql
SELECT xmlserialize(DOCUMENT '<foo><bar><val x="y">42</val></bar></foo>' AS text INDENT);
SELECT xmlserialize(CONTENT '<foo><bar><val x="y">42</val></bar></foo>' AS text INDENT);
SELECT xmlserialize(DOCUMENT '<foo><bar><val x="y">42</val></bar></foo>' AS text NO INDENT);
SELECT xmlserialize(CONTENT doc AS varchar INDENT) FROM xmltest;
