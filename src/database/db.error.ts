import { BaseError } from "@/errors/base.error";
import type { BaseErrorDetails } from "@/errors/base.error";

export const DBErrorCode = {
  CONNECTION_FAILED: "DB_CONNECTION_FAILED",
  QUERY_FAILED: "DB_QUERY_FAILED",
  TRANSACTION_FAILED: "DB_TRANSACTION_FAILED",
  SCHEMA_MISMATCH: "DB_SCHEMA_MISMATCH",
  MIGRATION_FAILED: "DB_MIGRATION_FAILED",
  TABLE_NOT_FOUND: "DB_TABLE_NOT_FOUND",
  CONSTRAINT_VIOLATION: "DB_CONSTRAINT_VIOLATION",
  UNKNOWN_ERROR: "DB_UNKNOWN_ERROR",
} as const;

export type DBErrorCode = (typeof DBErrorCode)[keyof typeof DBErrorCode];

export interface DBErrorDetails extends BaseErrorDetails {
  code: DBErrorCode;
  query?: string;
  table?: string;
}

export class DBError extends BaseError {
  public readonly code: DBErrorCode;
  public readonly query?: string;
  public readonly table?: string;

  constructor(details: DBErrorDetails) {
    super(details);
    this.code = details.code;
    this.query = details.query;
    this.table = details.table;
  }

  static create(
    code: DBErrorCode,
    message: string,
    options?: {
      originalError?: Error;
      query?: string;
      table?: string;
      operation?: string;
    }
  ): DBError {
    return new DBError({
      code,
      message,
      originalError: options?.originalError,
      query: options?.query,
      table: options?.table,
      operation: options?.operation,
      timestamp: Date.now(),
    });
  }

  static connectionFailed(originalError?: Error): DBError {
    return DBError.create(
      DBErrorCode.CONNECTION_FAILED,
      "Database connection failed",
      { originalError, operation: "connect" }
    );
  }

  static queryFailed(query: string, originalError?: Error): DBError {
    return DBError.create(
      DBErrorCode.QUERY_FAILED,
      `Database query failed: ${query}`,
      { originalError, query, operation: "query" }
    );
  }

  static transactionFailed(message: string, originalError?: Error): DBError {
    return DBError.create(
      DBErrorCode.TRANSACTION_FAILED,
      `Transaction failed: ${message}`,
      { originalError, operation: "transaction" }
    );
  }

  static schemaMismatch(message: string, originalError?: Error): DBError {
    return DBError.create(
      DBErrorCode.SCHEMA_MISMATCH,
      `Schema mismatch: ${message}`,
      { originalError, operation: "schema_check" }
    );
  }

  static migrationFailed(message: string, originalError?: Error): DBError {
    return DBError.create(
      DBErrorCode.MIGRATION_FAILED,
      `Migration failed: ${message}`,
      { originalError, operation: "migrate" }
    );
  }

  static tableNotFound(table: string): DBError {
    return DBError.create(
      DBErrorCode.TABLE_NOT_FOUND,
      `Table not found: ${table}`,
      { table, operation: "table_access" }
    );
  }

  static constraintViolation(message: string, originalError?: Error): DBError {
    return DBError.create(
      DBErrorCode.CONSTRAINT_VIOLATION,
      `Constraint violation: ${message}`,
      { originalError, operation: "constraint_check" }
    );
  }

  static unknownError(message: string, originalError?: Error): DBError {
    return DBError.create(
      DBErrorCode.UNKNOWN_ERROR,
      `Unknown database error: ${message}`,
      { originalError, operation: "unknown" }
    );
  }

  toJSON(): object {
    const base = super.toJSON();
    return {
      ...base,
      query: this.query,
      table: this.table,
    };
  }
}

export function isDBError(error: unknown): error is DBError {
  return error instanceof DBError;
}

export function getDBErrorCode(error: unknown): DBErrorCode | null {
  if (isDBError(error)) {
    return error.code;
  }
  return null;
}

export function getDBErrorMessage(error: unknown): string {
  if (isDBError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error == null) {
    return "Unknown error";
  }
  return String(error);
}