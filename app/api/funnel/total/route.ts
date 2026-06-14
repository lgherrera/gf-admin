// app/api/funnel/total/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getDateRange(range: string): { since: string; until?: string } | null {
  if (range === 'all') return null;

  if (range === '1') {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return { since: yesterday.toISOString(), until: today.toISOString() };
  }

  const days = range === '7' ? 7 : range === '14' ? 14 : range === '30' ? 30 : null;
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return { since: d.toISOString() };
}

export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password');
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const range = req.nextUrl.searchParams.get('range') || 'all';
  const dateRange = getDateRange(range);

  try {
    const queries = [
      { table: 'groobyte_callbacks', dateCol: 'received_at' },
      { table: 'user_profiles', dateCol: 'created_at' },
      { table: 'homepage_visits', dateCol: 'created_at' },
      { table: 'chat_visits', dateCol: 'created_at' },
    ].map(({ table, dateCol }) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (dateRange) {
        q = q.gte(dateCol, dateRange.since);
        if (dateRange.until) q = q.lt(dateCol, dateRange.until);
      }
      return q;
    });

    const [middleware, profiles, homepage, chat] = await Promise.all(queries);

    const steps = [
      { label: 'Middleware', description: 'Total Users at Middleware', count: middleware.count ?? 0 },
      { label: 'Profiles', description: 'Total New Users at Profiles', count: profiles.count ?? 0 },
      { label: 'Home Page', description: 'Total Users at Home Page', count: homepage.count ?? 0 },
      { label: 'Chat', description: 'Total Users at Chat Pages', count: chat.count ?? 0 },
    ];

    return NextResponse.json({ steps });
  } catch (error) {
    console.error('Funnel error:', error);
    return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 });
  }
}