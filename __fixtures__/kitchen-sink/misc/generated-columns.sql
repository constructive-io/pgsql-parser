-- 1. CREATE TABLE with a generated column (arithmetic expression)
CREATE TABLE generated_misc_test (
  a INT,
  b INT,
  c INT GENERATED ALWAYS AS (a + b) STORED
);

-- 2. Generated column with a function call
CREATE TABLE generated_func_test (
  name TEXT,
  name_upper TEXT GENERATED ALWAYS AS (upper(name)) STORED
);

-- 3. Generated column with type modifier and NOT NULL/UNIQUE
CREATE TABLE generated_numeric_test (
  quantity INT,
  unit_price NUMERIC(10, 2),
  total_price NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED NOT NULL UNIQUE
);

-- 4. Generated column with a CASE expression
CREATE TABLE generated_case_test (
  flag BOOLEAN,
  result INT GENERATED ALWAYS AS (CASE WHEN flag THEN 1 ELSE 0 END) STORED
);

-- 5. ALTER TABLE ADD COLUMN generated
ALTER TABLE generated_misc_test
ADD COLUMN d INT GENERATED ALWAYS AS (a + b + c) STORED;

-- 6. ALTER TABLE SET EXPRESSION (new expression for an existing generated column)
ALTER TABLE generated_misc_test
ALTER COLUMN c SET EXPRESSION AS (a - b);

-- 7. ALTER TABLE DROP EXPRESSION
ALTER TABLE generated_misc_test
ALTER COLUMN c DROP EXPRESSION;

-- 8. ALTER TABLE DROP EXPRESSION IF EXISTS
ALTER TABLE generated_misc_test
ALTER COLUMN c DROP EXPRESSION IF EXISTS;
