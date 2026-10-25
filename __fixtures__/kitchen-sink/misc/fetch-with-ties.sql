-- FETCH FIRST n ROWS WITH TIES (SelectStmt.limitOption)
-- Ref: PostgreSQL regress limit.sql
SELECT thousand FROM onek WHERE thousand < 5 ORDER BY thousand FETCH FIRST 2 ROW WITH TIES;
SELECT thousand FROM onek WHERE thousand < 5 ORDER BY thousand FETCH FIRST ROWS WITH TIES;
SELECT thousand FROM onek WHERE thousand < 5 ORDER BY thousand OFFSET 2 ROWS FETCH NEXT (1 + 1) ROWS WITH TIES;
CREATE VIEW limit_thousand_v_1 AS SELECT thousand FROM onek WHERE thousand < 995 ORDER BY thousand FETCH FIRST 5 ROWS WITH TIES OFFSET 10;
CREATE VIEW limit_thousand_v_3 AS SELECT thousand FROM onek WHERE thousand < 995 ORDER BY thousand FETCH FIRST (NULL+1) ROWS WITH TIES;
CREATE VIEW limit_thousand_v_4 AS SELECT thousand FROM onek WHERE thousand < 995 ORDER BY thousand FETCH FIRST NULL ROWS ONLY;
SELECT * FROM t ORDER BY a FETCH FIRST $1 ROWS WITH TIES;
SELECT * FROM t ORDER BY a FETCH FIRST -1 ROWS WITH TIES;
