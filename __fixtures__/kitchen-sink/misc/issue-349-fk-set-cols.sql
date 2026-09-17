-- Ref: constructive-io/pgsql-parser#349
ALTER TABLE ONLY child ADD CONSTRAINT child_fk FOREIGN KEY (a, b) REFERENCES parent(a, b) ON DELETE SET NULL (b);
ALTER TABLE ONLY child ADD CONSTRAINT child_fk FOREIGN KEY (a, b) REFERENCES parent(a, b) ON DELETE SET DEFAULT (b);
ALTER TABLE ONLY child ADD CONSTRAINT child_fk FOREIGN KEY (a, b) REFERENCES parent(a, b) ON UPDATE CASCADE ON DELETE SET NULL (a, b);
CREATE TABLE child (a int, b int, FOREIGN KEY (a, b) REFERENCES parent (a, b) ON DELETE SET NULL (b));
