import { expectParseDeparse } from '../../test-utils';

it('should deparse EXTRACT(EPOCH FROM ...) correctly', async () => {
    const sql = `SELECT EXTRACT(EPOCH FROM now())`;
    const result = await expectParseDeparse(sql);
    expect(result).toContain('EXTRACT(EPOCH FROM');
    expect(result).not.toContain("'epoch'");
});

it('should deparse EXTRACT(YEAR FROM ...) correctly', async () => {
    const sql = `SELECT EXTRACT(YEAR FROM TIMESTAMP '2001-02-16 20:38:40')`;
    const result = await expectParseDeparse(sql);
    expect(result).toContain('EXTRACT(YEAR FROM');
    expect(result).not.toContain("'year'");
});

it('should deparse EXTRACT(EPOCH FROM ...) with pretty option', async () => {
    const sql = `SELECT EXTRACT(EPOCH FROM now())`;
    const result = await expectParseDeparse(sql, { pretty: true });
    expect(result).toContain('EXTRACT(EPOCH FROM');
    expect(result).not.toContain("'epoch'");
});

it('should deparse EXTRACT(CENTURY FROM ...) correctly', async () => {
    const sql = `SELECT EXTRACT(CENTURY FROM DATE '2001-01-01')`;
    const result = await expectParseDeparse(sql);
    expect(result).toContain('EXTRACT(CENTURY FROM');
    expect(result).not.toContain("'century'");
});

it('should deparse EXTRACT(MILLENNIUM FROM ...) correctly', async () => {
    const sql = `SELECT EXTRACT(MILLENNIUM FROM DATE '2001-01-01')`;
    const result = await expectParseDeparse(sql);
    expect(result).toContain('EXTRACT(MILLENNIUM FROM');
    expect(result).not.toContain("'millennium'");
});
