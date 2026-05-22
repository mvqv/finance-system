
CREATE OR REPLACE FUNCTION public.tg_idea_to_committee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'debating' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.set_terminal_mode('committee', 'idea entered debate', 'idea', NEW.id);
  ELSIF NEW.status = 'risk_review' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.set_terminal_mode('risk_review', 'idea entered risk review', 'idea', NEW.id);
  ELSIF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.set_terminal_mode('execution', 'idea approved', 'idea', NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;
