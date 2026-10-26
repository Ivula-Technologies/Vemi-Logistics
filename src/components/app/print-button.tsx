"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return <Button type="button" variant="outline" onClick={() => window.print()} className="print:hidden"><Printer className="mr-2 h-4 w-4" />{label}</Button>;
}
