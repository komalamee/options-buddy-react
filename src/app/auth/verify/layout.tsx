export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify page has its own full-screen layout (no sidebar/header)
  return <>{children}</>;
}
