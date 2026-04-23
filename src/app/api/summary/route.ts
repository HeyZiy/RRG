import { NextResponse } from 'next/server';
import { summaryService } from '@/server/services/summary.service';
import { apiServerError } from '@/lib/api-response';

export async function GET() {
  try {
    const summary = await summaryService.getSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return apiServerError('Failed to generate summary', error);
  }
}
