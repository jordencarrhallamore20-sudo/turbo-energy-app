export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  let machines = []
  let error = null

  try {
    const res = await supabase.from('machines').select('*')
    machines = res.data || []
    error = res.error
  } catch (e) {
    error = e
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Machines</h1>

      {error && <p>Database error: {error.message || 'fetch failed'}</p>}

      {!error && machines.length === 0 && <p>No machines yet</p>}

      {machines.map((m) => (
        <div key={m.id}>
          <b>{m.name}</b> - {m.model} - {m.status} - {m.location}
        </div>
      ))}
    </div>
  )
}
