import { parse } from '@launchql/protobufjs';
import { readFileSync } from 'fs';

import {
  getOptionsWithDefaults,
  PgProtoParserOptions
} from './options';
import { ProtoStore } from './store';

export class PgProtoParser {
  inFile: string;
  options: PgProtoParserOptions;

  constructor(inFile: string, options?: PgProtoParserOptions) {
    this.inFile = inFile;
    this.options = getOptionsWithDefaults(options);
  }

  private readProtoFile(): string {
    return readFileSync(this.inFile, 'utf-8');
  }

  private parseProto(content: string): any {
    return parse(content, this.options.parser);
  }

  public write(): void {
    const protoContent = this.readProtoFile();
    const ast = this.parseProto(protoContent);
    const store = new ProtoStore(ast.root, this.options);
    store.write();
  }
}
