import { Suspense } from "react";
import { BolaoApp } from "@/app/components/bolao-app";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 text-slate-700 shadow-sm">
            Carregando bolão...
          </div>
        </main>
      }
    >
      <BolaoApp />
    </Suspense>
  );
}
