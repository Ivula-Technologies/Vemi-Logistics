"use client";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
export function Toaster(props: ToasterProps) {
  const { theme = "system" } = useTheme();
  return <Sonner theme={theme as ToasterProps["theme"]} toastOptions={{ classNames: { toast: "bg-card text-card-foreground border-border", description: "text-muted-foreground" } }} {...props} />;
}
