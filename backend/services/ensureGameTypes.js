import { query } from '../database/connection.js';

export async function ensureDefaultGameTypes() {
  const defaults = [
    { code: 'texas_holdem', name: '德州扑克', category: 'poker', minPlayers: 2, maxPlayers: 10, description: '最受欢迎的扑克游戏', sortOrder: 1 },
    { code: 'zhajinhua', name: '炸金花', category: 'poker', minPlayers: 2, maxPlayers: 6, description: '简单刺激的三张牌游戏', sortOrder: 2 },
    { code: 'doudizhu', name: '斗地主', category: 'poker', minPlayers: 3, maxPlayers: 3, description: '经典三人扑克游戏', sortOrder: 3 },
    { code: 'shengji', name: '升级', category: 'poker', minPlayers: 4, maxPlayers: 4, description: '四人两副牌游戏', sortOrder: 4 },
    { code: 'paodekuai', name: '跑得快', category: 'poker', minPlayers: 2, maxPlayers: 4, description: '快速出牌游戏', sortOrder: 5 },
    { code: 'blackjack', name: '21点', category: 'poker', minPlayers: 2, maxPlayers: 7, description: '经典赌场游戏', sortOrder: 6 },
    { code: 'sichuan_mahjong', name: '四川麻将', category: 'mahjong', minPlayers: 4, maxPlayers: 4, description: '四川地区麻将玩法', sortOrder: 7 },
    { code: 'guangdong_mahjong', name: '广东麻将', category: 'mahjong', minPlayers: 4, maxPlayers: 4, description: '广东地区麻将玩法', sortOrder: 8 },
    { code: 'guobiao_mahjong', name: '国标麻将', category: 'mahjong', minPlayers: 4, maxPlayers: 4, description: '国际标准麻将', sortOrder: 9 },
    { code: 'ren_mahjong', name: '二人麻将', category: 'mahjong', minPlayers: 2, maxPlayers: 2, description: '快速二人麻将', sortOrder: 10 },
    { code: 'xiangqi', name: '中国象棋', category: 'chess', minPlayers: 2, maxPlayers: 2, description: '中国传统棋类游戏', sortOrder: 11 },
    { code: 'weiqi', name: '围棋', category: 'chess', minPlayers: 2, maxPlayers: 2, description: '古老策略棋类游戏', sortOrder: 12 },
    { code: 'wuziqi', name: '五子棋', category: 'chess', minPlayers: 2, maxPlayers: 2, description: '简单有趣的棋类游戏', sortOrder: 13 },
    { code: 'international_chess', name: '国际象棋', category: 'chess', minPlayers: 2, maxPlayers: 2, description: '国际流行棋类游戏', sortOrder: 14 },
    { code: 'junqi', name: '军棋', category: 'chess', minPlayers: 2, maxPlayers: 2, description: '经典军棋对战游戏', sortOrder: 15 },
    { code: 'niuniu', name: '牛牛', category: 'other', minPlayers: 2, maxPlayers: 10, description: '刺激的比牌游戏', sortOrder: 16 },
    { code: 'erbaban', name: '二八杠', category: 'other', minPlayers: 2, maxPlayers: 8, description: '经典骰子游戏', sortOrder: 17 },
    { code: 'touzi_bao', name: '骰宝', category: 'other', minPlayers: 2, maxPlayers: 10, description: '骰子押注游戏', sortOrder: 18 }
  ];

  const placeholders = defaults.map(() => '(?, ?, ?, ?, ?, ?, ?, TRUE)').join(', ');
  const params = defaults.flatMap((g) => [
    g.code,
    g.name,
    g.category,
    g.minPlayers,
    g.maxPlayers,
    g.description,
    g.sortOrder
  ]);

  await query(
    `INSERT INTO game_types (code, name, category, min_players, max_players, description, sort_order, is_active)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE code = code`,
    params
  );

  await query(
    `UPDATE game_types
     SET min_players = 2,
         max_players = 2,
         category = 'chess',
         name = '军棋',
         description = '经典军棋对战游戏',
         sort_order = 15,
         is_active = TRUE
     WHERE code = 'junqi'`
  );
}
