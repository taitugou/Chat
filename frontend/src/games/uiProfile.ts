export type GameUiCategory = 'poker' | 'mahjong' | 'chess' | 'other' | 'generic';

export type GameUiProfile = {
  category: GameUiCategory;
  prefersLandscape: boolean;
  autoCollapsePanelsBelowPx: number;
  leftPanelWidth: string;
  rightPanelWidth: string;
  compactPanelWidth: string;
};

const pokerGames = new Set([
  'zhajinhua',
  'texas_holdem',
  'blackjack',
  'niuniu',
  'shengji',
  'doudizhu',
  'paodekuai',
]);

const mahjongGames = new Set(['sichuan_mahjong', 'guangdong_mahjong', 'guobiao_mahjong', 'ren_mahjong']);

const chessGames = new Set(['weiqi', 'xiangqi', 'international_chess', 'junqi', 'wuziqi']);

const otherGames = new Set(['touzi_bao', 'erbaban']);

export function getGameUiProfile(gameType: string): GameUiProfile {
  const t = String(gameType || '');
  const category: GameUiCategory = pokerGames.has(t)
    ? 'poker'
    : mahjongGames.has(t)
      ? 'mahjong'
      : chessGames.has(t)
        ? 'chess'
        : otherGames.has(t)
          ? 'other'
          : 'generic';

  if (t === 'wuziqi') {
    return {
      category,
      prefersLandscape: true,
      autoCollapsePanelsBelowPx: 980,
      leftPanelWidth: 'w-[22vw] min-w-[18vw] max-w-[30vw]',
      rightPanelWidth: 'w-[22vw] min-w-[18vw] max-w-[30vw]',
      compactPanelWidth: 'w-[7vw] min-w-[6vh]',
    };
  }

  if (category === 'chess') {
    return {
      category,
      prefersLandscape: true,
      autoCollapsePanelsBelowPx: 980,
      leftPanelWidth: 'w-[26vw] min-w-[22vw] max-w-[36vw]',
      rightPanelWidth: 'w-[26vw] min-w-[22vw] max-w-[36vw]',
      compactPanelWidth: 'w-[7vw] min-w-[6vh]',
    };
  }

  if (category === 'mahjong') {
    return {
      category,
      prefersLandscape: true,
      autoCollapsePanelsBelowPx: 1100,
      leftPanelWidth: 'w-[28vw] min-w-[25vw] max-w-[40vw]',
      rightPanelWidth: 'w-[28vw] min-w-[25vw] max-w-[40vw]',
      compactPanelWidth: 'w-[7vw] min-w-[6vh]',
    };
  }

  if (category === 'other') {
    return {
      category,
      prefersLandscape: true,
      autoCollapsePanelsBelowPx: 980,
      leftPanelWidth: 'w-[26vw] min-w-[22vw] max-w-[36vw]',
      rightPanelWidth: 'w-[26vw] min-w-[22vw] max-w-[36vw]',
      compactPanelWidth: 'w-[7vw] min-w-[6vh]',
    };
  }

  if (category === 'poker') {
    return {
      category,
      prefersLandscape: true,
      autoCollapsePanelsBelowPx: 1100,
      leftPanelWidth: 'w-[28vw] min-w-[25vw] max-w-[40vw]',
      rightPanelWidth: 'w-[28vw] min-w-[25vw] max-w-[40vw]',
      compactPanelWidth: 'w-[7vw] min-w-[6vh]',
    };
  }

  return {
    category,
    prefersLandscape: true,
    autoCollapsePanelsBelowPx: 1100,
    leftPanelWidth: 'w-[28vw] min-w-[25vw] max-w-[40vw]',
    rightPanelWidth: 'w-[28vw] min-w-[25vw] max-w-[40vw]',
    compactPanelWidth: 'w-[7vw] min-w-[6vh]',
  };
}

