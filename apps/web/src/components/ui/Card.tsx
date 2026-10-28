export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-[13px] border border-[#e8e7f0] bg-surface p-5 shadow-card ${className}`}>
      {children}
    </section>
  );
}
