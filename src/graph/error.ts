/**
 * Structured Graph API error type and parser.
 */

export interface GraphApiError {
  code: string;
  message: string;
  statusCode: number;
  innerError?: {
    code?: string;
    date?: string;
    requestId?: string;
    clientRequestId?: string;
  };
}

export class GraphError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly innerError?: GraphApiError["innerError"];

  constructor(error: GraphApiError) {
    super(error.message);
    this.name = "GraphError";
    this.code = error.code;
    this.statusCode = error.statusCode;
    this.innerError = error.innerError;
  }

  get isThrottled(): boolean {
    return this.statusCode === 429;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }
}

/**
 * Parse a Graph API error response body into a structured GraphError.
 */
export function parseGraphError(
  statusCode: number,
  body: unknown,
): GraphError {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as Record<string, unknown>).error === "object"
  ) {
    const err = (body as { error: Record<string, unknown> }).error;
    return new GraphError({
      code: (err.code as string) ?? "UnknownError",
      message: (err.message as string) ?? "An unknown error occurred",
      statusCode,
      innerError: err.innerError as GraphApiError["innerError"],
    });
  }

  // Fallback for non-standard error shapes
  return new GraphError({
    code: "UnknownError",
    message:
      typeof body === "string"
        ? body
        : `Graph API returned status ${statusCode}`,
    statusCode,
  });
}
