import type { Metadata } from "next";
import MintClient from "./MintClient";

// The tab said "Mint a Card" and the page said "Mint an Ownership Card". Two
// names for one screen is how a member ends up unsure whether they backed out
// of the flow or into a different one — the title now quotes the H1.
export const metadata: Metadata = {
  title: "Mint an Ownership Card · Cheat Code Club",
};

export default async function MintPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; symbol?: string }>;
}) {
  const sp = await searchParams;
  return <MintClient demo={sp?.demo === "1"} initialSymbol={sp?.symbol ?? ""} />;
}
