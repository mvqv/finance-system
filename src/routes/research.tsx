import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Brain, Search } from "lucide-react";

export const Route = createFileRoute("/research")({ component: ResearchPage });

interface Match {
  id: string;
  kind: string;
  title: string;
  content: string;
  similarity: number;
}

function ResearchPage() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["memos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("investment_memos")
        .select("*, ideas(title, side, status)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  const [idxTitle, setIdxTitle] = useState("");
  const [idxContent, setIdxContent] = useState("");
  const [idxBusy, setIdxBusy] = useState(false);

  async function ask() {
    if (!query.trim()) return;
    setBusy(true);
    setAnswer(null);
    try {
      const { data, error } = await supabase.functions.invoke("research-query", {
        body: { query, k: 5 },
      });
      if (error) throw error;
      setAnswer(data.answer);
      setMatches(data.matches ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("research.queryFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function indexNote() {
    if (!idxTitle.trim() || !idxContent.trim()) return toast.error(t("research.titleContentRequired"));
    setIdxBusy(true);
    try {
      const { error } = await supabase.functions.invoke("embed-document", {
        body: { kind: "note", title: idxTitle, content: idxContent },
      });
      if (error) throw error;
      toast.success(t("research.indexed"));
      setIdxTitle("");
      setIdxContent("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("research.indexingFailed"));
    } finally {
      setIdxBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title={t("research.title")} subtitle={t("research.subtitle")} />
      <div className="space-y-6 px-8 py-6">
        <div className="panel p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Brain className="h-3.5 w-3.5" /> {t("research.askMemory")}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("research.askPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
            />
            <Button onClick={ask} disabled={busy}>
              <Search className="mr-1 h-4 w-4" /> {busy ? t("research.searching") : t("research.ask")}
            </Button>
          </div>
          {answer && (
            <div className="mt-4 rounded border bg-surface p-4 text-sm leading-relaxed">
              <AnswerWithCitations answer={answer} matches={matches} />
            </div>
          )}
          {matches.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("research.sources")}</div>
              <div className="space-y-2">
                {matches.map((m, i) => (
                  <a
                    key={m.id}
                    id={`cite-${i + 1}`}
                    href={`#cite-${i + 1}`}
                    className="block rounded border bg-surface-2 p-3 text-xs hover:border-atlantix"
                  >
                    <div className="flex items-center gap-2 font-mono uppercase tracking-widest text-muted-foreground">
                      <span className="rounded bg-atlantix/15 px-1.5 py-0.5 text-atlantix">#{i + 1}</span>
                      <span>{m.kind}</span>
                      <span className="ml-auto">{t("research.sim")} {m.similarity.toFixed(3)}</span>
                    </div>
                    <div className="mt-1 font-display text-sm">{m.title}</div>
                    <div className="mt-1 line-clamp-3 text-muted-foreground">{m.content}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("research.indexNote")}</div>
          <Input placeholder={t("research.titlePh")} value={idxTitle} onChange={(e) => setIdxTitle(e.target.value)} />
          <Textarea
            placeholder={t("research.notePh")}
            value={idxContent}
            onChange={(e) => setIdxContent(e.target.value)}
            className="mt-2 min-h-[100px]"
          />
          <Button className="mt-2" onClick={indexNote} disabled={idxBusy}>
            {idxBusy ? t("research.indexing") : t("research.indexBtn")}
          </Button>
        </div>

        {data?.length === 0 && (
          <div className="panel p-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {t("research.noMemos")}
          </div>
        )}
        {data?.map((m) => {
          const idea = m.ideas as { title?: string; side?: string; status?: string } | null;
          const content = m.content as Record<string, unknown> | null;
          return (
            <div key={m.id} className="panel p-5">
              <div className="flex items-center gap-3">
                <div className="font-display text-lg">{idea?.title}</div>
                <span className={`font-mono text-[10px] uppercase tracking-widest ${idea?.side === "long" ? "text-bull" : "text-bear"}`}>
                  {idea?.side}
                </span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {m.generated_by_model ?? t("research.manual")} · {new Date(m.created_at).toLocaleDateString()}
                </span>
              </div>
              {content && (
                <pre className="mt-3 max-h-64 overflow-auto rounded bg-surface p-3 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(content, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function AnswerWithCitations({ answer, matches }: { answer: string; matches: Match[] }) {
  const parts = answer.split(/(\[#\d+\])/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, idx) => {
        const m = /^\[#(\d+)\]$/.exec(p);
        if (!m) return <span key={idx}>{p}</span>;
        const n = Number(m[1]);
        const src = matches[n - 1];
        return (
          <a
            key={idx}
            href={`#cite-${n}`}
            title={src?.title ?? `Memo #${n}`}
            className="mx-0.5 inline-flex items-center rounded bg-atlantix/15 px-1.5 py-0.5 align-baseline font-mono text-[10px] font-semibold text-atlantix hover:bg-atlantix/30"
          >
            Memo #{n}
          </a>
        );
      })}
    </span>
  );
}
