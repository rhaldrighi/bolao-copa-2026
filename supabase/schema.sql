-- ============================================================
-- BOLAO COPA DO MUNDO 2026 - Schema Supabase
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- Profiles (extende auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id        UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name      TEXT NOT NULL DEFAULT '',
  email     TEXT NOT NULL DEFAULT '',
  is_admin  BOOLEAN NOT NULL DEFAULT FALSE,
  paid      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles visíveis por todos"
  ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Usuário atualiza próprio perfil"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Usuário insere próprio perfil"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin atualiza qualquer perfil"
  ON public.profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Partidas
CREATE TABLE IF NOT EXISTS public.matches (
  id             SERIAL PRIMARY KEY,
  phase          TEXT NOT NULL,
  group_name     TEXT,
  match_number   INTEGER NOT NULL,
  home_team      TEXT NOT NULL,
  away_team      TEXT NOT NULL,
  home_goals     INTEGER,
  away_goals     INTEGER,
  match_date     TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'scheduled',
  api_fixture_id INTEGER,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partidas visíveis por todos"
  ON public.matches FOR SELECT USING (TRUE);
CREATE POLICY "Só admin modifica partidas"
  ON public.matches FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Palpites
CREATE TABLE IF NOT EXISTS public.predictions (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id    INTEGER NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_goals  INTEGER NOT NULL CHECK (home_goals >= 0 AND home_goals <= 20),
  away_goals  INTEGER NOT NULL CHECK (away_goals >= 0 AND away_goals <= 20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Palpites visíveis por todos"
  ON public.predictions FOR SELECT USING (TRUE);
CREATE POLICY "Usuário insere próprio palpite"
  ON public.predictions FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND m.status = 'scheduled'
      AND (m.match_date IS NULL OR m.match_date > NOW() + INTERVAL '1 hour')
    )
  );
CREATE POLICY "Usuário atualiza próprio palpite"
  ON public.predictions FOR UPDATE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND m.status = 'scheduled'
      AND (m.match_date IS NULL OR m.match_date > NOW() + INTERVAL '1 hour')
    )
  );

