import { PLpgSQLDeparser, PLpgSQLDeparserOptions, ReturnInfo, ReturnInfoKind } from './plpgsql-deparser';

const deparseMethod = PLpgSQLDeparser.deparse;
const deparseFunctionMethod = PLpgSQLDeparser.deparseFunction;

export const deparseSync = deparseMethod;
export const deparseFunctionSync = deparseFunctionMethod;

export const deparse = async (
  ...args: Parameters<typeof deparseMethod>
): Promise<ReturnType<typeof deparseMethod>> => {
  return deparseMethod(...args);
};

export const deparseFunction = async (
  ...args: Parameters<typeof deparseFunctionMethod>
): Promise<ReturnType<typeof deparseFunctionMethod>> => {
  return deparseFunctionMethod(...args);
};

export { PLpgSQLDeparser, PLpgSQLDeparserOptions, ReturnInfo, ReturnInfoKind };
export * from './types';
export * from './hydrate-types';
export { hydratePlpgsqlAst, dehydratePlpgsqlAst, isHydratedExpr, isHydratedTypeName, getOriginalQuery, DehydrationOptions } from './hydrate';
