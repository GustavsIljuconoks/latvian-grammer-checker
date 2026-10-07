import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useClerk, useUser } from "@clerk/react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useShell } from "@/components/AppShell";
import { ConfirmAction } from "@/components/ConfirmAction";
import { PageFrame } from "@/components/PageFrame";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants } from "@/components/ui/tabs";
import { t } from "@/i18n";
import { useApi } from "@/lib/api";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-auto rounded-[10px] border-0 bg-secondary px-3.5 py-3 text-sm shadow-none focus-visible:bg-[#ececE6] focus-visible:ring-2 focus-visible:ring-foreground/15";
const pillClass = "h-[42px] rounded-full px-[22px] text-[13px] font-semibold";
const TABS = ["profile", "account"] as const;
const listClass = "h-auto w-fit gap-1 rounded-full p-1";
const tabShape = "rounded-full px-[18px] py-[9px] text-[13px] font-semibold";
const tabClass = cn(tabShape, "text-muted-foreground shadow-none data-active:bg-transparent data-active:shadow-none");

export function SettingsPage() {
  return (
    <PageFrame title={t.settings.title} subtitle={t.settings.subtitle}>
      <Tabs defaultValue="profile" className="max-w-[640px]">
        <TabsList className={cn(listClass, "relative mb-7 bg-accent")}>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className={tabClass}>
              {t.settings.tabs[tab]}
            </TabsTrigger>
          ))}
          {/* A copy of the list in active colors, clipped to the active tab, so pill and text move as one. */}
          <TabsPrimitive.Indicator
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-[clip-path] duration-[220ms] ease-in-out [clip-path:inset(var(--active-tab-top)_var(--active-tab-right)_var(--active-tab-bottom)_var(--active-tab-left)_round_9999px)] motion-reduce:duration-75"
          >
            <span className={cn(tabsListVariants(), listClass, "bg-foreground")}>
              {TABS.map((tab) => (
                <span
                  key={tab}
                  className={cn(
                    "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center border border-transparent whitespace-nowrap text-background",
                    tabShape,
                  )}
                >
                  {t.settings.tabs[tab]}
                </span>
              ))}
            </span>
          </TabsPrimitive.Indicator>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
      </Tabs>
    </PageFrame>
  );
}

function ProfileTab() {
  const { user } = useUser();
  const [name, setName] = useState(user?.fullName ?? "");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!user) return null;

  const email = user.primaryEmailAddress?.emailAddress ?? "";

  async function save() {
    setSaving(true);
    const [firstName = "", ...rest] = name.trim().split(/\s+/);
    try {
      await user!.update({ firstName, lastName: rest.join(" ") });
      toast(t.settings.saved);
    } catch {
      toast.error(t.settings.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function setPhoto(file: File | null) {
    try {
      await user!.setProfileImage({ file });
    } catch {
      toast.error(t.settings.photoFailed);
    }
  }

  return (
    <>
      <div className="surface mb-6 p-6 lg:p-8">
        <div className="mb-7 flex items-center gap-[18px] border-b border-hairline pb-7">
          <Avatar className="size-[68px]">
            {user.hasImage && <AvatarImage src={user.imageUrl} alt="" />}
            <AvatarFallback className="bg-secondary text-[22px] font-semibold">{initials(name || email)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="mb-1.5 text-sm font-semibold">{t.settings.photo}</div>
            <div className="flex gap-4 text-[13px]">
              <button type="button" className="underline" onClick={() => fileInput.current?.click()}>
                {t.settings.changePhoto}
              </button>
              {user.hasImage && (
                <button type="button" className="text-subtle underline" onClick={() => setPhoto(null)}>
                  {t.settings.removePhoto}
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void setPhoto(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="settings-name" className="mb-2 block text-xs font-medium text-muted-foreground">
              {t.settings.fullName}
            </Label>
            <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={fieldClass} />
          </div>
          <div>
            <Label htmlFor="settings-email" className="mb-2 block text-xs font-medium text-muted-foreground">
              {t.settings.email}
            </Label>
            <Input id="settings-email" value={email} readOnly className={`${fieldClass} text-muted-foreground`} />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className={pillClass}>
          {t.settings.save}
        </Button>
      </div>
    </>
  );
}

function AccountTab() {
  const api = useApi();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { refreshRecent } = useShell();

  async function signOutEverywhere() {
    const sessions = (await user?.getSessions()) ?? [];
    await Promise.all(sessions.map((s) => s.revoke()));
    await signOut();
  }

  return (
    <section>
      <h2 className="mb-3.5 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{t.settings.dangerZone}</h2>
      <DangerRow title={t.settings.signOutAll} text={t.settings.signOutAllText}>
        <Button variant="outline" onClick={signOutEverywhere} className="h-[38px] rounded-full border-input px-[18px] text-xs font-semibold">
          {t.settings.signOutAllButton}
        </Button>
      </DangerRow>
      <DangerRow title={t.settings.deleteHistory} text={t.settings.deleteHistoryText}>
        <ConfirmAction
          trigger={<Button variant="outline" className="h-[38px] rounded-full border-input px-[18px] text-xs font-semibold" />}
          triggerContent={t.settings.deleteHistory}
          title={t.settings.deleteHistoryConfirm}
          description={t.settings.irreversible}
          confirmLabel={t.settings.deleteHistory}
          onConfirm={async () => {
            await api.deleteAllDocuments();
            refreshRecent();
            toast(t.settings.historyDeleted);
          }}
        />
      </DangerRow>
      <DangerRow title={t.settings.deleteAccount} text={t.settings.deleteAccountText}>
        <ConfirmAction
          trigger={<button type="button" className="text-xs font-semibold text-muted-foreground underline hover:text-destructive" />}
          triggerContent={t.settings.deleteAccount}
          title={t.settings.deleteAccountConfirm}
          description={t.settings.irreversible}
          confirmLabel={t.settings.deleteAccount}
          onConfirm={async () => {
            await api.deleteMe();
            // later move this to server
            await user?.delete();
          }}
        />
      </DangerRow>
    </section>
  );
}

function DangerRow({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4 border-t border-border pt-4">
      <div>
        <div className="mb-0.5 text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{text}</div>
      </div>
      {children}
    </div>
  );
}
