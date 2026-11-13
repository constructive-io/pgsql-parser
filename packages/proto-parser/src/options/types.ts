export type PgProtoParserOptions = PgProtoStoreOptions & {
    parser?: ParseProtoOptions;
};

/**
 * Configuration options for PgProtoStore.
 */
export interface PgProtoStoreOptions {
    // The directory where the generated files will be saved.
    outDir?: string;

    // Types and Enums to skip during processing
    exclude?: string[],

    // Options related to utility functions.
    utils?: {
        enums?: {
            // Whether to include TypeScript utils for enums
            enabled?: boolean;
            // Enums helpers filename
            filename?: string;
            // Whether to generate separate unidirectional functions
            unidirectional?: boolean;
            // Filename for enum to int function
            toIntFilename?: string;
            // Filename for enum to string function
            toStringFilename?: string;
            // Output format: 'switchStatements' or 'nestedObjects'
            outputFormat?: 'switchStatements' | 'nestedObjects';
        }

        // AST helper functions.
        astHelpers?: {
            // Whether to include TypeScript AST builders
            enabled?: boolean;
            // Source file for AST helper types.
            typesSource?: string;
            // Whether to inline nested-obj
            inlineNestedObj?: boolean;
            // if inlined, filename
            nestedObjFile?: string;
            // ASTs helpers filename
            filename?: string;
        }

        // Wrapped AST helper functions.
        wrappedAstHelpers?: {
            // Whether to include wrapped TypeScript AST builders
            enabled?: boolean;
            // Wrapped ASTs helpers filename
            filename?: string;
        }
    };

    // Options related to TypeScript types.
    types?: {
        // Whether to generate TypeScript interfaces for protobuf messages.
        enabled?: boolean;
        // Types filename
        filename?: string;
        // Whether fields in TypeScript interfaces should be optional.
        optionalFields?: boolean;
        // Enums source specifier
        enumsSource?: string;
        // Node Object Keys, e.g. { ParseResult: ParseResult, ... }
        // meant for simpler user cases
        // if a field in an object uses Node, it's a node type
        // if a field in an object references a type, e.g. RangeVar, it's flat
        wrappedNodeTypeExport?: boolean;
    };

    // Options related to runtime schema generation.
    runtimeSchema?: {
        // Whether to generate runtime schema for AST nodes
        enabled?: boolean;
        filename?: string;
        format?: 'json' | 'typescript';
    };

    // Options related to enumeration handling.
    enums?: {
        // Whether to include TypeScript enums.
        enabled?: boolean;
        // Enums filename
        filename?: string;
        // Whether enums in TypeScript are a union type
        enumsAsTypeUnion?: boolean;
        // Options for enum mappings output.
        enumMap?: {
            // Whether to generate enum mapping files.
            enabled?: boolean;
            // Output format: 'json' for plain JSON files, 'ts' for TypeScript exports
            format?: 'json' | 'ts';
            toIntOutFile?: string;
            toStrOutFile?: string;
        };
        // Whether to remove the initial `UNDEFINED` enum entry and adjust subsequent values.
        removeUndefinedAt0?: boolean;
    };

    // Whether to include a header in generated TypeScript files.
    includeHeader?: boolean;
    // Whether that header names the pg-proto-parser version. Turn off for output
    // committed to a repository, so a generator release does not touch every file.
    includeHeaderVersion?: boolean;
}


export interface ParseProtoOptions {
    keepCase?: boolean;
    alternateCommentMode?: boolean;
    preferTrailingComment?: boolean;
}
