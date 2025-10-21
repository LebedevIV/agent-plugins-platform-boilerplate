import { createStorage, StorageEnum } from '../base/index.js';
import type { ChatAlignmentStateType, ChatAlignmentStorageType, ChatAlignment } from '../base/index.js';

const storage = createStorage<ChatAlignmentStateType>(
  'chat-alignment-storage-key',
  {
    alignment: 'left',
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const exampleChatAlignmentStorage: ChatAlignmentStorageType = {
  ...storage,
  setAlignment: async (alignment: ChatAlignment) => {
    await storage.set({ alignment });
  },
  getAlignment: async () => {
    const state = await storage.get();
    return state.alignment;
  },
};