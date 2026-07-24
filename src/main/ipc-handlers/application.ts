import { app, dialog, ipcMain, safeStorage } from 'electron';
import * as Store from 'electron-store';
import * as fs from 'fs';

import { validateSender } from '../libs/misc/validateSender';
import { ShortcutRegister } from '../libs/ShortcutRegister';

export default () => {
   ipcMain.on('close-app', (event) => {
      if (!validateSender(event.senderFrame)) {
         return {
            status: 'error',
            response: 'Unauthorized process'
         };
      }
      app.exit();
   });

   ipcMain.on('set-key', (event, key) => {
      const sessionStore = new Store({
         name: 'session',
         fileExtension: ''
      });

      if (safeStorage.isEncryptionAvailable())
         sessionStore.set('key', safeStorage.encryptString(key));
      else {
         // safeStorage unavailable (e.g. Flatpak/Linux): persist the key as plain text
         // in the same session store so it survives restarts and extra windows. Without
         // this the key regenerated each time and clearInvalidConfig wiped the encrypted
         // connections file — permanent data loss. Same file-system protection either way.
         sessionStore.set('key', key);
      }

      event.returnValue = true;
   });

   ipcMain.on('get-key', (event) => {
      const sessionStore = new Store({
         name: 'session',
         fileExtension: ''
      });

      const stored = sessionStore.get('key');
      if (stored === undefined || stored === null) {
         event.returnValue = false;
         return;
      }

      // Try to decrypt (key was stored encrypted). If safeStorage is unavailable or the
      // value was stored as plain text, decryption throws — fall back to the raw value.
      if (safeStorage.isEncryptionAvailable()) {
         try {
            event.returnValue = safeStorage.decryptString(Buffer.from(stored as string, 'utf-8'));
            return;
         }
         catch (error) { /* not an encrypted value — fall through to the raw read */ }
      }

      event.returnValue = typeof stored === 'string' ? stored : false;
   });

   ipcMain.handle('show-open-dialog', (event, options) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      return dialog.showOpenDialog(options);
   });

   ipcMain.handle('show-save-dialog', (event, options) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      return dialog.showSaveDialog(options);
   });

   ipcMain.handle('get-download-dir-path', (event) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      return app.getPath('downloads');
   });

   ipcMain.handle('resotre-default-shortcuts', (event) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      const shortCutRegister = ShortcutRegister.getInstance();
      shortCutRegister.restoreDefaults();
   });

   ipcMain.handle('reload-shortcuts', (event) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      const shortCutRegister = ShortcutRegister.getInstance();
      shortCutRegister.reload();
   });

   ipcMain.handle('update-shortcuts', (event, shortcuts) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      const shortCutRegister = ShortcutRegister.getInstance();
      shortCutRegister.updateShortcuts(shortcuts);
   });

   ipcMain.handle('unregister-shortcuts', (event) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      const shortCutRegister = ShortcutRegister.getInstance();
      shortCutRegister.unregister();
   });

   ipcMain.handle('read-file', (event, { filePath, encoding }) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      try {
         const content = fs.readFileSync(filePath, encoding);
         return content;
      }
      catch (error) {
         return { status: 'error', response: error.toString() };
      }
   });

   ipcMain.handle('write-file', (event, filePath, content) => {
      if (!validateSender(event.senderFrame)) return { status: 'error', response: 'Unauthorized process' };
      try {
         fs.writeFileSync(filePath, content, 'utf-8');
         return { status: 'success' };
      }
      catch (error) {
         return { status: 'error', response: error.toString() };
      }
   });
};
