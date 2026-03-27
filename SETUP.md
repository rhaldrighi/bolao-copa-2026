# 🏆 Bolão Copa do Mundo 2026 — Guia de Instalação

## O que você vai precisar (tudo gratuito)

1. Conta no **Supabase** (banco de dados) → supabase.com
2. Conta no **Vercel** (hospedagem) → vercel.com
3. Conta na **GitHub** (para publicar o código) → github.com
4. Chave de API no **API-Football** (resultados automáticos) → api-football.com

---

## Passo a Passo

### 1. Criar projeto no Supabase

1. Acesse **supabase.com** → crie uma conta → "New Project"
2. Escolha um nome (ex: `bolao-copa-2026`) e uma senha forte
3. Aguarde o projeto ser criado (~2 minutos)
4. Vá em **SQL Editor** → clique em "New Query"
5. Cole **todo o conteúdo** do arquivo `supabase/schema.sql` e clique **Run**
6. Anote as credenciais em **Settings → API**:
   - `Project URL` → ex: `https://abcxyz.supabase.co`
   - `anon public` key → chave longa começando com `eyJ...`

### 2. Obter chave da API Football

1. Acesse **api-football.com** → "Subscribe" → plano Free (100 req/dia)
2. Copie sua **API Key** no painel

### 3. Publicar no GitHub

1. Acesse **github.com** → "New repository" → nome: `bolao-copa-2026`
2. Na pasta do projeto no seu computador, abra o Terminal e execute:
```bash
cd "/Users/raldrighi/Documents/Claude/bolao-copa-2026"
git init
git add .
git commit -m "Bolão Copa 2026"
git remote add origin https://github.com/SEU_USUARIO/bolao-copa-2026.git
git push -u origin main
```

### 4. Deploy no Vercel

1. Acesse **vercel.com** → "Add New Project"
2. Conecte com sua conta GitHub → selecione o repositório `bolao-copa-2026`
3. Em **Environment Variables**, adicione:

| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do seu projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave `anon public` do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` do Supabase (Settings → API) |
| `FOOTBALL_API_KEY` | Sua chave da API Football |
| `FOOTBALL_API_LEAGUE_ID` | `1` (FIFA World Cup) |
| `FOOTBALL_API_SEASON` | `2026` |
| `CRON_SECRET` | Qualquer palavra secreta (ex: `bolao2026secreto`) |

4. Clique **Deploy** → aguarde ~2 minutos
5. Seu site estará em: `https://bolao-copa-2026.vercel.app` (ou similar)

### 5. Configurar o primeiro admin

1. Acesse o site e faça login com seu email
2. No Supabase, vá em **Table Editor → profiles**
3. Encontre seu registro → edite → mude `is_admin` para `TRUE`
4. Agora você tem acesso ao painel `/admin`

### 6. Configurar autenticação de email

1. No Supabase, vá em **Authentication → URL Configuration**
2. Em "Site URL" coloque: `https://seu-site.vercel.app`
3. Em "Redirect URLs" adicione: `https://seu-site.vercel.app/auth/callback`

---

## Como funciona

### Para os participantes
- Acesse o site → entre com email → clique no link recebido
- Preencha nome em "Perfil"
- Preencha os palpites de todos os 72 jogos da fase de grupos
- Preencha campeão, vice e artilheiro antes da Copa começar
- Acompanhe o ranking em tempo real

### Para o admin (você)
- Painel `/admin` → aba Participantes → marque quem pagou
- Os resultados são atualizados **automaticamente a cada 30 minutos** via API
- Se necessário, edite resultados manualmente na aba Partidas
- Clique "🔒 Bloquear especiais" quando a Copa começar

### Resultados automáticos
- A Vercel executa `/api/resultados` a cada 30 min durante a Copa
- O sistema busca resultados finalizados na API de futebol
- O ranking é recalculado automaticamente no banco de dados

---

## Pontuação
| Situação | Pontos |
|----------|--------|
| Fase de grupos — placar exato | 3 |
| Fase de grupos — vencedor/empate certo | 1 |
| Mata-mata — placar exato (90 min) | 5 |
| Mata-mata — classificado certo | 2 |
| Final — placar exato | 7 |
| Final — campeão certo | 3 |
| Especial — campeão | 10 |
| Especial — vice-campeão | 6 |
| Especial — artilheiro | 8 |

## Premiação
- 25 participantes × R$50 = **R$1.250**
- 1° lugar: **R$750**
- 2° lugar: **R$375**
- Reserva: **R$125**
