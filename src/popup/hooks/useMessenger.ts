import { ExtensionMessage, ExtensionResponse } from '../../types';

const RECEIVING_END_ERROR = 'Receiving end does not exist';

function sanitizeErrorMessage(msg?: string): string {
  if (msg?.includes(RECEIVING_END_ERROR)) {
    return 'Extension background worker is unavailable. Reload the extension and try again.';
  }
  return msg ?? 'Background worker did not respond.';
}

export function sendBackgroundMessage<T = unknown>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let completed = false;

    const handleResult = (res?: ExtensionResponse<T>) => {
      if (completed) return;
      completed = true;

      const lastError = chrome.runtime.lastError;
      if (lastError !== undefined) {
        reject(new Error(sanitizeErrorMessage(lastError.message)));
        return;
      }

      if (res?.ok) {
        resolve(res.data as T);
        return;
      }

      reject(new Error(sanitizeErrorMessage(res?.error)));
    };

    try {
      const maybePromise = chrome.runtime.sendMessage(message, handleResult);
      if (
        typeof maybePromise === 'object' &&
        maybePromise !== null &&
        'then' in maybePromise &&
        typeof (maybePromise as Promise<any>).then === 'function'
      ) {
        (maybePromise as Promise<ExtensionResponse<T>>).then(handleResult, (err: any) => {
          if (!completed) {
            completed = true;
            reject(new Error(sanitizeErrorMessage(err instanceof Error ? err.message : undefined)));
          }
        });
      }
    } catch (err: any) {
      if (!completed) {
        completed = true;
        reject(new Error(sanitizeErrorMessage(err instanceof Error ? err.message : undefined)));
      }
    }
  });
}
