import { Sora, Manrope } from 'next/font/google';
import './globals.css';
import { TennisServiceSilhouette } from '@/components/ui/TennisServiceSilhouette';
import { CourtLinesBackground } from '@/components/ui/CourtLinesBackground';

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-sora',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
});

export const metadata = {
  title: 'CourtSync',
  description: 'Plateforme de suivi pour coachs de tennis et parents',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sora.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('courtsync-theme');
                if (!theme) {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen font-manrope bg-[var(--bg-main)] text-[var(--text-main)] antialiased transition-colors duration-300">
        <CourtLinesBackground className="fixed inset-0 z-0" />
        <TennisServiceSilhouette className="fixed bottom-0 right-0 w-[420px] h-[420px] z-0 opacity-[0.04] dark:opacity-[0.03] pointer-events-none" />
        {children}
      </body>
    </html>
  )
}
