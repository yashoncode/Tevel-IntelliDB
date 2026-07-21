import {
   AiMessage, AiProviderConfig, AiProviderType, AiTableRef, AskSchemaResult, GenerateSqlResult
} from 'common/interfaces/ai';
import { AiIntent, classifyAiIntent } from 'common/libs/classifyAiIntent';
import * as Store from 'electron-store';
import { defineStore } from 'pinia';

import Ai from '@/ipc-api/Ai';
import { useWorkspacesStore } from '@/stores/workspaces';

const aiStore = new Store({ name: 'ai' });

// NVIDIA NIM defaults. Nemotron reasoning model. API key is never shipped in source —
// the user enters it in Settings (persisted locally via electron-store).
const DEFAULTS = {
   provider: 'nim' as AiProviderType,
   baseUrl: 'https://integrate.api.nvidia.com/v1',
   // Small, fast, high-capacity NIM model. The 550B reasoning model's free
   // worker pool saturates (ResourceExhausted 48/48) and is slow; keep it as an
   // option users can pick in Settings, not the default. Thinking off by default.
   model: 'meta/llama-3.1-8b-instruct',
   apiKey: '',
   enableThinking: false,
   reasoningBudget: 8192,
   // Hybrid RAG: embed table docs for semantic retrieval. NIM's asymmetric QA embedder
   // by default; blank the model or turn off useEmbeddings to fall back to keyword ranking.
   embedModel: 'nvidia/nv-embedqa-e5-v5',
   useEmbeddings: true
};

