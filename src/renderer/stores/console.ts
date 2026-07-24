import { defineStore } from 'pinia';

const logsSize = 1000;

export type LogType = 'query' | 'debug' | 'ai'
export interface QueryLog {
   cUid: string;
   sql: string;
   date: Date;
}

export interface DebugLog {
   level: 'log' | 'info' | 'warn' | 'error' | string;
   process: 'renderer' | 'main' | 'worker';
   message: string;
   date: Date;
}

export interface AiLog {
   kind: 'sql' | 'schema';
   model: string;
   request: string;
   response: string;
   error?: boolean;
   date: Date;
}

export const useConsoleStore = defineStore('console', {
   state: () => ({
      isConsoleOpen: false,
      queryLogs: [] as QueryLog[],
      debugLogs: [] as DebugLog[],
      aiLogs: [] as AiLog[],
      selectedTab: 'query' as LogType,
      consoleHeight: 0
   }),
   getters: {
      getLogsByWorkspace: state => (uid: string) => state.queryLogs.filter(r => r.cUid === uid)
   },
   actions: {
      putLog (type: LogType, record: QueryLog | DebugLog) {
         if (type === 'query') {
            this.queryLogs.push(record);

            if (this.queryLogs.length > logsSize)
               this.queryLogs = this.queryLogs.slice(0, logsSize);
         }
         else if (type === 'debug') {
            this.debugLogs.push(record);

            if (this.debugLogs.length > logsSize)
               this.debugLogs = this.debugLogs.slice(0, logsSize);
         }
      },
      pushAiLog (record: AiLog) {
         this.aiLogs.push(record);

         if (this.aiLogs.length > logsSize)
            this.aiLogs = this.aiLogs.slice(-logsSize); // keep the most recent
      },
      openConsole () {
         this.isConsoleOpen = true;
         this.consoleHeight = 250;
      },
      closeConsole () {
         this.isConsoleOpen = false;
         this.consoleHeight = 0;
      },
      resizeConsole (height: number) {
         if (height < 30)
            this.closeConsole();
         else
            this.consoleHeight = height;
      },
      toggleConsole () {
         if (this.isConsoleOpen)
            this.closeConsole();
         else
            this.openConsole();
      }
   }
});
