import { useState } from "react";
import { useNavigate } from "react-router";
import { MAX_TEXT_CHARS } from "../../../shared/types";
import { useShell } from "@/components/AppShell";
import { PageFrame } from "@/components/PageFrame";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { errorMessage, useApi } from "@/lib/api";
import { countWords } from "@/lib/format";
import { cn } from "@/lib/utils";
import { paths } from "@/routes";

export function CheckerPage() {
  const api = useApi();
  const navigate = useNavigate();
  const { refreshRecent } = useShell();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const tooLong = text.length > MAX_TEXT_CHARS;

  async function check() {
    setBusy(true);
    setError(undefined);
    try {
      const document = await api.createDocument(text);
      refreshRecent();
      navigate(paths.document(document.id), { state: { document } });
    } catch (err) {
      setError(errorMessage(err)); // the text stays in the box
      setBusy(false);
    }
  }

  return (
    <PageFrame title={t.checker.title} subtitle={t.checker.subtitle}>
      <div className="surface flex min-h-[420px] flex-1 flex-col px-5 py-6 lg:px-8 lg:py-7">
        <label htmlFor="checker-input" className="sr-only">
          {t.checker.inputLabel}
        </label>
        <textarea
          id="checker-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          readOnly={busy}
          placeholder={t.checker.placeholder}
          className="flex-1 resize-none bg-transparent text-base leading-[1.7] text-foreground caret-foreground outline-none"
        />
        {(error || tooLong) && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error ?? t.errors.TEXT_TOO_LONG}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-4">
          <span className={cn("font-mono text-[11px] text-faint", tooLong && "text-destructive")}>
            {t.checker.counts(countWords(text), text.length)}
          </span>
          <Button
            onClick={check}
            disabled={busy || !text.trim() || tooLong}
            className="h-[42px] rounded-full px-[22px] text-[13px] font-semibold"
          >
            {busy ? t.checker.checking : `${t.checker.check} →`}
          </Button>
        </div>
      </div>
    </PageFrame>
  );
}
