import { NextRequest, NextResponse } from 'next/server';
import { saveGeneratedQuestions } from '@/services/question-bank.service';

/**
 * Webhook called by FastAPI after question generation completes.
 * Secured by X-Internal-Key header.
 */
export async function POST(req: NextRequest, { params }: { params: { bankId: string } }) {
  const key = req.headers.get('X-Internal-Key');
  if (!key || key !== process.env.NEXTJS_API_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { sourceDocId, questions = [], error } = body;

    if (!sourceDocId) {
      return NextResponse.json({ success: false, error: 'Missing sourceDocId' }, { status: 400 });
    }

    const result = await saveGeneratedQuestions(params.bankId, sourceDocId, questions, error);
    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
