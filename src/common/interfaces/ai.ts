// Tevel IntelliDB — shared AI types (main <-> renderer).
// SAFETY INVARIANT: nothing in this file may carry table row data. Metadata only.

/** A single column, metadata only. */
export interface AiColumn {
   name: string;
   type: string;
   nullable: boolean;
   key?: 'pri' | 'uni' | '';
   default?: string;
   comment?: string;
}

/** A foreign-key edge, metadata only. */
export interface AiForeignKey {
   field: string;
   refTable: string;
   refField: string;
   refSchema?: string;
   constraintName?: string;
}

/**
 * Minimal shape the snapshot adapter reads from a raw DB-client column descriptor.
 * Antares' TableField is structurally assignable to this — we depend on the subset
 * only, so the AI core stays decoupled from the driver type graph.
 */
export interface RawColumnMeta {
   name: string;
   type: string;
   nullable?: boolean;
   key?: 'pri' | 'uni' | '';
   default?: string;
   comment?: string;
}

/** Minimal shape the adapter reads from a raw key-usage/foreign-key row. */
export interface RawKeyUsageMeta {
   field: string;
   refTable?: string | null;
   refField?: string | null;
   refSchema?: string | null;
   // some drivers (Firebird) return this as a number
   constraintName?: string | number | null;
}

/** One table's metadata. Enriched on demand for retrieved tables only. */
export interface AiTable {
   schema: string;
   name: string;
   type?: string;
   comment?: string;
   /** Present only after enrichment (retrieved tables). */
   columns?: AiColumn[];
   foreignKeys?: AiForeignKey[];
}

/** Lightweight table list the renderer already holds (names + comments, no columns). */
export interface AiTableRef {
   schema: string;
   name: string;
   type?: string;
   comment?: string;
}

export type AiProviderType = 'nim' | 'openai' | 'anthropic' | 'openrouter' | 'lmstudio' | 'ollama';

export interface AiProviderConfig {
   type: AiProviderType;
   baseUrl: string;
   apiKey?: string;
   model: string;
   /** Reasoning models (e.g. Nemotron) emit a separate thinking stream; enable it. */
   enableThinking?: boolean;
   /** Token budget for the thinking stream when enableThinking is on. */
   reasoningBudget?: number;
}

export interface AiMessage {
   role: 'system' | 'user' | 'assistant';
   content: string;
}

export interface AiChatOptions {
   temperature?: number;
   maxTokens?: number;
   topP?: number;
}

/** Result of the NL -> SQL pipeline. Preview only — never auto-executed. */
export interface GenerateSqlResult {
   sql: string;
   explanation: string;
   /** Tables the schema-intelligence layer selected for the prompt. */
   usedTables: string[];
   valid: boolean;
   /** Validator messages (e.g. blocked write statement). */
   warnings: string[];
   /** How many repair attempts were spent. */
   repairAttempts: number;
}

export interface GenerateSqlParams {
   uid: string;
   schema: string;
   question: string;
   /** SQL dialect of the connection (mysql | pg | sqlite | firebird). */
   dialect: string;
   /** Table list from the renderer's already-loaded structure (no columns). */
   tables: AiTableRef[];
   provider: AiProviderConfig;
   writeMode?: boolean;
   maxTables?: number;
   /** User-defined business vocabulary aliases (e.g. { cust: 'customer' }). */
   vocabulary?: Record<string, string>;
}

export interface ChatParams {
   messages: AiMessage[];
   provider: AiProviderConfig;
}

export interface ExplainSqlParams {
   sql: string;
   dialect: string;
   provider: AiProviderConfig;
   /** 'explain' | 'optimize' | 'fix' */
   mode?: 'explain' | 'optimize' | 'fix';
}
