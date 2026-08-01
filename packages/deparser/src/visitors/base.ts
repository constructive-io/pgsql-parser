import { Node } from '@pgsql/types';

import { SqlFormatter } from '../utils/sql-formatter';

export interface DeparserContextOptions {
  isStringLiteral?: boolean;
  parentNodeTypes?: string[];
  indentLevel?: number;
  prettyMode?: boolean;
  formatter?: SqlFormatter;
  select?: boolean;
  from?: boolean;
  group?: boolean;
  sort?: boolean;
  insertColumns?: boolean;
  update?: boolean;
  bool?: boolean;
  isColumnConstraint?: boolean;
  isDomainConstraint?: boolean;
  alterColumnOptions?: boolean;
  alterTableOptions?: boolean;
  isEnumValue?: boolean;
  objtype?: string;
  subtype?: string;
  [key: string]: any;
}

export class DeparserContext {
  readonly indentLevel: number;
  readonly prettyMode: boolean;
  readonly isStringLiteral?: boolean;
  readonly parentNodeTypes: string[];
  private readonly formatter: SqlFormatter;
  readonly select?: boolean;
  readonly from?: boolean;
  readonly group?: boolean;
  readonly sort?: boolean;
  readonly insertColumns?: boolean;
  readonly update?: boolean;
  readonly bool?: boolean;
  readonly isColumnConstraint?: boolean;
  readonly isDomainConstraint?: boolean;
  readonly alterColumnOptions?: boolean;
  readonly alterTableOptions?: boolean;
  readonly isEnumValue?: boolean;
  readonly objtype?: string;
  readonly subtype?: string;
  readonly [key: string]: any;

  constructor({
    indentLevel = 0,
    prettyMode = true,
    isStringLiteral,
    parentNodeTypes = [],
    formatter,
    select,
    from,
    group,
    sort,
    insertColumns,
    update,
    bool,
    isColumnConstraint,
    isDomainConstraint,
    alterColumnOptions,
    alterTableOptions,
    isEnumValue,
    objtype,
    subtype,
    ...rest
  }: DeparserContextOptions = {}) {
    this.indentLevel = indentLevel;
    this.prettyMode = prettyMode;
    this.isStringLiteral = isStringLiteral;
    this.parentNodeTypes = parentNodeTypes;
    this.formatter = formatter || new SqlFormatter('\n', '  ', prettyMode);
    this.select = select;
    this.from = from;
    this.group = group;
    this.sort = sort;
    this.insertColumns = insertColumns;
    this.update = update;
    this.bool = bool;
    this.isColumnConstraint = isColumnConstraint;
    this.isDomainConstraint = isDomainConstraint;
    this.alterColumnOptions = alterColumnOptions;
    this.alterTableOptions = alterTableOptions;
    this.isEnumValue = isEnumValue;
    this.objtype = objtype;
    this.subtype = subtype;

    Object.assign(this, rest);
  }

  spawn(nodeType: string, overrides: Partial<DeparserContextOptions> = {}): DeparserContext {
    return new DeparserContext({
      indentLevel: this.indentLevel,
      prettyMode: this.prettyMode,
      isStringLiteral: this.isStringLiteral,
      parentNodeTypes: [...this.parentNodeTypes, nodeType],
      formatter: this.formatter,
      select: this.select,
      from: this.from,
      group: this.group,
      sort: this.sort,
      insertColumns: this.insertColumns,
      update: this.update,
      bool: this.bool,
      isColumnConstraint: this.isColumnConstraint,
      isDomainConstraint: this.isDomainConstraint,
      alterColumnOptions: this.alterColumnOptions,
      alterTableOptions: this.alterTableOptions,
      isEnumValue: this.isEnumValue,
      objtype: this.objtype,
      subtype: this.subtype,
      ...overrides,
    });
  }

  indent(text: string, count?: number): string {
    if (!this.prettyMode) {
      return text;
    }
    const indentCount = count !== undefined ? count : this.indentLevel + 1;
    return this.formatter.indent(text, indentCount);
  }

  newline(): string {
    return this.formatter.newline();
  }

  parens(content: string): string {
    return this.formatter.parens(content);
  }

  format(parts: string[], separator?: string): string {
    return this.formatter.format(parts, separator);
  }

  isPretty(): boolean {
    return this.formatter.isPretty();
  }
}

export interface DeparserVisitor {
  visit(node: Node, context?: DeparserContext): string;
}

export abstract class BaseVisitor implements DeparserVisitor {
  abstract visit(node: Node, context?: DeparserContext): string;

  protected getNodeType(node: Node): string {
    return Object.keys(node)[0];
  }

  protected getNodeData(node: Node): any {
    const type = this.getNodeType(node);
    return (node as any)[type];
  }

  protected formatList(items: any[], separator: string = ', ', prefix: string = '', formatter: (item: any) => string): string {
    if (!items || items.length === 0) {
      return '';
    }

    return items
      .map(item => `${prefix}${formatter(item)}`)
      .join(separator);
  }

  protected formatParts(parts: string[], separator: string = ' '): string {
    return parts.filter(part => part !== null && part !== undefined && part !== '').join(separator);
  }

  protected formatParens(content: string): string {
    return `(${content})`;
  }

  protected formatIndent(text: string, count: number = 1): string {
    return text;
  }
}
