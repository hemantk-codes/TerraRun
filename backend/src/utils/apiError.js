// Thrown from controllers, caught by Express and handed to the centralized
// error handler already set up in app.js (which reads err.status/err.message).
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
