import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-border/60 border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/queue" className="text-lg font-bold tracking-tight">
          Peer<span className="text-primary">Prep</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
