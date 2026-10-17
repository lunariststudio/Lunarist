-- Client Hub delivery approval: narrowly scoped, authenticated state transition.
-- Does not alter status until the caller owns the commission and it is delivered.

CREATE OR REPLACE FUNCTION public.client_approve_commission(p_commission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_client_id uuid := auth.uid();
  v_commission public.commissions%ROWTYPE;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;

  SELECT *
    INTO v_commission
    FROM public.commissions
   WHERE id = p_commission_id
     AND client_id = v_client_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Commission not found or access denied';
  END IF;

  IF v_commission.status IS DISTINCT FROM 'delivered' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Only delivered commissions can be approved';
  END IF;

  UPDATE public.commissions
     SET status = 'completed', updated_at = pg_catalog.now()
   WHERE id = v_commission.id
   RETURNING * INTO v_commission;

  RETURN jsonb_build_object('id', v_commission.id, 'status', v_commission.status);
END;
$$;

REVOKE ALL ON FUNCTION public.client_approve_commission(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_approve_commission(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.client_approve_commission(uuid) TO authenticated;
