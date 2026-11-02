import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upload your documents',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
