<template>
   <div v-show="isSelected" class="ai-query-tab column col-12 p-relative">
      <!-- Toolbar -->
      <div class="ai-query-toolbar">
         <div class="ai-query-title">
            <BaseIcon
               icon-name="mdiCreation"
               :size="18"
               class="mr-1"
            />
            <span>AI Query</span>
            <span class="ai-query-model" :title="model">{{ model }}</span>
         </div>
         <div class="ai-query-toolbar-right">
            <div class="ai-query-intent" title="How to interpret your message: Auto detects, or force SQL / Ask">
               <button
                  class="btn btn-sm"
                  :class="intentMode === 'auto' ? 'btn-primary' : ''"
                  @click="intentMode = 'auto'"
               >
                  Auto
               </button>
               <button
                  class="btn btn-sm"
                  :class="intentMode === 'sql' ? 'btn-primary' : ''"
                  @click="intentMode = 'sql'"
               >
                  SQL
               </button>
               <button
                  class="btn btn-sm"
                  :class="intentMode === 'chat' ? 'btn-primary' : ''"
                  @click="intentMode = 'chat'"
               >
                  Ask
               </button>
            </div>
            <a
               class="btn btn-sm btn-link"
               title="Configure the AI model"
               @click="showAiAssistant"
            >
               <BaseIcon
                  icon-name="mdiCog"
                  :size="16"
                  class="mr-1"
               />Model
            </a>
         </div>
      </div>

      <!-- Conversation -->
      <div ref="scrollRef" class="ai-query-body">
         <div v-if="!isConfigured" class="ai-query-empty">
            <BaseIcon icon-name="mdiKeyOutline" :size="44" />
            <p>Configure your AI model first — click <b>Model</b> above.</p>
         </div>
         <template v-else>
            <div v-if="!messages.length && !busy" class="ai-query-empty">
               <BaseIcon icon-name="mdiEarth" :size="44" />
               <p>
                  Ask in plain English. I'll decide whether you want a <b>SQL query</b>
                  or an <b>answer about your schema</b> — metadata only, never your row data.
               </p>
               <div class="ai-query-suggestions">
                  <button class="chip c-hand" @click="fillExample('top 10 customers by total order value this year')">
                     top 10 customers by total order value
                  </button>
                  <button class="chip c-hand" @click="fillExample('how are orders and payments related?')">
                     how are orders and payments related?
                  </button>
                  <button class="chip c-hand" @click="fillExample('which tables reference the users table?')">
                     which tables reference users?
                  </button>
               </div>
            </div>

            <div
               v-for="(m, i) in messages"
               :key="i"
               class="ai-query-msg"
               :class="m.role"
            >
               <div class="ai-query-msg-role">
                  <BaseIcon
                     :icon-name="m.role === 'user' ? 'mdiAccount' : 'mdiCreation'"
                     :size="14"
                     class="mr-1"
                  />
                  {{ m.role === 'user' ? 'You' : 'Tevel IntelliDB' }}
                  <span v-if="m.kind === 'sql'" class="ai-query-tag">SQL</span>
                  <span v-else-if="m.role === 'assistant'" class="ai-query-tag">Schema</span>
               </div>

               <!-- user or prose assistant -->
               <div
                  v-if="m.kind !== 'sql'"
                  class="ai-query-msg-text"
                  :class="{ 'is-error': m.error }"
               >
                  {{ m.content }}
               </div>

               <!-- generated SQL card -->
               <div v-else class="ai-query-sql-card">
                  <div v-if="m.result && !m.result.valid" class="toast toast-warning mb-2">
                     <b>Blocked for safety:</b>
                     <div v-for="(w, j) in m.result.warnings" :key="j">
                        • {{ w }}
                     </div>
                  </div>
                  <pre class="ai-query-sql"><code>{{ m.result?.sql || '—' }}</code></pre>
                  <div class="ai-query-sql-actions">
                     <button
                        class="btn btn-sm"
                        :disabled="!m.result?.sql"
                        @click="copy(m.result.sql)"
                     >
                        <BaseIcon
                           icon-name="mdiContentCopy"
                           :size="15"
                           class="mr-1"
                        />{{ copiedIdx === i ? 'Copied' : 'Copy' }}
                     </button>
                     <button
                        class="btn btn-sm"
                        :disabled="!m.result?.sql"
                        @click="openInEditor(m.result.sql, false)"
                     >
                        <BaseIcon
                           icon-name="mdiOpenInNew"
                           :size="15"
                           class="mr-1"
                        />Open in editor
                     </button>
                     <button
                        class="btn btn-sm btn-primary"
                        :disabled="!m.result?.sql || !m.result?.valid"
                        @click="openInEditor(m.result.sql, true)"
                     >
                        <BaseIcon
                           icon-name="mdiPlay"
                           :size="15"
                           class="mr-1"
                        />Run
                     </button>
                  </div>
                  <p v-if="m.result?.explanation" class="ai-query-explanation">
                     {{ m.result.explanation }}
                  </p>
                  <div v-if="m.result?.repairAttempts" class="ai-query-hint">
                     Auto-repaired {{ m.result.repairAttempts }}×
                  </div>
               </div>

               <div v-if="m.usedTables && m.usedTables.length" class="ai-query-tables">
                  <span class="ai-query-hint">Context:</span>
                  <span
                     v-for="tbl in m.usedTables"
                     :key="tbl"
                     class="chip"
                  >{{ tbl }}</span>
               </div>
            </div>

            <!-- Working indicator with rotating hints -->
            <div v-if="busy" class="ai-query-thinking">
               <span class="loading loading-sm mr-2" />
               <span>{{ thinkingHint }}</span>
            </div>
         </template>
      </div>

      <!-- Input -->
      <div class="ai-query-input">
         <textarea
            ref="inputRef"
            v-model="question"
            class="form-input"
            rows="2"
            :placeholder="isConfigured ? 'Ask anything about your data or schema…' : 'Configure a model to begin…'"
            :disabled="busy || !isConfigured"
            @keydown.enter.exact.prevent="submit"
         />
         <button
            class="btn btn-primary ai-query-send"
            :disabled="busy || !question.trim() || !isConfigured"
            @click="submit"
         >
            <BaseIcon icon-name="mdiSend" :size="18" />
         </button>
      </div>
   </div>
