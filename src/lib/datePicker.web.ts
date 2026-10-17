/*
 * The website's date and time picker: the browser's own (a hidden date or time field, opened straight away), answering the same way as the
 * phone's picker does ({ type: "set" } with the date, or "dismissed").
 */
type Answer = (e: { type: "set" | "dismissed" }, d?: Date) => void;
interface Opts { value: Date; mode?: "date" | "time"; minimumDate?: Date; maximumDate?: Date; onChange?: Answer; is24Hour?: boolean; [other: string]: unknown }

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function openDatePicker(opts: Opts) {
  const time = opts.mode === "time";
  const input = document.createElement("input");
  input.type = time ? "time" : "date";
  input.value = time ? `${pad(opts.value.getHours())}:${pad(opts.value.getMinutes())}` : ymd(opts.value);
  if (!time && opts.minimumDate) input.min = ymd(opts.minimumDate);
  if (!time && opts.maximumDate) input.max = ymd(opts.maximumDate);
  Object.assign(input.style, { position: "fixed", left: "50%", top: "40%", opacity: "0", width: "1px", height: "1px", pointerEvents: "none" });
  // inside the open pop-up, if there is one: a pop-up keeps the keyboard's focus inside itself, so a field outside it lost focus at once
  // and the calendar closed as soon as it opened
  const dialogs = document.querySelectorAll('[aria-modal="true"]');
  const host = (document.activeElement?.closest('[aria-modal="true"]') as HTMLElement | null) ?? (dialogs[dialogs.length - 1] as HTMLElement | undefined) ?? document.body;
  host.appendChild(input);
  let done = false;
  const finish = (set: boolean) => {
    if (done) return;
    done = true;
    input.remove();
    if (!set || !input.value) return opts.onChange?.({ type: "dismissed" });
    let d: Date;
    if (time) {
      const [h, m] = input.value.split(":").map(Number);
      d = new Date(opts.value);
      d.setHours(h, m, 0, 0);
    } else {
      const [y, mo, da] = input.value.split("-").map(Number);
      d = new Date(y, mo - 1, da, 12);
    }
    opts.onChange?.({ type: "set" }, d);
  };
  input.addEventListener("change", () => finish(true));
  input.addEventListener("blur", () => setTimeout(() => finish(false), 300));
  input.focus();
  try {
    (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
  } catch {
    /* an older browser: the field is focused, and its picker opens on the next tap */
  }
}
