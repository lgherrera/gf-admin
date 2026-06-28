// app/api/characters/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface LeaderboardRow {
  girlfriend_id: string;
  name: string;
  slug: string;
  avatar: string | null;
  girlfriend_type: string;
  content_rating: string | null;
  created_by: string | null;
  visits: number;
  messages: number;
}

export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password');
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = req.nextUrl.searchParams;

    // ── Range → cutoff (matches dashboard: '7' | '14' | '30' | 'all') ──
    const rangeParam = params.get('range') || 'all';
    const days = rangeParam === 'all' ? null : parseInt(rangeParam) || null;

    let cutoffDate: string | null = null;
    if (days) {
      const d = new Date();
      d.setDate(d.getDate() - days);
      cutoffDate = d.toISOString();
    }

    // ── Filters ──
    const typeParam = params.get('type');
    const ratingParam = params.get('rating');
    const sortParam = params.get('sort') === 'messages' ? 'messages' : 'visits';

    const p_type = typeParam === 'standard' || typeParam === 'custom' ? typeParam : null;
    const p_rating = ratingParam === 'sfw' || ratingParam === 'nsfw' ? ratingParam : null;

    const { data, error } = await supabase.rpc('get_character_leaderboard', {
      p_cutoff: cutoffDate,
      p_type,
      p_rating,
      p_sort: sortParam,
    });

    if (error) {
      console.error('characters leaderboard error:', error);
      return NextResponse.json({ error: 'Failed to load characters' }, { status: 500 });
    }

    const rows = (data as LeaderboardRow[] | null) || [];
    const characters = rows.map((row) => ({
      id: row.girlfriend_id,
      name: row.name,
      slug: row.slug,
      avatar: row.avatar,
      type: row.girlfriend_type,
      rating: row.content_rating,
      createdBy: row.created_by,
      visits: Number(row.visits) || 0,
      messages: Number(row.messages) || 0,
    }));

    return NextResponse.json({ characters });
  } catch (err) {
    console.error('characters route error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}