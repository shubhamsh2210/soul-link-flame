import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRACKS, LEVELS, type Track, type Level } from "@/lib/peerprep";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your profile — PeerPrep" },
      { name: "description", content: "Tell us your track and experience level so we can match you." },
      { property: "og:title", content: "Set up your profile — PeerPrep" },
      { property: "og:description", content: "Choose your interview track and level to start matching." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [track, setTrack] = useState<Track | "">("");
  const [level, setLevel] = useState<Level | "">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("profiles").select("id").eq("id", auth.user.id).maybeSingle();
      if (data) navigate({ to: "/queue", replace: true });
    })();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!track || !level) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").insert({
        id: auth.user.id,
        display_name: displayName.trim(),
        track,
        experience_level: level,
      });
      if (error) throw error;
      navigate({ to: "/queue", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-hero flex min-h-screen items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="surface-panel w-full max-w-md p-7">
        <h1 className="text-xl font-semibold">One quick setup</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          This is all we need to match you with the right peer.
        </p>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              required
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex R."
            />
          </div>

          <div className="space-y-2">
            <Label>Track</Label>
            <Select value={track} onValueChange={(v) => setTrack(v as Track)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose your track" />
              </SelectTrigger>
              <SelectContent>
                {TRACKS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Experience level</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose your level" />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button type="submit" className="mt-7 w-full" disabled={busy || !track || !level}>
          Continue
        </Button>
      </form>
    </div>
  );
}
