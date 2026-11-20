SELECT   JSON_ARRAYAGG(  t.name ORDER BY t.name ) FROM "my-schema".items t;
SELECT   JSON_OBJECTAGG(  t.id : t.name ) FROM "my-schema".items t;
SELECT   JSON_ARRAY(  "my-schema".label(1), 2 ), JSON_OBJECT(  'k' : 1 );
