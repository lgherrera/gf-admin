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
    // Parse range param: 7, 14, 30, or "all"
    const rangeParam = req.nextUrl.searchParams.get('range') || '14';
    const isAllTime = rangeParam === 'all';
    const days = isAllTime ? null : parseInt(rangeParam) || 14;

    // Compute cutoff date (null for all-time)
    let cutoffDate: string | null = null;
    if (days) {
      const d = new Date();
      d.setDate(d.getDate() - days);
      cutoffDate = d.toISOString();
    }

    // ── Stat cards (always all-time) ──

    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: totalMessages } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true });

    const { count: totalImages } = await supabase
      .from('generated_images')
      .select('*', { count: 'exact', head: true });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: activeData } = await supabase
      .from('chat_messages')
      .select('user_id')
      .gte('created_at', todayStart.toISOString());

    const activeToday = new Set(activeData?.map((r) => r.user_id)).size;

    const { count: customGirlfriends } = await supabase
      .from('girlfriends')
      .select('*', { count: 'exact', head: true })
      .eq('girlfriend_type', 'custom');

    // ── Helper: build daily map for chart data ──
    function buildDailyMap(numDays: number): Record<string, number> {
      const map: Record<string, number> = {};
      for (let i = 0; i < numDays; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (numDays - 1 - i));
        map[d.toISOString().split('T')[0]] = 0;
      }
      return map;
    }

    function buildDailyMapFromRange(earliest: string, latest: string): Record<string, number> {
      const map: Record<string, number> = {};
      const start = new Date(earliest);
      const end = new Date(latest);
      // Include today even if latest is in the past
      const realEnd = new Date(Math.max(end.getTime(), Date.now()));
      const d = new Date(start);
      while (d <= realEnd) {
        map[d.toISOString().split('T')[0]] = 0;
        d.setDate(d.getDate() + 1);
      }
      return map;
    }

    function fillMap(
      map: Record<string, number>,
      rows: { created_at: string }[] | null
    ): { date: string; count: number }[] {
      rows?.forEach((row) => {
        const key = new Date(row.created_at).toISOString().split('T')[0];
        if (map[key] !== undefined) {
          map[key]++;
        }
      });
      return Object.entries(map).map(([date, count]) => ({ date, count }));
    }

    // ── Active users per day (distinct user_id per day) ──
    let activeQuery = supabase
      .from('chat_messages')
      .select('user_id, created_at')
      .order('created_at', { ascending: true });
    if (cutoffDate) activeQuery = activeQuery.gte('created_at', cutoffDate);

    const { data: activeRaw } = await activeQuery;

    // Build a map of date → Set of user_ids
    const activeMapSets: Record<string, Set<string>> = {};
    activeRaw?.forEach((row) => {
      const key = new Date(row.created_at).toISOString().split('T')[0];
      if (!activeMapSets[key]) activeMapSets[key] = new Set();
      activeMapSets[key].add(row.user_id);
    });

    let activeUsersPerDay: { date: string; count: number }[];
    if (isAllTime && activeRaw && activeRaw.length > 0) {
      const dateMap = buildDailyMapFromRange(
        activeRaw[0].created_at,
        activeRaw[activeRaw.length - 1].created_at
      );
      activeUsersPerDay = Object.keys(dateMap).map((date) => ({
        date,
        count: activeMapSets[date]?.size || 0,
      }));
    } else {
      const dateMap = buildDailyMap(days || 14);
      activeUsersPerDay = Object.keys(dateMap).map((date) => ({
        date,
        count: activeMapSets[date]?.size || 0,
      }));
    }

    // ── Top active users by message count (scoped to range, top 5) ──
    const activeUserCountMap: Record<string, number> = {};
    activeRaw?.forEach((r) => {
      activeUserCountMap[r.user_id] = (activeUserCountMap[r.user_id] || 0) + 1;
    });

    const topActiveIds = Object.entries(activeUserCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const profileMap: Record<string, { name: string | null; msisdn: string | null }> = {};

    if (topActiveIds.length > 0) {
      const { data: activeProfiles } = await supabase
        .from('user_profiles')
        .select('supabase_auth_id, name, msisdn')
        .in('supabase_auth_id', topActiveIds.map(([id]) => id));

      activeProfiles?.forEach((p) => {
        profileMap[p.supabase_auth_id] = { name: p.name, msisdn: p.msisdn };
      });
    }

    const topActiveUsers = topActiveIds.map(([id, count]) => ({
      userId: id,
      name: profileMap[id]?.name || null,
      msisdn: profileMap[id]?.msisdn || null,
      count,
    }));

    // ── Messages per day ──
    let messagesQuery = supabase
      .from('chat_messages')
      .select('created_at')
      .order('created_at', { ascending: true });
    if (cutoffDate) messagesQuery = messagesQuery.gte('created_at', cutoffDate);

    const { data: messagesRaw } = await messagesQuery;

    let messagesPerDay: { date: string; count: number }[];
    if (isAllTime && messagesRaw && messagesRaw.length > 0) {
      const map = buildDailyMapFromRange(
        messagesRaw[0].created_at,
        messagesRaw[messagesRaw.length - 1].created_at
      );
      messagesPerDay = fillMap(map, messagesRaw);
    } else {
      messagesPerDay = fillMap(buildDailyMap(days || 14), messagesRaw);
    }

    // ── New users per day ──
    let usersQuery = supabase
      .from('user_profiles')
      .select('created_at')
      .order('created_at', { ascending: true });
    if (cutoffDate) usersQuery = usersQuery.gte('created_at', cutoffDate);

    const { data: usersRaw } = await usersQuery;

    let usersPerDay: { date: string; count: number }[];
    if (isAllTime && usersRaw && usersRaw.length > 0) {
      const map = buildDailyMapFromRange(
        usersRaw[0].created_at,
        usersRaw[usersRaw.length - 1].created_at
      );
      usersPerDay = fillMap(map, usersRaw);
    } else {
      usersPerDay = fillMap(buildDailyMap(days || 14), usersRaw);
    }

    // ── Generated images per day ──
    let imagesQuery = supabase
      .from('generated_images')
      .select('created_at')
      .order('created_at', { ascending: true });
    if (cutoffDate) imagesQuery = imagesQuery.gte('created_at', cutoffDate);

    const { data: imagesRaw } = await imagesQuery;

    let imagesPerDay: { date: string; count: number }[];
    if (isAllTime && imagesRaw && imagesRaw.length > 0) {
      const map = buildDailyMapFromRange(
        imagesRaw[0].created_at,
        imagesRaw[imagesRaw.length - 1].created_at
      );
      imagesPerDay = fillMap(map, imagesRaw);
    } else {
      imagesPerDay = fillMap(buildDailyMap(days || 14), imagesRaw);
    }

    // ── Custom GFs per day ──
    let customGfQuery = supabase
      .from('girlfriends')
      .select('created_at')
      .eq('girlfriend_type', 'custom')
      .order('created_at', { ascending: true });
    if (cutoffDate) customGfQuery = customGfQuery.gte('created_at', cutoffDate);

    const { data: customGfRaw } = await customGfQuery;

    let customGfPerDay: { date: string; count: number }[];
    if (isAllTime && customGfRaw && customGfRaw.length > 0) {
      const map = buildDailyMapFromRange(
        customGfRaw[0].created_at,
        customGfRaw[customGfRaw.length - 1].created_at
      );
      customGfPerDay = fillMap(map, customGfRaw);
    } else {
      customGfPerDay = fillMap(buildDailyMap(days || 14), customGfRaw);
    }

    // ── Top girlfriends by message count (scoped to range) ──
    let gfMsgQuery = supabase.from('chat_messages').select('girlfriend_id');
    if (cutoffDate) gfMsgQuery = gfMsgQuery.gte('created_at', cutoffDate);

    const { data: gfMessages } = await gfMsgQuery;

    const gfCountMap: Record<string, number> = {};
    gfMessages?.forEach((r) => {
      gfCountMap[r.girlfriend_id] = (gfCountMap[r.girlfriend_id] || 0) + 1;
    });

    const gfIds = Object.keys(gfCountMap);
    const gfNameMap: Record<string, string> = {};
    if (gfIds.length > 0) {
      const { data: girlfriends } = await supabase
        .from('girlfriends')
        .select('id, name')
        .in('id', gfIds);

      girlfriends?.forEach((g) => {
        gfNameMap[g.id] = g.name;
      });
    }

    const topGirlfriends = Object.entries(gfCountMap)
      .map(([id, count]) => ({ name: gfNameMap[id] || id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── Top users by message count (scoped to range) ──
    let userMsgQuery = supabase.from('chat_messages').select('user_id');
    if (cutoffDate) userMsgQuery = userMsgQuery.gte('created_at', cutoffDate);

    const { data: userMessages } = await userMsgQuery;

    const userCountMap: Record<string, number> = {};
    userMessages?.forEach((r) => {
      userCountMap[r.user_id] = (userCountMap[r.user_id] || 0) + 1;
    });

    const topUserIds = Object.entries(userCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (topUserIds.length > 0) {
      const missingTopUserIds = topUserIds.map(([id]) => id).filter((id) => !profileMap[id]);
      if (missingTopUserIds.length > 0) {
        const { data: userProfiles } = await supabase
          .from('user_profiles')
          .select('supabase_auth_id, name, msisdn')
          .in('supabase_auth_id', missingTopUserIds);

        userProfiles?.forEach((p) => {
          profileMap[p.supabase_auth_id] = { name: p.name, msisdn: p.msisdn };
        });
      }
    }

    const topUsers = topUserIds.map(([id, count]) => ({
      userId: id,
      name: profileMap[id]?.name || null,
      msisdn: profileMap[id]?.msisdn || null,
      count,
    }));

    // ── Top generators by image count (scoped to range) ──
    let genQuery = supabase.from('generated_images').select('user_id');
    if (cutoffDate) genQuery = genQuery.gte('created_at', cutoffDate);

    const { data: genImages } = await genQuery;

    const genCountMap: Record<string, number> = {};
    genImages?.forEach((r) => {
      genCountMap[r.user_id] = (genCountMap[r.user_id] || 0) + 1;
    });

    const topGenIds = Object.entries(genCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const missingGenIds = topGenIds.map(([id]) => id).filter((id) => !profileMap[id]);
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

    // ── Top custom GF creators (scoped to range) ──
    let creatorQuery = supabase
      .from('girlfriends')
      .select('created_by')
      .eq('girlfriend_type', 'custom');
    if (cutoffDate) creatorQuery = creatorQuery.gte('created_at', cutoffDate);

    const { data: allCustomGf } = await creatorQuery;

    const creatorCountMap: Record<string, number> = {};
    allCustomGf?.forEach((r) => {
      if (r.created_by) {
        creatorCountMap[r.created_by] = (creatorCountMap[r.created_by] || 0) + 1;
      }
    });

    const topCreatorIds = Object.entries(creatorCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const missingCreatorIds = topCreatorIds.map(([id]) => id).filter((id) => !profileMap[id]);
    if (missingCreatorIds.length > 0) {
      const { data: creatorProfiles } = await supabase
        .from('user_profiles')
        .select('supabase_auth_id, name, msisdn')
        .in('supabase_auth_id', missingCreatorIds);

      creatorProfiles?.forEach((p) => {
        profileMap[p.supabase_auth_id] = { name: p.name, msisdn: p.msisdn };
      });
    }

    const topCustomGfCreators = topCreatorIds.map(([id, count]) => ({
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
      activeUsersPerDay,
      topActiveUsers,
      messagesPerDay,
      imagesPerDay,
      usersPerDay,
      customGfPerDay,
      topGirlfriends,
      topGenerators,
      topUsers,
      topCustomGfCreators,
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}