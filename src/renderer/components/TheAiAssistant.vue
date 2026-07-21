<template>
   <Teleport to="#window-content">
      <div class="ai-drawer-overlay" @click.self="hideAiAssistant">
         <div class="ai-drawer">
            <!-- Header -->
            <div class="ai-header">
               <div class="ai-title">
                  <BaseIcon icon-name="mdiRobotHappyOutline" :size="22" class="mr-2" />
                  <span>Tevel AI</span>
                  <span class="ai-badge">{{ model }}</span>
               </div>
               <div class="ai-header-actions">
                  <a
                     class="btn btn-clear-icon"
                     :class="{ active: showSettings }"
                     title="Settings"
                     @click="showSettings = !showSettings"
                  >
                     <BaseIcon icon-name="mdiCog" :size="20" />
                  </a>
                  <a class="btn btn-clear-icon" title="Close" @click="hideAiAssistant">
                     <BaseIcon icon-name="mdiClose" :size="20" />
                  </a>
               </div>
            </div>

            <!-- Settings -->
            <div v-if="showSettings" class="ai-settings">
               <div class="form-group">
                  <label class="form-label">Provider</label>
                  <select v-model="providerModel" class="form-select select-sm">
                     <option value="nim">NVIDIA NIM</option>
                     <option value="openai">OpenAI</option>
                     <option value="openrouter">OpenRouter</option>
                     <option value="lmstudio">LM Studio (local)</option>
                     <option value="ollama">Ollama (local)</option>
                  </select>
               </div>
               <div class="form-group">
                  <label class="form-label">Base URL</label>
                  <input v-model="baseUrlModel" class="form-input input-sm" type="text">
               </div>
               <div class="form-group">
                  <label class="form-label">Model</label>
                  <input v-model="modelModel" class="form-input input-sm" type="text" list="ai-models">
                  <datalist id="ai-models">
                     <option value="nvidia/nemotron-3-ultra-550b-a55b" />
                     <option value="nvidia/llama-3.3-nemotron-super-49b-v1" />
                     <option value="nvidia/llama-3.1-nemotron-70b-instruct" />
                     <option value="meta/llama-3.3-70b-instruct" />
                  </datalist>
               </div>
               <div class="form-group">
                  <label class="form-label">API Key</label>
                  <input v-model="apiKeyModel" class="form-input input-sm" type="password" placeholder="stored locally">
               </div>
               <div class="form-group ai-row">
                  <label class="form-switch">
                     <input v-model="thinkingModel" type="checkbox"><i class="form-icon" /> Reasoning
                     <span class="ai-hint">(Nemotron thinking — slower, smarter)</span>
                  </label>
               </div>
               <div class="form-group ai-row">
                  <label class="form-switch">
                     <input v-model="writeModeModel" type="checkbox"><i class="form-icon" /> Write mode
                     <span class="ai-hint">(allows INSERT/UPDATE/DELETE)</span>
                  </label>
               </div>
               <div class="form-group ai-row">
                  <button class="btn btn-sm" :class="testState.cls" :disabled="testing" @click="testConn">
                     <span v-if="testing" class="loading loading-sm mr-1" />{{ testState.label }}
                  </button>
               </div>
            </div>

            <!-- Mode switch -->
            <div class="ai-modes">
               <button class="btn btn-sm" :class="mode === 'sql' ? 'btn-primary' : ''" @click="mode = 'sql'">NL → SQL</button>
               <button class="btn btn-sm" :class="mode === 'chat' ? 'btn-primary' : ''" @click="mode = 'chat'">Schema Chat</button>
            </div>

            <!-- Body -->
            <div class="ai-body">
               <div v-if="!isConfigured" class="ai-empty">
                  <BaseIcon icon-name="mdiKeyOutline" :size="40" />
                  <p>Add your provider details in <b>Settings</b> to start.</p>
               </div>

               <!-- NL -> SQL result -->
               <template v-else-if="mode === 'sql'">
                  <div v-if="error" class="toast toast-error">{{ error }}</div>
                  <div v-if="lastResult" class="ai-result">
                     <div v-if="!lastResult.valid" class="toast toast-warning">
                        <b>Blocked for safety:</b>
                        <div v-for="(w, i) in lastResult.warnings" :key="i">• {{ w }}</div>
                     </div>
                     <pre class="ai-sql"><code>{{ lastResult.sql || '—' }}</code></pre>
                     <div class="ai-result-actions">
                        <button class="btn btn-sm" :disabled="!lastResult.sql" @click="copy(lastResult.sql)">
                           <BaseIcon icon-name="mdiContentCopy" :size="16" class="mr-1" />{{ copied ? 'Copied' : 'Copy' }}
                        </button>
                        <button class="btn btn-sm btn-primary" :disabled="!lastResult.sql" @click="openInEditor(lastResult.sql)">
                           <BaseIcon icon-name="mdiOpenInNew" :size="16" class="mr-1" />Open in editor
                        </button>
                     </div>
                     <p v-if="lastResult.explanation" class="ai-explanation">{{ lastResult.explanation }}</p>
                     <div v-if="lastResult.usedTables.length" class="ai-tables">
                        <span class="ai-hint">Tables used:</span>
                        <span v-for="tbl in lastResult.usedTables" :key="tbl" class="chip">{{ tbl }}</span>
                     </div>
                     <div v-if="lastResult.repairAttempts" class="ai-hint">Auto-repaired {{ lastResult.repairAttempts }}×</div>
                  </div>
                  <div v-else-if="!isLoading" class="ai-empty">
                     <BaseIcon icon-name="mdiDatabaseSearchOutline" :size="40" />
                     <p>Ask a question about your data — I'll write the SQL. Nothing but schema metadata is ever sent.</p>
                  </div>
               </template>

               <!-- Chat -->
               <template v-else>
                  <div v-if="error" class="toast toast-error">{{ error }}</div>
                  <div v-for="(m, i) in chat" :key="i" class="ai-msg" :class="m.role">
                     <div class="ai-msg-role">{{ m.role === 'user' ? 'You' : 'Tevel AI' }}</div>
                     <div class="ai-msg-content">{{ m.content }}</div>
                  </div>
                  <div v-if="!chat.length && !isLoading" class="ai-empty">
                     <BaseIcon icon-name="mdiChatQuestionOutline" :size="40" />
                     <p>Ask anything about the database structure, relationships, or how to model a query.</p>
                  </div>
               </template>

               <div v-if="isLoading" class="ai-loading"><span class="loading loading-lg" /></div>
            </div>

            <!-- Input -->
            <div class="ai-input">
               <textarea
                  ref="inputRef"
                  v-model="question"
                  class="form-input"
                  rows="2"
                  :placeholder="mode === 'sql' ? 'e.g. top 10 customers by total invoice amount this year' : 'Ask about the schema…'"
                  :disabled="isLoading || !isConfigured"
                  @keydown.enter.exact.prevent="submit"
               />
               <button class="btn btn-primary ai-send" :disabled="isLoading || !question.trim() || !isConfigured" @click="submit">
                  <BaseIcon icon-name="mdiSend" :size="18" />
               </button>
            </div>
         </div>
      </div>
   </Teleport>
