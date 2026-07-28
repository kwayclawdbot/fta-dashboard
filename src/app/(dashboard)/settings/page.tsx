import SettingsSurface from "@/components/settings/SettingsSurface";

/**
 * /settings — no board in the archive draws this surface, so it is composed
 * from the vocabulary the boards do draw: the lowercase wordmark masthead of
 * board 07, white rounded cards with hairline borders, mono eyebrows, and rows
 * separated by hairlines INSIDE a card (board 22's explainer object) rather
 * than a stack of loose rules on the paper. The theme picker is the shared
 * SegmentedRail, so every one-of-N control in the app has one keyboard model.
 *
 * Theme, notification prefs, membership and sign-out are all live controls, not
 * display. Every commercial string (plan labels, renewal line, Challenge Pass,
 * billing row) is byte-identical to what shipped, including the `push_challenge`
 * row the Challenge lane added.
 */
export default function SettingsPage() {
  return <SettingsSurface />;
}
