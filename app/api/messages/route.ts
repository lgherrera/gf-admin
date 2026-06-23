// app/api/messages/route.ts

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

  try {
    let query = supabase
      .from('chat_messages')
      .select('id, user_id, girlfriend_id, role, content, created_at, content_rating', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (rating === 'nsfw') {
      query = query.eq('content_rating', 'nsfw');
    } else if (rating === 'sfw') {
      query = query.eq('content_rating', 'sfw');
    }

    const { data: messages, count } = await query.range(offset, offset + limit - 1);

    // Get unique girlfriend IDs to resolve names
    const gfIds = [...new Set(messages?.map((m) => m.girlfriend_id).filter(Boolean))];
    const { data: girlfriends } = await supabase
      .from('girlfriends')
      .select('id, name')
      .in('id', gfIds);

    const gfNameMap: Record<string, string> = {};
    girlfriends?.forEach((g) => {
      gfNameMap[g.id] = g.name;
    });

    // Get unique user IDs to resolve msisdn
    const userIds = [...new Set(messages?.map((m) => m.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('supabase_auth_id, name, msisdn')
      .in('supabase_auth_id', userIds);

    const profileMap: Record<string, { name: string | null; msisdn: string | null }> = {};
    profiles?.forEach((p) => {
      profileMap[p.supabase_auth_id] = { name: p.name, msisdn: p.msisdn };
    });

    const enriched = messages?.map((m) => ({
      id: m.id,
      time: m.created_at,
      user: profileMap[m.user_id]?.msisdn || profileMap[m.user_id]?.name || m.user_id?.slice(0, 8),
      character: gfNameMap[m.girlfriend_id] || m.girlfriend_id,
      role: m.role,
      content: m.content,
      content_rating: m.content_rating,
    }));

    return NextResponse.json({
      messages: enriched || [],
      total: count || 0,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}