-- GRANT/REVOKE role membership options, GRANTED BY, CASCADE
GRANT regress_role1 TO regress_role2;
GRANT regress_role1 TO regress_role2 WITH ADMIN OPTION;
GRANT regress_role1 TO regress_role2 WITH ADMIN OPTION GRANTED BY regress_role3;
GRANT regress_role1 TO regress_role2 GRANTED BY CURRENT_ROLE;
GRANT regress_role1 TO regress_role2 GRANTED BY CURRENT_USER;
GRANT regress_role1 TO regress_role2 WITH INHERIT FALSE, ADMIN TRUE;
GRANT regress_role1 TO regress_role2 WITH INHERIT OPTION, SET FALSE;
GRANT regress_role1 TO regress_role2 WITH SET TRUE GRANTED BY regress_role3;
GRANT "Mixed_Case_Role" TO regress_role2;
REVOKE regress_role1 FROM regress_role2;
REVOKE regress_role1 FROM regress_role2 CASCADE;
REVOKE ADMIN OPTION FOR regress_role1 FROM regress_role2;
REVOKE ADMIN OPTION FOR regress_role1 FROM regress_role2 GRANTED BY regress_role3 CASCADE;
REVOKE INHERIT OPTION FOR regress_role1 FROM regress_role2;
REVOKE SET OPTION FOR regress_role1 FROM regress_role2;
REVOKE regress_role1 FROM regress_role2 GRANTED BY CURRENT_ROLE;
-- GRANTED BY on object privileges
GRANT INSERT ON t TO regress_role2 GRANTED BY CURRENT_USER;
GRANT TRUNCATE ON t TO regress_role2 GRANTED BY regress_role3;
REVOKE SELECT ON t FROM regress_role2 GRANTED BY CURRENT_ROLE;