-- Palpites especiais (campeão, vice, artilheiro)
CREATE TABLE IF NOT EXISTS public.special_predictions (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  champion    TEXT NOT NULL DEFAULT '',
  runner_up   TEXT NOT NULL DEFAULT '',
  top_scorer  TEXT NOT NULL DEFAULT '',
  locked      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.special_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Especiais visíveis por todos"
  ON public.special_predictions FOR SELECT USING (TRUE);
CREATE POLICY "Usuário gerencia próprios especiais"
  ON public.special_predictions FOR ALL USING (auth.uid() = user_id);

-- Resultado final do torneio (para calcular especiais)
CREATE TABLE IF NOT EXISTS public.tournament_results (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  champion    TEXT NOT NULL DEFAULT '',
  runner_up   TEXT NOT NULL DEFAULT '',
  top_scorer  TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resultado visível por todos"
  ON public.tournament_results FOR SELECT USING (TRUE);
CREATE POLICY "Só admin modifica resultado"
  ON public.tournament_results FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

INSERT INTO public.tournament_results (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================
-- VIEW: Ranking com pontuação automática
-- ============================================================
CREATE OR REPLACE VIEW public.ranking AS
SELECT
  p.id,
  p.name,
  p.email,
  p.paid,
  COALESCE(ms.match_pts, 0)   AS match_pts,
  COALESCE(ss.special_pts, 0) AS special_pts,
  COALESCE(ms.match_pts, 0) + COALESCE(ss.special_pts, 0) AS total_pts,
  RANK() OVER (
    ORDER BY (COALESCE(ms.match_pts, 0) + COALESCE(ss.special_pts, 0)) DESC
  ) AS position
FROM public.profiles p
LEFT JOIN (
  SELECT
    pr.user_id,
    SUM(
      CASE
        WHEN m.status <> 'finished' THEN 0
        WHEN pr.home_goals = m.home_goals AND pr.away_goals = m.away_goals THEN
          CASE m.phase WHEN 'groups' THEN 3 WHEN 'final' THEN 7 ELSE 5 END
        WHEN m.home_goals IS NOT NULL
          AND SIGN(pr.home_goals::int - pr.away_goals::int) = SIGN(m.home_goals - m.away_goals) THEN
          CASE m.phase WHEN 'groups' THEN 1 WHEN 'final' THEN 3 ELSE 2 END
        ELSE 0
      END
    ) AS match_pts
  FROM public.predictions pr
  JOIN public.matches m ON pr.match_id = m.id
  GROUP BY pr.user_id
) ms ON p.id = ms.user_id
LEFT JOIN (
  SELECT
    sp.user_id,
    (CASE WHEN tr.champion  <> '' AND sp.champion  = tr.champion  THEN 10 ELSE 0 END +
     CASE WHEN tr.runner_up <> '' AND sp.runner_up = tr.runner_up THEN  6 ELSE 0 END +
     CASE WHEN tr.top_scorer <> '' AND sp.top_scorer = tr.top_scorer THEN 8 ELSE 0 END
    ) AS special_pts
  FROM public.special_predictions sp
  CROSS JOIN public.tournament_results tr
) ss ON p.id = ss.user_id
ORDER BY total_pts DESC;

-- ============================================================
-- FUNÇÃO: Cria perfil automaticamente ao cadastrar
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DADOS: Partidas da Fase de Grupos - Copa 2026
-- ============================================================
INSERT INTO public.matches (phase, group_name, match_number, home_team, away_team) VALUES
-- GRUPO A
('groups','Grupo A', 1,'México','África do Sul'),
('groups','Grupo A', 2,'Coreia do Sul','Rep. Europa D'),
('groups','Grupo A', 3,'México','Coreia do Sul'),
('groups','Grupo A', 4,'África do Sul','Rep. Europa D'),
('groups','Grupo A', 5,'México','Rep. Europa D'),
('groups','Grupo A', 6,'África do Sul','Coreia do Sul'),
-- GRUPO B
('groups','Grupo B', 7,'Canadá','Suíça'),
('groups','Grupo B', 8,'Catar','Rep. Europa A'),
('groups','Grupo B', 9,'Canadá','Catar'),
('groups','Grupo B',10,'Suíça','Rep. Europa A'),
('groups','Grupo B',11,'Canadá','Rep. Europa A'),
('groups','Grupo B',12,'Suíça','Catar'),
-- GRUPO C
('groups','Grupo C',13,'Brasil','Marrocos'),
('groups','Grupo C',14,'Haiti','Escócia'),
('groups','Grupo C',15,'Brasil','Haiti'),
('groups','Grupo C',16,'Marrocos','Escócia'),
('groups','Grupo C',17,'Brasil','Escócia'),
('groups','Grupo C',18,'Marrocos','Haiti'),
-- GRUPO D
('groups','Grupo D',19,'EUA','Paraguai'),
('groups','Grupo D',20,'Austrália','Rep. Europa C'),
('groups','Grupo D',21,'EUA','Austrália'),
('groups','Grupo D',22,'Paraguai','Rep. Europa C'),
('groups','Grupo D',23,'EUA','Rep. Europa C'),
('groups','Grupo D',24,'Paraguai','Austrália'),
-- GRUPO E
('groups','Grupo E',25,'Alemanha','Equador'),
('groups','Grupo E',26,'Costa do Marfim','Curaçao'),
('groups','Grupo E',27,'Alemanha','Costa do Marfim'),
('groups','Grupo E',28,'Equador','Curaçao'),
('groups','Grupo E',29,'Alemanha','Curaçao'),
('groups','Grupo E',30,'Equador','Costa do Marfim'),
-- GRUPO F
('groups','Grupo F',31,'Holanda','Japão'),
('groups','Grupo F',32,'Tunísia','Rep. Europa B'),
('groups','Grupo F',33,'Holanda','Tunísia'),
('groups','Grupo F',34,'Japão','Rep. Europa B'),
('groups','Grupo F',35,'Holanda','Rep. Europa B'),
('groups','Grupo F',36,'Japão','Tunísia'),
-- GRUPO G
('groups','Grupo G',37,'Bélgica','Egito'),
('groups','Grupo G',38,'Irã','Nova Zelândia'),
('groups','Grupo G',39,'Bélgica','Irã'),
('groups','Grupo G',40,'Egito','Nova Zelândia'),
('groups','Grupo G',41,'Bélgica','Nova Zelândia'),
('groups','Grupo G',42,'Egito','Irã'),
-- GRUPO H
('groups','Grupo H',43,'Espanha','Uruguai'),
('groups','Grupo H',44,'Arábia Saudita','Cabo Verde'),
('groups','Grupo H',45,'Espanha','Arábia Saudita'),
('groups','Grupo H',46,'Uruguai','Cabo Verde'),
('groups','Grupo H',47,'Espanha','Cabo Verde'),
('groups','Grupo H',48,'Uruguai','Arábia Saudita'),
-- GRUPO I
('groups','Grupo I',49,'França','Senegal'),
('groups','Grupo I',50,'Noruega','Repescagem 2'),
('groups','Grupo I',51,'França','Noruega'),
('groups','Grupo I',52,'Senegal','Repescagem 2'),
('groups','Grupo I',53,'França','Repescagem 2'),
('groups','Grupo I',54,'Senegal','Noruega'),
-- GRUPO J
('groups','Grupo J',55,'Argentina','Áustria'),
('groups','Grupo J',56,'Argélia','Jordânia'),
('groups','Grupo J',57,'Argentina','Argélia'),
('groups','Grupo J',58,'Áustria','Jordânia'),
('groups','Grupo J',59,'Argentina','Jordânia'),
('groups','Grupo J',60,'Áustria','Argélia'),
-- GRUPO K
('groups','Grupo K',61,'Portugal','Uzbequistão'),
('groups','Grupo K',62,'Colômbia','Repescagem 1'),
('groups','Grupo K',63,'Portugal','Colômbia'),
('groups','Grupo K',64,'Uzbequistão','Repescagem 1'),
('groups','Grupo K',65,'Portugal','Repescagem 1'),
('groups','Grupo K',66,'Uzbequistão','Colômbia'),
-- GRUPO L
('groups','Grupo L',67,'Inglaterra','Croácia'),
('groups','Grupo L',68,'Panamá','Gana'),
('groups','Grupo L',69,'Inglaterra','Panamá'),
('groups','Grupo L',70,'Croácia','Gana'),
('groups','Grupo L',71,'Inglaterra','Gana'),
('groups','Grupo L',72,'Croácia','Panamá');

-- Partidas eliminatórias (times a definir)
INSERT INTO public.matches (phase, match_number, home_team, away_team) VALUES
-- Rodada de 32
('r32',73,'A definir','A definir'),('r32',74,'A definir','A definir'),
('r32',75,'A definir','A definir'),('r32',76,'A definir','A definir'),
('r32',77,'A definir','A definir'),('r32',78,'A definir','A definir'),
('r32',79,'A definir','A definir'),('r32',80,'A definir','A definir'),
('r32',81,'A definir','A definir'),('r32',82,'A definir','A definir'),
('r32',83,'A definir','A definir'),('r32',84,'A definir','A definir'),
('r32',85,'A definir','A definir'),('r32',86,'A definir','A definir'),
('r32',87,'A definir','A definir'),('r32',88,'A definir','A definir'),
-- Oitavas
('r16',89,'A definir','A definir'),('r16',90,'A definir','A definir'),
('r16',91,'A definir','A definir'),('r16',92,'A definir','A definir'),
('r16',93,'A definir','A definir'),('r16',94,'A definir','A definir'),
('r16',95,'A definir','A definir'),('r16',96,'A definir','A definir'),
-- Quartas
('qf',97,'A definir','A definir'),('qf',98,'A definir','A definir'),
('qf',99,'A definir','A definir'),('qf',100,'A definir','A definir'),
-- Semifinais
('sf',101,'A definir','A definir'),('sf',102,'A definir','A definir'),
-- 3° Lugar
('3rd',103,'A definir','A definir'),
-- Final
('final',104,'A definir','A definir');
