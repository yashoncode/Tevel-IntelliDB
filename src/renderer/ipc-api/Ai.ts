import {
   ChatParams, ExplainSqlParams, GenerateSqlParams, GenerateSqlResult
} from 'common/interfaces/ai';
import { IpcResponse } from 'common/interfaces/antares';
import { ipcRenderer } from 'electron';

import { unproxify } from '../libs/unproxify';

export default class {
   static testConnection (params: ChatParams): Promise<IpcResponse<string>> {
      return ipcRenderer.invoke('ai:test-connection', unproxify(params));
   }

   static generateSql (params: GenerateSqlParams): Promise<IpcResponse<GenerateSqlResult>> {
      return ipcRenderer.invoke('ai:generate-sql', unproxify(params));
   }

   static chat (params: ChatParams): Promise<IpcResponse<string>> {
      return ipcRenderer.invoke('ai:chat', unproxify(params));
   }

   static explainSql (params: ExplainSqlParams): Promise<IpcResponse<string>> {
      return ipcRenderer.invoke('ai:explain-sql', unproxify(params));
   }
}
