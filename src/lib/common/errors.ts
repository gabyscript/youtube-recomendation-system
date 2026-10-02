/** YouTube cannot be used right now (quota exhausted or OAuth refresh token rejected). */
export class ServiceUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ServiceUnavailableError";
  }
}
