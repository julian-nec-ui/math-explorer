import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Combină clase Tailwind condiționale și rezolvă conflictele (ex. "px-2 px-4" → "px-4")
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
