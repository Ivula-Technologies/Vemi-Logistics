import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VemiMark } from "@/components/brand";
export default function NotFound() {
  return <div className="grid min-h-screen place-items-center px-4 text-center"><div><VemiMark className="mx-auto h-12 w-12" /><h1 className="mt-4 text-2xl font-bold">Wrong turn</h1><p className="mt-1 text-muted-foreground">That page doesn&apos;t exist, or you don&apos;t have access to it.</p><Button asChild className="mt-5"><Link href="/home">Go home</Link></Button></div></div>;
}
