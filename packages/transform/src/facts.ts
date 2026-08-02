/**
 * The statement-classification facts layer now lives in `@pgsql/semantics`.
 * It is re-exported here so existing `@pgsql/transform` consumers — and this
 * package's own drivers (`qualify`, `restructure`, `naming`, `graph`) — keep
 * importing the same symbols from the same paths.
 */
export * from '@pgsql/semantics';
