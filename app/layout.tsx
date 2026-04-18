import "./globals.css";

export const metadata = {
  title: "Turbo-Energy Machine Availability",
  description: "Shared fleet dashboard"
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
