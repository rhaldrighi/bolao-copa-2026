import { createClient } from '@supabase/supabase-js'
import { fetchFinishedMatches, fetchLiveMatches } from '@/lib/football-api'
import { NextRequest, NextResponse } from 'next/server'

// Supabase admin client criado dentro da função para evitar erro de build
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

// Normaliza nome do time (para comparar com o banco)
function normalizeName(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

// GET: chamado pelo cron da Vercel a cada 30 min
export async function GET(req: NextRequest) {
  return handleUpdate(req)
}

// POST: chamado manualmente pelo admin
export async function POST(req: NextRequest) {
  return handleUpdate(req)
}

async function handleUpdate(req: NextRequest) {
  // Verifica autenticação do cron
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  const isManual = auth === `Bearer ${cronSecret}` || auth === 'Bearer manual'

  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [finished, live] = await Promise.all([
      fetchFinishedMatches(),
      fetchLiveMatches(),
    ])

    // Busca todas as partidas do banco
    const { data: dbMatches } = await getSupabaseAdmin()
      .from('matches')
      .select('id, home_team, away_team, status, api_fixture_id')

    if (!dbMatches) {
      return NextResponse.json({ message: 'Nenhuma partida encontrada no banco.' })
    }

    let updated = 0

    // Atualiza partidas ao vivo
    for (const apiMatch of live) {
      const dbMatch = findMatch(dbMatches, apiMatch.teams.home.name, apiMatch.teams.away.name, apiMatch.fixture.id)
      if (!dbMatch || dbMatch.status === 'finished') continue

      await getSupabaseAdmin().from('matches').update({
        status: 'live',
        home_goals: apiMatch.goals.home ?? 0,
        away_goals: apiMatch.goals.away ?? 0,
        api_fixture_id: apiMatch.fixture.id,
        updated_at: new Date().toISOString(),
      }).eq('id', dbMatch.id)
      updated++
    }

    // Atualiza partidas encerradas
    for (const apiMatch of finished) {
      const dbMatch = findMatch(dbMatches, apiMatch.teams.home.name, apiMatch.teams.away.name, apiMatch.fixture.id)
      if (!dbMatch) continue

      const homeGoals = apiMatch.score.fulltime.home ?? apiMatch.goals.home ?? 0
      const awayGoals = apiMatch.score.fulltime.away ?? apiMatch.goals.away ?? 0

      await getSupabaseAdmin().from('matches').update({
        status: 'finished',
        home_goals: homeGoals,
        away_goals: awayGoals,
        api_fixture_id: apiMatch.fixture.id,
        updated_at: new Date().toISOString(),
      }).eq('id', dbMatch.id)
      updated++
    }

    return NextResponse.json({
      message: `Atualizado: ${updated} partidas (${finished.length} encerradas, ${live.length} ao vivo)`,
      finished: finished.length,
      live: live.length,
      updated,
    })
  } catch (err) {
    console.error('Erro ao atualizar resultados:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

function findMatch(
  dbMatches: Array<{ id: number; home_team: string; away_team: string; status: string; api_fixture_id: number | null }>,
  homeTeam: string,
  awayTeam: string,
  fixtureId: number
) {
  // Primeiro tenta por api_fixture_id
  const byId = dbMatches.find(m => m.api_fixture_id === fixtureId)
  if (byId) return byId

  // Fallback: busca por nome normalizado
  const normHome = normalizeName(homeTeam)
  const normAway = normalizeName(awayTeam)

  return dbMatches.find(m =>
    normalizeName(m.home_team).includes(normHome.split(' ')[0]) &&
    normalizeName(m.away_team).includes(normAway.split(' ')[0])
  ) ?? null
}
