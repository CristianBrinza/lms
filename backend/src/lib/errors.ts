/** An error the API answers with as JSON: { error: { code, message, fields? } }. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: { fields?: Record<string, string>; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'AppError';
  }

  get fields() {
    return this.extra.fields;
  }

  get headers() {
    return this.extra.headers;
  }
}
