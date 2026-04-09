/**
 * Return info extraction for PL/pgSQL functions.
 *
 * Re-exports the upstream helper from plpgsql-parser's return-info module
 * pattern, but implemented locally to avoid depending on plpgsql-parser
 * (which would create a circular dependency).
 */

import type { ReturnInfo, ReturnInfoKind } from 'plpgsql-deparser';

/**
 * Extract return type information from a CreateFunctionStmt AST node.
 */
export function getReturnInfo(createFunctionStmt: any): ReturnInfo {
  if (!createFunctionStmt) {
    return { kind: 'scalar' };
  }

  // Procedures have implicit void return
  if (createFunctionStmt.is_procedure) {
    return { kind: 'void' };
  }

  // Check for OUT/INOUT/TABLE parameters
  if (createFunctionStmt.parameters && Array.isArray(createFunctionStmt.parameters)) {
    const hasOutParams = createFunctionStmt.parameters.some((param: any) => {
      const fp = param?.FunctionParameter;
      if (!fp) return false;
      const mode = fp.mode;
      return mode === 'FUNC_PARAM_OUT' ||
             mode === 'FUNC_PARAM_INOUT' ||
             mode === 'FUNC_PARAM_TABLE';
    });
    if (hasOutParams) {
      return { kind: 'out_params' };
    }
  }

  // Check the return type
  const returnType = createFunctionStmt.returnType;
  if (!returnType) {
    return { kind: 'void' };
  }

  // SETOF
  if (returnType.setof) {
    return { kind: 'setof' };
  }

  // Extract type name
  const names = returnType.names
    ?.map((n: any) => n?.String?.sval)
    .filter((s: string | undefined): s is string => typeof s === 'string') ?? [];
  const lastName = names[names.length - 1]?.toLowerCase() ?? '';

  if (lastName === 'void') return { kind: 'void' };
  if (lastName === 'trigger') return { kind: 'trigger' };

  return { kind: 'scalar' };
}

/**
 * Get return info from a parsed function's stmt field.
 */
export function getReturnInfoFromParsedFunction(parsedFunction: any): ReturnInfo {
  if (!parsedFunction?.stmt) {
    return { kind: 'scalar' };
  }
  return getReturnInfo(parsedFunction.stmt);
}

export type { ReturnInfo, ReturnInfoKind };