export const useAiStore = defineStore('ai', {
   state: () => ({
      provider: aiStore.get('provider', DEFAULTS.provider) as AiProviderType,
      baseUrl: aiStore.get('base_url', DEFAULTS.baseUrl) as string,
      apiKey: aiStore.get('api_key', DEFAULTS.apiKey) as string,
      model: aiStore.get('model', DEFAULTS.model) as string,
      enableThinking: aiStore.get('enable_thinking', DEFAULTS.enableThinking) as boolean,
      reasoningBudget: aiStore.get('reasoning_budget', DEFAULTS.reasoningBudget) as number,
      embedModel: aiStore.get('embed_model', DEFAULTS.embedModel) as string,
      useEmbeddings: aiStore.get('use_embeddings', DEFAULTS.useEmbeddings) as boolean,
      writeMode: aiStore.get('write_mode', false) as boolean,
      maxTables: aiStore.get('max_tables', 12) as number,
      vocabulary: aiStore.get('vocabulary', {}) as Record<string, string>,
      // runtime — last error surfaced to the AI Query tab
      error: ''
   }),
   getters: {
      providerConfig (state): AiProviderConfig {
         return {
            type: state.provider,
            baseUrl: state.baseUrl,
            apiKey: state.apiKey,
            model: state.model,
            enableThinking: state.enableThinking,
            reasoningBudget: state.reasoningBudget,
            embedModel: state.embedModel
         };
      },
      isConfigured (state): boolean {
         const localProvider = state.provider === 'lmstudio' || state.provider === 'ollama';
         return !!state.model && !!state.baseUrl && (localProvider || !!state.apiKey);
      }
   },
   actions: {
      setProvider (v: AiProviderType) {
         this.provider = v; aiStore.set('provider', v);
      },
      setBaseUrl (v: string) {
         this.baseUrl = v; aiStore.set('base_url', v);
      },
      setApiKey (v: string) {
         this.apiKey = v; aiStore.set('api_key', v);
      },
      setModel (v: string) {
         this.model = v; aiStore.set('model', v);
      },
      setEnableThinking (v: boolean) {
         this.enableThinking = v; aiStore.set('enable_thinking', v);
      },
      setReasoningBudget (v: number) {
         this.reasoningBudget = v; aiStore.set('reasoning_budget', v);
      },
      setEmbedModel (v: string) {
         this.embedModel = v; aiStore.set('embed_model', v);
      },
      setUseEmbeddings (v: boolean) {
         this.useEmbeddings = v; aiStore.set('use_embeddings', v);
      },
      setWriteMode (v: boolean) {
         this.writeMode = v; aiStore.set('write_mode', v);
      },
      setMaxTables (v: number) {
         this.maxTables = v; aiStore.set('max_tables', v);
      },
      setVocabulary (v: Record<string, string>) {
         this.vocabulary = v; aiStore.set('vocabulary', v);
      },

      /** Current connection context: uid, schema, dialect, and the table list (names only). */
      activeContext (): { uid: string; schema: string; dialect: string; tables: AiTableRef[] } | null {
         const ws = useWorkspacesStore();
         const uid = ws.getSelected;
         if (!uid || uid === 'NEW') return null;
         const workspace = ws.getWorkspace(uid);
         if (!workspace || workspace.connectionStatus !== 'connected') return null;

         const schema = workspace.breadcrumbs?.schema || workspace.structure[0]?.name || '';
         const tables: AiTableRef[] = [];
         for (const s of workspace.structure) {
            if (schema && s.name !== schema) continue;
            for (const t of s.tables)
               tables.push({ schema: s.name, name: t.name, type: t.type, comment: t.comment });
         }
         return { uid, schema, dialect: workspace.client || 'mysql', tables };
      },

      async generateSql (question: string): Promise<GenerateSqlResult | null> {
         const ctx = this.activeContext();
         if (!ctx) {
            this.error = 'Connect to a database and select a schema first.'; return null;
         }
         this.error = '';
         try {
            const { status, response } = await Ai.generateSql({
               uid: ctx.uid,
               schema: ctx.schema,
               dialect: ctx.dialect,
               question,
               tables: ctx.tables,
               provider: this.providerConfig,
               writeMode: this.writeMode,
               maxTables: this.maxTables,
               vocabulary: this.vocabulary,
               useEmbeddings: this.useEmbeddings
            });
            if (status === 'success') return response as GenerateSqlResult;
            this.error = String(response);
            return null;
         }
         catch (err) {
            this.error = (err as Error).toString();
            return null;
         }
      },

      /** Route a natural-language message to SQL generation or a schema answer. */
      classifyIntent (question: string): AiIntent {
         return classifyAiIntent(question);
      },

      /** Answer a schema question in prose using the intelligence layer (ranked + enriched metadata). */
      async askSchema (question: string, history: AiMessage[] = []): Promise<{ ok: boolean; result?: AskSchemaResult; message?: string }> {
         const ctx = this.activeContext();
         if (!ctx) return { ok: false, message: 'Connect to a database and select a schema first.' };
         try {
            const { status, response } = await Ai.askSchema({
               uid: ctx.uid,
               schema: ctx.schema,
               dialect: ctx.dialect,
               question,
               tables: ctx.tables,
               provider: this.providerConfig,
               maxTables: this.maxTables,
               vocabulary: this.vocabulary,
               useEmbeddings: this.useEmbeddings,
               history
            });
            if (status === 'success') return { ok: true, result: response as AskSchemaResult };
            return { ok: false, message: String(response) };
         }
         catch (err) {
            return { ok: false, message: (err as Error).toString() };
         }
      },

      async testConnection (): Promise<{ ok: boolean; message: string }> {
         try {
            const { status, response } = await Ai.testConnection({
               provider: this.providerConfig,
               messages: []
            });
            return { ok: status === 'success', message: String(response) };
         }
         catch (err) {
            return { ok: false, message: (err as Error).toString() };
         }
      },

      /** Push generated SQL into a new query editor tab. `run` opts into auto-execution. */
      sendToEditor (sql: string, run = false): void {
         const ws = useWorkspacesStore();
         const uid = ws.getSelected;
         if (!uid || uid === 'NEW') return;
         const workspace = ws.getWorkspace(uid);
         ws.newTab({
            uid,
            type: 'query',
            content: sql,
            autorun: run,
            schema: workspace?.breadcrumbs?.schema
         });
      }
   }
});
