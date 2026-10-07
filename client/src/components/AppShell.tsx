import { Menu } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Outlet, useOutletContext } from "react-router";
import type { DocumentSummary } from "../../../shared/types";
import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { t } from "@/i18n";
import { useApi } from "@/lib/api";

const RECENT_COUNT = 5;

interface ShellContext {
  refreshRecent: () => void;
}

export const useShell = () => useOutletContext<ShellContext>();

export function AppShell() {
  const api = useApi();
  const [recent, setRecent] = useState<DocumentSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // fetches the whole list and keeps 5. Add a ?limit= param if histories get long.
  const refreshRecent = useCallback(() => {
    api.listDocuments().then((docs) => setRecent(docs.slice(0, RECENT_COUNT)), () => {});
  }, [api]);
  useEffect(refreshRecent, [refreshRecent]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex h-dvh bg-background text-foreground">
      <aside className="hidden w-[280px] shrink-0 border-r border-border lg:flex">
        <Sidebar recent={recent} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border px-3 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={t.nav.openMenu} />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetTitle className="sr-only">{t.nav.menu}</SheetTitle>
              <Sidebar recent={recent} onNavigate={closeMenu} />
            </SheetContent>
          </Sheet>
          <Logo />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet context={{ refreshRecent } satisfies ShellContext} />
        </main>
      </div>
    </div>
  );
}
