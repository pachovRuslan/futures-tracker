import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Futures Tracker",
  description:
    "Как Futures Tracker собирает, использует и защищает данные пользователей.",
};

/**
 * Публичная страница политики конфиденциальности.
 *
 * Требование Google Play (Data safety / Account deletion) и App Store
 * (Review 5.1.1): у приложения с созданием аккаунта должен быть
 * общедоступный URL политики. Страница добавлена в publicPaths
 * middleware — без логина и allowlist.
 *
 * ⚠️ Перед публикацией в сторы заполните SUPPORT_EMAIL ниже.
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

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8 py-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold text-[var(--color-text)]">
          Политика конфиденциальности
        </h1>
        <p className="text-xs text-[var(--color-text-faint)]">
          Futures Tracker · Последнее обновление: {LAST_UPDATED}
        </p>
      </header>

      <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
        Настоящая политика описывает, какие данные обрабатывает приложение
        Futures Tracker (&laquo;мы&raquo;, &laquo;приложение&raquo;) при
        регистрации, использовании трекера фьючерсных сделок и оформлении
        подписки Premium. Мы собираем минимум данных, необходимый для работы
        функций, и не продаём и не передаём их третьим лицам для рекламы.
      </p>

      <Section title="1. Какие данные мы собираем">
        <p>
          <strong className="text-[var(--color-text)]">Данные аккаунта.</strong>{" "}
          При входе через Google или Apple мы получаем адрес электронной почты,
          имя (если провайдер его передаёт) и идентификатор провайдера. Эти
          данные хранятся в сервисе аутентификации Supabase.
        </p>
        <p>
          <strong className="text-[var(--color-text)]">Данные о сделках.</strong>{" "}
          Сделки, которые вы добавляете вручную, а также метаданные сделок,
          подтянутые авто-синком с подключённых бирж (символ, направление,
          объём, цены, P&amp;L, комиссии, funding, время открытия/закрытия).
          Данные привязаны к вашему аккаунту и видны только вам.
        </p>
        <p>
          <strong className="text-[var(--color-text)]">API-ключи бирж.</strong>{" "}
          Если вы подключаете биржу, мы принимаем ваш API-ключ (с правами
          &laquo;только чтение&raquo;) и шифруем его перед сохранением.
          Ключ используется исключительно для синхронизации истории сделок от
          вашего имени.
        </p>
        <p>
          <strong className="text-[var(--color-text)]">Платёжные данные.</strong>{" "}
          Покупка подписки Premium проходит через магазин приложения (Google
          Play / App Store). Мы не получаем и не храним номера карт —
          платёжный провайдер магазина передаёт нам через сервис RevenueCat
          только факт покупки, её срок и идентификатор для восстановления.
        </p>
      </Section>

      <Section title="2. Зачем мы обрабатываем данные">
        <p>
          Данные обрабатываются для предоставления функциональности приложения:
          ведение журнала сделок, расчёт статистики и графиков, синхронизация
          с биржами по вашему запросу, управление подпиской Premium, а также
          для безопасности аккаунта и защиты от злоупотреблений.
        </p>
      </Section>

      <Section title="3. Где хранятся данные">
        <p>
          Данные хранятся в облачной базе Supabase и обрабатываются серверами
          Vercel. API-ключи бирж дополнительно шифруются. Доступ к
          персональным данным имеют только администраторы приложения в
          объёме, необходимом для поддержки пользователей.
        </p>
      </Section>

      <Section title="4. Сторонние сервисы">
        <p>
          Мы используем: <strong className="text-[var(--color-text)]">Supabase</strong>{" "}
          (аутентификация и база данных), <strong className="text-[var(--color-text)]">Vercel</strong>{" "}
          (хостинг), <strong className="text-[var(--color-text)]">RevenueCat</strong>{" "}
          (управление подписками), <strong className="text-[var(--color-text)]">Google</strong>{" "}
          и <strong className="text-[var(--color-text)]">Apple</strong> (вход через
          провайдера), а также публичные API подключённых вами бирж. Каждый
          сервис обрабатывает данные в соответствии со своей политикой
          конфиденциальности.
        </p>
      </Section>

      <Section title="5. Срок хранения и удаление">
        <p>
          Данные хранятся, пока существует ваш аккаунт. Вы можете удалить
          аккаунт в любой момент прямо из приложения: Настройки → &laquo;Удалить
          аккаунт&raquo;. Удаление необратимо и стирает профиль, все сделки,
          снимки баланса и подключения бирж. Отдельные запросы на удаление
          можно направить на {SUPPORT_EMAIL}.
        </p>
      </Section>

      <Section title="6. Ваши права">
        <p>
          В зависимости от юрисдикции вы имеете право на доступ к своим данным,
          их исправление, экспорт и удаление, а также на отзыв согласия на
          обработку. Для этого используйте удаление аккаунта из приложения или
          напишите нам на {SUPPORT_EMAIL} — ответим в течение 30 дней.
        </p>
      </Section>

      <Section title="7. Изменения политики">
        <p>
          Мы можем обновлять эту политику при изменении функциональности
          приложения. Актуальная версия всегда доступна на этой странице, а
          существенные изменения анонсируются в приложении.
        </p>
      </Section>

      <footer className="text-xs text-[var(--color-text-faint)] pt-4 border-t border-[var(--color-border)]">
        Контакт: {SUPPORT_EMAIL}
      </footer>
    </div>
  );
}