</template>

<script setup lang="ts">
import { AiProviderType } from 'common/interfaces/ai';
import { storeToRefs } from 'pinia';
import { computed, nextTick, ref } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import { useApplicationStore } from '@/stores/application';
import { useAiStore } from '@/stores/ai';

const applicationStore = useApplicationStore();
const { hideAiAssistant } = applicationStore;

const aiStore = useAiStore();
const { isLoading, error, lastResult, chat, model } = storeToRefs(aiStore);
const isConfigured = computed(() => aiStore.isConfigured);

const question = ref('');
const mode = ref<'sql' | 'chat'>('sql');
const showSettings = ref(false);
const copied = ref(false);
const testing = ref(false);
const inputRef = ref<HTMLTextAreaElement | null>(null);
const testState = ref<{ label: string; cls: string }>({ label: 'Test connection', cls: '' });

// Two-way bindings that persist through the store's setters.
const providerModel = computed({
   get: () => aiStore.provider,
   set: (v: AiProviderType) => aiStore.setProvider(v)
});
const baseUrlModel = computed({ get: () => aiStore.baseUrl, set: (v: string) => aiStore.setBaseUrl(v) });
const modelModel = computed({ get: () => aiStore.model, set: (v: string) => aiStore.setModel(v) });
const apiKeyModel = computed({ get: () => aiStore.apiKey, set: (v: string) => aiStore.setApiKey(v) });
const writeModeModel = computed({ get: () => aiStore.writeMode, set: (v: boolean) => aiStore.setWriteMode(v) });
const thinkingModel = computed({ get: () => aiStore.enableThinking, set: (v: boolean) => aiStore.setEnableThinking(v) });

const submit = async () => {
   const q = question.value.trim();
   if (!q) return;
   if (mode.value === 'sql') {
      await aiStore.generateSql(q);
   }
   else {
      await aiStore.ask(q);
   }
   question.value = '';
   await nextTick();
};

