import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laurea di Annachiara Soldivieri",
  description: "Invito alla festa di laurea di Annachiara Soldivieri",
  robots: {
    index: false,
    follow: false
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
