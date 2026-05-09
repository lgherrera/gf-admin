// app/api/metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password');
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Total users
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    // Total messages
    const { count: totalMessages } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true });

    // Active today (distinct users who messaged today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: activeData } = await supabase
      .from('chat_messages')
      .select('user_id')
      .gte('created_at', todayStart.toISOString());

    const activeToday = new Set(activeData?.map((r) => r.user_id)).size;

    // Average stage from user_progress
    const { data: stageData } = await supabase
      .from('user_progress')
      .select('stage');

    const avgStage =
      stageData && stageData.length > 0
        ? stageData.reduce((sum, r) => sum + (r.stage || 1), 0) / stageData.length
        : 0;

    // Messages per day — last 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: messagesRaw } = await supabase
      .from('chat_messages')
      .select('created_at')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    // Group by date
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = 0;
    }

    messagesRaw?.forEach((row) => {
      const key = new Date(row.created_at).toISOString().split('T')[0];
      if (dailyMap[key] !== undefined) {
        dailyMap[key]++;
      }
    });

    const messagesPerDay = Object.entries(dailyMap).map(([date, count]) => ({
      date,
      count,
    }));

    // Top girlfriends by message count
    const { data: gfMessages } = await supabase
      .from('chat_messages')
      .select('girlfriend_id');

    const gfCountMap: Record<string, number> = {};
    gfMessages?.forEach((r) => {
      gfCountMap[r.girlfriend_id] = (gfCountMap[r.girlfriend_id] || 0) + 1;
    });

    const { data: girlfriends } = await supabase
      .from('girlfriends')
      .select('id, name')
      .in('id', Object.keys(gfCountMap));

    const gfNameMap: Record<string, string> = {};
    girlfriends?.forEach((g) => {
      gfNameMap[g.id] = g.name;
    });

    const topGirlfriends = Object.entries(gfCountMap)
      .map(([id, count]) => ({ name: gfNameMap[id] || id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalMessages: totalMessages || 0,
      activeToday,
      avgStage: Math.round(avgStage * 10) / 10,
      messagesPerDay,
      topGirlfriends,
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}