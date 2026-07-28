import type { Metadata } from "next";

/**
 * THE TAB SAYS WHAT THE PAGE SAYS.
 *
 * /watchlist is a client component, so it cannot export metadata of its own —
 * which is why the browser tab fell back to the root "Cheat Code Club |
 * Dashboard" on the one screen a member keeps open all day, alongside a dozen
 * other tabs saying exactly the same thing. This layout supplies the title the
 * board actually prints as its wordmark.
 *
 * Casing: the H1 is set lowercase by the wordmark style (BoardLead applies
 * `lowercase` in CSS, the copy is not written that way). A tab strip is not a
 * masthead, so the title carries the same WORD in sentence case rather than
 * shouting the type treatment into browser chrome.
 *
 * /watchlist/community sits under this layout and overrides it with its own
 * title, because it is a different room with a different name.
 */
export const metadata: Metadata = {
  title: "Watch",
  description:
    "Companies you know, studied properly, decided with conviction — a verdict only unlocks after the homework.",
};

export default function WatchlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
