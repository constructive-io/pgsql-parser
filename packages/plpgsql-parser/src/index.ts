export * from './types';
export { parse, parseSync, loadModule } from './parse';
export { deparse, deparseSync } from './deparse';
export { transform, transformSync } from './transform';
export { walkSql, type WalkSqlOptions } from './traverse';

// The walkers live in @pgsql/traverse; re-exported here so a single import
// covers parsing and traversal.
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
export { getReturnInfo, getReturnInfoFromParsedFunction } from './return-info';

export {
  hydratePlpgsqlAst,
  dehydratePlpgsqlAst,
  deparseSync as deparsePlpgsqlBody,
  isHydratedExpr,
  getOriginalQuery,
  ReturnInfo,
  ReturnInfoKind
} from 'plpgsql-deparser';

export { deparse as deparseSql, Deparser } from 'pgsql-deparser';

export {
  parseSync as parseSql,
  parsePlPgSQLSync as parsePlpgsqlBody
} from 'libpg-query';
