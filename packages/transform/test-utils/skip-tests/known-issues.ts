import { SkipTest } from "./types";

export const knownIssues: SkipTest[] = [
    // PG13-PG16 treated \v as 'v'
    // PG17 treats \v as '\u000b'
    // So yes — PG17 fixed a real bug, and the current output with \u000b is the spec-compliant behavior.
    [16, 17, "misc/quotes_etc-26.sql", "16-17 Parser-level \v character escape sequence difference: PG16 parser outputs 'v' but PG17 parser outputs '\u000b' (vertical tab)"],

    // PG18 marks the special-form syntaxes SET TIME ZONE / SET XML OPTION with jumble_args,
    // but the v17 AST is identical for both the special form and the generic SET name TO value
    // form, so the transformer cannot recover which syntax was used
    [17, 18, "original/upstream/horology-90.sql", "17-18 v17 AST cannot distinguish SET TIME ZONE from SET timezone TO (jumble_args)"],
    [17, 18, "original/upstream/json-62.sql", "17-18 v17 AST cannot distinguish SET TIME ZONE from SET timezone TO (jumble_args)"],
    [17, 18, "original/upstream/jsonb-51.sql", "17-18 v17 AST cannot distinguish SET TIME ZONE from SET timezone TO (jumble_args)"],
    [17, 18, "original/upstream/xml-90.sql", "17-18 v17 AST cannot distinguish SET XML OPTION from SET xmloption TO (jumble_args)"],
    [17, 18, "original/upstream/horology-223.sql", "17-18 v17 AST cannot distinguish SET TIME ZONE from SET timezone TO (jumble_args)"],
    [17, 18, "original/upstream/json-64.sql", "17-18 v17 AST cannot distinguish SET TIME ZONE from SET timezone TO (jumble_args)"],
    [17, 18, "original/upstream/jsonb-53.sql", "17-18 v17 AST cannot distinguish SET TIME ZONE from SET timezone TO (jumble_args)"],
    [17, 18, "original/upstream/xml-93.sql", "17-18 v17 AST cannot distinguish SET XML OPTION from SET xmloption TO (jumble_args)"],
    [17, 18, "original/upstream/horology-224.sql", "17-18 v17 AST cannot distinguish SET TIME ZONE from SET timezone TO (jumble_args)"],

    // PG14 distinguishes explicit IN parameters (FUNC_PARAM_IN) from implicit ones
    // (FUNC_PARAM_DEFAULT), but PG13 reports FUNC_PARAM_IN for both, so the
    // transformer cannot recover which syntax was used
    [13, 14, "pretty/formatting-7.sql", "13-14 v13 AST cannot distinguish explicit IN parameters from implicit ones"],
    [13, 14, "pretty/formatting-8.sql", "13-14 v13 AST cannot distinguish explicit IN parameters from implicit ones"],

    // PG14 strips the pg_catalog prefix for unquoted substring() calls but keeps it
    // for quoted pg_catalog.\"substring\"() calls; PG13 produces the same AST for both,
    // so the transformer cannot recover which syntax was used
    [13, 14, "pretty/quoting-7.sql", "13-14 v13 AST cannot distinguish quoted pg_catalog.\"substring\"() from unquoted substring()"],
];  