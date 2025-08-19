import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key for server operations
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Simple client for database operations (no cookies needed)
export function createSimpleClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}

// SQL adapter for existing code that uses sql`` template literals
export function sql(strings: TemplateStringsArray, ...values: any[]) {
  // Build the query from template literal
  let query = ''
  let paramIndex = 1
  
  for (let i = 0; i < strings.length; i++) {
    query += strings[i]
    if (i < values.length) {
      // Replace with numbered parameters for PostgreSQL
      query += `$${paramIndex++}`
    }
  }
  
  return {
    async then(resolve: any, reject: any) {
      try {
        const supabase = createSimpleClient()
        
        // Execute raw SQL query using Supabase
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: query,
          args: values
        })
        
        if (error) throw error
        
        resolve({ rows: data || [] })
      } catch (err) {
        reject(err)
      }
    }
  }
}

// Database helpers
export const db = {
  async connect() {
    try {
      const supabase = createSimpleClient()
      const { data, error } = await supabase.from('content_queue').select('count', { count: 'exact', head: true })
      if (error) throw error
      return true
    } catch (err) {
      throw new Error(`Database connection failed: ${err.message}`)
    }
  },

  async disconnect() {
    // Supabase doesn't need explicit disconnect
    return true
  }
}