import type { ExcludeValuesFromBaseArrayType } from './types.js';

export const excludeValuesFromBaseArray = <B extends string[], E extends (string | number)[]>(
  baseArray: B,
  excludeArray: E,
) => baseArray.filter(value => !excludeArray.includes(value)) as ExcludeValuesFromBaseArrayType<B, E>;

export const sleep = async (time: number) => new Promise(r => setTimeout(r, time));

/**
 * Унифицированное получение pageKey из URL страницы.
 * Удаляет search/hash, возвращает нормализованный URL или 'unknown-page'.
 */
export const getPageKey = function (currentTabUrl: string | null): string {
  if (!currentTabUrl) return 'unknown-page';
  try {
    const url = new URL(currentTabUrl);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return currentTabUrl;
  }
};
