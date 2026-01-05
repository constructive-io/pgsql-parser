# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [17.9.10](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.9.9...@pgsql/transform@17.9.10) (2026-01-05)

**Note:** Version bump only for package @pgsql/transform

## [17.9.9](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.9.8...@pgsql/transform@17.9.9) (2026-01-01)

**Note:** Version bump only for package @pgsql/transform

## [17.9.8](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.9.7...@pgsql/transform@17.9.8) (2025-12-31)

**Note:** Version bump only for package @pgsql/transform

## [17.9.7](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.9.6...@pgsql/transform@17.9.7) (2025-12-27)

**Note:** Version bump only for package @pgsql/transform

## [17.9.6](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.9.5...@pgsql/transform@17.9.6) (2025-12-27)

**Note:** Version bump only for package @pgsql/transform

## [17.9.5](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.9.4...@pgsql/transform@17.9.5) (2025-12-25)

**Note:** Version bump only for package @pgsql/transform

## [17.9.4](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.9.3...@pgsql/transform@17.9.4) (2025-12-25)

**Note:** Version bump only for package @pgsql/transform

## [17.9.3](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.9.2...@pgsql/transform@17.9.3) (2025-12-24)

**Note:** Version bump only for package @pgsql/transform

## [17.9.2](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.9.1...@pgsql/transform@17.9.2) (2025-12-11)

**Note:** Version bump only for package @pgsql/transform

## [17.9.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.9.0...@pgsql/transform@17.9.1) (2025-11-23)

**Note:** Version bump only for package @pgsql/transform

# [17.9.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.8.3...@pgsql/transform@17.9.0) (2025-11-23)

**Note:** Version bump only for package @pgsql/transform

## [17.8.3](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.8.2...@pgsql/transform@17.8.3) (2025-08-08)

**Note:** Version bump only for package @pgsql/transform

## [17.8.2](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.8.1...@pgsql/transform@17.8.2) (2025-07-23)

**Note:** Version bump only for package @pgsql/transform

## [17.8.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.8.0...@pgsql/transform@17.8.1) (2025-07-17)

**Note:** Version bump only for package @pgsql/transform

# [17.8.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.7.1...@pgsql/transform@17.8.0) (2025-07-01)

### Bug Fixes

