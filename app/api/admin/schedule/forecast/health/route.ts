import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const missing = []
    if (!url) missing.push('SUPABASE_URL')
    if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    const base = { ok: missing.length === 0, missing }

    if (missing.length) return NextResponse.json(base, { status: 200 })

    const supabase = createClient(url!, key!)
    const { error } = await supabase
      .from('scheduled_posts')
      .select('id', { count: 'exact', head: true })
    if (error) {
      return NextResponse.json({ ...base, table_ok: false, error: error.message }, { status: 200 })
    }
    return NextResponse.json({ ...base, table_ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 200 })
  }
}