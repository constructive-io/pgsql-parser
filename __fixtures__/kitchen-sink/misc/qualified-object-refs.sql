-- Schema-qualified object references in GRANT/REVOKE, COMMENT and CREATE OPERATOR
-- (found while round-tripping pgpm diff migrations through the deparser)
GRANT USAGE ON TYPE fx.e TO r1;
GRANT USAGE ON DOMAIN fx.d TO r1;
REVOKE USAGE ON TYPE fx.e FROM r1;
GRANT USAGE ON TYPE "Fx"."Mixed Case" TO r1;
COMMENT ON TRIGGER t_tg ON fx.t IS 'trigger comment';
COMMENT ON RULE r ON fx.t IS 'rule comment';
COMMENT ON OPERATOR fx.### (int, int) IS 'operator comment';
COMMENT ON OPERATOR fx.### (NONE, int) IS 'prefix operator comment';
COMMENT ON CAST (int AS text) IS 'cast comment';
CREATE OPERATOR fx.### (LEFTARG = int, RIGHTARG = int, FUNCTION = fx.add3, COMMUTATOR = OPERATOR(fx.###), NEGATOR = OPERATOR(fx.!!!));
