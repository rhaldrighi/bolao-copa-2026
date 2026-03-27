import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'

export const revalidate = 30

type RankRow = {
  id: string; name: string; email: string; paid: boolean
  match_pts: number; special_pts: number; total_pts: number; position: number
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const PRIZES: Record<number, string> = { 1: 'R$ 750', 2: 'R$ 375' }

export default async function RankingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: profile }, { data: ranking }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('ranking').select('*').order('position'),
  ])

  const rows: RankRow[] = ranking ?? []
  const myRow = rows.find(r => r.id === user.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={profile?.name || ''} isAdmin={profile?.is_admin} />

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-gray-800">🏆 Ranking</h1>
          <span className="text-gray-400 text-xs">{rows.length} participantes</span>
        </div>

        {/* My position highlight */}
        {myRow && (
          <div className="copa-header rounded-xl p-4 text-white">
            <p className="text-green-200 text-xs">Minha posição</p>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-4xl font-black text-yellow-400">{myRow.position}°</span>
              <div>
                <p className="font-bold">{myRow.name || 'Você'}</p>
                <p className="text-green-200 text-sm">
                  {myRow.total_pts} pts
                  <span className="ml-2 text-xs">({myRow.match_pts} jogos + {myRow.special_pts} especiais)</span>
                </p>
              </div>
              {PRIZES[myRow.position] && (
                <div className="ml-auto bg-yellow-400 text-yellow-900 font-black px-3 py-1 rounded-full text-sm">
                  {PRIZES[myRow.position]}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full ranking table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-green-700 text-white text-xs font-bold">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-5">Participante</div>
            <div className="col-span-2 text-center">Jogos</div>
            <div className="col-span-2 text-center">Especiais</div>
            <div className="col-span-2 text-center font-black">Total</div>
          </div>

          {rows.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <p className="text-4xl mb-2">⏳</p>
              <p>Nenhum participante ainda.</p>
            </div>
          )}

          {rows.map((row, i) => {
            const isMe = row.id === user.id
            const medal = MEDALS[row.position]
            return (
              <div
                key={row.id}
                className={`grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-gray-50
                  ${isMe ? 'bg-green-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
              >
                <div className="col-span-1 text-center font-bold text-sm">
                  {medal ?? <span className="text-gray-500">{row.position}</span>}
                </div>
                <div className="col-span-5">
                  <p className={`text-sm font-semibold truncate ${isMe ? 'text-green-700' : 'text-gray-800'}`}>
                    {row.name || row.email.split('@')[0]}
                    {isMe && <span className="ml-1 text-xs text-green-500">(você)</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {PRIZES[row.position] && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">
                        {PRIZES[row.position]}
                      </span>
                    )}
                    {!row.paid && (
                      <span className="text-xs text-red-500">⚠ pgto pendente</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-center text-sm text-gray-600">
                  {row.match_pts}
                </div>
                <div className="col-span-2 text-center text-sm text-gray-600">
                  {row.special_pts}
                </div>
                <div className={`col-span-2 text-center font-black text-sm
                  ${row.position === 1 ? 'text-yellow-500' :
                    row.position === 2 ? 'text-gray-500' :
                    row.position === 3 ? 'text-orange-600' : 'text-gray-800'}`}>
                  {row.total_pts}
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-gray-400 text-xs text-center">
          Atualizado automaticamente após cada partida
        </p>
      </main>
    </div>
  )
}
