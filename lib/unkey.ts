import { WithUnkeyConfig } from "@unkey/nextjs";
import { NextResponse } from "next/server";
import { ALLOW_EXTERNAL_REQUEST_HEADERS } from "@/lib/constants";

export const unkeyConfig: WithUnkeyConfig = {
  apiId: process.env.UNKEY_API_ID,
  onError: (_req, err) =>
    NextResponse.json(
      err
        ? {
            error:
              "Unkey error. If you’re using a make-agent version older than v0.1.0, make sure you update and get your new api key here https://key.bitte.ai",
            ...err,
          }
        : { error: "UNKNOWN_AUTH_ERROR" },
      {
        status: 500,
        headers: ALLOW_EXTERNAL_REQUEST_HEADERS,
      }
    ),
  handleInvalidKey: (_req, res) =>
    NextResponse.json(
      res
        ? {
            error:
              "Invalid key. If you’re using a make-agent version older than v0.1.0, make sure you update and get your new api key here https://key.bitte.ai",
            ...res,
          }
        : { error: "UNKNOWN_AUTH_ERROR" },
      {
        status: 403,
        headers: ALLOW_EXTERNAL_REQUEST_HEADERS,
      }
    ),
};
