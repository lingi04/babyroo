// Google request URLs contain purchase tokens. Never log the error object,
// request configuration, free-form message, response body, or headers.
type Fields = Record<string, string | number | undefined>;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function allowed(value: unknown, values: readonly string[]) {
  return typeof value === "string" && values.includes(value)
    ? value
    : undefined;
}

export function googlePlayErrorFields(error: unknown): Fields {
  const source = record(error);
  const response = record(source.response);
  const data = record(response.data);
  const googleError = record(data.error);
  const firstReason = Array.isArray(googleError.errors)
    ? record(googleError.errors[0]).reason
    : undefined;
  const details = Array.isArray(googleError.details) ? googleError.details : [];
  const detailReason = details
    .map((item) =>
      allowed(record(item).reason, [
        "SERVICE_DISABLED",
        "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
        "IAM_PERMISSION_DENIED",
        "CONSUMER_INVALID",
        "SERVICE_NOT_VISIBLE",
      ])
    )
    .find((reason) => reason !== undefined);
  const status = response.status ?? source.status;

  return {
    errorType: error instanceof Error ? "Error" : "UnknownError",
    httpStatus:
      typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 100 &&
      status <= 599
        ? status
        : undefined,
    googleStatus: allowed(googleError.status, [
      "UNAUTHENTICATED",
      "PERMISSION_DENIED",
      "NOT_FOUND",
      "INVALID_ARGUMENT",
      "FAILED_PRECONDITION",
      "RESOURCE_EXHAUSTED",
      "INTERNAL",
      "UNAVAILABLE",
      "DEADLINE_EXCEEDED",
    ]),
    googleReason:
      detailReason ??
      allowed(firstReason, [
        "accessNotConfigured",
        "permissionDenied",
        "insufficientPermissions",
        "authError",
        "forbidden",
        "notFound",
        "invalid",
        "invalidParameter",
        "purchaseTokenMismatch",
        "productNotOwnedByUser",
        "rateLimitExceeded",
        "userRateLimitExceeded",
        "backendError",
      ]),
    authError: allowed(data.error, [
      "invalid_grant",
      "invalid_client",
      "unauthorized_client",
      "invalid_scope",
    ]),
    networkCode: allowed(source.code, [
      "ENOTFOUND",
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      "EAI_AGAIN",
      "ERR_NETWORK",
      "ERR_INVALID_URL",
    ]),
  };
}
