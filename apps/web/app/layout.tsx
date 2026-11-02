import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocRequest',
  description: 'Collect documents from clients securely.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
