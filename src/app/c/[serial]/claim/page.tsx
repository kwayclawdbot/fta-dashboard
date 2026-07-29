import type { Metadata } from "next";
import ClaimClient from "./ClaimClient";
import { demoScan } from "@/components/ownership/demo";
import { resolveScan } from "../../scan-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activate your card · Cheat Code",
  robots: { index: false },
};

type SP = { picc?: string; cmac?: string; demo?: string };

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ serial: string }>;
  searchParams: Promise<SP>;
}) {
  const { serial } = await params;
  const sp = await searchParams;
  const demo = sp.demo === "1" || serial.startsWith("demo-");
  const scan = demo
    ? demoScan(serial)
    : await resolveScan(serial, { picc: sp.picc, cmac: sp.cmac });

  return (
    <ClaimClient
      serial={serial}
      demo={demo}
      chipSerial={scan.chip?.serial ?? null}
      formFactor={scan.chip?.formFactor ?? null}
      claimable={scan.claimable}
      alreadyBound={scan.status === "ok" && !!scan.card}
    />
  );
}
