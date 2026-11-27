import type { LocaleCode } from './languages';

/**
 * V5-only UI copy (waiting state, TON Connect network guard, admin round launch
 * and exact BallTicket statuses).
 *
 * Kept OUTSIDE `TranslationDictionary` on purpose: the strict dictionary test
 * requires all 32 locales to carry every key, while this V5 copy is authored in
 * EN/RU and safely falls back to English for every other language.
 */
export interface V5UiCopy {
  waitingTitle: string;
  waitingBody: string;
  waitingRefresh: string;
  wrongNetworkTitle: string;
  wrongNetworkBody: string;
  wrongNetworkDisconnect: string;
  wrongNetworkHint: string;
  mainnet: string;
  testnet: string;
  launchRoundFirst: string;
  launchNewRound: string;
  launchRoundHint: string;
  launchRoundSuccess: string;
  launchRoundError: string;
  factoryMissingTitle: string;
  factoryMissingBody: string;
  ticketActive: string;
  ticketTallying: string;
  ticketWinner: string;
  ticketNotWon: string;
  ticketRefundable: string;
  ticketClaimed: string;
  claimOpcode: string;
  refundOpcode: string;
  ticketAddressLabel: string;
}

const EN: V5UiCopy = {
  waitingTitle: 'Waiting for the next round',
  waitingBody:
    'The Admin has not launched this round yet. As soon as it is on-chain, the live stats, ticket picker and results appear here automatically.',
  waitingRefresh: 'Check again',
  wrongNetworkTitle: 'Wrong TON network',
  wrongNetworkBody:
    'Your wallet is connected to {wallet}, but this app runs on {app}. Signing is disabled. Disconnect the wallet and reconnect on {app}.',
  wrongNetworkDisconnect: 'Disconnect wallet',
  wrongNetworkHint: 'Every Buy, Claim, Refund, Force End Game and Launch Round action is blocked until the networks match.',
  mainnet: 'Mainnet',
  testnet: 'Testnet',
  launchRoundFirst: 'Launch Round #1',
  launchNewRound: 'Launch New Round',
  launchRoundHint: 'Sends the admin-only factory message: DeployDraw (0x4001) for BALL or CreateDraw (0x2007) for 100K.',
  launchRoundSuccess: 'Launch transaction sent. Waiting for the factory to deploy the draw…',
  launchRoundError: 'Could not send the launch transaction.',
  factoryMissingTitle: 'Mainnet deployment pending',
  factoryMissingBody:
    'The canonical Mainnet factory address is not wired into this build yet. Run the Step 4 deployment and sync script; no transaction can be built until then.',
  ticketActive: 'Active',
  ticketTallying: 'Tallying',
  ticketWinner: 'Winner',
  ticketNotWon: 'Not won',
  ticketRefundable: 'Refundable',
  ticketClaimed: 'Claimed',
  claimOpcode: 'Claim (0x3008)',
  refundOpcode: 'Refund (0x3009)',
  ticketAddressLabel: 'Ticket contract',
};

const RU: V5UiCopy = {
  waitingTitle: 'Ожидание следующего раунда',
  waitingBody:
    'Администратор ещё не запустил этот раунд. Как только он появится в блокчейне, статистика, выбор комбинаций и результаты отобразятся здесь автоматически.',
  waitingRefresh: 'Проверить снова',
  wrongNetworkTitle: 'Неверная сеть TON',
  wrongNetworkBody:
    'Кошелёк подключён к сети {wallet}, а приложение работает в сети {app}. Подписание транзакций заблокировано. Отключите кошелёк и подключите его к сети {app}.',
  wrongNetworkDisconnect: 'Отключить кошелёк',
  wrongNetworkHint:
    'Все действия «Купить», «Забрать», «Возврат», «Принудительное завершение игры» и «Запуск раунда» заблокированы, пока сети не совпадут.',
  mainnet: 'Мейннет',
  testnet: 'Тестнет',
  launchRoundFirst: 'Запустить раунд #1',
  launchNewRound: 'Запустить новый раунд',
  launchRoundHint:
    'Отправляет администраторское сообщение фабрике: DeployDraw (0x4001) для BALL или CreateDraw (0x2007) для 100K.',
  launchRoundSuccess: 'Транзакция запуска отправлена. Ожидаем развёртывание раунда фабрикой…',
  launchRoundError: 'Не удалось отправить транзакцию запуска раунда.',
  factoryMissingTitle: 'Развёртывание в Mainnet ещё не выполнено',
  factoryMissingBody:
    'Канонический адрес фабрики Mainnet пока не прописан в этой сборке. Выполните развёртывание Шага 4 и скрипт синхронизации — до этого транзакции не строятся.',
  ticketActive: 'Активен',
  ticketTallying: 'Идёт подсчёт',
  ticketWinner: 'Выигрыш',
  ticketNotWon: 'Без выигрыша',
  ticketRefundable: 'Доступен возврат',
  ticketClaimed: 'Получено',
  claimOpcode: 'Забрать (0x3008)',
  refundOpcode: 'Возврат (0x3009)',
  ticketAddressLabel: 'Контракт билета',
};

const COPY: Partial<Record<LocaleCode, V5UiCopy>> = { en: EN, ru: RU };

/** Locale-aware V5 copy with a guaranteed English fallback. */
export function v5Copy(locale: string | null | undefined): V5UiCopy {
  const base = (locale ?? 'en').toLowerCase().split(/[-_]/)[0] as LocaleCode;
  return COPY[base] ?? EN;
}

/** `{name}` interpolation shared with the main translator. */
export function formatV5Copy(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
