import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '@/lib/errors';

/**
 * Global API error handler.
 * Maps known error types to appropriate HTTP responses.
 */
export function handleApiError(err: unknown): NextResponse {
  // Custom AppError (includes all subclasses)
  if (err instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        code: err.code,
        ...(err.details !== undefined && { details: err.details }),
      },
      { status: err.statusCode },
    );
  }

  // Zod validation error
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: 'Dữ liệu đầu vào không hợp lệ',
        code: 'VALIDATION_ERROR',
        details: err.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          error: 'Dữ liệu đã tồn tại',
          code: 'CONFLICT',
        },
        { status: 409 },
      );
    }

    if (err.code === 'P2025') {
      return NextResponse.json(
        {
          success: false,
          error: 'Không tìm thấy bản ghi',
          code: 'NOT_FOUND',
        },
        { status: 404 },
      );
    }
  }

  // Unknown / unhandled error
  console.error('[API Error]', err);

  return NextResponse.json(
    {
      success: false,
      error: 'Lỗi hệ thống. Vui lòng thử lại sau.',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 },
  );
}

/**
 * Convenience: wrap an async route handler with automatic error handling.
 */
export function withErrorHandler<T extends unknown[]>(
  fn: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      return handleApiError(err);
    }
  };
}
