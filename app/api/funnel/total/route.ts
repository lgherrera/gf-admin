// app/api/funnel/total/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password');
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [middleware, profiles, homepage] = await Promise.all([
      supabase
        .from('groobyte_callbacks')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('homepage_visits')
        .select('*', { count: 'exact', head: true }),
    ]);

    const steps = [
      { label: 'Middleware', description: 'Total Users at Middleware', count: middleware.count ?? 0 },
      { label: 'Profiles', description: 'Total New Users at Profiles', count: profiles.count ?? 0 },
      { label: 'Home Page', description: 'Total Users at Home Page', count: homepage.count ?? 0 },
    ];

    return NextResponse.json({ steps });
  } catch (error) {
    console.error('Funnel error:', error);
    return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 });
  }
}