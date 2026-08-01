import { knownIssues } from './known-issues';
import { parserErrors } from './parser-errors';
import { transformerErrors } from './transformer-errors';
import { SkipTest } from './types';
// Combined export for backward compatibility
export const skipTests: SkipTest[] = [
  ...parserErrors,
  ...transformerErrors,
  ...knownIssues
];
