// Tevel IntelliDB — relationship graph over foreign keys.
// Lets the AI reason about join paths (Customer -> Order -> Invoice) instead of raw FKs.

import type { AiForeignKey, AiTable } from 'common/interfaces/ai';

export interface JoinEdge {
   fromTable: string;
   fromField: string;
   toTable: string;
   toField: string;
}

const norm = (name: string) => name.toLowerCase();

export class RelationshipGraph {
   /** adjacency: table -> outgoing/incoming join edges (undirected for pathfinding). */
   private adjacency = new Map<string, JoinEdge[]>();

   constructor (tables: AiTable[]) {
      for (const table of tables) {
         for (const fk of table.foreignKeys ?? []) {
            this.addEdge(table.name, fk);
         }
      }
   }

   private addEdge (fromTable: string, fk: AiForeignKey) {
      const edge: JoinEdge = {
         fromTable: norm(fromTable),
         fromField: fk.field,
         toTable: norm(fk.refTable),
         toField: fk.refField
      };
      this.push(edge.fromTable, edge);
      // reverse edge so BFS can traverse both directions
      this.push(edge.toTable, {
         fromTable: edge.toTable,
         fromField: edge.toField,
         toTable: edge.fromTable,
         toField: edge.fromField
      });
   }

   private push (key: string, edge: JoinEdge) {
      const list = this.adjacency.get(key) ?? [];
      list.push(edge);
      this.adjacency.set(key, list);
   }

   /** Shortest join path between two tables (BFS). Empty array if none / same table. */
   joinPath (from: string, to: string): JoinEdge[] {
      const start = norm(from);
      const goal = norm(to);
      if (start === goal) return [];

      const queue: string[] = [start];
      const cameFrom = new Map<string, JoinEdge>();
      const visited = new Set<string>([start]);

      while (queue.length) {
         const current = queue.shift() as string;
         if (current === goal) break;
         for (const edge of this.adjacency.get(current) ?? []) {
            if (!visited.has(edge.toTable)) {
               visited.add(edge.toTable);
               cameFrom.set(edge.toTable, edge);
               queue.push(edge.toTable);
            }
         }
      }

      if (!cameFrom.has(goal)) return [];
      const path: JoinEdge[] = [];
      let node = goal;
      while (node !== start) {
         const edge = cameFrom.get(node) as JoinEdge;
         path.unshift(edge);
         node = edge.fromTable;
      }
      return path;
   }

   /** Tables directly related to the given one (one FK hop, either direction). */
   neighbors (table: string): string[] {
      return (this.adjacency.get(norm(table)) ?? []).map(e => e.toTable);
   }
}
