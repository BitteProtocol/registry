export const errorString = (error: unknown): string => {
  // intentional == to check for null or undefined
  if (error == null) {
    return "unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return JSON.stringify(error);
};

export const getErrorMsg = (error: unknown): string => {
  if (error === undefined) {
    return "Undefined Error";
  }
  return error instanceof Error ? error.message : JSON.stringify(error);
};
