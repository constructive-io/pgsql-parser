export type {
  ExtensionAction,
  ExtensionFact,
  QualifiedName,
  StatementFacts,
  StatementKind,
} from './facts';
export { classifyStatements } from './facts';
export type {
  EdgeKind,
  StatementEdge,
  StatementGraph,
  StatementNode,
} from './graph';
export { buildStatementGraph } from './graph';
export type {
  Granularity,
  RestructureOptions,
  RestructureResult,
} from './restructure';
export { orderStatements, restructureSql } from './restructure';
export type {
  ExtensionDefinition,
  ExtensionRoute,
  ExtensionRouteSpec,
  ExtensionRouterOptions,
  ExtensionSymbol,
  ExtensionSymbolNamespace,
  SymbolRewrite,
} from './extension-router';
export { COMMON_EXTENSIONS, ExtensionRouter } from './extension-router';
export type { ExtensionTransformResult } from './extension-transform';
export {
  createExtensionResult,
  createExtensionVisitor,
  transformExtensions,
} from './extension-transform';
export type { RoleRouteSpec } from './role-router';
export { RoleRouter } from './role-router';
export type { RoleTransformResult } from './role-transform';
export {
  createRoleResult,
  createRoleVisitor,
  transformRoles,
} from './role-transform';
export type {
  ObjectInventory,
  QualifyResult,
  QualifyRoutes,
  QualifyTargetSelector,
  QualifyUnqualifiedOptions,
} from './qualify';
export {
  collectCreatedObjects,
  createQualifyVisitor,
  mergeInventories,
  qualifyUnqualified,
} from './qualify';
export type {
  ObjectNamespace,
  ObjectRoute,
  ObjectRouteTarget,
  RouteNamespace,
  RouteSpec,
  SchemaRoute,
} from './router';
export { SchemaRouter } from './router';
export type { CapturedAsts } from './round-trip';
export {
  captureAstsFromSql,
  captureTransformAsts,
  firstDifference,
  normalizeParseTree,
  validateRoundTrip,
} from './round-trip';
export type { NormalizeTreeOptions } from './round-trip-core';
export {
  CLEAN_TREE_VOLATILE_KEYS,
  cleanTree,
  normalizeTree,
  trimDefElemBody,
} from './round-trip-core';
export type {
  SchemaMappingInput,
  SchemaTransformPass,
  SchemaTransformResult,
  TransformSqlOptions,
} from './transform';
export {
  createPlpgsqlVisitor,
  createSqlVisitor,
  escapeRegexp,
  extractPgpmHeader,
  shouldTransformSchema,
  transformComments,
  transformJsonStringValues,
  transformNameList,
  transformPlpgsqlTypeAst,
  transformPlpgsqlTypeString,
  transformRelation,
  transformSchemaName,
  transformSql,
  transformSqlStatement,
  transformVerifyCalls,
  validateNoUntransformedSchemas,
  walkPlpgsqlForSchemas,
} from './transform';
