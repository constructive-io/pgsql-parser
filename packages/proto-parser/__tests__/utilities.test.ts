import { Type } from '@launchql/protobufjs';

import { ProtoStore } from '../src/store';
import { getDependencies, getDependents, getUndefinedKey } from '../src/utils';
import { getStore } from '../test-utils';


describe('Dependency and Dependent Resolution', () => {
  let store: ProtoStore;
  let all: string[];
  let typesToSearch: Type[];

  beforeAll(() => {
    store = getStore({
      exclude: ['ScanResult', 'ParseResult', 'CreateSubscriptionStmt', 'AlterSubscriptionStmt', 'DropBehavior'],
    });
    all = store.types.map(type=>type.name);
    typesToSearch = store.typesToProcess();
  });

  describe('getDependencies', () => {
    it('DropUserMappingStmt', () => {
      const list =
        getDependencies(
          'DropUserMappingStmt',
          typesToSearch,
          store.enums
        );
      expect(list).toEqual([
        'RoleSpecType',
        'RoleSpec',
        'DropUserMappingStmt'
      ]);
    });
    it('RangeTblRef', () => {
      const list =
        getDependencies(
          'RangeTblRef',
          typesToSearch,
          store.enums
        );
      expect(list).toEqual([
        'RangeTblRef'
      ]);
    });
    it('TargetEntry', () => {
      const list =
        getDependencies(
          'TargetEntry',
          typesToSearch,
          store.enums
        );
      expect(list).toEqual([
        'TargetEntry'
      ]);
    });
  });

  describe('getDependents', () => {
    it('ImportForeignSchemaType', () => {
      const list =
        getDependents(
          'ImportForeignSchemaType',
          typesToSearch,
          store.enums
        );
      expect(list).toEqual([
        'ImportForeignSchemaStmt'
      ]);
    });
    it('RangeTblRef', () => {
      const list =
        getDependents(
          'RangeTblRef',
          typesToSearch,
          store.enums
        );
      expect(list).toEqual([
      ]);
    });
  });
});

it('getUndefinedKey', () => {
  expect(getUndefinedKey('SQLValueFunctionOp')).toEqual('SQLVALUE_FUNCTION_OP_UNDEFINED');
  expect(getUndefinedKey('AlterTSConfigType')).toEqual('ALTER_TSCONFIG_TYPE_UNDEFINED');
  expect(getUndefinedKey('A_Expr_Kind')).toEqual('A_EXPR_KIND_UNDEFINED');
});
