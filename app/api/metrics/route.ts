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

    // Custom girlfriends count
    // TODO: adjust filter if column name differs (e.g. is_custom, created_by, etc.)
    const { count: customGirlfriends } = await supabase
      .from('girlfriends')
      .select('*', { count: 'exact', head: true })
      .eq('girlfriend_type', 'custom');

    // Messages per day — last 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: messagesRaw } = await supabase
      .from('chat_messages')
      .select('created_at')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .order('created_at', { ascending: true });

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

    // New users per day — last 14 days
    const { data: usersRaw } = await supabase
      .from('user_profiles')
      .select('created_at')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    const usersMap: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().split('T')[0];
      usersMap[key] = 0;
    }

    usersRaw?.forEach((row) => {
      const key = new Date(row.created_at).toISOString().split('T')[0];
      if (usersMap[key] !== undefined) {
        usersMap[key]++;
      }
    });

    const usersPerDay = Object.entries(usersMap).map(([date, count]) => ({
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

    // Top users by message count with phone
    const { data: userMessages } = await supabase
      .from('chat_messages')
      .select('user_id');

    const userCountMap: Record<string, number> = {};
    userMessages?.forEach((r) => {
      userCountMap[r.user_id] = (userCountMap[r.user_id] || 0) + 1;
    });

    const topUserIds = Object.entries(userCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('supabase_auth_id, name, msisdn')
      .in('supabase_auth_id', topUserIds.map(([id]) => id));

    const profileMap: Record<string, { name: string | null; msisdn: string | null }> = {};
    userProfiles?.forEach((p) => {
      profileMap[p.supabase_auth_id] = { name: p.name, msisdn: p.msisdn };
    });

    const topUsers = topUserIds.map(([id, count]) => ({
      userId: id,
      name: profileMap[id]?.name || null,
      msisdn: profileMap[id]?.msisdn || null,
      count,
    }));

    // Generated images per day — last 14 days
    const { data: imagesRaw } = await supabase
      .from('generated_images')
      .select('created_at')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    const imagesMap: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().split('T')[0];
      imagesMap[key] = 0;
    }

    imagesRaw?.forEach((row) => {
      const key = new Date(row.created_at).toISOString().split('T')[0];
      if (imagesMap[key] !== undefined) {
        imagesMap[key]++;
      }
    });

    const imagesPerDay = Object.entries(imagesMap).map(([date, count]) => ({
      date,
      count,
    }));

    // Total generated images
    const { count: totalImages } = await supabase
      .from('generated_images')
      .select('*', { count: 'exact', head: true });

    // Top generators by image count with phone
    const { data: genImages } = await supabase
      .from('generated_images')
      .select('user_id');

    const genCountMap: Record<string, number> = {};
    genImages?.forEach((r) => {
      genCountMap[r.user_id] = (genCountMap[r.user_id] || 0) + 1;
    });

    const topGenIds = Object.entries(genCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Fetch profiles for generators (reuse existing profiles where possible)
    const allGenIds = topGenIds.map(([id]) => id);
    const missingGenIds = allGenIds.filter((id) => !profileMap[id]);

    if (missingGenIds.length > 0) {
      const { data: genProfiles } = await supabase
        .from('user_profiles')
        .select('supabase_auth_id, name, msisdn')
        .in('supabase_auth_id', missingGenIds);

      genProfiles?.forEach((p) => {
        profileMap[p.supabase_auth_id] = { name: p.name, msisdn: p.msisdn };
      });
    }

    const topGenerators = topGenIds.map(([id, count]) => ({
      userId: id,
      name: profileMap[id]?.name || null,
      msisdn: profileMap[id]?.msisdn || null,
      count,
    }));

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalMessages: totalMessages || 0,
      totalImages: totalImages || 0,
      activeToday,
      customGirlfriends: customGirlfriends || 0,
      messagesPerDay,
      imagesPerDay,
      usersPerDay,
      topGirlfriends,
      topGenerators,
      topUsers,
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}