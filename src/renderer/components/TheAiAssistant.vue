<template>
   <Teleport to="#window-content">
      <div class="ai-drawer-overlay" @click.self="hideAiAssistant">
         <div class="ai-drawer">
            <!-- Header -->
            <div class="ai-header">
               <div class="ai-title">
                  <BaseIcon
                     icon-name="mdiCreation"
                     :size="22"
                     class="mr-2"
                  />
                  <span>AI Model</span>
               </div>
               <a
                  class="btn btn-clear-icon"
                  title="Close"
                  @click="hideAiAssistant"
               >
                  <BaseIcon icon-name="mdiClose" :size="20" />
               </a>
            </div>

            <div class="ai-body">
               <p class="ai-intro">
                  Configure the language model used by <b>AI Query</b> tabs. Open a new AI Query
                  tab from the <b>+</b> menu to ask questions or generate SQL. Only schema
                  <b>metadata</b> is ever sent — never your row data.
               </p>

               <div class="form-group">
                  <label class="form-label">Provider</label>
                  <select v-model="providerModel" class="form-select select-sm">
                     <option value="nim">
                        NVIDIA NIM
                     </option>
                     <option value="openai">
                        OpenAI
                     </option>
                     <option value="openrouter">
                        OpenRouter
                     </option>
                     <option value="lmstudio">
                        LM Studio (local)
                     </option>
                     <option value="ollama">
                        Ollama (local)
                     </option>
                  </select>
               </div>
               <div class="form-group">
                  <label class="form-label">Base URL</label>
                  <input
                     v-model="baseUrlModel"
                     class="form-input input-sm"
                     type="text"
                  >
               </div>
               <div class="form-group">
                  <label class="form-label">Chat model</label>
                  <input
                     v-model="modelModel"
                     class="form-input input-sm"
                     type="text"
                     list="ai-models"
                  >
                  <datalist id="ai-models">
                     <option value="meta/llama-3.1-8b-instruct" />
                     <option value="meta/llama-3.3-70b-instruct" />
                     <option value="nvidia/llama-3.3-nemotron-super-49b-v1" />
                     <option value="nvidia/llama-3.1-nemotron-70b-instruct" />
                  </datalist>
               </div>
               <div class="form-group">
                  <label class="form-label">API Key</label>
                  <input
                     v-model="apiKeyModel"
                     class="form-input input-sm"
                     type="password"
                     placeholder="stored locally"
                  >
               </div>

               <div class="ai-section-label">
                  Retrieval (RAG)
               </div>
               <div class="form-group ai-row">
                  <label class="form-switch">
                     <input v-model="useEmbeddingsModel" type="checkbox"><i class="form-icon" /> Semantic retrieval
                     <span class="ai-hint">(embed schema for better table matching)</span>
                  </label>
               </div>
               <div v-if="useEmbeddingsModel" class="form-group">
                  <label class="form-label">Embedding model</label>
                  <input
                     v-model="embedModelModel"
                     class="form-input input-sm"
                     type="text"
                     placeholder="blank = keyword ranking only"
                  >
               </div>

               <div class="ai-section-label">
                  Advanced
               </div>
               <div class="form-group ai-row">
                  <label class="form-switch">
                     <input v-model="thinkingModel" type="checkbox"><i class="form-icon" /> Reasoning
                     <span class="ai-hint">(thinking models — slower, smarter)</span>
                  </label>
               </div>
               <div class="form-group ai-row">
                  <label class="form-switch">
                     <input v-model="writeModeModel" type="checkbox"><i class="form-icon" /> Write mode
                     <span class="ai-hint">(allows INSERT/UPDATE/DELETE)</span>
                  </label>
               </div>

               <div class="form-group mt-2">
                  <button
                     class="btn btn-sm"
                     :class="testState.cls"
                     :disabled="testing"
                     @click="testConn"
                  >
                     <span v-if="testing" class="loading loading-sm mr-1" />{{ testState.label }}
                  </button>
               </div>
            </div>
         </div>
      </div>
   </Teleport>
</template>

<script setup lang="ts">
import { AiProviderType } from 'common/interfaces/ai';
import { computed, ref } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import { useAiStore } from '@/stores/ai';
import { useApplicationStore } from '@/stores/application';

const applicationStore = useApplicationStore();
const { hideAiAssistant } = applicationStore;

const aiStore = useAiStore();

const testing = ref(false);
const testState = ref<{ label: string; cls: string }>({ label: 'Test connection', cls: '' });

// Two-way bindings that persist through the store's setters.
const providerModel = computed({
   get: () => aiStore.provider,
   set: (v: AiProviderType) => aiStore.setProvider(v)
});
const baseUrlModel = computed({ get: () => aiStore.baseUrl, set: (v: string) => aiStore.setBaseUrl(v) });
const modelModel = computed({ get: () => aiStore.model, set: (v: string) => aiStore.setModel(v) });
const apiKeyModel = computed({ get: () => aiStore.apiKey, set: (v: string) => aiStore.setApiKey(v) });
const embedModelModel = computed({ get: () => aiStore.embedModel, set: (v: string) => aiStore.setEmbedModel(v) });
const useEmbeddingsModel = computed({ get: () => aiStore.useEmbeddings, set: (v: boolean) => aiStore.setUseEmbeddings(v) });
const writeModeModel = computed({ get: () => aiStore.writeMode, set: (v: boolean) => aiStore.setWriteMode(v) });
const thinkingModel = computed({ get: () => aiStore.enableThinking, set: (v: boolean) => aiStore.setEnableThinking(v) });

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
   width: 420px;
   max-width: 92vw;
   height: 100%;
   display: flex;
   flex-direction: column;
   background: var(--ai-bg, #1e1e24);
   color: #e6e6ea;
   box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
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
}

.btn-clear-icon {
   display: flex;
   align-items: center;
   padding: 4px;
   opacity: 0.7;
   cursor: pointer;
   border-radius: 6px;

   &:hover { opacity: 1; background: rgba(255, 255, 255, 0.08); }
}

.ai-body {
   flex: 1;
   overflow-y: auto;
   padding: 14px;

   .form-group { margin-bottom: 10px; }
   .form-label { font-size: 12px; opacity: 0.75; margin-bottom: 2px; }
   .ai-row { display: flex; align-items: center; }
   .ai-hint { font-size: 11px; opacity: 0.55; margin-left: 6px; }
}

.ai-intro {
   font-size: 12.5px;
   line-height: 1.5;
   opacity: 0.75;
   margin-bottom: 14px;
}

.ai-section-label {
   font-size: 11px;
   font-weight: 600;
   text-transform: uppercase;
   opacity: 0.5;
   margin: 14px 0 6px;
   border-top: 1px solid rgba(255, 255, 255, 0.08);
   padding-top: 10px;
}
</style>
