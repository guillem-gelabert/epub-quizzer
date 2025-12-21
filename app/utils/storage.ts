// Simple localStorage wrapper utilities

export function saveToLocalStorage<T>(key: string, value: T): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }
}

export function loadFromLocalStorage<T>(key: string): T | null {
  if (typeof window !== "undefined") {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      return null;
    }
  }
  return null;
}

export function removeFromLocalStorage(key: string): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Failed to remove from localStorage:", error);
    }
  }
}
