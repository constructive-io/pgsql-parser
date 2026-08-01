import { exec } from 'child_process';
import fs from 'fs';
import https from 'https';
import { sync as mkdirp } from 'mkdirp';
import { dirname } from 'path';

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

// Generate JavaScript from proto file using pbjs
export const generateProtoJS = (inFile: string, outFile: string): Promise<void> => new Promise((resolve, reject) => {
  const command = `pbjs --keep-case -t static-module -o ${outFile} ${inFile}`;
  mkdirp(dirname(outFile));

  exec(command, (error, _stdout, _stderr) => {
    if (error) {
      console.error(`Error during code generation: ${error.message}`);
      reject(error);
      return;
    }
    console.log('Generated proto.js from proto file.');
    resolve();
  });
});

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
