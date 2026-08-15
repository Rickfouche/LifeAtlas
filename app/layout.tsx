import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life Atlas",
  description: "A spatial system for mapping life across past, present, and future.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}