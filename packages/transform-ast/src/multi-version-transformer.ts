import { V13ToV14Transformer } from './transformers/v13-to-v14';
import { V14ToV15Transformer } from './transformers/v14-to-v15';
import { V15ToV16Transformer } from './transformers/v15-to-v16';
import { V16ToV17Transformer } from './transformers/v16-to-v17';
import { V17ToV18Transformer } from './transformers/v17-to-v18';

export class ASTTransformer {
  private transformers = {
    '13-14': new V13ToV14Transformer(),
    '14-15': new V14ToV15Transformer(),
    '15-16': new V15ToV16Transformer(),
    '16-17': new V16ToV17Transformer(),
    '17-18': new V17ToV18Transformer(),
  };

  transform(ast: any, fromVersion: number, toVersion: number): any {
    if (fromVersion === toVersion) {
      return ast;
    }

    if (fromVersion > toVersion) {
      throw new Error(`Cannot transform backwards from v${fromVersion} to v${toVersion}`);
    }

    let currentAst = ast;
    let currentVersion = fromVersion;

    while (currentVersion < toVersion) {
      const nextVersion = currentVersion + 1;
      const transformerKey = `${currentVersion}-${nextVersion}`;
      
      // Use explicit switch to avoid complex union types
      switch (transformerKey) {
        case '13-14':
          currentAst = this.transformers['13-14'].transform(currentAst, { parentNodeTypes: [] });
          break;
        case '14-15':
          currentAst = this.transformers['14-15'].transform(currentAst, { parentNodeTypes: [] });
          break;
        case '15-16':
          currentAst = this.transformers['15-16'].transform(currentAst, { parentNodeTypes: [] });
          break;
        case '16-17':
          currentAst = this.transformers['16-17'].transform(currentAst, { parentNodeTypes: [] });
          break;
        case '17-18':
          currentAst = this.transformers['17-18'].transform(currentAst, { parentNodeTypes: [] });
          break;
        default:
          throw new Error(`No transformer available for v${currentVersion} to v${nextVersion}`);
      }
      
      currentVersion = nextVersion;
    }

    return currentAst;
  }

  transformToLatest(ast: any, fromVersion: number): any {
    return this.transform(ast, fromVersion, 18);
  }

  transform13To17(ast: any): any {
    return this.transform(ast, 13, 17);
  }

  transform14To17(ast: any): any {
    return this.transform(ast, 14, 17);
  }

  transform15To17(ast: any): any {
    return this.transform(ast, 15, 17);
  }

  transform16To17(ast: any): any {
    return this.transform(ast, 16, 17);
  }

  transform13To18(ast: any): any {
    return this.transform(ast, 13, 18);
  }

  transform14To18(ast: any): any {
    return this.transform(ast, 14, 18);
  }

  transform15To18(ast: any): any {
    return this.transform(ast, 15, 18);
  }

  transform16To18(ast: any): any {
    return this.transform(ast, 16, 18);
  }

  transform17To18(ast: any): any {
    return this.transform(ast, 17, 18);
  }
}