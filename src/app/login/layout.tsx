export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Login page has its own full-screen layout (no sidebar/header)
  return <>{children}</>;
}