- add missing nulls_not_distinct property handling in IndexStmt ([caee212](https://github.com/constructive-io/pgsql-parser/commit/caee212c298320a89ce9443099597ebe089eac2f))
- add missing nulls_not_distinct property to IndexStmt transformer ([07c0ab4](https://github.com/constructive-io/pgsql-parser/commit/07c0ab47ce1ae10bd6ac0925b32ab9d6e821fefd))
- preserve num field in AlterTableCmd 14->15 transformation ([f52083c](https://github.com/constructive-io/pgsql-parser/commit/f52083c69916ff2195dbe40fca6fe06927791d4f))
- resolve 15-16 transformer AST mismatch for create_view-281.sql ([80d169e](https://github.com/constructive-io/pgsql-parser/commit/80d169e441bbb65e4b72a20f54947cb1a3abf528))
- resolve TypeScript compilation error with proper cross-package imports ([9d8ecbc](https://github.com/constructive-io/pgsql-parser/commit/9d8ecbca7a95b6a40eb1bb2f4c25c28508e4612f))

### Features

- Add comprehensive documentation for @pgsql/transform package ([b757a7b](https://github.com/constructive-io/pgsql-parser/commit/b757a7b438881b8035d5588836ffc4c00f1f13bb))

## [17.7.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.7.0...@pgsql/transform@17.7.1) (2025-07-01)

**Note:** Version bump only for package @pgsql/transform

# [17.7.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.6.3...@pgsql/transform@17.7.0) (2025-07-01)

### Bug Fixes

- add -32767 to A_Const Integer values that should result in empty ival objects ([f69104c](https://github.com/constructive-io/pgsql-parser/commit/f69104cfeb83ada8564ebe2aa2379df759809491))
- add Array.isArray handling to transform method for nested node processing ([2a04017](https://github.com/constructive-io/pgsql-parser/commit/2a04017f160ddc51c5d5731d528babb4c5ba9d3f))
- add CI rule to RULES.md and fix node wrapping in v16-to-v17 transformer ([08e3b29](https://github.com/constructive-io/pgsql-parser/commit/08e3b297c0458c5256fefd335d989f40895ab5ff))
- add CI rule to RULES.md and fix node wrapping in v16-to-v17 transformer ([75b2d95](https://github.com/constructive-io/pgsql-parser/commit/75b2d9521448a1084e816ab8346192487d651b51))
- add comprehensive node wrapping for v15-to-v16 transformer core methods ([35d8727](https://github.com/constructive-io/pgsql-parser/commit/35d8727042393a0e6346cb48c329eefc93e274c1))
- add comprehensive node wrapping for v15-to-v16 transformer core methods ([aa0e2e7](https://github.com/constructive-io/pgsql-parser/commit/aa0e2e778a046a3bdb7d9280057020b7e7f66e04))
- add comprehensive node wrapping for v15-to-v16 transformer core methods ([c1fbf5b](https://github.com/constructive-io/pgsql-parser/commit/c1fbf5b78b8ec1672ef715f6b21c1a43a62af9c0))
- add comprehensive node wrapping for v15-to-v16 transformer core methods ([561b53c](https://github.com/constructive-io/pgsql-parser/commit/561b53c49d9d4b4ef53862249bd63b65fd126284))
- add context-aware TypeCast boolean conversion logic ([edfe9da](https://github.com/constructive-io/pgsql-parser/commit/edfe9da9995f154f95314252461d7e53019dab64))
- add DefElem method to handle Integer to Boolean transformations for 'strict' defname in V14ToV15Transformer ([44e376a](https://github.com/constructive-io/pgsql-parser/commit/44e376a567aba70ed912ae8683a851d3ac60b6f6))
- add explicit override field preservation in InsertStmt ([02024ce](https://github.com/constructive-io/pgsql-parser/commit/02024cef5fcd9ccd5c255e78a075ef02b498b743))
- add funcformat field to FuncCall and transform FUNC_PARAM_IN to FUNC_PARAM_DEFAULT in FunctionParameter ([470d60b](https://github.com/constructive-io/pgsql-parser/commit/470d60b68fbaebab0307daadf8c0f3a16a7889af))
- add GrantStmt and RevokeStmt to allowedNodeTypes for objfuncargs creation - improves to 230/258 passing tests ([fa4af0d](https://github.com/constructive-io/pgsql-parser/commit/fa4af0d821b569fbc64a76554eae589599af9d57))
- add GrantStmt method to handle REVOKE EXECUTE ON FUNCTION statements ([b4f2e22](https://github.com/constructive-io/pgsql-parser/commit/b4f2e22f5bf39be3d525ba28a2d77de01dae8d8a))
- add InsertStmt method to remove override field when OVERRIDING_NOT_SET ([bdbca44](https://github.com/constructive-io/pgsql-parser/commit/bdbca444569a3a7676375d804bf1bd1f712a6dd2))
- add JSON pg_catalog prefix removal logic to TypeName method ([9fb52f8](https://github.com/constructive-io/pgsql-parser/commit/9fb52f81f61e66754af8c5a42f7d5214dabde642))
- add List transformation method to enable proper traversal of nested FunctionParameter nodes ([5570dcb](https://github.com/constructive-io/pgsql-parser/commit/5570dcba89fda91700fe7d9fd5327b8785b98b04))
- add ltrim back to sqlSyntaxFunctions for COERCE_SQL_SYNTAX funcformat ([39f8b7d](https://github.com/constructive-io/pgsql-parser/commit/39f8b7d5fde6e3e0a7cf1f132fb104b1bf1b2814))
- add ltrim back to sqlSyntaxFunctions for COERCE_SQL_SYNTAX funcformat ([c2d6d41](https://github.com/constructive-io/pgsql-parser/commit/c2d6d410471f0ab87ccae7e5a801d926227e0609))
- add missing CreateAccessMethodStmt transformation method ([24c6867](https://github.com/constructive-io/pgsql-parser/commit/24c68678fdf873d707ed418c0ab7613f7be1b938))
- add more ival values that should be converted to empty objects in PG15 ([40eaf59](https://github.com/constructive-io/pgsql-parser/commit/40eaf59b589f7e40922166fb8184d83a76bdee14))
- add node wrapping for A_ArrayExpr, A_Indices, A_Indirection, A_Star in v15-to-v16 ([c686223](https://github.com/constructive-io/pgsql-parser/commit/c686223384a0f028709d528d4e656e3d62dd5749))
- add node wrapping for A_ArrayExpr, A_Indices, A_Indirection, A_Star in v15-to-v16 ([68aa7bf](https://github.com/constructive-io/pgsql-parser/commit/68aa7bfdb1ace0e170a441be6d7fce3b2bf013f4))
- add node wrapping for A_ArrayExpr, A_Indices, A_Indirection, A_Star in v15-to-v16 ([a30f733](https://github.com/constructive-io/pgsql-parser/commit/a30f7330ef23340705d8e4f0de6703136dffcb3b))
- add node wrapping for A_ArrayExpr, A_Indices, A_Indirection, A_Star in v15-to-v16 ([e6a67e7](https://github.com/constructive-io/pgsql-parser/commit/e6a67e7f7b148da3a9a00f2c2203df7f0902f322))
- add node wrapping for A_Expr, BoolExpr, Alias, Boolean in v15-to-v16 transformer ([55e3a1b](https://github.com/constructive-io/pgsql-parser/commit/55e3a1b8724a17a633ef266d2cda7b3a44f03bc2))
- add node wrapping for A_Expr, BoolExpr, Alias, Boolean in v15-to-v16 transformer ([5054c7d](https://github.com/constructive-io/pgsql-parser/commit/5054c7dc8fdec2abfc6818d20332d5ae00a48eb8))
- add node wrapping for A_Expr, BoolExpr, Alias, Boolean in v15-to-v16 transformer ([db4371b](https://github.com/constructive-io/pgsql-parser/commit/db4371bc0e23aec2dd556288f5ad9087a0002267))
- add node wrapping for A_Expr, BoolExpr, Alias, Boolean in v15-to-v16 transformer ([bb5e95a](https://github.com/constructive-io/pgsql-parser/commit/bb5e95abb26c2da2f38b3563d959b93cbad7c088))
- add operator detection in CreateOpClassItem to prevent objfuncargs for operators ([5d09535](https://github.com/constructive-io/pgsql-parser/commit/5d09535a0f87de50a5e0dae24bd207a21e48a6b4))
- add pg_catalog prefix logic for SQL standard functions ([6587de1](https://github.com/constructive-io/pgsql-parser/commit/6587de11ef58a8c8a007939494aa6893b3079801))
- add pg_catalog prefix logic for SQL standard functions ([92328ad](https://github.com/constructive-io/pgsql-parser/commit/92328ad1ddc4d3c3c7e74c1cfc8c1d942a50c0f7))
- add pg_collation_for and collation_for to sqlSyntaxFunctions for COERCE_SQL_SYNTAX funcformat ([49f0c6e](https://github.com/constructive-io/pgsql-parser/commit/49f0c6e5b62b86e1ff56885d287b87af7315a14f))
- add specific objname array conversion handling in CreateOpClassItem method ([03687a8](https://github.com/constructive-io/pgsql-parser/commit/03687a8e2d7a826bbaf9e74b2027baa79c6fe285))
- add SQL syntax detection to FuncCall method for proper funcformat handling ([28a4b32](https://github.com/constructive-io/pgsql-parser/commit/28a4b329610fded9963427eb09963a5ac3458fd1))
- add xmlexists to sqlSyntaxFunctions for COERCE_SQL_SYNTAX funcformat ([d7e1f95](https://github.com/constructive-io/pgsql-parser/commit/d7e1f953f5590addee774ee22f6da480fab234f1))
- align String/Integer/Float/BitString/Null methods with other transformer patterns to resolve CI failures ([a5f58f7](https://github.com/constructive-io/pgsql-parser/commit/a5f58f774f4e8f14a3b8a7561b4a4fcc1c6ca51a))
- align String/Integer/Float/BitString/Null methods with other transformer patterns to resolve CI failures ([e8cf872](https://github.com/constructive-io/pgsql-parser/commit/e8cf8722dd811f97d6d2b4e7c3d51dea6bd261a6))
- align String/Integer/Float/BitString/Null methods with other transformer patterns to resolve CI failures ([94a0019](https://github.com/constructive-io/pgsql-parser/commit/94a001942944bd7a5e1fdc8578a060d698e1ba50))
- align String/Integer/Float/BitString/Null methods with other transformer patterns to resolve CI failures ([9061be5](https://github.com/constructive-io/pgsql-parser/commit/9061be54ea135c8a00fa5b19eb5ef8aff0b13d19))
- align String/Integer/Float/BitString/Null methods with other transformer patterns to resolve CI failures ([eab064a](https://github.com/constructive-io/pgsql-parser/commit/eab064a6179ff3c81ce3a5fb476cf6c68204f667))
- allow funcformat for function calls in constraint contexts ([1511097](https://github.com/constructive-io/pgsql-parser/commit/151109750f31f5863733c20b93c876dac670dd90))
- attempt FunctionParameter mode transformation FUNC_PARAM_IN -> FUNC_PARAM_DEFAULT ([33b1d2a](https://github.com/constructive-io/pgsql-parser/commit/33b1d2a461ea5d20689543af1732fb1d706ebeb6))
- attempt to improve function parameter modes and TableLikeOption mapping ([5352574](https://github.com/constructive-io/pgsql-parser/commit/535257406379e273a176b6eb89bdcd14ad64a7c7))
- attempt to improve function parameter modes and TableLikeOption mapping ([0571f65](https://github.com/constructive-io/pgsql-parser/commit/0571f65dd6353fecf5a99ff549868f0bca267b2e))
- clean A_Const method to maintain stable 184/258 baseline ([f8de8be](https://github.com/constructive-io/pgsql-parser/commit/f8de8becc12c22125bb8060f5d0f70e6aca0599f))
- clean up debug logging from A_Const and Integer transformations ([06364c5](https://github.com/constructive-io/pgsql-parser/commit/06364c57a6d5e1c635e74c491df1d85b4c7481c0))
- clean up FuncCall method formatting and ensure no funcformat addition logic ([d5b32d5](https://github.com/constructive-io/pgsql-parser/commit/d5b32d5b5648e1dc931241208c41ab5a64e1d4d9))
- continue systematic node wrapping improvements for v15-to-v16 transformer ([6000a07](https://github.com/constructive-io/pgsql-parser/commit/6000a074a92d29c73db3aceab8956eb66bf2d721))
- correct A_Const String transformation to avoid double-nesting ([3067336](https://github.com/constructive-io/pgsql-parser/commit/30673365f83781020c50fb1f72a6d7c60d982d94))
- correct DeclareCursorStmt options transformation (48 -> 288) ([f75c1ea](https://github.com/constructive-io/pgsql-parser/commit/f75c1ea681a8d2865476fa31299387385d7d232f))
- correct DefineStmt and CopyStmt wrapper returns for 15-16 compatibility ([09577d1](https://github.com/constructive-io/pgsql-parser/commit/09577d11a92ed2f3f313c97cc9ad7bbe80496a1e))
- correct ParseResult version output to match parser expectations (170004) ([71c4710](https://github.com/constructive-io/pgsql-parser/commit/71c47102baede36aa258a88fb8292541099a3da4))
- correct SortBy node wrapping in v15-to-v16 transformer ([9ae31c0](https://github.com/constructive-io/pgsql-parser/commit/9ae31c0c8aa8bcaf09582cd3546625ecee00ee44))
- correct SortBy node wrapping in v15-to-v16 transformer ([4ba52fb](https://github.com/constructive-io/pgsql-parser/commit/4ba52fb075be27f1729797044cb57bf332757601))
- correct v16-to-v17 version number and wrap all node transformation methods ([3e953d2](https://github.com/constructive-io/pgsql-parser/commit/3e953d22c80647d9b506add2972076deb6e95019))
- correct v16-to-v17 version number and wrap all node transformation methods ([1e46576](https://github.com/constructive-io/pgsql-parser/commit/1e46576719cf81a0ce38edef4a834cfa7f98ad23))
- correct WithClause transformation to convert objects to arrays for PG13→PG14 ([d1fd0bb](https://github.com/constructive-io/pgsql-parser/commit/d1fd0bbc48974961895e930b9b61be8ea296f4b7))
- exclude all TypeCast contexts from JSON pg_catalog prefix logic ([7294a06](https://github.com/constructive-io/pgsql-parser/commit/7294a06ef817675169307f1902a6f3b3434c0dfb))
- exclude parameter name preservation in DropStmt contexts to match PG14 expectations ([bf1de29](https://github.com/constructive-io/pgsql-parser/commit/bf1de2953e1533683031531f2b806404a4c97460))
- explicitly build FuncCall result object to prevent funcformat field preservation ([2417645](https://github.com/constructive-io/pgsql-parser/commit/24176459e42692242abd27849cd489e7be8c27fa))
- extend DefElem method to handle cycle defname Integer-to-Boolean conversion ([c3bcefe](https://github.com/constructive-io/pgsql-parser/commit/c3bcefe0e57bd3d70e6772d60286f54abad8e1a1))
- handle A_Const zero values correctly in V13ToV14Transformer ([fa460ff](https://github.com/constructive-io/pgsql-parser/commit/fa460ff5a13cdf76090433f13daecbf40a0c0d16))
- handle both ival 0 and -1 cases in AlterTableCmd context for SET STATISTICS ([3623ca0](https://github.com/constructive-io/pgsql-parser/commit/3623ca0c87da7625c3299feca23cd47e8bba3ad5))
- handle empty PG15 Integer nodes in v15-to-v16 transformer ([22d5594](https://github.com/constructive-io/pgsql-parser/commit/22d55948f59fabfdb62633f586588ce31591baf0))
- implement FunctionParameter mode transformation FUNC_PARAM_IN -> FUNC_PARAM_DEFAULT ([8285c61](https://github.com/constructive-io/pgsql-parser/commit/8285c6146bf4b0042efda4ba509562164f47647c))
- implement FunctionParameter mode transformation FUNC_PARAM_IN -> FUNC_PARAM_DEFAULT ([b6dbbb1](https://github.com/constructive-io/pgsql-parser/commit/b6dbbb11daeba4d3becbdf8cf8fd50ca3b3250f4))
- implement FunctionParameter mode transformation FUNC_PARAM_IN -> FUNC_PARAM_DEFAULT ([7cfa81b](https://github.com/constructive-io/pgsql-parser/commit/7cfa81be82679123e05b86f58874484a58751c70))
- implement hybrid DeclareCursorStmt options transformation to handle all cursor types ([4329114](https://github.com/constructive-io/pgsql-parser/commit/432911468d241843dbf46dd5a8c8638077633154))
- implement Integer to Boolean conversion for DefElem contexts ([0f352e9](https://github.com/constructive-io/pgsql-parser/commit/0f352e9ae842caf9c68220cd2dd1fd3c6e53f217))
- implement objfuncargs creation for plain object func in AlterFunctionStmt - fixes original-upstream-guc test ([92b7746](https://github.com/constructive-io/pgsql-parser/commit/92b7746719aa9037060cb53f0feb56372ffe04f7))
- improve 13-14 transformation with CreateTransformStmt objfuncargs support ([87765cf](https://github.com/constructive-io/pgsql-parser/commit/87765cfa7ec7366079085edab760bc198827cc29))
- improve 13-14 transformation with CreateTransformStmt objfuncargs support ([0ca7653](https://github.com/constructive-io/pgsql-parser/commit/0ca7653e95a5cdc967e311a96bb943746a821248))
- improve 13-14 transformation with CreateTransformStmt objfuncargs support ([798ee14](https://github.com/constructive-io/pgsql-parser/commit/798ee14e9ed7750a3445c89e214dd5cb7cf3af8d))
- improve 13-14 transformation with CreateTransformStmt objfuncargs support ([ff509b7](https://github.com/constructive-io/pgsql-parser/commit/ff509b7f379ba6beecb8076b6dff9c21cf3e3380))
- improve A_Const and Integer transformation methods ([b7bef8f](https://github.com/constructive-io/pgsql-parser/commit/b7bef8fa6831320c1b894704ad4f1fb65efa560c))
- improve A_Const node handling for null values ([027b89c](https://github.com/constructive-io/pgsql-parser/commit/027b89c109f0252e10bbcbfce900add5026a3f5d))
- improve AST transformations for INSERT statements and nested structures ([569bb31](https://github.com/constructive-io/pgsql-parser/commit/569bb311787d952c1dd88e8f894d26c42b37019a))
- improve field preservation in BaseTransformer and add Alias method to V13ToV14Transformer ([e80da61](https://github.com/constructive-io/pgsql-parser/commit/e80da61a53ddeba44b525d8d01260b7d005b8bd5))
- improve funcformat logic and remove unwanted pg_catalog prefixes ([6eff20f](https://github.com/constructive-io/pgsql-parser/commit/6eff20f5a111a519107a539779aaf5e2f3350944))
- improve funcformat logic and remove unwanted pg_catalog prefixes ([f9f699a](https://github.com/constructive-io/pgsql-parser/commit/f9f699aa3d9a3320e09e040e63011dca9bc58c4f))
- improve funcformat logic and remove unwanted pg_catalog prefixes ([1c35423](https://github.com/constructive-io/pgsql-parser/commit/1c35423db3aa03f36f8fe664500c25cffd78e4c2))
- improve FunctionParameter and other non-funcformat transformations for quick wins ([864b157](https://github.com/constructive-io/pgsql-parser/commit/864b1574d87c47deda75ebb5d6b02262fe991984))
- improve Integer method for arrayBounds transformation ([9af201b](https://github.com/constructive-io/pgsql-parser/commit/9af201b03b52acc67a0fb240e12a676cdc03930c))
- improve ObjectWithArgs logic to handle OBJECT_PROCEDURE and OBJECT_AGGREGATE in DROP statements ([0cf48a8](https://github.com/constructive-io/pgsql-parser/commit/0cf48a8617ebdade2f84449b58dbf9d99399768a))
- improve objfuncargs preservation by removing incorrect CommentStmt logic ([24054c6](https://github.com/constructive-io/pgsql-parser/commit/24054c6ea52a3ba3c5e6b5956e778ae579cfd311))
- improve objfuncargs preservation logic for better context handling ([c3e0ac8](https://github.com/constructive-io/pgsql-parser/commit/c3e0ac85c1e17e7ef9ca5c1c5e120eb41a1f71f4))
- improve objname transformation logic to handle array/object conversions ([8656f28](https://github.com/constructive-io/pgsql-parser/commit/8656f282382c83a4dbbf233d30fd6466cfd7afa7))
- improve v14-to-v15 transformer node wrapping by following v13-to-v14 patterns ([62f077f](https://github.com/constructive-io/pgsql-parser/commit/62f077f290a5a69f8d82165643b3a962596f3fc5))
- improve v14-to-v15 transformer node wrapping by following v13-to-v14 patterns ([9d476f2](https://github.com/constructive-io/pgsql-parser/commit/9d476f2321a6336e689845fdc5cc9cd64df390cc))
- improve v14-to-v15 transformer node wrapping by following v13-to-v14 patterns ([e20ac90](https://github.com/constructive-io/pgsql-parser/commit/e20ac90ed5f8b34d8d30c001e6304127ac47e84a))
- improve v14-to-v15 transformer node wrapping by following v13-to-v14 patterns ([6e9deae](https://github.com/constructive-io/pgsql-parser/commit/6e9deae724737f10586c75b1ed4fff8ee76d6aa0))
- improve variadic parameter detection and add CI rule ([3ba09a8](https://github.com/constructive-io/pgsql-parser/commit/3ba09a8a3c2dddb88423a237d72b9e1a3f870f4b))
- improve variadic parameter detection and add CI rule ([bf615b2](https://github.com/constructive-io/pgsql-parser/commit/bf615b2d0721afc3883ab0385f3aedc5fb0f2921))
- improve variadic parameter detection and add CI rule ([bc906b6](https://github.com/constructive-io/pgsql-parser/commit/bc906b6ea4a978d8b4da448d31c042e2e47e9960))
- improve variadic parameter detection and add CI rule ([bd0546a](https://github.com/constructive-io/pgsql-parser/commit/bd0546a2890caa6f89dc656d22b38e8bea547613))
- improve variadic parameter detection and preserve existing modes ([8558af8](https://github.com/constructive-io/pgsql-parser/commit/8558af83cfa487233407f04b2ff963678a2ca432))
- improve variadic parameter detection and preserve existing modes ([ae659c4](https://github.com/constructive-io/pgsql-parser/commit/ae659c40d8ab7c35c2a72b1cabe6bf823f03fdc4))
- invert shouldPreserveObjnameAsObject logic to convert objects to arrays in CreateOpClassItem contexts ([e5e02b9](https://github.com/constructive-io/pgsql-parser/commit/e5e02b9c8b7c4b9a4114b7f9a20ce4431bb84510))
- maintain stable 184/258 test pass rate ([10636fe](https://github.com/constructive-io/pgsql-parser/commit/10636fe8735c5103cc7ca5c2c926178c6808637d))
- make OBJECT_OPERATOR exclusion specific to CommentStmt contexts ([b498786](https://github.com/constructive-io/pgsql-parser/commit/b4987868ab7c111d6cba1d334e2360b689f2a2fc))
- make variadic detection more conservative to fix arrays regression ([c1503c4](https://github.com/constructive-io/pgsql-parser/commit/c1503c4c55dc08e7ce70f63413be98456266bffb))
- make variadic detection more conservative to fix arrays regression ([dbf0129](https://github.com/constructive-io/pgsql-parser/commit/dbf0129af005a5f175eaf36ffb4d4a6e319ef42b))
- make variadic detection more conservative to fix arrays regression ([8aa6b34](https://github.com/constructive-io/pgsql-parser/commit/8aa6b3484249c6323f9da2c7bf324ebff798c1bb))
- make variadic detection more conservative to fix arrays regression ([c06b18a](https://github.com/constructive-io/pgsql-parser/commit/c06b18adbb2541b24031a739ac6189f5a29555ba))
- move RenameStmt to objfuncargs removal contexts - should not preserve objfuncargs in RenameStmt ([a255aba](https://github.com/constructive-io/pgsql-parser/commit/a255ababfb81691d52e0d77e333742fcd1237c11))
- preserve existing objfuncargs and improve variadic parameter handling ([b331ae7](https://github.com/constructive-io/pgsql-parser/commit/b331ae7b5bef86846d30e2b0f81028e01b7e0569))
- preserve existing objfuncargs and improve variadic parameter handling ([4c766d0](https://github.com/constructive-io/pgsql-parser/commit/4c766d0ac914e80ccd920ba297c2bd13841bc4f2))
- preserve funcformat field by default in FuncCall transformations ([82dd9d4](https://github.com/constructive-io/pgsql-parser/commit/82dd9d40163d41b643b8bf8926423d89a1e4cb69))
- preserve funcformat field in FuncCall transformations ([c1b3cda](https://github.com/constructive-io/pgsql-parser/commit/c1b3cda89e0f2f6a746e9e4ec3f91b8898edfe38))
- preserve funcformat field in FuncCall transformations based on debug evidence ([45d1192](https://github.com/constructive-io/pgsql-parser/commit/45d1192175fb41585577e680cbfff3b9f132a284))
- preserve FunctionParameter mode values without transformation ([6457675](https://github.com/constructive-io/pgsql-parser/commit/6457675ff5a1618e28de36fe705026b4784e15fa))
- preserve InsertStmt override field instead of removing it ([89b0f38](https://github.com/constructive-io/pgsql-parser/commit/89b0f38c3f093ce5be73ed07f1ee4d38589b990f))
- preserve Integer ival field in v14-to-v15 and add missing ival in v15-to-v16 transformations ([09249eb](https://github.com/constructive-io/pgsql-parser/commit/09249ebf642bb0289fed3e13de297cd59ab9b03b))
- preserve objfuncargs in AlterFunctionStmt contexts ([f717cb7](https://github.com/constructive-io/pgsql-parser/commit/f717cb7d5ef8620818159e209725e865eea38fe0))
- preserve objfuncargs in CreateCastStmt contexts - only remove for AlterFunctionStmt ([4adba0c](https://github.com/constructive-io/pgsql-parser/commit/4adba0c86e3c53042d0dfc7910694fce4046ff48))
- prioritize shouldCreateObjfuncargs logic for CreateCastStmt contexts ([1237ea0](https://github.com/constructive-io/pgsql-parser/commit/1237ea00be0ea5421fe1896436a119753016e290))
- refine Integer to Boolean conversion logic for DefElem contexts ([08518d3](https://github.com/constructive-io/pgsql-parser/commit/08518d371cd3027cd117ac56ca3be27c3c30c98a))
- refine objfuncargs preservation and add missing node type transformations ([5386a40](https://github.com/constructive-io/pgsql-parser/commit/5386a400fe97ed382e0aa263d919ba9e49c0cef8))
- refine PG13->PG14 conversion with improved enum mappings and function handling ([83c4ad7](https://github.com/constructive-io/pgsql-parser/commit/83c4ad7dac05544368345253698fed7d03b7a767))
- refine PG13->PG14 conversion with improved enum mappings and function handling ([e588110](https://github.com/constructive-io/pgsql-parser/commit/e58811059a240614895682fddacf75084ae2f8c1))
- remove all JSON pg_catalog prefix logic from TypeName and TypeCast methods ([5617796](https://github.com/constructive-io/pgsql-parser/commit/56177969be8be5d14640d135bed1d5149fe70e31))
- remove all JSON pg_catalog prefix logic from TypeName method ([d89a9bf](https://github.com/constructive-io/pgsql-parser/commit/d89a9bf0fa47c539fab93944b3c40e1a9dac1a69))
- remove AlterOwnerStmt objfuncargs logic and debug logging ([67cb93e](https://github.com/constructive-io/pgsql-parser/commit/67cb93ee514de59f032383235119152288df21fa))
- remove automatic inh field addition from BaseTransformer ([f8f1d3d](https://github.com/constructive-io/pgsql-parser/commit/f8f1d3d307509bcede1899e16288c08a76cba52f))
- remove CreateOpClassItem from shouldPreserveObjfuncargs exclusion list to enable objfuncargs creation ([aa3fc4d](https://github.com/constructive-io/pgsql-parser/commit/aa3fc4d6647b4d83cb2ed5f49b30648e161cfa6b))
- remove DefElem boolean conversion logic from Integer method ([ca618be](https://github.com/constructive-io/pgsql-parser/commit/ca618be633f2ffd05b4bdaf7c2275058f88d346e))
- remove duplicate function implementations that caused TypeScript errors ([a07a75b](https://github.com/constructive-io/pgsql-parser/commit/a07a75b7aaa2aec51365e381ecd29d8d89b278fe))
- remove duplicate method implementations and add proper node wrapping for DropRoleStmt, XmlExpr, AlterRoleSetStmt, GrantStmt ([ddb47b2](https://github.com/constructive-io/pgsql-parser/commit/ddb47b2bc03433c5c28d4a133a52e872200f98a2))
- remove duplicate WithClause method to resolve compilation errors ([b3083bb](https://github.com/constructive-io/pgsql-parser/commit/b3083bb2c9db7ceb33768aff857386fa47f9953e))
- remove funcformat addition logic - PG13 FuncCall nodes without funcformat should not get one added ([c78c9b7](https://github.com/constructive-io/pgsql-parser/commit/c78c9b7fd4003d938aa9798307010b289127d014))
- remove funcformat fields from FuncCall transformations - PG14 expects them absent ([af6cd86](https://github.com/constructive-io/pgsql-parser/commit/af6cd860c44a1b740454b05f6ef93f3136f1dea4))
- remove incorrect FunctionParameter mode conversion from FUNC_PARAM_IN to FUNC_PARAM_DEFAULT ([c672bca](https://github.com/constructive-io/pgsql-parser/commit/c672bca354680d3580b4ba3d2f889e7c4b44b814))
- remove incorrect FunctionParameter mode transformation - FUNC_PARAM_DEFAULT doesn't exist in enum ([86e5785](https://github.com/constructive-io/pgsql-parser/commit/86e5785374efd0e3a5a7def257fd6285aa22cd9a))
- remove INSERT and UPDATE context exclusions from shouldAddFuncformat to allow more funcformat assignments ([a3dd2fb](https://github.com/constructive-io/pgsql-parser/commit/a3dd2fb7758f4751ec4b08bfd809180feb3cdc71))
- remove JSON-specific transformation logic from TypeName method ([9454b0d](https://github.com/constructive-io/pgsql-parser/commit/9454b0d3d61082a8d1dee9383f26b0097c528e9f))
- remove ltrim from sqlSyntaxFunctions to use COERCE_EXPLICIT_CALL instead of COERCE_SQL_SYNTAX ([5d4d784](https://github.com/constructive-io/pgsql-parser/commit/5d4d7848f88f047acbac15e12c4ec69c4621de99))
- remove overly broad DefElem transformations ([17795b4](https://github.com/constructive-io/pgsql-parser/commit/17795b4681efde2d9b91c82c0a318a89585ffd33))
- remove overly broad JSON pg_catalog prefix logic from TypeCast method ([b4d5297](https://github.com/constructive-io/pgsql-parser/commit/b4d5297283b63e593c76e778a51ddf31885e94b4))
- remove substring pg_catalog prefix stripping logic to preserve funcname consistency ([039e826](https://github.com/constructive-io/pgsql-parser/commit/039e82680b81425588b630cef93c91b2cf23cb9f))
- resolve PartitionSpec strategy mapping in CreateStmt method ([6147794](https://github.com/constructive-io/pgsql-parser/commit/6147794d56510a89a54daecc4689a65751c6628d))
- restore and improve RangeFunction, RangeTableSample, and XmlSerialize transformation methods ([9623191](https://github.com/constructive-io/pgsql-parser/commit/9623191741969ce195f0d0812b7a4556d3c27023))
- restore complete ival conversion logic for DefineStmt args ([ab76535](https://github.com/constructive-io/pgsql-parser/commit/ab76535acb71ff78c54b0138f1db01bffb4ceeac))
- restore DefineStmt and CopyStmt wrapper returns to maintain 254/258 tests passing ([16fb3de](https://github.com/constructive-io/pgsql-parser/commit/16fb3de1cd4a0f6fc15c5037d0cae15e4b40cd8f))
- restore getNodeType ParseResult detection for stable 184/258 baseline ([bbcecee](https://github.com/constructive-io/pgsql-parser/commit/bbcecee21740c344694cfe70f5f539c3b51341cd))
- restore missing FunctionParameter and AlterFunctionStmt transformations to recover 125/258 baseline ([07f11e4](https://github.com/constructive-io/pgsql-parser/commit/07f11e4b245bc30eeee26816dc23262ada3caf40))
- reverse TableLikeClause options transformation from 6→12 instead of 12→6 - improves test count to 234/258 ([5c892b2](https://github.com/constructive-io/pgsql-parser/commit/5c892b2d3ed924220bc6faa243f03a64589edd95))
- reverse TableLikeClause options transformation from 6→12 instead of 12→6 - improves test count to 234/258 ([b61ee68](https://github.com/constructive-io/pgsql-parser/commit/b61ee68c7e35d1a3deba62fce16300e62a8bd323))
- revert A_Const changes and add context-specific Integer transformation ([b28d623](https://github.com/constructive-io/pgsql-parser/commit/b28d6236fb7da9c372fb7153d25f803f75a8aa01))
- revert overly broad A_Const fix, restore stable 184/258 test pass rate ([be2e5a1](https://github.com/constructive-io/pgsql-parser/commit/be2e5a146512dd2c33be0ea8fd091a5a56f11311))
- revert overly broad A_Const ival transformation ([1a09090](https://github.com/constructive-io/pgsql-parser/commit/1a0909070889fcc0211ba09221aaf958f61bbbf8))
- revert overly broad A_Const ival transformation ([8bbcd8e](https://github.com/constructive-io/pgsql-parser/commit/8bbcd8e6c49279dded7e66147db900a1f6d90b9a))
- revert String transformation to preserve original field and restore 76 passing tests ([11826a7](https://github.com/constructive-io/pgsql-parser/commit/11826a7924542ca6dd29f98a2b106c32bb068361))
- revert substring exclusion logic to maintain 125/258 baseline ([1062933](https://github.com/constructive-io/pgsql-parser/commit/106293331275d416251a412ba4f7018cb1deb989))
- revert to stable 184/258 test baseline ([3b5852a](https://github.com/constructive-io/pgsql-parser/commit/3b5852a7d7b1a79e0e56366dbe065aaa8674be28))
- systematic node wrapping improvements for 12+ additional transformation methods ([9129107](https://github.com/constructive-io/pgsql-parser/commit/912910792e1910ad98ea13fbbdc373976da27aaa))
- systematic node wrapping improvements for 20+ additional transformation methods ([47e61ba](https://github.com/constructive-io/pgsql-parser/commit/47e61ba7928e5867d189a5cdfd6b3063f2d8eb8e))
- systematic node wrapping improvements for 32+ transformation methods ([f365289](https://github.com/constructive-io/pgsql-parser/commit/f365289152585fa01524a1b220cfc8e760861f9a))
- systematic node wrapping improvements for v15-to-v16 transformer ([c202a9d](https://github.com/constructive-io/pgsql-parser/commit/c202a9d801f823569eb42e09e5a342c1f1c0190b))
- systematic node wrapping improvements for v15-to-v16 transformer ([198aa88](https://github.com/constructive-io/pgsql-parser/commit/198aa885e7fc27329ce2c098a38dfb7f3a52c1d2))
- systematic v15-to-v16 transformer node wrapping improvements ([f2c7e5c](https://github.com/constructive-io/pgsql-parser/commit/f2c7e5c571796b0f1b91d8bb1d11f99bc31710b8))
- systematic v15-to-v16 transformer node wrapping improvements ([bf90bbc](https://github.com/constructive-io/pgsql-parser/commit/bf90bbc91e0d83ad93f14875ba56c581115d154b))
- systematic v15-to-v16 transformer node wrapping improvements ([17c63b8](https://github.com/constructive-io/pgsql-parser/commit/17c63b8e0cc61107e7765b9931e6ef6640339d8e))
- systematic v15-to-v16 transformer node wrapping improvements ([4e6357a](https://github.com/constructive-io/pgsql-parser/commit/4e6357ab0971b57ff02a618ee1bf3ef40c0a7ea4))
- update A_Const and Integer transformation methods ([ee69c77](https://github.com/constructive-io/pgsql-parser/commit/ee69c77b14920b2abcd58dcac26ed214c85b5a5c))
- update DeclareCursorStmt to transform options field from 32 to 256 for PG13→PG14 upgrade ([7fb5588](https://github.com/constructive-io/pgsql-parser/commit/7fb55883068669ac2f0a29e36fdc33fc2b851470))
- update transformers with improved field preservation and method signatures ([4785265](https://github.com/constructive-io/pgsql-parser/commit/4785265b817cf03d2cfb155ba0f6b1a7f926ff14))

### Features

- add AlterOpFamilyStmt to objfuncargs allowed contexts ([8579352](https://github.com/constructive-io/pgsql-parser/commit/8579352a94ee101e4ca0901268d8694cfc8a5be0))
- add context exclusions for SortBy, default constraints, policies, and SELECT FROM to reduce funcformat failures ([c45d181](https://github.com/constructive-io/pgsql-parser/commit/c45d18166c7b71e535be726ff36ea6bd0daa413a))
- add context-aware funcformat logic to exclude CHECK constraints and COMMENT contexts ([3dd99a7](https://github.com/constructive-io/pgsql-parser/commit/3dd99a757212f8c097b5bef244d5d524ad5d83d4))
- add CreateStmt, CreatePolicyStmt, and DropStmt transformation methods ([61f0715](https://github.com/constructive-io/pgsql-parser/commit/61f07157036df0eb2a79a26db2610580e4dd4c54))
- add date and isfinite to sqlSyntaxFunctions for COERCE_SQL_SYNTAX ([dbc4bfc](https://github.com/constructive-io/pgsql-parser/commit/dbc4bfca7aeb17268443a80420211597f89a44ce))
- add date_part to extract function name transformation for PG14 compatibility ([b0a96be](https://github.com/constructive-io/pgsql-parser/commit/b0a96be6be5a9bc56da906ff3e3bb844ca082f0a))
- add debug tests and improve String transformations in V14ToV15Transformer ([3cb6439](https://github.com/constructive-io/pgsql-parser/commit/3cb64390cd826b8fd0517e70e966c0805b5a3fb2))
- add direct objfuncargs creation in CreateOpClassItem method ([389512a](https://github.com/constructive-io/pgsql-parser/commit/389512aeee8e112f94c2a2b4d1237404eb17ea2c))
- add failing tests analysis script for structural investigation ([633dea6](https://github.com/constructive-io/pgsql-parser/commit/633dea6b22ebcafbc8cc9ba5905fb381cf36b34a))
- add INSERT context exclusion for funcformat to handle generate_series and similar functions ([6e880da](https://github.com/constructive-io/pgsql-parser/commit/6e880da3c5c8773cc791e7b6c3a09cde26b80f8f))
- add investigation script for structural differences analysis ([de39ffe](https://github.com/constructive-io/pgsql-parser/commit/de39ffefca60bf3e18eb4c2208354a15ce18cb60))
- add ObjectWithArgs objfuncargs transformation for CommentStmt contexts ([ae40ad9](https://github.com/constructive-io/pgsql-parser/commit/ae40ad9b0ec94a4d90e289a33f9018b966490447))
- add overlaps to sqlSyntaxFunctions for COERCE_SQL_SYNTAX ([1c30691](https://github.com/constructive-io/pgsql-parser/commit/1c306916bcad48fdee0989b16f38398b7fec8d26))
- add pg_catalog prefix removal logic to both TypeName and TypeCast methods ([179bd48](https://github.com/constructive-io/pgsql-parser/commit/179bd4860e827e6c4ff41f44b37633004152a1c9))
- add RangeFunction context exclusion for funcformat to handle generate_series and chkrolattr functions ([5d98426](https://github.com/constructive-io/pgsql-parser/commit/5d984262602391ff469093d04e446e9460ee0e92))
- add RenameStmt support to objfuncargs transformation contexts ([0fb0340](https://github.com/constructive-io/pgsql-parser/commit/0fb0340a3ab6754fadb62de3cec72065d3785d4f))
- add ResTarget method to fix method dispatch for FuncCall transformations ([0d991b4](https://github.com/constructive-io/pgsql-parser/commit/0d991b44a1759570f466ce5d524ac06e3ffa429a))
- add RoleSpecType enum transformation for PG13->PG14 compatibility ([e922ef2](https://github.com/constructive-io/pgsql-parser/commit/e922ef23c157d4d320bc4cacda8092b3343b48b7))
- add shouldPreserveObjnameAsObject method for context-specific objname transformations ([0decb45](https://github.com/constructive-io/pgsql-parser/commit/0decb45959dc86d925dacb293ccc40a6aa24d9e8))
- add transformation methods for new PG14 interface nodes (CTECycleClause, CTESearchClause, PLAssignStmt, ReturnStmt, StatsElem) ([4fc9d4a](https://github.com/constructive-io/pgsql-parser/commit/4fc9d4af7c777ac3ab1682997f4399b9fca11f3b))
- add XmlExpr context exclusion for funcformat to handle XML function calls ([6a3f99c](https://github.com/constructive-io/pgsql-parser/commit/6a3f99cfa7727aaf65f9c92023b08f7ef8d8fec5))
- enhance CHECK constraint detection with multiple path strategies for AlterTableCmd contexts ([572c6b3](https://github.com/constructive-io/pgsql-parser/commit/572c6b370dc751c2005abd6433cb7861a4d7234c))
- exclude DropStmt contexts from objfuncargs preservation to match PG14 behavior ([1825e08](https://github.com/constructive-io/pgsql-parser/commit/1825e08da312ee3eaef8030e0bca6238a93ef883))
- explore dual-parse approach for negative integer transformation ([a1e7d08](https://github.com/constructive-io/pgsql-parser/commit/a1e7d0838d177e01be8f6163b3b9a6fdc9985c3f))
- implement additional AST node transformations for improved PG13->PG14 compatibility ([3c754c6](https://github.com/constructive-io/pgsql-parser/commit/3c754c6d3251017fe1cb77ec8f95a2a0d76a6aa2))
- implement boolean TypeCast to A_Const boolval transformation ([6417906](https://github.com/constructive-io/pgsql-parser/commit/641790629b2d3d874e7d4f2b19a5923257b00449))
- implement complete end-to-end integration test for PG13→PG17 transformation ([ee05721](https://github.com/constructive-io/pgsql-parser/commit/ee057215b925ee9aa6fd1b34a91adb24e68d0928))
- implement complete PostgreSQL AST transformer system (v13→v17) ([0aef236](https://github.com/constructive-io/pgsql-parser/commit/0aef236307e21ec850ab00170fb7db1ee8cda270))
- implement context-aware A_Const transformation for negative integers ([2c6a46f](https://github.com/constructive-io/pgsql-parser/commit/2c6a46f0895c9932c69f3663c967783a158c7b54))
- implement context-aware substring funcformat handling ([8cc80e7](https://github.com/constructive-io/pgsql-parser/commit/8cc80e718c221a375796572b3601567ee473f23a))
- implement enum transformations for A_Expr_Kind and RoleSpecType, update NOTES.md with latest progress ([29cd055](https://github.com/constructive-io/pgsql-parser/commit/29cd05526f3f24e95ebc8cf14545afd8a56b5435))
- implement function-specific funcformat logic to break 124/258 plateau ([16c2e5e](https://github.com/constructive-io/pgsql-parser/commit/16c2e5e8b0341719d85c81e5e400ef432603345c))
- implement JSON type transformation with VALUES context detection ([69520be](https://github.com/constructive-io/pgsql-parser/commit/69520be7d65d99155cd34f64414f720e8365e894))
- implement PG16->PG17 JSON type transformation with pg_catalog prefix handling ([a4edd7e](https://github.com/constructive-io/pgsql-parser/commit/a4edd7ef95129c6e79d77c1a30306d1d2b0f5a04))
- implement surgical funcformat exclusion for aggregate functions in TypeCast contexts ([f2b0a7c](https://github.com/constructive-io/pgsql-parser/commit/f2b0a7ccc1e97bd8a4af876402296e45e64632a7))
- implement TableLikeOption enum transformation for PG13->PG14 CREATE_TABLE_LIKE_COMPRESSION insertion ([fd9a940](https://github.com/constructive-io/pgsql-parser/commit/fd9a94024ece9266c9728a68604ab20e7c73bb42))
- implement transformer visitor system for PostgreSQL AST versions 13-17 ([a86d6ae](https://github.com/constructive-io/pgsql-parser/commit/a86d6ae012921c0c0ee30a2695e45ca31c0b06c0))
- implement TypeCast method to handle unwrapped TypeName data and add pg_catalog prefix for JSON types ([4ad9fbb](https://github.com/constructive-io/pgsql-parser/commit/4ad9fbb58ed884f40ce918c1602768fa2ea82562))
- improve PG13->PG14 conversion with context-aware function parameter handling and enum documentation ([5e78728](https://github.com/constructive-io/pgsql-parser/commit/5e78728a3fb310e4633102343548a0035de910bc))
- improve PG13->PG14 conversion with context-aware function parameter handling and enum documentation ([03ace38](https://github.com/constructive-io/pgsql-parser/commit/03ace38e64437c814a50aa79927bdd45081c139c))
- improve PG13->PG14 conversion with targeted enum mappings and function handling ([5573f90](https://github.com/constructive-io/pgsql-parser/commit/5573f9030d3166cf5b55671dbcc67547809e3dfb))
- improve PG13->PG14 conversion with targeted enum mappings and function handling ([2ba6e4a](https://github.com/constructive-io/pgsql-parser/commit/2ba6e4ae809a1647ff991879a9fad0b39acc8a9f))
- improve v13-to-v14 transformer with funcformat detection and objfuncargs refinement ([8f788cc](https://github.com/constructive-io/pgsql-parser/commit/8f788ccfafd5b90a078f38642ee318307dcbcc61))
- investigate type system bug in funcformat handling ([5ceb419](https://github.com/constructive-io/pgsql-parser/commit/5ceb41985a3913efb820451e8148e6960d644594))
- maintain stable 184/258 test baseline and add dual-parse exploration ([8526f0d](https://github.com/constructive-io/pgsql-parser/commit/8526f0d1f04e784cb01971d7a09ad804981f7fd9))
- refine ObjectWithArgs objfuncargs handling to ensure CreateCastStmt gets empty arrays ([916b6a2](https://github.com/constructive-io/pgsql-parser/commit/916b6a204598ec6c3d4905a7fc29ce842a4a4238))
- systematic PG14->PG15 transformer improvements ([899711a](https://github.com/constructive-io/pgsql-parser/commit/899711a085355e960bc06d101ae7d72fa9fe17ed))
- update STATUS-14-15.md with 254/258 tests passing (98.4% success rate) ([448a721](https://github.com/constructive-io/pgsql-parser/commit/448a7213a76812cfe7749ad92835fffdc5291df5))

### Reverts

- Revert "fix: align String/Integer/Float/BitString/Null methods with other transformer patterns to resolve CI failures" ([66f8ab1](https://github.com/constructive-io/pgsql-parser/commit/66f8ab1b685db2594a9075ac98490d9fcfb3e64b))
- Revert "fix: align String/Integer/Float/BitString/Null methods with other transformer patterns to resolve CI failures" ([790d811](https://github.com/constructive-io/pgsql-parser/commit/790d811ae43ec799718d643c5bb97bdc6e207316))
- Revert "fix: align String/Integer/Float/BitString/Null methods with other transformer patterns to resolve CI failures" ([fc0f1b4](https://github.com/constructive-io/pgsql-parser/commit/fc0f1b417b76ffca183e459b7a525d797687ff51))
- Revert "fix: align String/Integer/Float/BitString/Null methods with other transformer patterns to resolve CI failures" ([4328b27](https://github.com/constructive-io/pgsql-parser/commit/4328b2798c0c8eca4fd817d970a0e99572a5774c))
- Revert "fix: align String/Integer/Float/BitString/Null methods with other transformer patterns to resolve CI failures" ([a267450](https://github.com/constructive-io/pgsql-parser/commit/a267450566b1222ea19637dd2355935e41f2032f))
- objname transformation changes that reduced passing tests from 223 to 196 ([3f649af](https://github.com/constructive-io/pgsql-parser/commit/3f649af5e5719df83b513dbb4ba33434addcba59))
- remove funcformat field in FuncCall transformations ([ae95ae0](https://github.com/constructive-io/pgsql-parser/commit/ae95ae08cb30c10fe32f26500400e59d673899c2))
- remove funcformat field in FuncCall transformations again ([949dd99](https://github.com/constructive-io/pgsql-parser/commit/949dd998c25b41d194e936141826fe3e8a1c3415))
- remove Integer method fix that caused CI failures ([c18653e](https://github.com/constructive-io/pgsql-parser/commit/c18653e5472ad107cd54e4fb5319a75fcdf4f019))
- remove overly broad A_Const ival transformation ([436ec4f](https://github.com/constructive-io/pgsql-parser/commit/436ec4f2273821f04bda8bf3faec441ec697d8d9))
- restore parameter name preservation logic - PG14 expects names in DropStmt contexts ([decd2d3](https://github.com/constructive-io/pgsql-parser/commit/decd2d346abf2ca9f3f5d182dd59ab5648ed8eb8))
- restore substring override to maintain 231 passing tests - blanket COERCE_SQL_SYNTAX works better than context-specific logic ([afad542](https://github.com/constructive-io/pgsql-parser/commit/afad542bac60a47d0e7a0b90e2c0327990e40a7e))
- substring function logic back to original isStandardFunctionCallSyntax ([afae37f](https://github.com/constructive-io/pgsql-parser/commit/afae37f88fbd5f1cf0623027b92a1a825816ba6a))
- undo problematic changes that caused regressions - back to 78 passing tests baseline ([1492dce](https://github.com/constructive-io/pgsql-parser/commit/1492dce8855c7a198fb06904baf9f5f6fcffe287))

## [17.6.3](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.6.2...@pgsql/transform@17.6.3) (2025-06-26)

**Note:** Version bump only for package @pgsql/transform

## [17.6.2](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.6.1...@pgsql/transform@17.6.2) (2025-06-24)

**Note:** Version bump only for package @pgsql/transform

## [17.6.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.6.0...@pgsql/transform@17.6.1) (2025-06-23)

**Note:** Version bump only for package @pgsql/transform

# [17.6.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.5.2...@pgsql/transform@17.6.0) (2025-06-23)

**Note:** Version bump only for package @pgsql/transform

## [17.5.2](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.5.1...@pgsql/transform@17.5.2) (2025-06-22)

**Note:** Version bump only for package @pgsql/transform

## [17.5.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.5.0...@pgsql/transform@17.5.1) (2025-06-22)

**Note:** Version bump only for package @pgsql/transform

# [17.5.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.4.2...@pgsql/transform@17.5.0) (2025-06-22)

**Note:** Version bump only for package @pgsql/transform

## [17.4.2](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.4.1...@pgsql/transform@17.4.2) (2025-06-22)

**Note:** Version bump only for package @pgsql/transform

## [17.4.1](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.4.0...@pgsql/transform@17.4.1) (2025-06-21)

**Note:** Version bump only for package @pgsql/transform

# [17.4.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.1.0...@pgsql/transform@17.4.0) (2025-06-21)

**Note:** Version bump only for package @pgsql/transform

# [17.2.0](https://github.com/constructive-io/pgsql-parser/compare/@pgsql/transform@17.1.0...@pgsql/transform@17.2.0) (2025-06-21)

**Note:** Version bump only for package @pgsql/transform

# 17.1.0 (2025-06-21)

### Features

- implement PG13 to PG17 AST transformer ([d8d6514](https://github.com/constructive-io/pgsql-parser/commit/d8d6514eaac1308f2076a36c9a3780f5ad0fc893))
