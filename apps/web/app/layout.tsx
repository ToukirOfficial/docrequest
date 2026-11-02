import type { Metadata } from 'next';
import { Public_Sans, Schibsted_Grotesk } from 'next/font/google';
import './globals.css';
import { DemoBanner } from '@/components/demo-banner';

const display = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
  display: 'swap',
});
const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'DocRequest', template: '%s · DocRequest' },
  description: 'Collect documents from clients securely, on your own server.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" className={`${publicSans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
