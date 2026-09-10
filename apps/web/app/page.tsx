import { Suspense } from "react";
import Portal from "./components/Portal";
export default function Page() {
  return (
    <Suspense fallback={<div className="boot">Opening your workspace…</div>}>
      <Portal />
    </Suspense>
  );
}
