export const dynamic = 'force-dynamic'

export default async function Page() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  let urlCheck = 'ok'
  let fetchCheck = 'not run'

  try {
    new URL(url)
  } catch (e) {
    urlCheck = `invalid: ${e instanceof Error ? e.message : String(e)}`
  }

  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    fetchCheck = `status ${res.status}`
  } catch (e) {
    fetchCheck = e instanceof Error ? e.message : String(e)
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Debug</h1>
      <p>URL present: {String(!!url)}</p>
      <p>URL value: [{url}]</p>
      <p>URL length: {url.length}</p>
      <p>URL valid: {urlCheck}</p>
      <p>Anon key present: {String(!!anon)}</p>
      <p>Anon key length: {anon.length}</p>
      <p>Fetch test: {fetchCheck}</p>
    </div>
  )
}
