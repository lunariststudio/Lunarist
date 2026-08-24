BEGIN;

ALTER TABLE public.commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE public.commissions ADD CONSTRAINT commissions_status_check CHECK (
  status = ANY (ARRAY[
    'waitlist','requested','new','contacted','accepted','unpaid','pending_payment','paid',
    'wip1','wip2','wip3','in_progress','delivered','revisions','completed','cancelled','disputed'
  ]::text[])
);

CREATE INDEX IF NOT EXISTS commissions_artist_created_idx ON public.commissions (artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commissions_client_created_idx ON public.commissions (client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.commission_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commission_status_history_commission_idx
  ON public.commission_status_history (commission_id, created_at DESC);

ALTER TABLE public.commission_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_history_select_participant ON public.commission_status_history;
CREATE POLICY commission_history_select_participant
ON public.commission_status_history
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.commissions c
    WHERE c.id = commission_id
      AND (c.artist_id = auth.uid() OR c.client_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

CREATE OR REPLACE FUNCTION public.record_commission_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.commission_status_history(commission_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commissions_status_history_trigger ON public.commissions;
CREATE TRIGGER commissions_status_history_trigger
AFTER UPDATE OF status ON public.commissions
FOR EACH ROW
EXECUTE FUNCTION public.record_commission_status_change();

DROP POLICY IF EXISTS commissions_select_participant ON public.commissions;
CREATE POLICY commissions_select_participant
ON public.commissions
FOR SELECT TO authenticated
USING (
  artist_id = auth.uid()
  OR client_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS commissions_update_artist_or_admin ON public.commissions;
CREATE POLICY commissions_update_artist_or_admin
ON public.commissions
FOR UPDATE TO authenticated
USING (
  artist_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
)
WITH CHECK (
  artist_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

COMMIT;
