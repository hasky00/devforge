import { ClientOnly } from "@/components/ClientOnly";
import { Workspace } from "@/components/workspace/Workspace";

function WorkspaceSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-bg text-text">
      <div className="flex h-12 items-center gap-3 border-b border-border bg-surface px-3">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-surface-2" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-24 animate-pulse rounded bg-surface-2" />
          <div className="h-2.5 w-40 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center text-sm text-text-dim">
        Loading DevForge workspace…
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <ClientOnly fallback={<WorkspaceSkeleton />}>
      <Workspace />
    </ClientOnly>
  );
}
