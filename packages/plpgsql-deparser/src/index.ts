import { PLpgSQLDeparser, PLpgSQLDeparserOptions } from './plpgsql-deparser';

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

export { PLpgSQLDeparser, PLpgSQLDeparserOptions };
export * from './types';
export * from './hydrate-types';
export { hydratePlpgsqlAst, dehydratePlpgsqlAst, isHydratedExpr, getOriginalQuery } from './hydrate';
