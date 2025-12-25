-- 1. EXPLAIN with COSTS OFF - tests optional keyword preservation
-- Some deparsers may omit optional keywords like COSTS OFF
-- This documents that EXPLAIN (COSTS OFF) may deparse differently than EXPLAIN alone
EXPLAIN (COSTS OFF) SELECT * FROM onek2 WHERE unique2 = 11 AND stringu1 = 'ATAAAA';

-- 2. EXPLAIN without COSTS (default behavior)
EXPLAIN SELECT * FROM onek2 WHERE unique2 = 11 AND stringu1 = 'ATAAAA';

-- 3. Boolean literal formatting - INPUT FORM with 't'::boolean cast
-- The deparser may normalize this to TRUE
INSERT INTO objects.object (name, val, active, hash)
VALUES ('name', 'val', 't'::boolean, 'abcdefg'),
       ('name', 'val', 't'::boolean, 'abcdefg'),
       ('name', 'val', 't'::boolean, 'abcdefg');

-- 4. Boolean literal formatting - CANONICAL FORM with TRUE
INSERT INTO objects.object (name, val, active, hash)
VALUES ('name', 'val', TRUE, 'abcdefg'),
       ('name', 'val', TRUE, 'abcdefg'),
       ('name', 'val', TRUE, 'abcdefg');

-- 5. Boolean literal formatting - CANONICAL FORM with FALSE
INSERT INTO objects.object (name, val, active, hash)
VALUES ('name', 'val', FALSE, 'abcdefg');

-- 6. Boolean literal formatting - INPUT FORM with 'f'::boolean cast
-- The deparser may normalize this to FALSE
INSERT INTO objects.object (name, val, active, hash)
VALUES ('name', 'val', 'f'::boolean, 'abcdefg');

-- 7. Parenthesization / argument formatting with IN parameter mode
-- Tests formatting of function parameters with IN mode and custom types
-- Input form: ( IN p1 pos_int )
CREATE FUNCTION test_func(IN p1 pos_int) RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;

-- 8. Parenthesization with multiple IN parameters
CREATE FUNCTION test_func2(IN p1 pos_int, IN p2 text) RETURNS void AS $$ BEGIN NULL; END; $$ LANGUAGE plpgsql;

-- 9. Mixed parameter modes (IN, OUT, INOUT)
CREATE FUNCTION test_func3(IN p1 integer, OUT p2 text, INOUT p3 boolean) RETURNS record AS $$ BEGIN p2 := 'test'; END; $$ LANGUAGE plpgsql;
