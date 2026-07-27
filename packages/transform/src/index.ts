export type {
  BundleScriptContext,
  NamespaceValidatorOptions,
  SchemaTranspiler,
  SchemaTranspilerOptions,
} from './bundle-driver';
export {
  makeNamespaceValidator,
  makeSchemaTranspiler,
} from './bundle-driver';
export type {
  CategoryProfile,
  ChangeCategory,
} from './categorize';
export {
  buildCategoryOf,
  categorizeChange,
  TIER_PROFILE,
} from './categorize';
export type {
  QualifiedName,
  StatementFacts,
  StatementKind,
} from './facts';
export { classifyStatements } from './facts';
export type {
  ClosureChange,
  ClosureInputChange,
  ClosureReason,
  FixtureClosure,
  ResolveFixtureClosureOptions,
} from './fixture-closure';
export { resolveFixtureClosure } from './fixture-closure';
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
