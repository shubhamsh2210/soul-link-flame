DROP POLICY "feedback_select_participant" ON public.feedback_reports;
DROP POLICY "feedback_insert_peer" ON public.feedback_reports;
DROP FUNCTION public.is_session_participant(uuid, uuid);

CREATE POLICY "feedback_select_participant" ON public.feedback_reports FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    WHERE s.id = feedback_reports.session_id
      AND (s.user_a_id = auth.uid() OR s.user_b_id = auth.uid())
  ));

CREATE POLICY "feedback_insert_peer" ON public.feedback_reports FOR INSERT TO authenticated
  WITH CHECK (
    source = 'peer'
    AND rater_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.interview_sessions s
      WHERE s.id = feedback_reports.session_id
        AND (s.user_a_id = auth.uid() OR s.user_b_id = auth.uid())
    )
  );