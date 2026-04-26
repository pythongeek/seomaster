import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEOMaster - AI-Powered SEO Analytics",
  description: "GSC Command Center, CTR Lab, and AI-driven SEO insights powered by MiniMax M2.7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}