CREATE TYPE public.track_type AS ENUM ('pm','swe','consulting','sales','support');
CREATE TYPE public.experience_level AS ENUM ('entry','mid','senior');
CREATE TYPE public.queue_status AS ENUM ('waiting','matched','expired','cancelled');
CREATE TYPE public.session_status AS ENUM ('matched','room_created','round_1','round_swap','round_2','ended','no_show');
CREATE TYPE public.question_difficulty AS ENUM ('easy','medium','hard');
CREATE TYPE public.feedback_source AS ENUM ('peer','ai');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  track public.track_type NOT NULL,
  experience_level public.experience_level NOT NULL,
  credits_balance int NOT NULL DEFAULT 3,
  trust_score numeric NOT NULL DEFAULT 100,
  no_show_count int NOT NULL DEFAULT 0,
  completed_sessions int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track text NOT NULL,
  experience_level text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  status public.queue_status NOT NULL DEFAULT 'waiting'
);
CREATE INDEX queue_entries_waiting_idx ON public.queue_entries (track, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_entries TO authenticated;
GRANT ALL ON public.queue_entries TO service_role;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue_select_own" ON public.queue_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "queue_insert_own" ON public.queue_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "queue_update_own" ON public.queue_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "queue_delete_own" ON public.queue_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track text NOT NULL,
  difficulty public.question_difficulty NOT NULL DEFAULT 'medium',
  prompt_text text NOT NULL
);
GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_read" ON public.questions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track text NOT NULL,
  user_a_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.session_status NOT NULL DEFAULT 'matched',
  room_token_a text,
  room_token_b text,
  question_id uuid REFERENCES public.questions(id),
  round_1_candidate_id uuid,
  scheduled_at timestamptz,
  started_at timestamptz,
  round_swap_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interview_sessions_users_idx ON public.interview_sessions (user_a_id, user_b_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_sessions TO authenticated;
GRANT ALL ON public.interview_sessions TO service_role;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_select_participant" ON public.interview_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE OR REPLACE FUNCTION public.is_session_participant(_session_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.interview_sessions s
    WHERE s.id = _session_id AND (s.user_a_id = _user_id OR s.user_b_id = _user_id)
  )
$$;

CREATE TABLE public.feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  subject_user_id uuid NOT NULL,
  rater_user_id uuid,
  source public.feedback_source NOT NULL,
  structure_score int CHECK (structure_score BETWEEN 1 AND 5),
  prioritization_score int CHECK (prioritization_score BETWEEN 1 AND 5),
  stakeholder_awareness_score int CHECK (stakeholder_awareness_score BETWEEN 1 AND 5),
  communication_clarity_score int CHECK (communication_clarity_score BETWEEN 1 AND 5),
  domain_depth_score int CHECK (domain_depth_score BETWEEN 1 AND 5),
  ai_summary_text text,
  strengths text[],
  gaps text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_reports_session_idx ON public.feedback_reports (session_id);
GRANT SELECT, INSERT ON public.feedback_reports TO authenticated;
GRANT ALL ON public.feedback_reports TO service_role;
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_select_participant" ON public.feedback_reports FOR SELECT TO authenticated
  USING (public.is_session_participant(session_id, auth.uid()));
CREATE POLICY "feedback_insert_peer" ON public.feedback_reports FOR INSERT TO authenticated
  WITH CHECK (
    source = 'peer'
    AND rater_user_id = auth.uid()
    AND public.is_session_participant(session_id, auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_sessions;

INSERT INTO public.questions (track, difficulty, prompt_text) VALUES
('pm','medium','Design a feature to help commuters avoid overcrowded trains. Walk through your approach.'),
('pm','medium','Our checkout conversion dropped 12% last week. How do you investigate and respond?'),
('pm','hard','You must cut one of three roadmap bets this quarter. How do you decide and communicate it?'),
('swe','medium','Design a rate limiter for a public API. Discuss trade-offs.'),
('swe','medium','Walk through debugging an intermittent 500 error that only happens in production.'),
('swe','hard','Design a real-time collaborative document editor backend.'),
('consulting','medium','A regional grocery chain has flat revenue for 3 years. Diagnose the problem.'),
('consulting','hard','Should a legacy print publisher acquire a digital news startup? Structure your answer.'),
('sales','medium','A key account signals churn 60 days before renewal. Run the save play.'),
('sales','medium','Qualify a mid-market inbound lead with an unclear budget.'),
('support','medium','A customer reports repeated data sync failures. Handle the conversation end to end.'),
('support','easy','Explain a billing error and a refund policy to a frustrated customer.');