import { Brand } from "@/components/brand";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen lg:grid-cols-2">
    <div className="relative hidden overflow-hidden bg-[#151a24] p-10 text-white lg:flex lg:flex-col lg:justify-between">
      <Brand className="text-white [&_span]:text-white/80" />
      <div className="relative z-10 max-w-md">
        <p className="text-3xl font-bold leading-tight">Every truck verified. Every shilling tracked. Every trip on the map.</p>
        <p className="mt-4 text-white/70">From Mombasa port to Kampala, Kigali and Juba. Shippers post loads in a minute; truck owners bid and get paid to M-Pesa within 24 hours of delivery.</p>
      </div>
      <svg aria-hidden="true" viewBox="0 0 400 400" className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] opacity-25"><path d="M40 20 200 380 360 20" fill="none" stroke="#f26a1b" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" /><path d="M200 60v220" stroke="#fff" strokeWidth="14" strokeDasharray="24 30" strokeLinecap="round" /></svg>
    </div>
    <div className="flex flex-col px-4 py-8 sm:px-8">
      <div className="lg:hidden"><Brand /></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
    </div>
  </div>;
}
