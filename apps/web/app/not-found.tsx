import Link from "next/link";
export default function NotFound() {
  return (
    <main className="boot">
      <div>
        <p className="eyebrow">404 / OpsGlass</p>
        <h1>This page has moved.</h1>
        <p>Your projects are in the workspace.</p>
        <Link className="button primary" href="/">
          Open workspace
        </Link>
      </div>
    </main>
  );
}
