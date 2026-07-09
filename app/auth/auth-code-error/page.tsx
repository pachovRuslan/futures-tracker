export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-[var(--color-text-muted)]">
      Не удалось войти. Попробуй ещё раз со страницы{" "}
      <a href="/login" className="text-[var(--color-accent)] underline">
        входа
      </a>
      .
    </div>
  );
}
