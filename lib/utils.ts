import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { NextRequest } from "next/server";

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

export const getBaseUrl = (req: NextRequest | Request) => {
  const host = req.headers.get("host");
  const protocol =
    req.headers.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const baseUrl = `${protocol}://${host}`;

  return baseUrl;
};
