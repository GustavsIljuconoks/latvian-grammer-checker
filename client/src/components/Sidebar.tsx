import { useClerk, useUser } from "@clerk/react";
import { Link, NavLink } from "react-router";
import type { DocumentSummary } from "../../../shared/types";
import { Logo } from "@/components/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/i18n";
import { formatShortDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { paths } from "@/routes";

export function Sidebar({ recent, onNavigate }: { recent: DocumentSummary[]; onNavigate?: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || "";

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <Link to={paths.checker} onClick={onNavigate} className="px-6 pt-7 pb-5">
        <Logo />
      </Link>

      <div className="px-5 pb-5">
        <Link
          to={paths.checker}
          onClick={onNavigate}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-[42px] w-full rounded-full border-input text-[13px] font-medium shadow-[0_1px_2px_rgba(17,17,17,0.04)]",
          )}
        >
          <span className="text-[15px] leading-none">+</span> {t.nav.newCheck}
        </Link>
      </div>

      <nav aria-label={t.nav.history} className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
        <div className="mx-2 mt-2 mb-2.5 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{t.nav.history}</span>
          <Link to={paths.history} onClick={onNavigate} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
            {t.nav.seeAll}
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mx-2 text-xs text-faint">{t.nav.empty}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {recent.map((doc) => (
              <li key={doc.id}>
                <NavLink
                  to={paths.document(doc.id)}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn("flex items-center gap-2.5 rounded-[10px] p-2 transition-colors hover:bg-accent", isActive && "bg-accent")
                  }
                >
                  <span className="size-7 shrink-0 rounded-lg bg-secondary" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium leading-snug">{doc.title}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-faint">{formatShortDate(doc.createdAt)}</span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-border px-5 pt-4 pb-5">
        <Avatar className="size-9">
          {user?.hasImage && <AvatarImage src={user.imageUrl} alt="" />}
          <AvatarFallback className="bg-secondary text-xs font-semibold">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{name}</div>
          <div className="mt-px text-[11px] text-subtle">
            <Link to={paths.settings} onClick={onNavigate} className="hover:text-foreground">
              {t.nav.settings}
            </Link>{" "}
            ·{" "}
            <button type="button" onClick={() => signOut()} className="hover:text-foreground">
              {t.nav.signOut}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
