export * from './types';
export { parse, parseSync, loadModule } from './parse';
export { deparse, deparseSync } from './deparse';
export { transform, transformSync } from './transform';
export { 
  walk, 
  walkParsedScript, 
  PLpgSQLNodePath,
  type PLpgSQLWalker,
  type PLpgSQLVisitor,
  type PLpgSQLNodeTag,
  type WalkOptions
} from './traverse';
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
} from '@libpg-query/parser';
