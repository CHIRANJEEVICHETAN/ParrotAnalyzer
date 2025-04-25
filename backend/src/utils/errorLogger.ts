import { pool } from "../config/database";

export async function logError(
  service: string,
  errorType: string,
  message: string,
  userId?: number,
  metadata?: any,
  stackTrace?: string
): Promise<void> {
  try {
    // Ensure we always have a valid timestamp
    const timestamp = new Date();

    await pool.query(
      `INSERT INTO error_logs 
       (timestamp, service, error_type, message, user_id, metadata, stack_trace) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        timestamp,
        service,
        errorType,
        message,
        userId || null,
        metadata ? JSON.stringify(metadata) : null,
        stackTrace || null,
      ]
    );
  } catch (loggingError) {
    // Don't throw here - just console log the error to avoid crash cycles
    console.error("Failed to log error to database:", loggingError);
    console.error("Original error:", {
      service,
      errorType,
      message,
      userId,
      metadata,
    });
  }
}

// Helper function to log specific types of errors with standard format
export function logLocationError(
  error: any,
  userId?: number,
  locationData?: any
): void {
  const errorType = error?.code || "UnknownError";
  const message = error?.message || String(error);
  const stackTrace = error?.stack;

  logError(
    "LocationUpdate",
    errorType,
    message,
    userId,
    { locationData },
    stackTrace
  );
}

export function logGeofenceError(
  error: any,
  userId?: number,
  geofenceData?: any
): void {
  const errorType = error?.code || "UnknownError";
  const message = error?.message || String(error);
  const stackTrace = error?.stack;

  logError(
    "GeofenceProcessing",
    errorType,
    message,
    userId,
    { geofenceData },
    stackTrace
  );
}

export function logSocketError(
  error: any,
  userId?: number,
  socketData?: any
): void {
  const errorType = error?.code || "UnknownError";
  const message = error?.message || String(error);
  const stackTrace = error?.stack;

  logError(
    "SocketConnection",
    errorType,
    message,
    userId,
    { socketData },
    stackTrace
  );
}
