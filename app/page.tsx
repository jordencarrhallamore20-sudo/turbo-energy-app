export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function Page() {
  const { data: machines } = await supabase.from('machines').select('*')

  return (
    <div style={{ padding: 40 }}>
      <h1>Machines</h1>

      {machines?.length === 0 && <p>No machines yet</p>}

      {machines?.map((m) => (
        <div key={m.id} style={{ marginBottom: 10 }}>
          <b>{m.name}</b> — {m.model} — {m.status} — {m.location}
        </div>
      ))}
    </div>
  )
}
