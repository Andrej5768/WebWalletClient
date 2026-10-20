/** A section of a legal page: a heading, paragraphs and an optional list. */
export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDocument {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const CONTACT = 'support@andrew-dev.org';

export const privacy: Record<'uk' | 'en', LegalDocument> = {
  uk: {
    title: 'Політика конфіденційності',
    updated: 'Оновлено 20 жовтня 2026 року',
    intro:
      'WebWallet — особистий некомерційний проєкт для обліку фінансів, інвестицій і податків. Тут пояснено, які дані ми зберігаємо, навіщо, де і як довго, і що ви можете з ними зробити.',
    sections: [
      {
        title: 'Які дані ми зберігаємо',
        items: [
          'Дані акаунта: адреса пошти, ім’я, прізвище (якщо вказали), мова, базова валюта. Пароль зберігається лише як криптографічний хеш.',
          'Якщо ви входите через Google — ідентифікатор вашого акаунта Google, його адресу пошти та ім’я. Пароля від Google ми не бачимо.',
          'Фінансові дані, які ви вносите або імпортуєте: рахунки, операції, категорії, бюджет, цілі, інвестиції, податкові налаштування.',
          'Токен Monobank, якщо ви підключили банк. Він зберігається зашифрованим і використовується лише для завантаження ваших операцій.',
          'Для двофакторної автентифікації — зашифрований секрет застосунку-автентифікатора та хеші резервних кодів.',
          'Технічні дані: IP-адреса під час входу тимчасово зберігається в пам’яті сервера для захисту від підбору пароля; журнали сервера містять час і адресу запитів.',
        ],
      },
      {
        title: 'Навіщо',
        paragraphs: [
          'Дані використовуються лише для того, щоб сервіс працював: показувати ваші рахунки й звіти, рахувати бюджет, податки й цілі, надсилати службові листи (підтвердження пошти, скидання пароля, видалення акаунта) і захищати акаунт.',
          'Ми не продаємо дані, не показуємо рекламу, не використовуємо аналітику чи сторонні трекери і не передаємо дані нікому для їхніх власних цілей.',
        ],
      },
      {
        title: 'Де зберігаються дані',
        paragraphs: [
          'Сервер і база даних розміщені в Google Cloud у регіоні europe-central2 (Варшава, Польща). Службові листи надсилаються через Amazon Simple Email Service у регіоні Європейського Союзу.',
        ],
      },
      {
        title: 'Сторонні сервіси',
        items: [
          'Monobank — за вашим токеном, щоб отримувати операції ваших рахунків.',
          'Google — для входу через Google, лише якщо ви ним користуєтеся.',
          'Національний банк України — офіційні курси валют (без ваших даних).',
          'Постачальники ринкових даних — ціни й дивіденди цінних паперів за тікерами (без ваших даних).',
          'Amazon Simple Email Service — адреса пошти й текст службового листа.',
        ],
      },
      {
        title: 'Cookie та сховище браузера',
        paragraphs: [
          'Ми використовуємо лише технічно необхідні cookie: refresh_token — щоб ви залишалися в акаунті (до 30 днів), trusted_device — довірений пристрій, на якому не питаємо код 2FA (до 90 днів), oauth_state — на 10 хвилин під час входу через Google. Мова, тема й подібні налаштування зберігаються в сховищі вашого браузера. Рекламних чи аналітичних cookie немає.',
        ],
      },
      {
        title: 'Як довго зберігаються дані',
        paragraphs: [
          'Дані зберігаються, доки існує акаунт. Після запиту на видалення акаунт блокується, а через 14 днів видаляється разом з усіма даними. Резервні копії бази даних зберігаються до 14 днів, тож за цей час дані зникають і з них.',
        ],
      },
      {
        title: 'Ваші права',
        items: [
          'Отримати копію всіх своїх даних: Налаштування → Дані → Експорт даних.',
          'Виправити дані в налаштуваннях і на сторінках застосунку.',
          'Видалити всі фінансові дані («Почати спочатку») або весь акаунт: Налаштування → Дані.',
          'Відключити банк чи вхід через Google у будь-який момент.',
          `З будь-яким питанням щодо ваших даних пишіть на ${CONTACT}.`,
        ],
      },
      {
        title: 'Безпека',
        paragraphs: [
          'Сайт працює лише через HTTPS. Паролі зберігаються як хеші, токени банків і секрети 2FA — зашифрованими. Ви можете увімкнути двофакторну автентифікацію в налаштуваннях безпеки.',
        ],
      },
      {
        title: 'Зміни політики',
        paragraphs: [
          'Якщо ця політика зміниться, ми оновимо дату вгорі сторінки, а про суттєві зміни повідомимо листом.',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy policy',
    updated: 'Updated on 20 October 2026',
    intro:
      'WebWallet is a personal noncommercial project for tracking finances, investments and taxes. This page explains what data we keep, why, where and for how long, and what you can do with it.',
    sections: [
      {
        title: 'What data we keep',
        items: [
          'Account data: email address, first name, last name (if given), language and base currency. The password is stored only as a cryptographic hash.',
          'If you sign in with Google: the id of your Google account, its email address and name. We never see your Google password.',
          'Finance data you enter or import: accounts, transactions, categories, budget, goals, investments, tax settings.',
          'Your Monobank token, if you connect the bank. It is stored encrypted and used only to load your transactions.',
          'For two-factor authentication: the encrypted secret of the authenticator app and the hashes of the recovery codes.',
          'Technical data: the IP address at sign-in is kept in server memory for a while to stop password guessing; server logs contain the time and address of requests.',
        ],
      },
      {
        title: 'Why',
        paragraphs: [
          'The data is used only to run the service: show your accounts and reports, calculate the budget, taxes and goals, send service emails (email confirmation, password reset, account deletion) and protect the account.',
          'We do not sell data, show ads, use analytics or third-party trackers, or give data to anyone for their own purposes.',
        ],
      },
      {
        title: 'Where the data is stored',
        paragraphs: [
          'The server and the database run in Google Cloud in the europe-central2 region (Warsaw, Poland). Service emails are sent with Amazon Simple Email Service in a European Union region.',
        ],
      },
      {
        title: 'Third-party services',
        items: [
          'Monobank — with your token, to load the transactions of your accounts.',
          'Google — for sign-in with Google, only if you use it.',
          'The National Bank of Ukraine — official exchange rates (no data of yours).',
          'Market data providers — prices and dividends of securities by ticker (no data of yours).',
          'Amazon Simple Email Service — your email address and the text of a service email.',
        ],
      },
      {
        title: 'Cookies and browser storage',
        paragraphs: [
          'We use only strictly necessary cookies: refresh_token keeps you signed in (up to 30 days), trusted_device marks a device where the 2FA code is not asked (up to 90 days), oauth_state lives 10 minutes during a Google sign-in. The language, the theme and similar preferences are kept in your browser storage. There are no advertising or analytics cookies.',
        ],
      },
      {
        title: 'How long the data is kept',
        paragraphs: [
          'The data is kept while the account exists. After you ask to delete the account, it is blocked and deleted with all its data after 14 days. Database backups are kept for up to 14 days, so the data leaves them within that time too.',
        ],
      },
      {
        title: 'Your rights',
        items: [
          'Get a copy of all your data: Settings → Data → Export data.',
          'Correct your data in the settings and the pages of the app.',
          'Delete all finance data ("Start over") or the whole account: Settings → Data.',
          'Disconnect the bank or Google sign-in at any time.',
          `For any question about your data write to ${CONTACT}.`,
        ],
      },
      {
        title: 'Security',
        paragraphs: [
          'The site works only over HTTPS. Passwords are stored as hashes, bank tokens and 2FA secrets encrypted. You can turn on two-factor authentication in the security settings.',
        ],
      },
      {
        title: 'Changes',
        paragraphs: [
          'If this policy changes, we will update the date at the top, and tell you about significant changes by email.',
        ],
      },
    ],
  },
};

export const terms: Record<'uk' | 'en', LegalDocument> = {
  uk: {
    title: 'Умови використання',
    updated: 'Оновлено 20 жовтня 2026 року',
    intro:
      'Користуючись WebWallet, ви погоджуєтеся з цими умовами. Будь ласка, прочитайте їх і нашу політику конфіденційності.',
    sections: [
      {
        title: 'Про сервіс',
        paragraphs: [
          'WebWallet — особистий некомерційний проєкт. Сервіс надається безкоштовно і «як є»: ми стараємося, щоб він працював і зберігав дані, але не гарантуємо безперервної роботи й можемо змінювати чи припинити його.',
        ],
      },
      {
        title: 'Ваш акаунт',
        items: [
          'Вказуйте справжню адресу пошти: на неї приходять службові листи.',
          'Ви відповідаєте за збереження пароля, резервних кодів і доступу до пошти. Радимо увімкнути двофакторну автентифікацію.',
          'Один акаунт — для однієї людини.',
        ],
      },
      {
        title: 'Не фінансова порада',
        paragraphs: [
          'Звіти, прогнози, розрахунки податків, FIRE і FYM — це орієнтири для планування на основі ваших даних, а не фінансова, податкова чи юридична консультація. Перевіряйте важливі рішення й декларації з фахівцем; за подання декларацій і сплату податків відповідаєте ви.',
        ],
      },
      {
        title: 'Ваші дані',
        paragraphs: [
          'Дані, які ви вносите, належать вам. Ви дозволяєте нам зберігати й обробляти їх лише для роботи сервісу, як описано в політиці конфіденційності. Ви можете будь-коли експортувати або видалити їх.',
        ],
      },
      {
        title: 'Заборонено',
        items: [
          'Намагатися отримати доступ до чужих акаунтів чи даних.',
          'Перевантажувати сервіс, шукати й використовувати вразливості, обходити обмеження.',
          'Використовувати сервіс для незаконної діяльності.',
        ],
      },
      {
        title: 'Вихідний код',
        paragraphs: [
          'Код проєкту опубліковано лише для ознайомлення. Усі права захищені: запускати, копіювати, змінювати й поширювати його без письмового дозволу автора не можна.',
        ],
      },
      {
        title: 'Відповідальність',
        paragraphs: [
          'Наскільки це дозволяє закон, ми не відповідаємо за збитки, пов’язані з використанням сервісу, перервами в роботі, втратою даних або рішеннями, ухваленими на основі розрахунків застосунку. Регулярно робіть експорт своїх даних.',
        ],
      },
      {
        title: 'Припинення',
        paragraphs: [
          'Ви можете видалити акаунт будь-коли в налаштуваннях. Ми можемо заблокувати акаунт, який порушує ці умови.',
        ],
      },
      {
        title: 'Зміни умов і контакти',
        paragraphs: [
          `Про суттєві зміни умов ми повідомимо листом. Ці умови регулюються законодавством України. Питання — на ${CONTACT}.`,
        ],
      },
    ],
  },
  en: {
    title: 'Terms of service',
    updated: 'Updated on 20 October 2026',
    intro: 'By using WebWallet you agree to these terms. Please read them and our privacy policy.',
    sections: [
      {
        title: 'The service',
        paragraphs: [
          'WebWallet is a personal noncommercial project. The service is free and provided "as is": we do our best to keep it running and your data safe, but we do not guarantee uninterrupted operation and may change or stop the service.',
        ],
      },
      {
        title: 'Your account',
        items: [
          'Use a real email address: service emails are sent to it.',
          'You are responsible for your password, recovery codes and access to your email. We recommend turning on two-factor authentication.',
          'One account is for one person.',
        ],
      },
      {
        title: 'Not financial advice',
        paragraphs: [
          'Reports, forecasts, tax calculations, FIRE and FYM are guides for planning based on your data, not financial, tax or legal advice. Check important decisions and declarations with a professional; filing declarations and paying taxes is your responsibility.',
        ],
      },
      {
        title: 'Your data',
        paragraphs: [
          'The data you enter belongs to you. You allow us to store and process it only to run the service, as the privacy policy describes. You can export or delete it at any time.',
        ],
      },
      {
        title: 'Not allowed',
        items: [
          'Trying to access other people’s accounts or data.',
          'Overloading the service, looking for and using vulnerabilities, getting around limits.',
          'Using the service for anything illegal.',
        ],
      },
      {
        title: 'Source code',
        paragraphs: [
          'The source code of the project is published for reference only. All rights reserved: running, copying, modifying or distributing it requires written permission from the author.',
        ],
      },
      {
        title: 'Liability',
        paragraphs: [
          'As far as the law allows, we are not liable for losses related to using the service, interruptions, loss of data or decisions made on the calculations of the app. Export your data regularly.',
        ],
      },
      {
        title: 'Termination',
        paragraphs: [
          'You can delete your account at any time in the settings. We may block an account that breaks these terms.',
        ],
      },
      {
        title: 'Changes and contact',
        paragraphs: [
          `We will tell you about significant changes to these terms by email. These terms are governed by the law of Ukraine. Questions go to ${CONTACT}.`,
        ],
      },
    ],
  },
};
