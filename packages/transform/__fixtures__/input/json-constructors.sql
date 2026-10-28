-- SQL/JSON aggregate constructors carry their own location under a
-- "constructor" key; extra whitespace shifts it on deparse.
SELECT   JSON_ARRAYAGG(  t.name ORDER BY t.name ) FROM "my-schema".items t;

SELECT   JSON_OBJECTAGG(  t.id : t.name ) FROM "my-schema".items t;

SELECT   JSON_ARRAY(  "my-schema".label(1), 2 ), JSON_OBJECT(  'k' : 1 );
