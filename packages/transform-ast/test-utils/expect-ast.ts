import { cleanTree } from './clean-tree';
import { ASTTransformer } from '../src/multi-version-transformer';

export async function expectOldAstToTransformToNewAst(
  oldAst: any,
  oldVersion: 13 | 14 | 15 | 16 | 17, 
  newVersion: 13 | 14 | 15 | 16 | 17,
  expectedAst?: any
): Promise<void> {
  const transformer = new ASTTransformer();
  const transformedAst = transformer.transform(oldAst, oldVersion, newVersion);

  if (expectedAst) {
    expect(cleanTree(transformedAst)).toEqual(cleanTree(expectedAst));
  }
}

export async function expectTransformWithCustomAssertion(
  oldAst: any,
  oldVersion: number,
  newVersion: number,
  assertion: (transformedAst: any) => void
): Promise<void> {
  const transformer = new ASTTransformer();
  const transformedAst = transformer.transform(oldAst, oldVersion, newVersion);
  assertion(transformedAst);
}

export async function expectTransformWithStats(
  oldAst: any,
  oldVersion: number,
  newVersion: number
): Promise<{
  transformedAst: any;
  stats: any;
}> {
  const transformer = new ASTTransformer();
  const transformedAst = transformer.transform(oldAst, oldVersion, newVersion);
  
  return {
    transformedAst,
    stats: {
      sourceVersion: oldVersion,
      targetVersion: newVersion,
      nodeCount: JSON.stringify(transformedAst).length
    }
  };
}
