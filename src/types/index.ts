import { UserRole } from "@prisma/client";

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface StockCheckResult {
  available: number;
  sufficient: boolean;
}

export interface KarigarPaymentCalc {
  rate: number;
  pieces: number;
  amountDue: number;
}

export interface LedgerEntryParams {
  partyId: string;
  description: string;
  referenceType: string;
  referenceId: string;
  debitAmount: number;
  creditAmount: number;
}

export interface SuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

export interface ErrorBody {
  success: false;
  message: string;
  code: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      requestId?: string;
    }
  }
}

export {};
