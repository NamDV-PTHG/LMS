import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { rateAsset } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';
import { z } from 'zod';
import { ValidationError } from '@/lib/errors';

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const POST = withAuth(async (req, { params, user }) => {
  try {
    const body = await req.json();
    const parsed = ratingSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

    const result = await rateAsset(params!.id, user.id, parsed.data.rating, parsed.data.comment);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
});
