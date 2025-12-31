import { parse } from './parse';
import { deparse, deparseSync } from './deparse';
import type {
  TransformOptions,
  TransformContext,
  TransformInput,
  TransformCallback,
  TransformVisitors,
  ParsedFunction,
  ParsedStatement
} from './types';

function isCallback(input: TransformInput): input is TransformCallback {
  return typeof input === 'function';
}

function isVisitors(input: TransformInput): input is TransformVisitors {
  return typeof input === 'object' && input !== null;
}

export async function transform(
  sql: string,
  input: TransformInput,
  options: TransformOptions = {}
): Promise<string> {
  const { hydrate = true, pretty = true } = options;
  
  const parsed = parse(sql, { hydrate });
  
  const ctx: TransformContext = {
    sql: parsed.sql,
    items: parsed.items,
    functions: parsed.functions
  };
  
  if (isCallback(input)) {
    await input(ctx);
  } else if (isVisitors(input)) {
    for (const item of ctx.items) {
      if (item.kind === 'plpgsql-function' && input.onFunction) {
        await input.onFunction(item as ParsedFunction, ctx);
      } else if (item.kind === 'stmt' && input.onStatement) {
        await input.onStatement(item as ParsedStatement, ctx);
      }
    }
  }
  
  return deparse(ctx, { pretty });
}

export function transformSync(
  sql: string,
  input: TransformInput,
  options: TransformOptions = {}
): string {
  const { hydrate = true, pretty = true } = options;
  
  const parsed = parse(sql, { hydrate });
  
  const ctx: TransformContext = {
    sql: parsed.sql,
    items: parsed.items,
    functions: parsed.functions
  };
  
  if (isCallback(input)) {
    const result = input(ctx);
    if (result instanceof Promise) {
      throw new Error('transformSync does not support async callbacks. Use transform() instead.');
    }
  } else if (isVisitors(input)) {
    for (const item of ctx.items) {
      if (item.kind === 'plpgsql-function' && input.onFunction) {
        const result = input.onFunction(item as ParsedFunction, ctx);
        if (result instanceof Promise) {
          throw new Error('transformSync does not support async visitors. Use transform() instead.');
        }
      } else if (item.kind === 'stmt' && input.onStatement) {
        const result = input.onStatement(item as ParsedStatement, ctx);
        if (result instanceof Promise) {
          throw new Error('transformSync does not support async visitors. Use transform() instead.');
        }
      }
    }
  }
  
  return deparseSync(ctx, { pretty });
}
