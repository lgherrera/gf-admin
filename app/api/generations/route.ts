// app/api/generations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password');
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');
  const rating = req.nextUrl.searchParams.get('rating') || 'all';
  const limit = 50;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyRating = (q: any) => {
    if (rating === 'nsfw') return q.eq('content_rating', 'nsfw');
    if (rating === 'sfw') return q.eq('content_rating', 'sfw');
    return q;
  };

  try {
    let query = supabase
      .from('generated_images')
      .select('id, user_id, girlfriend_id, prompt, created_at, content_rating, status', { count: 'exact' })
      .order('created_at', { ascending: false });

    query = applyRating(query);

    const { data: images, count } = await query.range(offset, offset + limit - 1);

    // Only compute the status stat cards on the first page load
    let stats: { total: number; saved: number; censored: number; trashed: number } | null = null;
    if (offset === 0) {
      const countByStatus = async (status?: string) => {
        let q = supabase
          .from('generated_images')
          .select('*', { count: 'exact', head: true });
        q = applyRating(q);
        if (status) q = q.eq('status', status);
        const { count: c } = await q;
        return c || 0;
      };

      const [saved, censored, trashed] = await Promise.all([
        countByStatus('saved'),
        countByStatus('censored'),
        countByStatus('trashed'),
      ]);

      stats = { total: count || 0, saved, censored, trashed };
    }

    // Get unique girlfriend IDs to resolve names
    const gfIds = [...new Set(images?.map((m) => m.girlfriend_id).filter(Boolean))];
    const { data: girlfriends } = await supabase
      .from('girlfriends')
      .select('id, name')
      .in('id', gfIds);

    const gfNameMap: Record<string, string> = {};
    girlfriends?.forEach((g) => {
      gfNameMap[g.id] = g.name;
    });

    // Get unique user IDs to resolve msisdn
    const userIds = [...new Set(images?.map((m) => m.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('supabase_auth_id, name, msisdn')
      .in('supabase_auth_id', userIds);

    const profileMap: Record<string, { name: string | null; msisdn: string | null }> = {};
    profiles?.forEach((p) => {
      profileMap[p.supabase_auth_id] = { name: p.name, msisdn: p.msisdn };
    });

    const enriched = images?.map((m) => ({
      id: m.id,
      time: m.created_at,
      user: profileMap[m.user_id]?.msisdn || profileMap[m.user_id]?.name || m.user_id?.slice(0, 8),
      character: gfNameMap[m.girlfriend_id] || m.girlfriend_id,
      status: m.status,
      prompt: m.prompt,
    }));

    return NextResponse.json({
      generations: enriched || [],
      total: count || 0,
      stats,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Generations error:', error);
    return NextResponse.json({ error: 'Failed to fetch generations' }, { status: 500 });
  }
}