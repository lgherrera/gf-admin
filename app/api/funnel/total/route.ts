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
  const rating = req.nextUrl.searchParams.get('rating') || 'all';
  const dateRange = getDateRange(range);

  try {
    // Helper: build a count query with date + rating filters
    function buildQuery(table: string, dateCol: string) {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (dateRange) {
        q = q.gte(dateCol, dateRange.since);
        if (dateRange.until) q = q.lt(dateCol, dateRange.until);
      }
      if (rating !== 'all') {
        q = q.eq('content_rating', rating);
      }
      return q;
    }

    // Helper: count page_visits for a specific page value
    function buildPageQuery(page: string) {
      let q = supabase.from('page_visits').select('*', { count: 'exact', head: true }).eq('page', page);
      if (dateRange) {
        q = q.gte('created_at', dateRange.since);
        if (dateRange.until) q = q.lt('created_at', dateRange.until);
      }
      if (rating !== 'all') {
        q = q.eq('content_rating', rating);
      }
      return q;
    }

    const [middleware, profiles, homepage, chat, create, shorts, renderImage] = await Promise.all([
      buildQuery('groobyte_callbacks', 'received_at'),
      buildQuery('user_profiles', 'created_at'),
      buildQuery('homepage_visits', 'created_at'),
      buildQuery('chat_visits', 'created_at'),
      buildPageQuery('create'),
      buildPageQuery('shorts'),
      buildPageQuery('render_image'),
    ]);

    const steps = [
      { label: 'Middleware', description: 'Total Users at Middleware', count: middleware.count ?? 0, indent: false },
      { label: 'Profiles', description: 'Total New Users at Profiles', count: profiles.count ?? 0, indent: false },
      { label: 'Home Page', description: 'Total Users at Home Page', count: homepage.count ?? 0, indent: false },
      { label: 'Chat', description: 'Total Users at Chat Pages', count: chat.count ?? 0, indent: true },
      { label: 'Create', description: 'Total Users at Create Page', count: create.count ?? 0, indent: true },
      { label: 'Shorts', description: 'Total Users at Shorts Pages', count: shorts.count ?? 0, indent: true },
      { label: 'Render Image', description: 'Total Users at Render Image', count: renderImage.count ?? 0, indent: true },
    ];

    return NextResponse.json({ steps, serverTime: new Date().toISOString() });
  } catch (error) {
    console.error('Funnel error:', error);
    return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 });
  }
}