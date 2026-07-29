import type { Metadata } from "next";
import CollectionClient from "./CollectionClient";

export const metadata: Metadata = {
  title: "Your Collection · Cheat Code Club",
};

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const sp = await searchParams;
  return <CollectionClient demo={sp?.demo === "1"} />;
}
