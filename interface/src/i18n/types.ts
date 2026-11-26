/**
 * Strict i18n contract. Adding a language = one partial locale module + one
 * entry in the `LANGUAGES` registry in `src/i18n/languages.ts`. Any key that a
 * locale omits automatically falls back to the English dictionary.
 */
export interface TranslationDictionary {
  nav: {
    home: string;
    games: string;
    ball: string;
    hundredK: string;
    tickets: string;
    verify: string;
    info: string;
  };
  common: {
    appName: string;
    /** Browser tab title (localized, no hardcoded English in `index.html`). */
    documentTitle: string;
    tagline: string;
    testnet: string;
    mainnet: string;
    connectWallet: string;
    connectShort: string;
    connected: string;
    disconnect: string;
    walletMenu: string;
    walletNotConnected: string;
    connectPrompt: string;
    loading: string;
    refresh: string;
    retry: string;
    error: string;
    noData: string;
    close: string;
    confirm: string;
    cancel: string;
    copy: string;
    copied: string;
    viewExplorer: string;
    address: string;
    round: string;
    status: string;
    ticketsSold: string;
    prizePool: string;
    ticketPrice: string;
    countdown: string;
    deadline: string;
    threshold: string;
    hardCap: string;
    total: string;
    winners: string;
    share: string;
    pool: string;
    perTicket: string;
    amount: string;
    claim: string;
    refund: string;
    claimed: string;
    refunded: string;
    active: string;
    past: string;
    allGames: string;
    ball: string;
    hundredK: string;
    learnRules: string;
    ton: string;
    gas: string;
    network: string;
    expired: string;
    waiting: string;
    open: string;
    progress: string;
    contract: string;
    refreshNow: string;
    anonymously: string;
    sessionOnly: string;
    reconnecting: string;
    of: string;
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    mainNavigation: string;
    whiteBall: string;
    redBall: string;
    /** Compact "red" suffix used by the BALL match counter (e.g. "3/5 + red"). */
    redShort: string;
  };
  status: {
    waitingFirstTicket: string;
    activeSales: string;
    salesClosed: string;
    tallying: string;
    claimOpen: string;
    cancelled: string;
    active: string;
    drawing: string;
    drawn: string;
    ticketActive: string;
    ticketPending: string;
    ticketTallied: string;
    ticketClaimed: string;
    ticketRefunded: string;
    ticketTallying: string;
    ticketWinner: string;
    ticketNotWinner: string;
    ticketExpired: string;
    unknown: string;
  };
  roles: {
    adminBadge: string;
    treasuryBadge: string;
    buyerBadge: string;
    adminTitle: string;
    adminNotice: string;
    treasuryTitle: string;
    treasuryNotice: string;
    buyerTitle: string;
    buyerNotice: string;
  };
  overview: {
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    ballTitle: string;
    ballSubtitle: string;
    hundredTitle: string;
    hundredSubtitle: string;
    openGame: string;
    nextDraw: string;
    noCurrentRound: string;
    protocolTitle: string;
    protocolBody: string;
    transparencyTitle: string;
    transparencyBody: string;
    transparencyCta: string;
    ticketsCta: string;
    verifyCta: string;
    closingSoon: string;
    gamesSectionTitle: string;
    gamesSectionSubtitle: string;
    allGamesCta: string;
    rulesTitle: string;
    rulesIntro: string;
    rulesTabsLabel: string;
    rulesMechanics: string;
    rulesMechanicsIntro: string;
    rulesPrizes: string;
    rulesPrizesIntro: string;
    rulesFairness: string;
    rulesFairnessIntro: string;
    rulesRefunds: string;
    rulesRefundsIntro: string;
    rulesRefund24h: string;
  };
  games: {
    title: string;
    subtitle: string;
    switchLabel: string;
  };
  ball: {
    title: string;
    subtitle: string;
    statsTitle: string;
    prizeTableTitle: string;
    prizeTableIntro: string;
    category: string;
    condition: string;
    conditionLabels: string[];
    winnersLabel: string;
    payoutLabel: string;
    rolloverNote: string;
    pickerTitle: string;
    pickerIntro: string;
    whitesTitle: string;
    redTitle: string;
    selectedTitle: string;
    emptySelection: string;
    quickPick: string;
    clear: string;
    duplicateWarning: string;
    availableNote: string;
    noLockNote: string;
    costTitle: string;
    costBody: string;
    costPool: string;
    costFee: string;
    costGas: string;
    costGasFlat: string;
    costMint: string;
    costTotal: string;
    batchV4Note: string;
    buyButton: string;
    buying: string;
    quotaTitle: string;
    quotaRemaining: string;
    quotaExhausted: string;
    salesClosed: string;
    pickerFirst: string;
    archiveTitle: string;
    archiveIntro: string;
    archiveEmpty: string;
    winnerOfDraw: string;
    latestResult: string;
    tallyingTitle: string;
    latestResultIntro: string;
    winnersTotal: string;
    noWinners: string;
    claimClosesIn: string;
    tallyClosesIn: string;
    rolloverInLabel: string;
    rolloverOutLabel: string;
  };
  hundredK: {
    title: string;
    subtitle: string;
    statsTitle: string;
    placesTitle: string;
    placesIntro: string;
    place: string;
    winnersLabel: string;
    shareLabel: string;
    poolLabel: string;
    perWinner: string;
    purchaseTitle: string;
    purchaseIntro: string;
    soldLabel: string;
    remainingLabel: string;
    nextNumber: string;
    costTitle: string;
    costPool: string;
    costFee: string;
    costGas: string;
    costGasFlat: string;
    costTotal: string;
    packCostNote: string;
    packSingleTxNote: string;
    buyButton: string;
    buying: string;
    quotaTitle: string;
    quotaRemaining: string;
    quotaExhausted: string;
    capReached: string;
    salesClosed: string;
    archiveTitle: string;
    archiveIntro: string;
    archiveEmpty: string;
    winnersDrawn: string;
  };
  tickets: {
    title: string;
    subtitle: string;
    connectTitle: string;
    connectBody: string;
    loadingTitle: string;
    loadingBody: string;
    emptyTitle: string;
    emptyBody: string;
    filterActive: string;
    filterPast: string;
    filterAll: string;
    waitingDraw: string;
    drawingMessage: string;
    tallyNote: string;
    claimOpenMessage: string;
    cancelledMessage: string;
    winnerLabel: string;
    nonWinnerLabel: string;
    yourNumbers: string;
    winningNumbers: string;
    payout: string;
    categoryLabel: string;
    placeLabel: string;
    expiryTitle: string;
    expiryExpired: string;
    claimButton: string;
    refundButton: string;
    claimedBadge: string;
    refundedBadge: string;
    claimNote: string;
    refundNote: string;
    gasNote: string;
    scanNote: string;
    refreshTickets: string;
    ticketStatus: string;
    drawStatus: string;
    errorTitle: string;
    errorBody: string;
    pendingNote: string;
    noActive: string;
    noPast: string;
    tallyingTitle: string;
    tallyCountdown: string;
    claimCountdown: string;
    winnerCountLabel: string;
    zeroWinners: string;
    matchedLabel: string;
    rolloverInLabel: string;
    rolloverOutLabel: string;
    drawnBallsLabel: string;
    packLabel: string;
    packActive: string;
    packDrawing: string;
    packTallying: string;
    packWonLabel: string;
    packTotalPrize: string;
    packExpand: string;
    packClaim: string;
    packRefund: string;
    packClaimNote: string;
    packRefundNote: string;
  };
  verify: {
    title: string;
    subtitle: string;
    selectGame: string;
    selectRound: string;
    loadProof: string;
    runVerification: string;
    running: string;
    manualTitle: string;
    manualIntro: string;
    drawAddress: string;
    totalTickets: string;
    closingMarker: string;
    targetTime: string;
    roundId: string;
    signature: string;
    publicKey: string;
    payloadHash: string;
    stepsTitle: string;
    stepPayload: string;
    stepSignature: string;
    stepSeed: string;
    stepResult: string;
    payloadOk: string;
    payloadMismatch: string;
    signatureOk: string;
    signatureBad: string;
    seedLabel: string;
    resultLabel: string;
    match: string;
    mismatch: string;
    verified: string;
    failed: string;
    noProof: string;
    noRounds: string;
    ballResult: string;
    hundredResult: string;
    winnersTitle: string;
    placeColumn: string;
    ticketColumn: string;
    payoutColumn: string;
    onChainResult: string;
    recomputedResult: string;
    errorMissing: string;
    errorInvalid: string;
    autoNote: string;
    localOnly: string;
    /** Numeric round input label — any round id can be verified directly. */
    roundNumber: string;
    /** Placeholder for a synthesized round that has no indexed result yet. */
    roundUnknown: string;
    /** Hint shown while the selected round has not closed its sales yet. */
    roundPending: string;
  };
  info: {
    title: string;
    subtitle: string;
    principlesTitle: string;
    principlesIntro: string;
    principles: string[];
    ballRulesTitle: string;
    ballRulesIntro: string;
    ballRules: string[];
    ballPayoutTitle: string;
    ballPayoutIntro: string;
    ballPayoutRows: string[];
    hundredRulesTitle: string;
    hundredRulesIntro: string;
    hundredRules: string[];
    hundredPayoutTitle: string;
    hundredPayoutIntro: string;
    hundredPayoutRows: string[];
    pricingTitle: string;
    pricingIntro: string;
    pricingRows: string[];
    timersTitle: string;
    timersIntro: string;
    timersRows: string[];
    refundsTitle: string;
    refundsIntro: string;
    refundsRows: string[];
    privacyTitle: string;
    privacyIntro: string;
    privacyRows: string[];
    contractsTitle: string;
    contractsIntro: string;
    /**
     * Live draw contract label — `{game}` and `{round}` are interpolated from
     * the public API, so future rounds and games need no code change.
     */
    drawRoundLabel: string;
    ballFactory: string;
    hundredFactory: string;
    adminLabel: string;
    treasuryLabel: string;
    vrfKeyLabel: string;
    networkLabel: string;
    copyHint: string;
    disclaimer: string;
  };
  admin: {
    title: string;
    subtitle: string;
    forceStart: string;
    forceStartDesc: string;
    forceStartTitle: string;
    forceStartSubtitle: string;
    forceStartSending: string;
    forceStartSuccess: string;
    forceStartDisabled: string;
    phaseLabel: string;
    secondaryTitle: string;
    secondarySubtitle: string;
    createRound: string;
    createRoundDesc: string;
    nextRoundLabel: string;
    sweep: string;
    sweepDesc: string;
    sweepAmount: string;
    sweepMax: string;
    maintenance: string;
    checkDeadline: string;
    checkDeadlineDesc: string;
    checkVrfTimeout: string;
    checkVrfTimeoutDesc: string;
    retryRollover: string;
    retryRolloverDesc: string;
    closeExpired: string;
    closeExpiredDesc: string;
    confirmTitle: string;
    confirmBody: string;
    confirmAction: string;
    success: string;
    error: string;
    sending: string;
    infoOnly: string;
    roundLabel: string;
    feeAccrued: string;
    autoFeeNote: string;
    keeperExpiryNote: string;
    autoFeeSweptLabel: string;
    notAvailable: string;
  };
  purchase: {
    basketTitle: string;
    basketEmpty: string;
    addCombination: string;
    quickPickOne: string;
    quickPickFive: string;
    quickPickBusy: string;
    clearBasket: string;
    remove: string;
    availabilityChecking: string;
    availabilityFree: string;
    availabilityTaken: string;
    availabilityUnknown: string;
    retry: string;
    lockedHint: string;
    basketValid: string;
    basketInvalid: string;
    basketQuotaExceeded: string;
    basketReverify: string;
    remainingQuota: string;
    ticketsLabel: string;
    buyTickets: string;
    batchNote: string;
    batchTooltip: string;
    batchProgress: string;
    batchOf: string;
    gasRefund: string;
    quantityTitle: string;
    quantityHint: string;
    max: string;
    increase: string;
    decrease: string;
  };
  errors: {
    api: string;
    tonapi: string;
    wallet: string;
    rejected: string;
    noPrice: string;
    statusClosed: string;
    quota: string;
    generic: string;
    invalidCombination: string;
    duplicate: string;
    adminRestricted: string;
    treasuryRestricted: string;
    loadFailed: string;
    tonConnectMissing: string;
    copyFailed: string;
  };
  language: {
    label: string;
    english: string;
    russian: string;
    switchLabel: string;
    /** Globe trigger accessible label. */
    open: string;
    /** Modal title. */
    title: string;
    searchLabel: string;
    searchPlaceholder: string;
    noResults: string;
    /** Accessible suffix for the active row checkmark. */
    selected: string;
    /** Badge for a registered language whose full dictionary is still being authored. */
    soon: string;
  };
  theme: {
    light: string;
    dark: string;
    toggleLabel: string;
  };
  footer: {
    note: string;
    privacy: string;
    rules: string;
    contracts: string;
  };
}

/**
 * Deep partial used by locale modules: a new language may translate only the
 * keys it needs and rely on the English fallback for everything else.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly string[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

type TranslationPaths<T> = T extends readonly unknown[]
  ? never
  : T extends object
    ? {
        [K in keyof T & string]: T[K] extends readonly unknown[]
          ? K
          : T[K] extends object
            ? `${K}.${TranslationPaths<T[K]>}`
            : K;
      }[keyof T & string]
    : never;

/** Every dot-separated key of the dictionary (compile-time checked). */
export type TranslationKey = TranslationPaths<TranslationDictionary>;

type TranslationPathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? TranslationPathValue<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/** Value stored under a translation key (string or a localized string[]). */
export type TranslationValue<K extends TranslationKey> = TranslationPathValue<TranslationDictionary, K>;

export type TranslateVars = Record<string, string | number>;

/**
 * Central translation helper. Keys are compile-time checked and missing values
 * always fall back to the English dictionary.
 */
export type Translate = <K extends TranslationKey>(
  key: K,
  vars?: TranslateVars,
) => TranslationValue<K>;

