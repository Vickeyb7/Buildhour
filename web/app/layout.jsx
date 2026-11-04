import "./globals.css";

export const metadata = {
  title: "HDFC MF FAQ",
  description: "Facts-only answers about select HDFC Mutual Fund schemes.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
