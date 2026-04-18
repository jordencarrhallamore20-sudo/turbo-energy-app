export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function Page() {
  const { data: machines, error } = await supabase
    .from('machines')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: 40 }}>
      <h1>Machines</h1>

      {error && <p>Database error: {error.message}</p>}

      {!error && (!machines || machines.length === 0) && <p>No machines yet</p>}

      {machines?.map((m) => (
        <div key={m.id} style={{ marginBottom: 10 }}>
          <b>{m.name}</b> — {m.model} — {m.status} — {m.location}
        </div>
      ))}
    </div>
  )
}
