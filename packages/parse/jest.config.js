/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                babelConfig: false,
                tsconfig: "tsconfig.test.json",
            },
        ],
    },
    transformIgnorePatterns: [
        "/node_modules/(?!(pgsql-deparser|@pgsql/quotes|@pgsql/types|@pgsql/utils)/)"
    ],
    moduleNameMapper: {
        "^pgsql-deparser$": "<rootDir>/../deparser/src/index.ts",
        "^pgsql-deparser/(.*)$": "<rootDir>/../deparser/src/$1",
        "^@pgsql/quotes$": "<rootDir>/../quotes/src/index.ts",
        "^@pgsql/quotes/(.*)$": "<rootDir>/../quotes/src/$1",
        "^@pgsql/utils$": "<rootDir>/../utils/src/index.ts",
        "^@pgsql/utils/(.*)$": "<rootDir>/../utils/src/$1",
    },
    testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    modulePathIgnorePatterns: ["dist/*"]
};
