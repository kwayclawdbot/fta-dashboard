import SettingsSurface from "@/components/settings/SettingsSurface";

/**
 * /settings — no canvas board exists for this surface, so it is derived from
 * the canvas design language: section rules + hairline ledger rows, no
 * settings-cards, and the shared SegmentedRail for the theme picker so every
 * one-of-N control in the app shares one keyboard model.
 *
 * Theme, notification prefs, membership and sign-out are all live controls, not
 * display. Every commercial string (plan labels, renewal line, Challenge Pass,
 * billing row) is byte-identical to what shipped.
 */
export default function SettingsPage() {
  return <SettingsSurface />;
}
