# PostgreSQL 18 AST Upgrade Analysis

This document analyzes the AST changes between PostgreSQL 17 and PostgreSQL 18 based on the [libpg_query comparison](https://github.com/pganalyze/libpg_query/compare/17-latest...18-latest-dev).

## Summary

The PG17 to PG18 upgrade represents a **moderate breaking change**. While not as severe as the PG13 to PG17 migration, there are significant structural changes that will require updates to the parser, deparser, and transformer packages.

The primary changes center around:
1. Enhanced RETURNING clause support (OLD/NEW table references per SQL:2011)
2. Temporal/period constraint support (WITHOUT OVERLAPS)
3. Constraint enforceability (ENFORCED/NOT ENFORCED)
4. Virtual generated columns
5. Comparison type generalization

## New Node Types (5 added)

### ReturningExpr
New expression node for handling RETURNING clause expressions with OLD/NEW context.

```protobuf
message ReturningExpr {
  Node xpr = 1;
  int32 retlevelsup = 2;
  bool retold = 3;
  Node retexpr = 4;
}
```

### ReturningOption
Options for RETURNING clause specifying OLD or NEW table reference.

```protobuf
message ReturningOption {
  ReturningOptionKind option = 1;
  string value = 2;
  int32 location = 3;
}
```

### ReturningClause
New structured RETURNING clause replacing the simple `returning_list`.

```protobuf
message ReturningClause {
  repeated Node options = 1;
  repeated Node exprs = 2;
}
```

### ATAlterConstraint
New node for ALTER CONSTRAINT operations with enhanced options.

```protobuf
message ATAlterConstraint {
  string conname = 1;
  bool alter_enforceability = 2;
  bool is_enforced = 3;
  bool alter_deferrability = 4;
  bool deferrable = 5;
  bool initdeferred = 6;
  bool alter_inheritability = 7;
  bool noinherit = 8;
}
```

## Removed Nodes (1 removed)

### SinglePartitionSpec
Removed (was an empty message in PG17 anyway).

## Major Breaking Changes

### 1. RETURNING Clause Restructuring

**Impact: HIGH** - Affects all DML statements

The `returning_list` field (repeated Node) has been replaced with `returning_clause` (ReturningClause) in:
- `InsertStmt`
- `DeleteStmt`
- `UpdateStmt`
- `MergeStmt`

**Before (PG17):**
```protobuf
message InsertStmt {
  // ...
  repeated Node returning_list = 5;
  // ...
}
```

**After (PG18):**
```protobuf
message InsertStmt {
  // ...
  ReturningClause returning_clause = 5;
  // ...
}
```

This enables SQL:2011 syntax like:
```sql
INSERT INTO t VALUES (1) RETURNING OLD AS o, NEW AS n, *;
DELETE FROM t RETURNING OLD.*, NEW.*;
```

### 2. RowCompareType Replaced by CompareType

**Impact: HIGH** - Breaking enum change

The `RowCompareType` enum has been removed and replaced with a more general `CompareType` enum.

**Removed:**
```protobuf
enum RowCompareType {
  ROWCOMPARE_LT = 1;
  ROWCOMPARE_LE = 2;
  ROWCOMPARE_EQ = 3;
  ROWCOMPARE_GE = 4;
  ROWCOMPARE_GT = 5;
  ROWCOMPARE_NE = 6;
}
```

**Added:**
```protobuf
enum CompareType {
  COMPARE_INVALID = 1;
  COMPARE_LT = 2;
  COMPARE_LE = 3;
  COMPARE_EQ = 4;
  COMPARE_GE = 5;
  COMPARE_GT = 6;
  COMPARE_NE = 7;
  COMPARE_OVERLAP = 8;      // New for temporal
  COMPARE_CONTAINED_BY = 9; // New for temporal
}
```

**RowCompareExpr** field changed:
- `rctype` (RowCompareType) -> `cmptype` (CompareType)

### 3. Query Node Field Additions and Renumbering

**Impact: MEDIUM** - Field position shifts

New fields added to `Query`:
- `has_group_rte` (field 15) - New boolean for GROUP RTE tracking
- `returning_old_alias` (field 27) - Alias for OLD table in RETURNING
- `returning_new_alias` (field 28) - Alias for NEW table in RETURNING

All subsequent fields are renumbered (16-45 instead of 15-42).

### 4. Constraint Node Enhancements

**Impact: MEDIUM** - New fields for temporal and enforceability

New fields added to `Constraint`:
- `is_enforced` (field 5) - For NOT ENFORCED constraints
- `generated_kind` (field 12) - For virtual generated columns
- `without_overlaps` (field 15) - For temporal PRIMARY KEY/UNIQUE
- `fk_with_period` (field 27) - For temporal foreign keys
- `pk_with_period` (field 28) - For temporal foreign keys

**Removed:** `inhcount` field

## Moderate Changes

### Var Node
Added `varreturningtype` (VarReturningType enum) at field 9 for RETURNING OLD/NEW context.

### CreateStmt
Added `nnconstraints` (field 8) for separate NOT NULL constraint handling.

### IndexStmt
Added `iswithoutoverlaps` (field 19) for temporal index support.

### SortGroupClause
Added `reverse_sort` (field 4) for explicit sort direction tracking.

### RangeTblEntry
Added `groupexprs` (field 30) for GROUP RTE support.

### VariableSetStmt
Added `jumble_args` (field 4) and `location` (field 6).

### FunctionParameter
Added `location` (field 5) for better error reporting.

### ArrayExpr and A_ArrayExpr
Added `list_start` and `list_end` fields for precise source location tracking.

### A_Expr
Added `rexpr_list_start` and `rexpr_list_end` fields for IN-list location tracking.

### IntoClause
`view_query` changed from generic `Node` to specific `Query` type.

## New Enums

### ReturningOptionKind
```protobuf
enum ReturningOptionKind {
  RETURNING_OPTION_OLD = 1;
  RETURNING_OPTION_NEW = 2;
}
```

### VarReturningType
```protobuf
enum VarReturningType {
  VAR_RETURNING_DEFAULT = 1;
  VAR_RETURNING_OLD = 2;
  VAR_RETURNING_NEW = 3;
}
```

### CompareType
See above - replaces RowCompareType with additional temporal comparison operators.

## Modified Enums

### AlterTableType
- **Removed:** `AT_CheckNotNull`
- All subsequent values renumbered (shifted down by 1)

### ConstrType
- **Added:** `CONSTR_ATTR_ENFORCED` (15), `CONSTR_ATTR_NOT_ENFORCED` (16)

### RTEKind
- **Added:** `RTE_GROUP` (10) for GROUP BY optimization

### JoinType
- **Added:** `JOIN_RIGHT_SEMI` (7)
- Subsequent values renumbered

## New SQL Keywords/Tokens

- `ENFORCED` - For constraint enforceability
- `OBJECTS_P` - New keyword
- `PERIOD` - For temporal constraints
- `VIRTUAL` - For virtual generated columns

**Removed:** `RECHECK`

## Migration Effort Estimate

### Deparser Updates Required

1. **ReturningClause handling** - Must deparse new structure instead of simple list
2. **CompareType enum** - Update RowCompareExpr deparsing
3. **New constraint syntax** - WITHOUT OVERLAPS, ENFORCED/NOT ENFORCED
4. **Virtual generated columns** - New GENERATED ALWAYS AS ... VIRTUAL syntax

### Transformer Updates Required

1. **V17ToV18Transformer** - New transformer needed
2. **RETURNING clause transformation** - Convert between list and clause structures
3. **CompareType mapping** - Map old RowCompareType values to new CompareType
4. **Constraint field mapping** - Handle new fields with defaults

### Types Package Updates

1. Regenerate from new protobuf definitions
2. Update all affected interfaces
3. Add new node types and enums

## Comparison with Previous Upgrades

| Upgrade | New Nodes | Removed Nodes | Breaking Changes | Effort |
|---------|-----------|---------------|------------------|--------|
| PG13 -> PG14 | ~5 | 0 | funcformat, A_Const | High |
| PG14 -> PG15 | ~3 | 0 | Boolean primitive | Medium |
| PG15 -> PG16 | ~2 | 0 | JSON functions | Low |
| PG16 -> PG17 | ~3 | 0 | JSON types | Low |
| **PG17 -> PG18** | **5** | **1** | **RETURNING, CompareType** | **Medium-High** |

## Recommended Approach

1. **Phase 1: Types Generation**
   - Update proto file to 18-latest
   - Regenerate @pgsql/types, @pgsql/enums, @pgsql/utils
   - Update runtime schema

2. **Phase 2: Deparser Updates**
   - Add ReturningClause visitor
   - Update RowCompareExpr to use CompareType
   - Add new constraint syntax support
   - Add temporal syntax support

3. **Phase 3: Transformer**
   - Create V17ToV18Transformer
   - Handle returning_list -> returning_clause conversion
   - Handle RowCompareType -> CompareType mapping
   - Add default values for new fields

4. **Phase 4: Testing**
   - Add fixtures for new PG18 syntax
   - Verify round-trip parsing/deparsing
   - Test transformation from PG17 ASTs

## Conclusion

The PG17 to PG18 upgrade is more significant than the PG15-16 or PG16-17 upgrades but less disruptive than PG13-14. The main challenges are:

1. The RETURNING clause restructuring affects all DML statements
2. The RowCompareType -> CompareType change requires careful enum mapping
3. New temporal/period features add complexity to constraint handling

However, most existing SQL will continue to work without changes. The new features (temporal constraints, enhanced RETURNING, virtual columns) are additive and won't break existing AST structures for queries that don't use them.
