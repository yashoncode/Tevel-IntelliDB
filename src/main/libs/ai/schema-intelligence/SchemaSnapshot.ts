// Tevel IntelliDB: the no-row-data boundary.
// Every object the AI layer sees is constructed HERE by explicit field whitelist.
// Row data cannot pass through because we never copy arbitrary fields, only the
// named metadata properties below. This is the tested safety guarantee.

import type {
   AiColumn, AiForeignKey, AiTable, AiTableRef, RawColumnMeta, RawKeyUsageMeta
} from 'common/interfaces/ai';

/** Whitelist a raw column descriptor down to metadata only. */
export function toAiColumn (field: RawColumnMeta): AiColumn {
   return {
      name: field.name,
      type: field.type,
      nullable: field.nullable ?? true,
      key: field.key ?? '',
      default: field.default ?? undefined,
      comment: field.comment ?? undefined
   };
}

/** Whitelist key-usage rows to real foreign keys only (drops non-FK key usage). */
export function toAiForeignKeys (keyUsage: RawKeyUsageMeta[]): AiForeignKey[] {
   return (keyUsage ?? [])
      .filter(k => !!k.refTable)
      .map(k => ({
         field: k.field,
         refTable: k.refTable as string,
         refField: k.refField ?? '',
         refSchema: k.refSchema ?? undefined,
         constraintName: k.constraintName != null ? String(k.constraintName) : undefined
      }));
}

/** Assemble a fully-enriched table snapshot from client metadata calls. */
export function buildTableSnapshot (
   ref: AiTableRef,
   columns: RawColumnMeta[],
   keyUsage: RawKeyUsageMeta[]
): AiTable {
   return {
      schema: ref.schema,
      name: ref.name,
      type: ref.type,
      comment: ref.comment,
      columns: (columns ?? []).map(toAiColumn),
      foreignKeys: toAiForeignKeys(keyUsage)
   };
}
