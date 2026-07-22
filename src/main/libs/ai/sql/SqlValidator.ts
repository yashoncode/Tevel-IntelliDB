// Tevel IntelliDB: read-only SQL safety gate.
// Blocks any statement that could mutate data/schema unless write-mode is explicitly on.
// This is a safety boundary: it errs toward BLOCKING. Identifier collisions with
// SQL keywords (e.g. a column literally named "update") fail safe (blocked), by design.

import type { SqlRisk } from 'common/interfaces/ai';

export interface SqlValidationResult {
   valid: boolean;
   warnings: string[];
   /** Execution risk (independent of the read-only gate). */
   risk: SqlRisk;
   riskReason: string;
}

// Schema/permission changes: irreversible, always high risk.
const DESTRUCTIVE = new Set([
   'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'RENAME', 'GRANT', 'REVOKE', 'REPLACE'
]);
// Data mutations: high if unscoped (no WHERE), otherwise moderate.
const MUTATING = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'COPY', 'LOAD']);

const ALLOWED_LEADING = new Set([
   'SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE', 'DESC', 'VALUES', 'TABLE'
]);

// Any of these appearing as a bare token blocks the statement in read-only mode.
const FORBIDDEN = new Set([
   'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'MERGE', 'REPLACE',
   'CREATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL', 'SET', 'USE', 'COPY',
   'LOAD', 'RENAME', 'VACUUM', 'ATTACH', 'DETACH', 'PRAGMA', 'INTO', 'LOCK',
   'UNLOCK', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'START', 'BEGIN'
]);

/** Remove line/block comments and string/identifier literals so keyword scanning is clean. */
export function stripNoise (sql: string): string {
   return sql
      .replace(/--[^\n]*/g, ' ') // line comments
      .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
      .replace(/'(?:[^'\\]|\\.|'')*'/g, '\'\'') // single-quoted strings
      .replace(/"(?:[^"\\]|\\.|"")*"/g, '""') // double-quoted identifiers/strings
      .replace(/`[^`]*`/g, '``'); // backtick identifiers
}

/** Split on top-level semicolons, drop empties. */
export function splitStatements (sql: string): string[] {
   return stripNoise(sql)
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
}

function tokenize (statement: string): string[] {
   return statement.toUpperCase().match(/[A-Z_][A-Z0-9_]*/g) ?? [];
}

/**
 * Classify how dangerous a statement is to EXECUTE (regardless of the read-only gate).
 * Returns the highest risk across all statements. Destructive DDL and unscoped
 * UPDATE/DELETE are high; other data mutations are moderate; everything else is safe.
 */
export function classifyRisk (sql: string): { level: SqlRisk; reason: string } {
   let level: SqlRisk = 'safe';
   let reason = 'Read-only query — safe to run.';
   for (const stmt of splitStatements(sql)) {
      const tokens = tokenize(stmt);
      if (tokens.length === 0) continue;

      const destructive = tokens.find(t => DESTRUCTIVE.has(t));
      if (destructive)
         return { level: 'high', reason: `Contains ${destructive} — changes schema or permissions and can be irreversible.` };

      const mutating = tokens.find(t => MUTATING.has(t));
      if (mutating) {
         if ((mutating === 'UPDATE' || mutating === 'DELETE') && !tokens.includes('WHERE'))
            return { level: 'high', reason: `${mutating} without a WHERE clause affects every row in the table.` };
         if (level === 'safe') {
            level = 'moderate';
            reason = `Contains ${mutating} — modifies data.`;
         }
      }
   }
   return { level, reason };
}

/**
 * Validate a (possibly multi-statement) SQL string.
 * In read-only mode every statement must lead with an allowed keyword and contain
 * no forbidden keyword; EXPLAIN ANALYZE is blocked (it executes the plan).
 * `risk` is always computed (even in write mode) so the UI can gate execution.
 */
export function validateSql (sql: string, writeMode = false): SqlValidationResult {
   const warnings: string[] = [];
   const { level: risk, reason: riskReason } = classifyRisk(sql);
   if (!sql || !sql.trim()) return { valid: false, warnings: ['Empty query.'], risk, riskReason };
   if (writeMode) return { valid: true, warnings: [], risk, riskReason };

   const statements = splitStatements(sql);
   if (statements.length === 0) return { valid: false, warnings: ['No executable statement found.'], risk, riskReason };

   for (const stmt of statements) {
      const tokens = tokenize(stmt);
      if (tokens.length === 0) continue;
      const lead = tokens[0];

      if (!ALLOWED_LEADING.has(lead)) {
         warnings.push(`Blocked: "${lead}" is not a read-only statement. Enable write mode to run it.`);
         continue;
      }
      // EXPLAIN ANALYZE actually runs the query in PostgreSQL, block it.
      if (lead === 'EXPLAIN' && tokens.includes('ANALYZE')) {
         warnings.push('Blocked: EXPLAIN ANALYZE executes the query. Enable write mode to run it.');
         continue;
      }
      const forbidden = tokens.find(t => FORBIDDEN.has(t));
      if (forbidden)
         warnings.push(`Blocked: statement contains "${forbidden}", which can modify data or schema.`);
   }

   return { valid: warnings.length === 0, warnings, risk, riskReason };
}
