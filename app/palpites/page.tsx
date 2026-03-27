'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

type Match = {
  id: number; phase: string; group_name: string | null
  match_number: number; home_team: string; away_team: string
  home_goals: number | null; away_goals: number | null
  match_date: string | null; status: string
}
type Prediction = { match_id: number; home_goals: number; away_goals: number }
type Profile = { id: string; name: string; email: string; is_admin: boolean; paid: boolean }
type SpecialPred = { champion: string; runner_up: string; top_scorer: string; locked: boolean }

const TABS = ['grupos', 'mata-mata', 'especiais', 'perfil'] as const
type Tab = typeof TABS[number]

const PHASE_LABELS: Record<string, string> = {
  groups: 'Fase de Grupos', r32: 'Rodada de 32', r16: 'Oitavas de Final',
  qf: 'Quartas de Final', sf: 'Semifinal', '3rd': '3° Lugar', final: 'Final'
}

function isLocked(match: Match): boolean {
  if (match.status !== 'scheduled') return true
  if (!match.match_date) return false
  return new Date(match.match_date).getTime() - Date.now() < 60 * 60 * 1000
}

export default function PalpitesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <PalpitesContent />
    </Suspense>
  )
}

function PalpitesContent() {
  const searchParams = useSearchParams()
  const initTab = (searchParams.get('tab') as Tab) ?? 'grupos'

  const supabase = createClient()
  const [tab, setTab]               = useState<Tab>(initTab)
  const [profile, setProfile]       = useState<Profile | null>(null)
  const [matches, setMatches]       = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({})
  const [special, setSpecial]       = useState<SpecialPred>({ champion: '', runner_up: '', top_scorer: '', locked: false })
  const [saving, setSaving]         = useState<Record<number | string, boolean>>({})
  const [saved, setSaved]           = useState<Record<number | string, boolean>>({})
  const [name, setName]             = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: prof }, { data: mts }, { data: preds }, { data: sp }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('matches').select('*').order('match_number'),
      supabase.from('predictions').select('*').eq('user_id', user.id),
      supabase.from('special_predictions').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    if (prof) { setProfile(prof); setName(prof.name || '') }
    if (mts)  setMatches(mts)
    if (preds) {
      const map: Record<number, Prediction> = {}
      preds.forEach(p => { map[p.match_id] = p })
      setPredictions(map)
    }
    if (sp) setSpecial(sp)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function savePrediction(matchId: number, home: number, away: number) {
    if (!profile) return
    setSaving(s => ({ ...s, [matchId]: true }))

    await supabase.from('predictions').upsert(
      { user_id: profile.id, match_id: matchId, home_goals: home, away_goals: away },
      { onConflict: 'user_id,match_id' }
    )

    setPredictions(p => ({ ...p, [matchId]: { match_id: matchId, home_goals: home, away_goals: away } }))
    setSaving(s => ({ ...s, [matchId]: false }))
    setSaved(s => ({ ...s, [matchId]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [matchId]: false })), 2000)
  }

  async function saveSpecial() {
    if (!profile || special.locked) return
    setSaving(s => ({ ...s, especial: true }))

    await supabase.from('special_predictions').upsert(
      { user_id: profile.id, ...special },
      { onConflict: 'user_id' }
    )

    setSaving(s => ({ ...s, especial: false }))
    setSaved(s => ({ ...s, especial: true }))
    setTimeout(() => setSaved(s => ({ ...s, especial: false })), 2000)
  }

  async function saveName() {
    if (!profile) return
    setNameSaving(true)
    await supabase.from('profiles').update({ name }).eq('id', profile.id)
    setProfile(p => p ? { ...p, name } : p)
    setNameSaving(false)
  }

  // Group matches by group / phase
  const groupMatches    = matches.filter(m => m.phase === 'groups')
  const knockoutMatches = matches.filter(m => m.phase !== 'groups')
  const groupedByGroup  = groupMatches.reduce<Record<string, Match[]>>((acc, m) => {
    const key = m.group_name ?? 'Sem grupo'
    acc[key] = [...(acc[key] ?? []), m]
    return acc
  }, {})
  const groupedByPhase = knockoutMatches.reduce<Record<string, Match[]>>((acc, m) => {
    const key = m.phase
    acc[key] = [...(acc[key] ?? []), m]
    return acc
  }, {})

  const phaseOrder = ['r32', 'r16', 'qf', 'sf', '3rd', 'final']

  const myPredCount  = Object.keys(predictions).length
  const groupCount   = groupMatches.length
  const kcCount      = knockoutMatches.filter(m => m.status !== 'scheduled' ||
    (m.home_team !== 'A definir')).length

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={profile?.name || ''} isAdmin={profile?.is_admin} />

      <main className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-black text-gray-800">Meus Palpites</h1>
          <p className="text-gray-500 text-sm">
            {myPredCount}/{groupCount} jogos da fase de grupos preenchidos
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors
                ${tab === t ? 'bg-green-700 text-white' : 'bg-white text-green-700 border border-green-700'}`}
            >
              {t === 'grupos' ? '⚽ Grupos' :
               t === 'mata-mata' ? '🔥 Mata-Mata' :
               t === 'especiais' ? '🏆 Especiais' : '👤 Perfil'}
            </button>
          ))}
        </div>

        {/* TAB: GRUPOS */}
        {tab === 'grupos' && (
          <div className="space-y-5">
            {Object.entries(groupedByGroup).map(([groupName, groupMts]) => (
              <div key={groupName} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-green-700 px-4 py-2">
                  <h2 className="text-white font-bold text-sm">{groupName}</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {groupMts.map(match => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      prediction={predictions[match.id]}
                      saving={saving[match.id]}
                      saved={saved[match.id]}
                      onSave={savePrediction}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: MATA-MATA */}
        {tab === 'mata-mata' && (
          <div className="space-y-5">
            {phaseOrder.map(phase => {
              const phaseMts = groupedByPhase[phase]
              if (!phaseMts?.length) return null
              return (
                <div key={phase} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-red-700 px-4 py-2">
                    <h2 className="text-white font-bold text-sm">
                      {PHASE_LABELS[phase] ?? phase}
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {phaseMts.map(match => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        prediction={predictions[match.id]}
                        saving={saving[match.id]}
                        saved={saved[match.id]}
                        onSave={savePrediction}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
            {!knockoutMatches.length && (
              <div className="card text-center py-8">
                <p className="text-4xl mb-3">⏳</p>
                <p className="text-gray-600 font-semibold">Aguardando fase de grupos</p>
                <p className="text-gray-400 text-sm mt-1">
                  Os jogos do mata-mata serão liberados após o final dos grupos.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB: ESPECIAIS */}
        {tab === 'especiais' && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
            <div>
              <h2 className="font-bold text-gray-800 text-lg mb-1">Palpites Especiais</h2>
              <p className="text-gray-500 text-sm">
                Estes palpites serão bloqueados assim que a Copa começar.
              </p>
            </div>
            {special.locked && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                🔒 Palpites especiais bloqueados — Copa já iniciou!
              </div>
            )}
            <div className="space-y-4">
              {[
                { key: 'champion',   label: '🏆 Campeão',      pts: '10 pts', hint: 'Nome do time campeão' },
                { key: 'runner_up',  label: '🥈 Vice-Campeão', pts: '6 pts',  hint: 'Nome do time finalista' },
                { key: 'top_scorer', label: '⚽ Artilheiro',   pts: '8 pts',  hint: 'Nome do jogador artilheiro' },
              ].map(field => (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-700">{field.label}</label>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                      {field.pts}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={special[field.key as keyof SpecialPred] as string}
                    onChange={e => setSpecial(s => ({ ...s, [field.key]: e.target.value }))}
                    disabled={special.locked}
                    placeholder={field.hint}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-green-500
                               disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              ))}
            </div>
            {!special.locked && (
              <button
                onClick={saveSpecial}
                disabled={saving['especial'] as boolean}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold
                           py-3 rounded-lg transition-colors text-sm"
              >
                {saving['especial'] ? 'Salvando...' : saved['especial'] ? '✓ Salvo!' : 'Salvar palpites especiais'}
              </button>
            )}
          </div>
        )}

        {/* TAB: PERFIL */}
        {tab === 'perfil' && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Meu Perfil</h2>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1 block">
                Nome completo
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1 block">Email</label>
              <input type="email" value={profile?.email ?? ''} disabled
                className="w-full border border-gray-100 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500" />
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                profile?.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {profile?.paid ? '✓ Pagamento confirmado' : '⚠ Pagamento pendente'}
              </div>
            </div>
            <button
              onClick={saveName}
              disabled={nameSaving}
              className="w-full bg-green-700 hover:bg-green-800 text-white font-bold
                         py-3 rounded-lg transition-colors text-sm"
            >
              {nameSaving ? 'Salvando...' : 'Salvar nome'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

/* ── MatchRow component ── */
interface MatchRowProps {
  match: Match
  prediction?: Prediction
  saving?: boolean
  saved?: boolean
  onSave: (id: number, home: number, away: number) => void
}

function MatchRow({ match, prediction, saving, saved, onSave }: MatchRowProps) {
  const locked = isLocked(match)
  const [home, setHome] = useState<string>(prediction?.home_goals?.toString() ?? '')
  const [away, setAway] = useState<string>(prediction?.away_goals?.toString() ?? '')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setHome(prediction?.home_goals?.toString() ?? '')
    setAway(prediction?.away_goals?.toString() ?? '')
    setDirty(false)
  }, [prediction?.home_goals, prediction?.away_goals])

  function handleChange(side: 'home' | 'away', val: string) {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 2)
    if (side === 'home') setHome(clean)
    else setAway(clean)
    setDirty(true)
  }

  function handleSave() {
    const h = parseInt(home)
    const a = parseInt(away)
    if (isNaN(h) || isNaN(a)) return
    setDirty(false)
    onSave(match.id, h, a)
  }

  const hasPrediction = prediction !== undefined
  const isFinished    = match.status === 'finished'
  const isLive        = match.status === 'live'

  return (
    <div className={`px-4 py-3 ${locked ? 'bg-gray-50' : 'bg-white'}`}>
      {/* Status badge */}
      <div className="flex items-center gap-2 mb-2">
        {isLive && (
          <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
            AO VIVO
          </span>
        )}
        {isFinished && (
          <span className="text-xs bg-gray-500 text-white px-2 py-0.5 rounded-full">
            Encerrado
          </span>
        )}
        {locked && !isLive && !isFinished && (
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            🔒 Bloqueado
          </span>
        )}
        {match.match_date && (
          <span className="text-xs text-gray-400">
            {new Date(match.match_date).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            })}
          </span>
        )}
        {hasPrediction && !dirty && (
          <span className="text-xs text-green-600 ml-auto">✓ Salvo</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Home team */}
        <span className="text-sm font-semibold text-gray-800 flex-1 text-right truncate">
          {match.home_team}
        </span>

        {/* Prediction inputs */}
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min={0} max={20}
            value={home}
            onChange={e => handleChange('home', e.target.value)}
            disabled={locked}
            className={`w-10 h-10 text-center text-lg font-black border-2 rounded-lg
              focus:outline-none focus:border-green-500 transition-colors
              ${locked
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-50 border-yellow-300 text-gray-800'
              }`}
          />
          <span className="text-gray-400 font-bold text-xs">×</span>
          <input
            type="number"
            min={0} max={20}
            value={away}
            onChange={e => handleChange('away', e.target.value)}
            disabled={locked}
            className={`w-10 h-10 text-center text-lg font-black border-2 rounded-lg
              focus:outline-none focus:border-green-500 transition-colors
              ${locked
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-50 border-yellow-300 text-gray-800'
              }`}
          />
        </div>

        {/* Away team */}
        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">
          {match.away_team}
        </span>
      </div>

      {/* Result (if finished) */}
      {isFinished && match.home_goals !== null && (
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-500">Resultado: </span>
          <span className="text-sm font-bold text-gray-700">
            {match.home_goals} × {match.away_goals}
          </span>
          {prediction !== undefined && (
            <span className="ml-2 text-xs font-bold">
              {(() => {
                const h = prediction.home_goals, a = prediction.away_goals
                const rh = match.home_goals!, ra = match.away_goals!
                if (h === rh && a === ra) return <span className="text-green-600">+{match.phase === 'groups' ? 3 : match.phase === 'final' ? 7 : 5} pts 🎯</span>
                if (Math.sign(h - a) === Math.sign(rh - ra)) return <span className="text-blue-600">+{match.phase === 'groups' ? 1 : match.phase === 'final' ? 3 : 2} pts ✓</span>
                return <span className="text-gray-400">0 pts ✗</span>
              })()}
            </span>
          )}
        </div>
      )}

      {/* Save button */}
      {!locked && dirty && home !== '' && away !== '' && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white text-xs
                     font-bold py-1.5 rounded-lg transition-colors"
        >
          {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar palpite'}
        </button>
      )}
    </div>
  )
}
