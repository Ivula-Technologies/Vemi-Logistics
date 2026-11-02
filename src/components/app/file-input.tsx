"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { CLIENT_MAX_UPLOAD_BYTES, shrinkImage } from "@/lib/shrink-image";

/** A file input that shrinks phone photos before the form is sent and refuses files over the upload limit. */
export function FileInput(props: Omit<React.ComponentProps<"input">, "type" | "onChange">) {
  const [busy, setBusy] = useState(false);
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    setBusy(true);
    const shrunk = await Promise.all(files.map(shrinkImage));
    setBusy(false);
    const tooBig = shrunk.find((f) => f.size > CLIENT_MAX_UPLOAD_BYTES);
    input.setCustomValidity(tooBig ? `"${tooBig.name}" is over ${CLIENT_MAX_UPLOAD_BYTES / 1024 / 1024} MB. Use a smaller photo or scan.` : "");
    if (tooBig) { input.reportValidity(); return; }
    if (shrunk.some((f, i) => f !== files[i]) && typeof DataTransfer !== "undefined") {
      const list = new DataTransfer();
      shrunk.forEach((f) => list.items.add(f));
      input.files = list.files;
    }
  }
  return <>
    <Input {...props} type="file" onChange={onChange} />
    {busy ? <span className="sr-only" role="status">Preparing photo…</span> : null}
  </>;
}
