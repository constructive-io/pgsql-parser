declare module 'protobufjs-cli/targets/static-module' {
  import { Root } from 'protobufjs';

  export default function staticModule(
    root: Root,
    options: Record<string, boolean | string>,
    callback: (error: Error | null, output?: string) => void
  ): void;
}