</template>

<script setup lang="ts">
import { AiMessage, GenerateSqlResult } from 'common/interfaces/ai';
import { AiIntent } from 'common/libs/classifyAiIntent';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import BaseIcon from '@/components/BaseIcon.vue';
import { useAiStore } from '@/stores/ai';
import { useApplicationStore } from '@/stores/application';

const props = defineProps<{
   tabUid: string;
   tab: object;
   isSelected: boolean;
   connection: { uid: string };
}>();

const aiStore = useAiStore();
const { model } = storeToRefs(aiStore);
const isConfigured = computed(() => aiStore.isConfigured);

const applicationStore = useApplicationStore();
const { showAiAssistant } = applicationStore;

interface Msg {
   role: 'user' | 'assistant';
   kind: 'text' | 'sql';
   content?: string;
   result?: GenerateSqlResult;
   usedTables?: string[];
   error?: boolean;
}

const messages = ref<Msg[]>([]);
const question = ref('');
const busy = ref(false);
const intentMode = ref<'auto' | AiIntent>('auto');
const copiedIdx = ref<number | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);
const scrollRef = ref<HTMLElement | null>(null);

// Rotating "working" hints so the user knows the (sometimes slow) model is alive.
const THINKING_HINTS = ['Thinking…', 'Reading your schema…', 'Ranking relevant tables…', 'Composing an answer…'];
const thinkingHint = ref(THINKING_HINTS[0]);
let hintTimer: ReturnType<typeof setInterval> | null = null;

const startThinking = () => {
   let i = 0;
   thinkingHint.value = THINKING_HINTS[0];
   hintTimer = setInterval(() => {
      i = (i + 1) % THINKING_HINTS.length;
      thinkingHint.value = THINKING_HINTS[i];
   }, 1800);
};
const stopThinking = () => {
   if (hintTimer) {
      clearInterval(hintTimer); hintTimer = null;
   }
};

const scrollToEnd = async () => {
   await nextTick();
   if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
};

/** Compact prior turns as context for follow-up schema questions. */
const buildHistory = (): AiMessage[] => {
   return messages.value.slice(-6).map(m => ({
      role: m.role,
      content: m.kind === 'sql'
         ? `${m.result?.sql || ''}\n${m.result?.explanation || ''}`.trim()
         : (m.content || '')
   } as AiMessage)).filter(m => m.content);
};

