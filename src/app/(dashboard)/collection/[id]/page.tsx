import type { Metadata } from "next";
import CardDetailClient from "./CardDetailClient";

export const metadata: Metadata = {
  title: "Ownership Card · Cheat Code Club",
};

export default async function CardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  return <CardDetailClient id={id} demo={sp?.demo === "1"} />;
}
