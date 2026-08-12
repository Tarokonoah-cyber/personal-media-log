export function readStorageItem(key: string) {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readStorageEnum<T extends string>(key: string, values: readonly T[], fallback: T): T {
  const value = readStorageItem(key);
  return value && values.includes(value as T) ? value as T : fallback;
}

export function writeStorageItem(key: string, value: string) {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorageItem(key: string) {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
