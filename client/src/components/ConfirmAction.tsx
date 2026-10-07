import { useState, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/api";

export function ConfirmAction(props: {
  /** What the trigger renders as, without children (Base UI `render`), e.g. `<Button variant="outline" />`. */
  trigger: ReactElement;
  triggerContent: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false); // controlled, so the dialog stays open on failure and closes on success
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await props.onConfirm();
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={props.trigger}>{props.triggerContent}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription>{props.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction className="rounded-full" disabled={busy} onClick={confirm}>
            {props.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
