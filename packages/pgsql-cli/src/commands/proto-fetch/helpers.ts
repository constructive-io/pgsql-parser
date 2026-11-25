import fs from 'fs';
import https from 'https';
import { sync as mkdirp } from 'mkdirp';
import { dirname, resolve } from 'path';
import { Field, Namespace, OneOf, Root, Type, util } from 'protobufjs';
import staticModule from 'protobufjs-cli/targets/static-module';

// Download .proto file if URL
export const downloadProtoFile = (protoUrl: string, filePath: string): Promise<void> => {
  mkdirp(dirname(filePath));

  return new Promise((resolve, reject) => {
    https.get(protoUrl, (response) => {
      if (response.statusCode !== 200) {
        console.error(`Failed to download file: Status Code: ${response.statusCode}`);
        response.resume(); // consume response data to free up memory
        reject(new Error('Failed to download file'));
        return;
      }

      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log('Downloaded proto file.');
        resolve();
      });
    }).on('error', (err) => {
      console.error(`Error downloading the file: ${err.message}`);
      fs.unlink(filePath, () => {}); // Delete the file async. (No need to check error here)
      reject(err);
    });
  });
};

const applyJsonFieldNames = (namespace: Namespace): void => {
  if (namespace instanceof Type) {
    const fields = namespace.fieldsArray.map(field => {
      const name = field.options?.json_name ?? field.name;
      if (typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(name) || name === '__proto__') {
        throw new Error(`Invalid JSON field name on ${field.fullName}`);
      }
      return { field, name };
    });
    if (fields.some(({ field, name }) => field.name !== name)) {
      const oneofs = new Map<OneOf, Field[]>(
        namespace.oneofsArray.map(oneof => [oneof, [...oneof.fieldsArray]])
      );
      for (const [oneof, members] of oneofs) {
        members.forEach(field => oneof.remove(field));
      }
      fields.forEach(({ field }) => namespace.remove(field));
      fields.forEach(({ field, name }) => {
        field.name = name;
        namespace.add(field);
      });
      for (const [oneof, members] of oneofs) {
        members.forEach(field => oneof.add(field));
      }
    }
  }
  for (const child of namespace.nestedArray) {
    if (child instanceof Namespace) applyJsonFieldNames(child);
  }
};

export const generateProtoJS = async (inFile: string, outFile: string): Promise<void> => {
  const root = new Root();
  const includeDir = dirname(require.resolve('protobufjs/package.json'));
  root.resolvePath = (origin, target) => {
    const local = util.path.resolve(origin, target);
    if (fs.existsSync(local)) return local;

    const bundled = resolve(includeDir, target);
    return fs.existsSync(bundled) ? bundled : local;
  };
  root.loadSync(inFile, { keepCase: true });
  applyJsonFieldNames(root);
  root.resolveAll();
  const output = await new Promise<string>((resolve, reject) => {
    staticModule(root, {
      beautify: true,
      comments: true,
      convert: true,
      create: true,
      decode: true,
      delimited: true,
      encode: true,
      lint: 'eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars',
      service: true,
      typeurl: true,
      verify: true,
    }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
  mkdirp(dirname(outFile));
  await fs.promises.writeFile(outFile, output, 'utf8');
  console.log('Generated proto.js from proto file.');
};

// Replace text in generated JS file
export const replaceTextInProtoJS = (filePath: string, originalPackage: string, newPackage: string): Promise<void> => new Promise((resolve, reject) => {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading proto.js: ${err.message}`);
      reject(err);
      return;
    }

    const result = data.replace(new RegExp(originalPackage, 'g'), newPackage);
    
    fs.writeFile(filePath, result, 'utf8', (err) => {
      if (err) {
        console.error(`Error writing back to proto.js: ${err.message}`);
        reject(err);
        return;
      }
      console.log('Replaced text in proto.js successfully.');
      resolve();
    });
  });
});
