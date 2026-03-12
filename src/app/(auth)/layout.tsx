export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-midnight-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          <span className="text-gradient-gold">Family Trading Academy</span>
        </h1>
        <p className="mt-2 text-midnight-300 text-sm font-body">
          Build Generational Wealth Together
        </p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md glow-border rounded-2xl bg-midnight-900/80 backdrop-blur-sm p-8">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-8 text-midnight-400 text-xs font-body">
        &copy; {new Date().getFullYear()} Family Trading Academy. All rights reserved.
      </p>
    </div>
  );
}
