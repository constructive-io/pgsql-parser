export { deparse, deparseSync } from './deparse';
export { loadModule,parse, parseSync } from './parse';
export { transform, transformSync } from './transform';
export { walkSql, type WalkSqlOptions } from './traverse';
export * from './types';

// The walkers live in @pgsql/traverse; re-exported here so a single import
// covers parsing and traversal.
export { getReturnInfo, getReturnInfoFromParsedFunction } from './return-info';
export {
  PlpgsqlNodePath,
  type PlpgsqlNodeTag,
  type PlpgsqlVisitor,
  type PlpgsqlWalker,
  type PlpgsqlWalkOptions,
  READ_STATEMENTS,
  type UnifiedVisitor,
  type UnifiedWalker,
  walk,
  type WalkContext,
  type WalkOptions,
  walkPlpgsqlAst,
  type WalkResult,
  walkSqlAst,
  WRITE_STATEMENTS
} from '@pgsql/traverse';
export {
  parsePlPgSQLSync as parsePlpgsqlBody,
  parseSync as parseSql} from 'libpg-query';
export { Deparser,deparse as deparseSql } from 'pgsql-deparser';
export {
  dehydratePlpgsqlAst,
  deparseSync as deparsePlpgsqlBody,
  getOriginalQuery,
  hydratePlpgsqlAst,
  isHydratedExpr,
  ReturnInfo,
  ReturnInfoKind
} from 'plpgsql-deparser';
