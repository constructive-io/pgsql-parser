import { Field, Namespace,Type } from '@launchql/protobufjs';

import { FieldSpec,NodeSpec } from './types';

export class RuntimeSchemaGenerator {
  private root: Namespace;
  private nodeTypes: Set<string> = new Set();

  constructor(root: Namespace) {
    this.root = root;
    this.extractNodeTypes();
  }

  private extractNodeTypes(): void {
    const nodeType = this.root.lookupType('Node');
    if (nodeType && nodeType.oneofs && nodeType.oneofs.node) {
      const oneof = nodeType.oneofs.node;
      for (const fieldName of oneof.fieldsArray.map(f => f.name)) {
        const field = nodeType.fields[fieldName];
        if (field && field.type) {
          this.nodeTypes.add(field.type);
        }
      }
    }
  }

  public generateNodeSpecs(): NodeSpec[] {
    const nodeSpecs: NodeSpec[] = [];
    
    const pgQueryNamespace = this.root.nested?.pg_query;
    if (pgQueryNamespace && pgQueryNamespace instanceof Namespace && pgQueryNamespace.nestedArray) {
      pgQueryNamespace.nestedArray.forEach((nested) => {
        if (nested instanceof Type && nested.name !== 'Node') {
          const nodeSpec = this.createNodeSpec(nested);
          if (nodeSpec) {
            nodeSpecs.push(nodeSpec);
          }
        }
      });
    }

    return nodeSpecs.sort((a, b) => a.name.localeCompare(b.name));
  }

  private createNodeSpec(type: Type): NodeSpec | null {
    const fields: FieldSpec[] = [];
    
    Object.values(type.fields).forEach((field) => {
      const fieldSpec = this.createFieldSpec(field);
      if (fieldSpec) {
        fields.push(fieldSpec);
      }
    });

    return {
      name: type.name,
      isNode: this.nodeTypes.has(type.name),
      fields: fields.sort((a, b) => a.name.localeCompare(b.name))
    };
  }

  private createFieldSpec(field: Field): FieldSpec | null {
    const fieldName = field.name;
    const isArray = field.repeated || false;
    const optional = !field.required;
    const fieldType = field.type;

    return {
      name: fieldName,
      type: fieldType,
      isArray,
      optional
    };
  }

  public getNodeTypes(): string[] {
    return Array.from(this.nodeTypes).sort();
  }

  public getNodeTypesCount(): number {
    return this.nodeTypes.size;
  }
}
