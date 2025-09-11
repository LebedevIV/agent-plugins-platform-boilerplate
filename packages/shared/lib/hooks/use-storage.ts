// ВРЕМЕННАЯ ЗАГЛУШКА для обхода ошибки Rollup с useRef/useSyncExternalStore
// export const useStorage = (storage) => { ...оригинал... }
export const useStorage = (storage?: any) => ({ isLight: true, toggle: () => {} });