const submit = async () => {
   const q = question.value.trim();
   if (!q || busy.value) return;
   question.value = '';
   messages.value.push({ role: 'user', kind: 'text', content: q });
   await scrollToEnd();

   const intent: AiIntent = intentMode.value === 'auto' ? aiStore.classifyIntent(q) : intentMode.value;
   busy.value = true;
   startThinking();
   try {
      if (intent === 'sql') {
         const result = await aiStore.generateSql(q);
         if (result)
            messages.value.push({ role: 'assistant', kind: 'sql', result, usedTables: result.usedTables });
         else
            messages.value.push({ role: 'assistant', kind: 'text', content: aiStore.error || 'Something went wrong.', error: true });
      }
      else {
         const { ok, result, message } = await aiStore.askSchema(q, buildHistory());
         if (ok && result)
            messages.value.push({ role: 'assistant', kind: 'text', content: result.answer, usedTables: result.usedTables });
         else
            messages.value.push({ role: 'assistant', kind: 'text', content: message || 'Something went wrong.', error: true });
      }
   }
   finally {
      busy.value = false;
      stopThinking();
      await scrollToEnd();
   }
};

const fillExample = (text: string) => {
   question.value = text;
   inputRef.value?.focus();
};

const copy = (sql: string) => {
   navigator.clipboard.writeText(sql);
   const idx = messages.value.findIndex(m => m.result?.sql === sql);
   copiedIdx.value = idx;
   setTimeout(() => {
      copiedIdx.value = null;
   }, 1500);
};

const openInEditor = (sql: string, run: boolean) => {
   aiStore.sendToEditor(sql, run);
};

watch(() => props.isSelected, sel => {
   if (sel) nextTick(() => inputRef.value?.focus());
});

onBeforeUnmount(stopThinking);
</script>

<style lang="scss" scoped>
.ai-query-tab {
   display: flex;
   flex-direction: column;
   height: 100%;
   overflow: hidden;
}

.ai-query-toolbar {
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: 8px;
   padding: 6px 12px;
   border-bottom: 1px solid rgba(128, 128, 128, 0.2);
   flex-wrap: wrap;

   .ai-query-title {
      display: flex;
      align-items: center;
      font-weight: 600;
   }

   .ai-query-model {
      margin-left: 8px;
      font-size: 11px;
      opacity: 0.6;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
   }

   .ai-query-toolbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
   }

   .ai-query-intent {
      display: flex;
      gap: 2px;
   }
}

.ai-query-body {
   flex: 1;
   overflow-y: auto;
   padding: 14px;
   display: flex;
   flex-direction: column;
   gap: 12px;
}

.ai-query-empty {
   margin: auto;
   text-align: center;
   opacity: 0.6;
   max-width: 380px;

   p { margin-top: 12px; }

   .ai-query-suggestions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;

      .chip { cursor: pointer; }
   }
}

.ai-query-msg {
   display: flex;
   flex-direction: column;
   gap: 4px;
   max-width: 900px;

   &.user { align-self: flex-end; align-items: flex-end; }
   &.assistant { align-self: flex-start; width: 100%; }

   .ai-query-msg-role {
      display: flex;
      align-items: center;
      font-size: 11px;
      font-weight: 600;
      opacity: 0.6;
   }

   .ai-query-tag {
      margin-left: 6px;
      font-size: 9px;
      padding: 0 5px;
      border-radius: 8px;
      background: rgba(128, 128, 128, 0.2);
      text-transform: uppercase;
   }

   .ai-query-msg-text {
      white-space: pre-wrap;
      line-height: 1.55;
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(128, 128, 128, 0.1);

      &.is-error { background: rgba(222, 59, 40, 0.14); }
   }

   &.user .ai-query-msg-text { background: rgba(30, 64, 175, 0.16); }
}

.ai-query-sql-card { width: 100%; }

.ai-query-sql {
   background: rgba(128, 128, 128, 0.12);
   border: 1px solid rgba(128, 128, 128, 0.25);
   border-radius: 8px;
   padding: 12px;
   font-family: 'Fira Code', monospace;
   font-size: 12.5px;
   white-space: pre-wrap;
   word-break: break-word;
   overflow-x: auto;
   margin-bottom: 8px;
}

.ai-query-sql-actions { display: flex; flex-wrap: wrap; gap: 8px; }

.ai-query-explanation {
   font-size: 13px;
   line-height: 1.55;
   white-space: pre-wrap;
   opacity: 0.9;
   margin-top: 8px;
}

.ai-query-tables {
   display: flex;
   flex-wrap: wrap;
   align-items: center;
   gap: 4px;

   .chip { font-size: 11px; }
}

.ai-query-hint { font-size: 11px; opacity: 0.55; }

.ai-query-thinking {
   display: flex;
   align-items: center;
   font-size: 13px;
   opacity: 0.8;
   padding: 4px 2px;
}

.ai-query-input {
   display: flex;
   gap: 8px;
   padding: 12px 14px;
   border-top: 1px solid rgba(128, 128, 128, 0.2);
   align-items: flex-end;

   textarea { resize: none; }
   .ai-query-send { align-self: stretch; display: flex; align-items: center; }
}
</style>
