import { ApiReference } from "@scalar/nextjs-api-reference";
import { openApiSpec } from "@/lib/openapi";

const config = {
  spec: {
    content: openApiSpec,
  },
};

export const GET = ApiReference(config);
