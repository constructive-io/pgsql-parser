-- SQL/JSON aggregate constructors carry their own location under a
-- "constructor" key; extra whitespace shifts it on deparse.
SELECT JSON_ARRAYAGG(t.name ORDER BY t.name ABSENT ON NULL)
FROM my_schema.items AS t;

SELECT JSON_OBJECTAGG(t.id : t.name NULL ON NULL)
FROM my_schema.items AS t;

SELECT
  JSON_ARRAY(my_schema.label(1), 2 ABSENT ON NULL),
  JSON_OBJECT('k' : 1 NULL ON NULL);