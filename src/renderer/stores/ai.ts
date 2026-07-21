import {
   AiMessage, AiProviderConfig, AiProviderType, AiTableRef, GenerateSqlResult
} from 'common/interfaces/ai';
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
   model: 'nvidia/nemotron-3-ultra-550b-a55b',
   apiKey: '',
   enableThinking: true,
   reasoningBudget: 8192
};

export interface AiChatEntry { role: 'user' | 'assistant'; content: string }

export const useAiStore = defineStore('ai', {
   state: () => ({
      provider: aiStore.get('provider', DEFAULTS.provider) as AiProviderType,
      baseUrl: aiStore.get('base_url', DEFAULTS.baseUrl) as string,
      apiKey: aiStore.get('api_key', DEFAULTS.apiKey) as string,
      model: aiStore.get('model', DEFAULTS.model) as string,
      enableThinking: aiStore.get('enable_thinking', DEFAULTS.enableThinking) as boolean,
      reasoningBudget: aiStore.get('reasoning_budget', DEFAULTS.reasoningBudget) as number,
      writeMode: aiStore.get('write_mode', false) as boolean,
      maxTables: aiStore.get('max_tables', 12) as number,
      vocabulary: aiStore.get('vocabulary', {}) as Record<string, string>,
      // runtime
      isLoading: false,
      error: '',
      lastResult: null as GenerateSqlResult | null,
      chat: [] as AiChatEntry[]
   }),
   getters: {
      providerConfig (state): AiProviderConfig {
         return {
            type: state.provider,
            baseUrl: state.baseUrl,
            apiKey: state.apiKey,
            model: state.model,
            enableThinking: state.enableThinking,
            reasoningBudget: state.reasoningBudget
         };
      },
      isConfigured (state): boolean {
         const localProvider = state.provider === 'lmstudio' || state.provider === 'ollama';
         return !!state.model && !!state.baseUrl && (localProvider || !!state.apiKey);
      }
   },
   actions: {
      setProvider (v: AiProviderType) { this.provider = v; aiStore.set('provider', v); },
      setBaseUrl (v: string) { this.baseUrl = v; aiStore.set('base_url', v); },
      setApiKey (v: string) { this.apiKey = v; aiStore.set('api_key', v); },
      setModel (v: string) { this.model = v; aiStore.set('model', v); },
      setEnableThinking (v: boolean) { this.enableThinking = v; aiStore.set('enable_thinking', v); },
      setReasoningBudget (v: number) { this.reasoningBudget = v; aiStore.set('reasoning_budget', v); },
      setWriteMode (v: boolean) { this.writeMode = v; aiStore.set('write_mode', v); },
      setMaxTables (v: number) { this.maxTables = v; aiStore.set('max_tables', v); },
      setVocabulary (v: Record<string, string>) { this.vocabulary = v; aiStore.set('vocabulary', v); },

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
            for (const t of s.tables) {
               tables.push({ schema: s.name, name: t.name, type: t.type, comment: t.comment });
            }
         }
         return { uid, schema, dialect: workspace.client || 'mysql', tables };
      },

      async generateSql (question: string): Promise<GenerateSqlResult | null> {
         const ctx = this.activeContext();
         if (!ctx) { this.error = 'Connect to a database and select a schema first.'; return null; }
         this.isLoading = true;
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
               vocabulary: this.vocabulary
            });
            if (status === 'success') {
               this.lastResult = response as GenerateSqlResult;
               return this.lastResult;
            }
            this.error = String(response);
            return null;
         }
         catch (err) {
            this.error = (err as Error).toString();
            return null;
         }
         finally {
            this.isLoading = false;
         }
      },

      async ask (question: string): Promise<void> {
         const ctx = this.activeContext();
         this.chat.push({ role: 'user', content: question });
         this.isLoading = true;
         this.error = '';
         try {
            const schemaHint = ctx
               ? `Connected database dialect: ${ctx.dialect}. Available tables: ${ctx.tables.map((t: AiTableRef) => t.name).slice(0, 200).join(', ')}.`
               : 'No database is currently connected.';
            const messages: AiMessage[] = [
               { role: 'system', content: `You are Tevel IntelliDB, a senior database engineer. You reason over schema METADATA only (never row data). ${schemaHint}` },
               ...this.chat.map((c: AiChatEntry) => ({ role: c.role, content: c.content } as AiMessage))
            ];
            const { status, response } = await Ai.chat({ messages, provider: this.providerConfig });
            if (status === 'success') this.chat.push({ role: 'assistant', content: String(response) });
            else this.error = String(response);
         }
         catch (err) {
            this.error = (err as Error).toString();
         }
         finally {
            this.isLoading = false;
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

      /** Push generated SQL into a new query editor tab (user reviews & runs it). */
      sendToEditor (sql: string): void {
         const ws = useWorkspacesStore();
         const uid = ws.getSelected;
         if (!uid || uid === 'NEW') return;
         const workspace = ws.getWorkspace(uid);
         ws.newTab({
            uid,
            type: 'query',
            content: sql,
            autorun: false,
            schema: workspace?.breadcrumbs?.schema
         });
      }
   }
});
