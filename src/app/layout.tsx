import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantessa — Kota Innovista",
  description:
    "Quantessa — the division-aware AI work assistant for the Kota Innovista team. A real estate & property AI agent by Quantaland, helping every department move from questions to clear next steps.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}