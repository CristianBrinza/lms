import { api } from '@/services/api/client';

/** /api/assistant: the in-app Claude (admins only for now). The server queues, a bridge answers. */

export type Mode = 'assistant' | 'developer';
export type MessageStatus = 'queued' | 'running' | 'done' | 'failed' | 'stopped';
export type AttachmentKind = 'image' | 'audio' | 'file';

export interface Thread {
  id: string;
  title: string;
  mode: Mode;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentRef {
  id: string;
  kind: AttachmentKind;
  mime: string;
  name: string;
  url: string;
}

export interface AssistantMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  text: string;
  status: MessageStatus;
  steps: string[];
  error: string;
  stopRequested: boolean;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentRef[];
}

export interface Transcript {
  status: '' | 'queued' | 'running' | 'done' | 'failed';
  text: string;
  error: string;
}

export const assistantKeys = {
  all: ['assistant'] as const,
  threads: ['assistant', 'threads'] as const,
  messages: (threadId: string) => ['assistant', 'messages', threadId] as const,
};

/** A reply the bridge hasn't finished: the app keeps asking until it has. */
export const isBusy = (messages: readonly AssistantMessage[]) =>
  messages.some((m) => m.role === 'assistant' && (m.status === 'queued' || m.status === 'running'));

export const assistantApi = {
  threads: () => api.get<{ threads: Thread[] }>('/assistant/threads').then((r) => r.threads),
  createThread: (mode: Mode) =>
    api.post<{ thread: Thread }>('/assistant/threads', { mode }).then((r) => r.thread),
  setMode: (id: string, mode: Mode) =>
    api.patch<{ thread: Thread }>(`/assistant/threads/${id}`, { mode }).then((r) => r.thread),
  messages: (id: string) =>
    api.get<{ thread: Thread; messages: AssistantMessage[] }>(`/assistant/threads/${id}/messages`),
  send: (id: string, text: string, attachmentIds: string[]) =>
    api.post<{ replyId: string }>(`/assistant/threads/${id}/messages`, { text, attachmentIds }),
  stop: (messageId: string) => api.post<void>(`/assistant/messages/${messageId}/stop`),
  upload: (input: {
    kind: AttachmentKind;
    name: string;
    mime: string;
    data: string;
    durationSec?: number;
  }) => api.post<{ attachment: AttachmentRef }>('/assistant/attachments', input).then((r) => r.attachment),
  removeAttachment: (id: string) => api.delete<void>(`/assistant/attachments/${id}`),
  /** Waits on the server for up to 90 s; a 202 answer comes back as status queued/running. */
  transcribe: (attachmentId: string) =>
    api.post<Transcript>('/assistant/transcribe', { attachmentId }),
  transcript: (attachmentId: string) =>
    api.get<Transcript>(`/assistant/attachments/${attachmentId}/transcript`),
};
