"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, Smartphone, Tablet, Monitor, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listDevices, removeDevice, type DeviceRow } from "@/lib/push";

/**
 * Settings device list — every device this user has subscribed for push, with
 * a human label, last-seen time, a "This device" marker, and per-device remove.
 * Complements EnablePushButton (which shows THIS device's true on/off/blocked
 * state). Reflects the self-heal: rows keep a fresh last_seen while the device
 * keeps opening the app; abandoned ones age out of the 60-day sweep.
 */

function DeviceIcon({ label }: { label: string | null }) {
  const l = (label || "").toLowerCase();
  const cls = "w-4 h-4 text-midnight-300";
  if (l.includes("iphone") || l.includes("android")) return <Smartphone className={cls} />;
  if (l.includes("ipad") || l.includes("tablet")) return <Tablet className={cls} />;
  if (l.includes("mac") || l.includes("linux")) return <Laptop className={cls} />;
  if (l.includes("windows")) return <Monitor className={cls} />;
  return <Laptop className={cls} />;
}

function seenAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 120) return "active now";
  const m = Math.floor(s / 60);
  if (m < 60) return `last seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `last seen ${h}h ago`;
  const d = Math.floor(h / 24);
  return `last seen ${d}d ago`;
}

export default function PushDevices() {
  const supabase = createClient();
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setDevices([]);
      return;
    }
    setDevices(await listDevices(supabase, user.id));
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRemove(d: DeviceRow) {
    setRemoving(d.id);
    await removeDevice(supabase, d.id, d.endpoint);
    setRemoving(null);
    await load();
  }

  if (devices === null || devices.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs font-medium text-midnight-400 uppercase tracking-wide mb-2">
        Your devices
      </p>
      <ul className="space-y-2">
        {devices.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 rounded-lg border border-sand bg-paper/40 px-3 py-2.5"
          >
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-midnight-800 shrink-0">
              <DeviceIcon label={d.device_label} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-midnight-100 truncate">
                {d.device_label || "Device"}
                {d.is_this_device && (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-gold-600">
                    This device
                  </span>
                )}
              </p>
              <p className="text-xs text-midnight-500">{seenAgo(d.last_seen_at)}</p>
            </div>
            <button
              onClick={() => handleRemove(d)}
              disabled={removing === d.id}
              aria-label="Remove device"
              className="text-midnight-500 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0"
            >
              {removing === d.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
