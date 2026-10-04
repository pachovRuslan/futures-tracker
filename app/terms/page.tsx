import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Условия использования — Futures Tracker",
  description: "Условия использования приложения и подписки Futures Tracker.",
};

/**
 * Публичная страница условий использования (Terms of Use).
 * Требование App Store Review (подписки должны иметь публичные terms)
 * и Google Play. Добавлена в publicPaths middleware.
 *
 * ⚠️ Перед публикацией заполните SUPPORT_EMAIL.
 */
const SUPPORT_EMAIL = "support@example.com"; // TODO: заменить на реальный

const LAST_UPDATED = "2026-10-05";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-[var(--color-text)]">{title}</h2>
      <div className="text-sm leading-relaxed text-[var(--color-text-muted)] flex flex-col gap-3">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8 py-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold text-[var(--color-text)]">
          Условия использования
        </h1>
        <p className="text-xs text-[var(--color-text-faint)]">
          Futures Tracker · Последнее обновление: {LAST_UPDATED}
        </p>
      </header>

      <Section title="1. О сервисе">
        <p>
          Futures Tracker — приложение для ведения журнала фьючерсных сделок и
          личной статистики. Сервис предоставляется &laquo;как есть&raquo; и
          предназначен для личного некоммерческого использования трейдером для
          учёта собственной активности.
        </p>
      </Section>

      <Section title="2. Аккаунт">
        <p>
          Для работы приложения требуется аккаунт (вход через Google или
          Apple). Вы отвечаете за сохранность доступа к своему аккаунту
          провайдера. Аккаунт можно удалить в любой момент в настройках
          приложения — все связанные данные будут стёрты безвозвратно.
        </p>
      </Section>

      <Section title="3. Бесплатный план и подписка Premium">
        <p>
          Бесплатный план позволяет вести до 50 сделок. Подписка Premium
          (авто-синк бирж и неограниченное количество сделок) оформляется
          через встроенную покупку в Google Play или App Store и
          автоматически продлевается, пока вы её не отмените.
        </p>
        <p>
          Оплата списывается с вашего счёта в магазине при подтверждении
          покупки. Управление подпиской и отмену автопродления можно
          выполнить в любой момент в настройках аккаунта магазина (Google
          Play / App Store). После отмены подписка действует до конца
          оплаченного периода.
        </p>
        <p>
          Восстановление ранее купленной подписки доступно в приложении
          кнопкой &laquo;Восстановить покупки&raquo; на экране Premium.
        </p>
      </Section>

      <Section title="4. Ответственность и отказ от гарантий">
        <p>
          Приложение носит информационный характер и не является
          инвестиционной рекомендацией, торговой платформой или Signals-as-a-
          Service. Мы не гарантируем абсолютную точность загруженных с бирж
          данных и не несём ответственности за торговые решения, принятые на
          основе статистики приложения. Вы используете сервис на свой риск.
        </p>
        <p>
          Функция авто-синка требует API-ключей биржи с правами
          &laquo;только чтение&raquo;. Вы самостоятельно контролируете создание
          и права таких ключей на стороне биржи.
        </p>
      </Section>

      <Section title="5. Правомерное использование">
        <p>
          Запрещено использовать приложение в целях, нарушающих законы,
          пытаться обходить лимиты бесплатного плана, вмешиваться в работу
          серверов или злоупотреблять API. Мы вправе ограничить доступ при
          нарушении этих условий.
        </p>
      </Section>

      <Section title="6. Изменения условий">
        <p>
          Условия могут обновляться вместе с развитием приложения. Продолжая
          использовать сервис после публикации изменений, вы принимаете
          обновлённую редакцию. Вопросы и предложения: {SUPPORT_EMAIL}.
        </p>
      </Section>

      <footer className="text-xs text-[var(--color-text-faint)] pt-4 border-t border-[var(--color-border)]">
        Контакт: {SUPPORT_EMAIL}
      </footer>
    </div>
  );
}
