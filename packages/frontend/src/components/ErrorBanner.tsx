export default function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner" data-testid="error-banner">{message}</div>;
}
