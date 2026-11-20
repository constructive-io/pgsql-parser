SELECT JSON_ARRAYAGG(t.name ORDER BY t.name ABSENT ON NULL)
FROM my_schema.items AS t;

SELECT JSON_OBJECTAGG(t.id : t.name NULL ON NULL)
FROM my_schema.items AS t;

SELECT
  JSON_ARRAY(my_schema.label(1), 2 ABSENT ON NULL),
  JSON_OBJECT('k' : 1 NULL ON NULL);