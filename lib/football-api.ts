// Integração com api-football.com para resultados automáticos

const API_KEY    = process.env.FOOTBALL_API_KEY    ?? ''
const LEAGUE_ID  = process.env.FOOTBALL_API_LEAGUE_ID ?? '1'
const SEASON     = process.env.FOOTBALL_API_SEASON    ?? '2026'
const BASE_URL   = 'https://v3.football.api-sports.io'

interface ApiFixture {
  fixture: { id: number; status: { short: string } }
  teams: {
    home: { name: string }
    away: { name: string }
  }
  goals: { home: number | null; away: number | null }
  score: {
    fulltime: { home: number | null; away: number | null }
  }
}

// Busca partidas finalizadas da Copa 2026
export async function fetchFinishedMatches(): Promise<ApiFixture[]> {
  if (!API_KEY) {
    console.warn('FOOTBALL_API_KEY não configurada')
    return []
  }

  const url = `${BASE_URL}/fixtures?league=${LEAGUE_ID}&season=${SEASON}&status=FT`
  const res = await fetch(url, {
    headers: {
      'x-apisports-key': API_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    console.error('Erro na API Football:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  return data.response ?? []
}

// Busca partidas ao vivo
export async function fetchLiveMatches(): Promise<ApiFixture[]> {
  if (!API_KEY) return []

  const url = `${BASE_URL}/fixtures?league=${LEAGUE_ID}&season=${SEASON}&live=all`
  const res = await fetch(url, {
    headers: { 'x-apisports-key': API_KEY },
    next: { revalidate: 0 },
  })

  if (!res.ok) return []
  const data = await res.json()
  return data.response ?? []
}

export type { ApiFixture }
