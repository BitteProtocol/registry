import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Stringify an object and convert all bigint values to strings
 * @param object - The object to stringify
 * @returns A JSON stringified object with bigint values converted to strings
 */
export function toJson(object: unknown) {
  return JSON.stringify(object, (_key, value) =>
    typeof value === 'bigint'
        ? value.toString()
        : value
  );
}