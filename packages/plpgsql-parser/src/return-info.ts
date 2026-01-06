import type { ReturnInfo, ReturnInfoKind } from 'plpgsql-deparser';

/**
 * Extract return type information from a CreateFunctionStmt AST node.
 * 
 * This helper analyzes the function's return type and parameters to determine
 * the correct ReturnInfo for the PL/pgSQL deparser.
 * 
 * @param createFunctionStmt - The CreateFunctionStmt AST node
 * @returns ReturnInfo object with the appropriate kind
 */
export function getReturnInfo(createFunctionStmt: any): ReturnInfo {
  if (!createFunctionStmt) {
    return { kind: 'scalar' };
  }

  // Check if it's a procedure (procedures have implicit void return)
  if (createFunctionStmt.is_procedure) {
    return { kind: 'void' };
  }

  // Check for OUT/INOUT/TABLE parameters - these indicate out_params return type
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
  // Note: returnType is directly a TypeName object, not wrapped in { TypeName: ... }
  const returnType = createFunctionStmt.returnType;
  if (!returnType) {
    // No return type specified - treat as void
    return { kind: 'void' };
  }

  // Check for SETOF
  if (returnType.setof) {
    return { kind: 'setof' };
  }

  // Extract the type name
  const typeName = extractTypeName(returnType);
  
  // Check for void
  if (typeName === 'void') {
    return { kind: 'void' };
  }

  // Check for trigger
  if (typeName === 'trigger') {
    return { kind: 'trigger' };
  }

  // Default to scalar for all other types
  return { kind: 'scalar' };
}

/**
 * Extract the type name from a TypeName AST node.
 * 
 * @param typeName - The TypeName AST node
 * @returns The type name as a lowercase string
 */
function extractTypeName(typeName: any): string {
  if (!typeName?.names || !Array.isArray(typeName.names)) {
    return '';
  }

  // The names array contains String nodes with sval property
  // For simple types like "void", it's usually ["pg_catalog", "void"]
  // For user types, it might be ["schema", "type"] or just ["type"]
  const names = typeName.names
    .map((n: any) => n?.String?.sval)
    .filter((s: string | undefined): s is string => typeof s === 'string');

  // Return the last name (the actual type name, not the schema)
  const lastName = names[names.length - 1];
  return lastName ? lastName.toLowerCase() : '';
}

/**
 * Get return info from a ParsedFunction object.
 * 
 * @param parsedFunction - A ParsedFunction object from plpgsql-parser
 * @returns ReturnInfo object with the appropriate kind
 */
export function getReturnInfoFromParsedFunction(parsedFunction: any): ReturnInfo {
  if (!parsedFunction?.stmt) {
    return { kind: 'scalar' };
  }
  return getReturnInfo(parsedFunction.stmt);
}

export type { ReturnInfo, ReturnInfoKind };
