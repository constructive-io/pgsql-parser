import type { ParseResult } from '@libpg-query/parser';
import type {
  PLpgSQLParseResult,
  HydrationStats,
  HydrationError
} from 'plpgsql-deparser';

export interface PlpgsqlFunctionBody {
  raw: string;
  delimiter: string;
}

export interface PlpgsqlFunctionData {
  raw: PLpgSQLParseResult;
  hydrated: any;
  stats: HydrationStats;
  errors: HydrationError[];
}

export interface ParsedFunction {
  kind: 'plpgsql-function';
  stmt: any;
  stmtIndex: number;
  language: string;
  body: PlpgsqlFunctionBody;
  plpgsql: PlpgsqlFunctionData;
}

export interface ParsedStatement {
  kind: 'stmt';
  stmt: any;
  stmtIndex: number;
}

export type ParsedItem = ParsedFunction | ParsedStatement;

export interface ParsedScript {
  sql: ParseResult;
  items: ParsedItem[];
  functions: ParsedFunction[];
}

export interface ParseOptions {
  hydrate?: boolean;
}

export interface DeparseOptions {
  pretty?: boolean;
}

export interface TransformOptions extends DeparseOptions {
  hydrate?: boolean;
}

export interface TransformContext {
  sql: ParseResult;
  items: ParsedItem[];
  functions: ParsedFunction[];
}

export type TransformCallback = (ctx: TransformContext) => void | Promise<void>;

export interface TransformVisitors {
  onFunction?: (fn: ParsedFunction, ctx: TransformContext) => void | Promise<void>;
  onStatement?: (stmt: ParsedStatement, ctx: TransformContext) => void | Promise<void>;
}

export type TransformInput = TransformCallback | TransformVisitors;
