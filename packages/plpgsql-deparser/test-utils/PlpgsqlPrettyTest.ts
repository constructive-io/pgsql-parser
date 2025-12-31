import { parsePlPgSQLSync, loadModule } from '@libpg-query/parser';
import { deparseSync, PLpgSQLParseResult } from '../src';
import * as fs from 'fs';
import * as path from 'path';

export class PlpgsqlPrettyTest {
  private testCases: string[];
  private fixturesDir: string;

  constructor(testCases: string[]) {
    this.testCases = testCases;
    this.fixturesDir = path.join(__dirname, '../../../__fixtures__/plpgsql-pretty');
  }

  generateTests(): void {
    beforeAll(async () => {
      await loadModule();
    });

    this.testCases.forEach((testName) => {
      const filePath = path.join(this.fixturesDir, testName);
      
      it(`uppercase: ${testName}`, () => {
        const sql = fs.readFileSync(filePath, 'utf-8').trim();
        const result = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
        const deparsed = deparseSync(result, { uppercase: true });
        expect(deparsed).toMatchSnapshot();
      });

      it(`lowercase: ${testName}`, () => {
        const sql = fs.readFileSync(filePath, 'utf-8').trim();
        const result = parsePlPgSQLSync(sql) as unknown as PLpgSQLParseResult;
        const deparsed = deparseSync(result, { uppercase: false });
        expect(deparsed).toMatchSnapshot();
      });
    });
  }
}
