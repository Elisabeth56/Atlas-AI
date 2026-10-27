// The API's error shape and what the UI does with each kind of failure.

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Turns a failed response into an ApiError, falling back to a plain message for non-JSON bodies. */
export async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error?.code) {
      return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
    }
  } catch {
    // not JSON: a proxy or cold-start page
  }
  return new ApiError(res.status, "http_error", "Atlas didn’t respond as expected. Try again in a moment.");
}

export type ErrorAction = "inline" | "refresh" | "retry" | "sign_in";

/** How the UI should respond to an error code. */
export function actionFor(error: ApiError): ErrorAction {
  if (error.status === 401) return "sign_in";
  if (error.code === "invalid_input") return "inline";
  if (error.code === "checkpoint_conflict") return "refresh";
  return "retry";
}
