import { LoadingState } from "../components/ui";

export default function Loading() {
  return (
    <main className="page route-loading" aria-busy="true">
      <LoadingState label="Bogga waa la soo rarayaa…" />
    </main>
  );
}
