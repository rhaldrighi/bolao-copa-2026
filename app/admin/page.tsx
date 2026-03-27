'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { useRouter } from 'next/navigation'

type Match = {
  id: number; phase: string; group_name: string | null; match_number: number
  home_team: string; away_team: string; home_goals: number | null
  away_goals: number | null; match_date: string | null; status: string
}
type Profile = { id: string; name: string; email: string; is_admin: boolean; paid: boolean }
type TournamentResult = { champion: string; runner_up: string; top_scorer: string }

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado', live: 'Ao Vivo', finished: 'Encerrado'
}
const PHASE_ORDER = ['groups', 'r32', 'r16', 'qf', 'sf', '3rd', 'final']
const PHASE_LABELS: Record<string, string> = {
  groups: 'Grupos', r32: 'Rodada de 32', r16: 'Oitavas', qf: 'Quartas', sf: 'Semifinal', '3rd': '3°', final: 'Final'
}

export default function AdminPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [profile, setProfile]         = useState<Profile | null>(null)
  const [matches, setMatches]         = useState<Match[]>([])
  const [profiles, setProfiles]       = useState<Profile[]>([])
  const [tournament, setTournament]   = useState<TournamentResult>({ champion: '', runner_up: '', top_scorer: '' })
  const [activeTab, setActiveTab]     = useState<'matches' | 'users' | 'especiais'>('matches')
  const [filterPhase, setFilterPhase] = useState('groups')
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState('')
  const [syncing, setSyncing]         = useState(false)
  const [editMatch, setEditMatch]     = useState<Match | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof?.is_admin) { router.push('/dashboard'); return }
    setProfile(prof)

    const [{ data: mts }, { data: profs }, { data: tr }] = await Promise.all([
      supabase.from('matches').select('*').order('match_number'),
      supabase.from('profiles').select('*').order('name'),
      supabase.from('tournament_results').select('*').eq('id', 1).single(),
    ])

    if (mts)  setMatches(mts)
    if (profs) setProfiles(profs)
    if (tr)   setTournament({ champion: tr.champion, runner_up: tr.runner_up, top_scorer: tr.top_scorer })
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  async function saveMatchResult(match: Match) {
    setSaving(true)
    const { error } = await supabase.from('matches').update({
      home_goals:  match.home_goals,
      away_goals:  match.away_goals,
      status:      match.status,
      home_team:   match.home_team,
      away_team:   match.away_team,
      match_date:  match.match_date,
      updated_at:  new Date().toISOString(),
    }).eq('id', match.id)

    if (error) { showMsg('Erro: ' + error.message); setSaving(false); return }
    setMatches(ms => ms.map(m => m.id === match.id ? match : m))
    setEditMatch(null)
    showMsg('Partida atualizada!')
    setSaving(false)
  }

  async function saveTournament() {
    setSaving(true)
    const { error } = await supabase.from('tournament_results').upsert(
      { id: 1, ...tournament, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    if (error) showMsg('Erro: ' + error.message)
    else showMsg('Resultados especiais salvos!')
    setSaving(false)
  }

  async function togglePaid(userId: string, current: boolean) {
    await supabase.from('profiles').update({ paid: !current }).eq('id', userId)
    setProfiles(ps => ps.map(p => p.id === userId ? { ...p, paid: !current } : p))
  }

  async function toggleAdmin(userId: string, current: boolean) {
    await supabase.from('profiles').update({ is_admin: !current }).eq('id', userId)
    setProfiles(ps => ps.map(p => p.id === userId ? { ...p, is_admin: !current } : p))
  }

  async function syncResults() {
    setSyncing(true)
    const res = await fetch('/api/resultados', { method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? 'manual'}` }
    })
    const data = await res.json()
    showMsg(data.message ?? 'Sincronizado!')
    await load()
    setSyncing(false)
  }

  async function lockSpecials() {
    const count = await supabase.from('special_predictions').update({ locked: true })
      .eq('locked', false)
    showMsg('Palpites especiais bloqueados!')
  }

  function showMsg(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 4000)
  }

  const filteredMatches = matches.filter(m => m.phase === filterPhase)

  if (!profile) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={profile.name} isAdmin />

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-black text-gray-800">⚙️ Painel Admin</h1>
          <div className="flex gap-2">
            <button
              onClick={syncResults}
              disabled={syncing}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold
                         px-4 py-2 rounded-lg flex items-center gap-2"
            >
              {syncing ? '⏳ Sincronizando...' : '🔄 Buscar resultados'}
            </button>
            <button
              onClick={lockSpecials}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg"
            >
              🔒 Bloquear especiais
            </button>
          </div>
        </div>

        {msg && (
          <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg text-sm font-semibold">
            ✓ {msg}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Participantes', value: profiles.length },
            { label: 'Pagamentos OK', value: profiles.filter(p => p.paid).length },
            { label: 'Jogos finalizados', value: matches.filter(m => m.status === 'finished').length },
            { label: 'Total arrecadado', value: `R$${profiles.filter(p => p.paid).length * 50}` },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm text-center">
              <p className="text-2xl font-black text-green-700">{s.value}</p>
              <p className="text-gray-500 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['matches', 'users', 'especiais'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors
                ${activeTab === t ? 'bg-green-700 text-white' : 'bg-white text-green-700 border border-green-700'}`}>
              {t === 'matches' ? '⚽ Partidas' : t === 'users' ? '👥 Participantes' : '🏆 Especiais'}
            </button>
          ))}
        </div>

        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <div className="space-y-3">
            {/* Phase filter */}
            <div className="flex gap-1 flex-wrap">
              {PHASE_ORDER.map(ph => (
                <button key={ph} onClick={() => setFilterPhase(ph)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors
                    ${filterPhase === ph ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>
                  {PHASE_LABELS[ph]}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {filteredMatches.map(match => (
                <div key={match.id}
                  className="border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-400 w-6">{match.match_number}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-800">
                      {match.home_team} × {match.away_team}
                    </span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold
                      ${match.status === 'finished' ? 'bg-gray-200 text-gray-600' :
                        match.status === 'live' ? 'bg-red-100 text-red-600' :
                        'bg-green-100 text-green-600'}`}>
                      {STATUS_LABELS[match.status]}
                    </span>
                    {match.status === 'finished' && match.home_goals !== null && (
                      <span className="ml-2 text-sm font-bold text-gray-600">
                        {match.home_goals}–{match.away_goals}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditMatch(match)}
                    className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5
                               rounded-lg font-semibold transition-colors"
                  >
                    Editar
                  </button>
                </div>
              ))}
              {filteredMatches.length === 0 && (
                <p className="py-6 text-center text-gray-400 text-sm">Nenhuma partida nesta fase.</p>
              )}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {profiles.map((p, i) => (
              <div key={p.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-wrap
                  ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {p.name || '(sem nome)'} {p.is_admin && '👑'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{p.email}</p>
                </div>
                <button onClick={() => togglePaid(p.id, p.paid)}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${
                    p.paid ? 'bg-green-100 text-green-700 hover:bg-green-200'
                           : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}>
                  {p.paid ? '✓ Pago' : '⚠ Pendente'}
                </button>
                {p.id !== profile.id && (
                  <button onClick={() => toggleAdmin(p.id, p.is_admin)}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-300
                               text-gray-600 hover:bg-gray-100 transition-colors">
                    {p.is_admin ? 'Remover admin' : 'Tornar admin'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ESPECIAIS TAB */}
        {activeTab === 'especiais' && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-800">Resultado Final do Torneio</h2>
            <p className="text-gray-500 text-sm">Preencha após o encerramento da Copa para calcular os pontos especiais.</p>
            {[
              { key: 'champion',   label: '🏆 Campeão'     },
              { key: 'runner_up',  label: '🥈 Vice-Campeão'},
              { key: 'top_scorer', label: '⚽ Artilheiro'  },
            ].map(f => (
              <div key={f.key}>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">{f.label}</label>
                <input
                  type="text"
                  value={tournament[f.key as keyof TournamentResult]}
                  onChange={e => setTournament(t => ({ ...t, [f.key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
            <button onClick={saveTournament} disabled={saving}
              className="w-full bg-green-700 hover:bg-green-800 text-white font-bold
                         py-3 rounded-lg transition-colors">
              {saving ? 'Salvando...' : 'Salvar resultados especiais'}
            </button>
          </div>
        )}
      </main>

      {/* Edit Match Modal */}
      {editMatch && (
        <EditMatchModal
          match={editMatch}
          onSave={saveMatchResult}
          onClose={() => setEditMatch(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

function EditMatchModal({ match, onSave, onClose, saving }: {
  match: Match; onSave: (m: Match) => void; onClose: () => void; saving: boolean
}) {
  const [m, setM] = useState(match)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Editar Partida #{match.match_number}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Time Casa</label>
            <input value={m.home_team} onChange={e => setM(x => ({ ...x, home_team: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Time Fora</label>
            <input value={m.away_team} onChange={e => setM(x => ({ ...x, away_team: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Data/Hora</label>
          <input type="datetime-local" value={m.match_date?.slice(0, 16) ?? ''}
            onChange={e => setM(x => ({ ...x, match_date: e.target.value ? new Date(e.target.value).toISOString() : null }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Status</label>
          <select value={m.status} onChange={e => setM(x => ({ ...x, status: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="scheduled">Agendado</option>
            <option value="live">Ao Vivo</option>
            <option value="finished">Encerrado</option>
          </select>
        </div>

        {(m.status === 'finished' || m.status === 'live') && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Gols Casa</label>
              <input type="number" min={0} max={20}
                value={m.home_goals ?? ''} onChange={e => setM(x => ({ ...x, home_goals: parseInt(e.target.value) || 0 }))}
                className="w-full border rounded-lg px-3 py-2 text-sm text-center font-bold
                           focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Gols Fora</label>
              <input type="number" min={0} max={20}
                value={m.away_goals ?? ''} onChange={e => setM(x => ({ ...x, away_goals: parseInt(e.target.value) || 0 }))}
                className="w-full border rounded-lg px-3 py-2 text-sm text-center font-bold
                           focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2.5 rounded-lg text-sm">
            Cancelar
          </button>
          <button onClick={() => onSave(m)} disabled={saving}
            className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold py-2.5 rounded-lg text-sm">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
