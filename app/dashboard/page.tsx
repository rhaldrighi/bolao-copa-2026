import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

export const revalidate = 60

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: profile }, { data: rankingData }, { data: matches }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('ranking').select('*').order('position'),
    supabase.from('matches').select('id, status, match_date').eq('phase', 'groups'),
  ])

  // Stats
  const totalParts = rankingData?.length ?? 0
  const myRank     = rankingData?.find(r => r.id === user.id)
  const finishedMatches = matches?.filter(m => m.status === 'finished').length ?? 0
  const totalGroupMatches = 72

  // Next match
  const now = new Date()
  const nextMatch = matches
    ?.filter(m => m.status === 'scheduled' && m.match_date)
    .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())[0]

  const isAdmin = profile?.is_admin ?? false

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={profile?.name || user.email} isAdmin={isAdmin} />

      <main className="max-w-4xl mx-auto p-4 space-y-5">

        {/* Welcome */}
        <div className="copa-header rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-200 text-sm">Bem-vindo,</p>
              <h1 className="text-2xl font-black text-yellow-400">
                {profile?.name || 'Participante'}
              </h1>
              {!profile?.name && (
                <p className="text-green-200 text-xs mt-1">
                  ⚠️ Complete seu perfil abaixo
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-green-200 text-xs">Pagamento</p>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                profile?.paid
                  ? 'bg-yellow-400 text-green-900'
                  : 'bg-red-500 text-white'
              }`}>
                {profile?.paid ? '✓ Confirmado' : '⚠ Pendente'}
              </span>
            </div>
          </div>

          {myRank && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-yellow-400">{myRank.position}°</p>
                <p className="text-green-200 text-xs">Posição</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-yellow-400">{myRank.total_pts}</p>
                <p className="text-green-200 text-xs">Pontos</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-yellow-400">{totalParts}</p>
                <p className="text-green-200 text-xs">Participantes</p>
              </div>
            </div>
          )}
        </div>

        {/* Setup name if missing */}
        {!profile?.name && <SetupNameCard userId={user.id} />}

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/palpites" className="card hover:shadow-md transition-shadow text-center">
            <div className="text-3xl mb-2">⚽</div>
            <p className="font-bold text-gray-800">Meus Palpites</p>
            <p className="text-gray-500 text-xs mt-1">Fase de grupos, mata-mata e especiais</p>
          </Link>
          <Link href="/ranking" className="card hover:shadow-md transition-shadow text-center">
            <div className="text-3xl mb-2">🏆</div>
            <p className="font-bold text-gray-800">Ranking</p>
            <p className="text-gray-500 text-xs mt-1">{totalParts} participantes</p>
          </Link>
          <div className="card text-center">
            <div className="text-3xl mb-2">📊</div>
            <p className="font-bold text-gray-800">Progresso</p>
            <p className="text-gray-500 text-xs mt-1">
              {finishedMatches}/{totalGroupMatches} jogos finalizados
            </p>
            <div className="mt-2 bg-gray-100 rounded-full h-2">
              <div
                className="bg-green-600 rounded-full h-2 transition-all"
                style={{ width: `${(finishedMatches / totalGroupMatches) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Premiação */}
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            🏅 Premiação
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { pos: '1°', prize: 'R$ 750', color: 'bg-yellow-400 text-yellow-900' },
              { pos: '2°', prize: 'R$ 375', color: 'bg-gray-200 text-gray-700' },
              { pos: 'Reserva', prize: 'R$ 125', color: 'bg-orange-100 text-orange-700' },
            ].map(p => (
              <div key={p.pos} className={`${p.color} rounded-xl p-3 text-center`}>
                <p className="text-xl font-black">{p.pos}</p>
                <p className="text-sm font-bold">{p.prize}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-400 text-xs mt-2 text-center">
            25 participantes × R$50 = R$1.250 total
          </p>
        </div>

        {/* Tabela de pontuação */}
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-3">📋 Como pontuar</h2>
          <div className="space-y-2 text-sm">
            {[
              ['Fase de grupos – Placar exato',     '3 pts'],
              ['Fase de grupos – Vencedor/Empate',  '1 pt'],
              ['Mata-mata – Placar exato (90min)',   '5 pts'],
              ['Mata-mata – Classificado certo',    '2 pts'],
              ['Final – Placar exato',              '7 pts'],
              ['Final – Campeão certo',             '3 pts'],
              ['Especial – Campeão',                '10 pts'],
              ['Especial – Vice-campeão',           '6 pts'],
              ['Especial – Artilheiro',             '8 pts'],
            ].map(([desc, pts], i) => (
              <div key={i} className={`flex justify-between items-center py-1.5 px-3 rounded-lg
                ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <span className="text-gray-700">{desc}</span>
                <span className="font-bold text-green-700 ml-4 whitespace-nowrap">{pts}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

// Inline client component para editar nome
function SetupNameCard({ userId }: { userId: string }) {
  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
      <p className="text-yellow-800 font-semibold text-sm mb-1">
        ⚠️ Configure seu perfil
      </p>
      <p className="text-yellow-700 text-xs mb-3">
        Adicione seu nome para aparecer no ranking.
      </p>
      <Link
        href="/palpites?tab=perfil"
        className="text-xs bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold
                   px-4 py-2 rounded-lg transition-colors"
      >
        Configurar agora
      </Link>
    </div>
  )
}
