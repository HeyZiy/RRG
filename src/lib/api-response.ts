import { NextResponse } from 'next/server';

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function apiServerError(message: string, error?: unknown) {
  if (error) {
    console.error(message, error);
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

export function parseIntField(value: unknown): number | null {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseNumberField(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
