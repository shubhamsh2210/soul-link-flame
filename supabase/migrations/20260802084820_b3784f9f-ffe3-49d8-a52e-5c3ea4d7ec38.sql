CREATE OR REPLACE FUNCTION public.try_match_queue_entry(_entry_id uuid, _allow_adjacent boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me public.queue_entries%ROWTYPE;
  my_profile public.profiles%ROWTYPE;
  best_entry uuid;
  best_user uuid;
  chosen_question uuid;
  new_session uuid;
  min_exp numeric;
BEGIN
  SELECT * INTO me FROM public.queue_entries WHERE id = _entry_id FOR UPDATE;
  IF NOT FOUND OR me.status <> 'waiting' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO my_profile FROM public.profiles WHERE id = me.user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  min_exp := CASE WHEN _allow_adjacent THEN 0.5 ELSE 1 END;

  SELECT q.id, q.user_id INTO best_entry, best_user
  FROM public.queue_entries q
  JOIN public.profiles p ON p.id = q.user_id
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN p.experience_level = my_profile.experience_level THEN 1.0
      WHEN abs(
        array_position(ARRAY['entry','mid','senior'], p.experience_level::text)
        - array_position(ARRAY['entry','mid','senior'], my_profile.experience_level::text)
      ) = 1 THEN 0.5
      ELSE 0.0
    END AS exp_score
  ) e
  WHERE q.status = 'waiting'
    AND q.id <> me.id
    AND q.user_id <> me.user_id
    AND q.track = me.track
    AND e.exp_score >= min_exp
  ORDER BY (
    10 * e.exp_score
    + greatest(0, 10 - abs(p.trust_score - my_profile.trust_score) / 10)
    - CASE WHEN EXISTS (
        SELECT 1 FROM public.interview_sessions s
        WHERE s.created_at > now() - interval '14 days'
          AND ((s.user_a_id = me.user_id AND s.user_b_id = q.user_id)
            OR (s.user_b_id = me.user_id AND s.user_a_id = q.user_id))
      ) THEN 100 ELSE 0 END
  ) DESC, q.joined_at ASC
  LIMIT 1;

  IF best_entry IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO chosen_question
  FROM public.questions WHERE track = me.track
  ORDER BY random() LIMIT 1;

  INSERT INTO public.interview_sessions
    (track, user_a_id, user_b_id, status, question_id, round_1_candidate_id, scheduled_at)
  VALUES (me.track, best_user, me.user_id, 'matched', chosen_question, best_user, now())
  RETURNING id INTO new_session;

  UPDATE public.queue_entries SET status = 'matched'
  WHERE id IN (me.id, best_entry);

  RETURN new_session;
END;
$$;

REVOKE ALL ON FUNCTION public.try_match_queue_entry(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_match_queue_entry(uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.on_queue_entry_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.try_match_queue_entry(NEW.id, false);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.on_queue_entry_insert() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER queue_entries_match_on_insert
AFTER INSERT ON public.queue_entries
FOR EACH ROW EXECUTE FUNCTION public.on_queue_entry_insert();