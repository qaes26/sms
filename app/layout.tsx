import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Willkommen | Live-Verifikation & Übertragung',
  description: 'Sichere Verifikation per SMS und WebRTC Live-Übertragung.',
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="antialiased min-h-screen selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