const copy = (sql: string) => {
   navigator.clipboard.writeText(sql);
   copied.value = true;
   setTimeout(() => { copied.value = false; }, 1500);
};

const openInEditor = (sql: string) => {
   aiStore.sendToEditor(sql);
   hideAiAssistant();
};

const testConn = async () => {
   testing.value = true;
   testState.value = { label: 'Testing…', cls: '' };
   const { ok, message } = await aiStore.testConnection();
   testState.value = ok
      ? { label: 'Connected ✓', cls: 'btn-success' }
      : { label: `Failed: ${message.slice(0, 40)}`, cls: 'btn-error' };
   testing.value = false;
};
</script>

<style lang="scss" scoped>
.ai-drawer-overlay {
   position: absolute;
   inset: 0;
   z-index: 400;
   display: flex;
   justify-content: flex-end;
   background: rgba(0, 0, 0, 0.25);
}

.ai-drawer {
   width: 460px;
   max-width: 92vw;
   height: 100%;
   display: flex;
   flex-direction: column;
   background: var(--ai-bg, #1e1e24);
   color: #e6e6ea;
   box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
   backdrop-filter: blur(12px);
   border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.ai-header {
   display: flex;
   align-items: center;
   justify-content: space-between;
   padding: 10px 14px;
   border-bottom: 1px solid rgba(255, 255, 255, 0.08);

   .ai-title {
      display: flex;
      align-items: center;
      font-weight: 600;
      font-size: 15px;
   }

   .ai-badge {
      margin-left: 8px;
      font-size: 10px;
      font-weight: 500;
      opacity: 0.6;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
   }

   .ai-header-actions { display: flex; gap: 4px; }
}

.btn-clear-icon {
   display: flex;
   align-items: center;
   padding: 4px;
   opacity: 0.7;
   cursor: pointer;
   border-radius: 6px;

   &:hover, &.active { opacity: 1; background: rgba(255, 255, 255, 0.08); }
}

.ai-settings {
   padding: 10px 14px;
   border-bottom: 1px solid rgba(255, 255, 255, 0.08);
   background: rgba(255, 255, 255, 0.02);

   .form-group { margin-bottom: 8px; }
   .form-label { font-size: 12px; opacity: 0.75; margin-bottom: 2px; }
   .ai-row { display: flex; align-items: center; }
   .ai-hint { font-size: 11px; opacity: 0.55; margin-left: 6px; }
}

.ai-modes {
   display: flex;
   gap: 6px;
   padding: 10px 14px 0;
}

.ai-body {
   flex: 1;
   overflow-y: auto;
   padding: 14px;
   display: flex;
   flex-direction: column;
   gap: 10px;
}

.ai-empty {
   margin: auto;
   text-align: center;
   opacity: 0.55;
   max-width: 280px;
   p { margin-top: 10px; font-size: 13px; }
}

.ai-sql {
   background: #12121a;
   border: 1px solid rgba(255, 255, 255, 0.1);
   border-radius: 8px;
   padding: 12px;
   font-family: 'Fira Code', monospace;
   font-size: 12.5px;
   white-space: pre-wrap;
   word-break: break-word;
   overflow-x: auto;
}

.ai-result-actions { display: flex; gap: 8px; margin: 8px 0; }

.ai-explanation {
   font-size: 13px;
   line-height: 1.5;
   white-space: pre-wrap;
   opacity: 0.9;
}

.ai-tables {
   display: flex;
   flex-wrap: wrap;
   align-items: center;
   gap: 4px;
   margin-top: 6px;
   .chip { font-size: 11px; }
}

.ai-hint { font-size: 11px; opacity: 0.55; }

.ai-msg {
   padding: 8px 10px;
   border-radius: 8px;
   font-size: 13px;

   &.user { background: rgba(120, 120, 255, 0.12); }
   &.assistant { background: rgba(255, 255, 255, 0.04); }

   .ai-msg-role { font-size: 11px; font-weight: 600; opacity: 0.6; margin-bottom: 3px; }
   .ai-msg-content { white-space: pre-wrap; line-height: 1.5; }
}

.ai-loading { display: flex; justify-content: center; padding: 16px; }

.ai-input {
   display: flex;
   gap: 8px;
   padding: 12px 14px;
   border-top: 1px solid rgba(255, 255, 255, 0.08);
   align-items: flex-end;

   textarea { resize: none; }
   .ai-send { align-self: stretch; display: flex; align-items: center; }
}
</style>
