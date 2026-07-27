import { parserErrors } from './parser-errors';
import { transformerErrors } from './transformer-errors';
import { knownIssues } from './known-issues';
import { SkipTest } from './types';
// Combined export for backward compatibility
export const skipTests: SkipTest[] = [
    ...parserErrors,
    ...transformerErrors,
    ...knownIssues
];
