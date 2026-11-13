import { runtimeSchema } from '../../utils/src/runtime-schema';
import fieldMetadata from '../src/field-metadata.json';

interface FieldMetadata {
  nullable: boolean;
  tags: string[];
  isArray: boolean;
}

const metadata = fieldMetadata as Record<string, Record<string, FieldMetadata>>;
const schema = new Map(runtimeSchema.map(spec => [spec.name, spec]));

describe('field-metadata.json', () => {
  it('only describes Node-typed fields that exist in the runtime schema', () => {
    const unknown: string[] = [];
    for (const [nodeName, fields] of Object.entries(metadata)) {
      const spec = schema.get(nodeName);
      for (const fieldName of Object.keys(fields)) {
        const field = spec?.fields.find(f => f.name === fieldName);
        if (!field || field.type !== 'Node') {
          unknown.push(`${nodeName}.${fieldName}`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });

  it('only infers tags that are node types, sorted and without duplicates', () => {
    const bad: string[] = [];
    for (const [nodeName, fields] of Object.entries(metadata)) {
      for (const [fieldName, field] of Object.entries(fields)) {
        const sorted = [...new Set(field.tags)].sort();
        if (sorted.join() !== field.tags.join() || field.tags.some(tag => !schema.has(tag))) {
          bad.push(`${nodeName}.${fieldName}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('marks a field as an array exactly when the schema says so', () => {
    const mismatched: string[] = [];
    for (const [nodeName, fields] of Object.entries(metadata)) {
      for (const [fieldName, field] of Object.entries(fields)) {
        const spec = schema.get(nodeName)?.fields.find(f => f.name === fieldName);
        if (spec && spec.isArray !== field.isArray) {
          mismatched.push(`${nodeName}.${fieldName}`);
        }
      }
    }
    expect(mismatched).toEqual([]);
  });
});
