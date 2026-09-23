// Original fictional companions; chapter assignments describe their work in the shop.
export const CHARACTERS = [
  {
    id: 'crane',
    chapter: 1,
    species: '丹顶鹤',
    name: '清禾',
    role: '引菜人',
    traits: ['细心', '爱整齐'],
    image: 'assets/character-crane.svg',
  },
  {
    id: 'panda',
    chapter: 2,
    species: '熊猫',
    name: '团团',
    role: '小铺掌柜',
    traits: ['随和', '不慌不忙'],
    image: 'assets/character-panda.svg',
  },
  {
    id: 'tiger',
    chapter: 3,
    species: '老虎',
    name: '阿寅',
    role: '出餐帮手',
    traits: ['爽快', '做事认真'],
    image: 'assets/character-tiger.svg',
  },
  {
    id: 'snow-leopard',
    chapter: 4,
    species: '雪豹',
    name: '小霁',
    role: '理单员',
    traits: ['安静', '眼尖'],
    image: 'assets/character-snow-leopard.svg',
  },
  {
    id: 'dragon',
    chapter: 5,
    species: '龙',
    name: '云生',
    role: '山海宴召集人',
    traits: ['好奇', '爱热闹'],
    image: 'assets/character-dragon.svg',
  },
];

export const characterById = Object.fromEntries(
  CHARACTERS.map((character) => [character.id, character]),
);

export function characterForChapter(id) {
  return CHARACTERS.find((character) => character.chapter === Number(id)) ?? characterById.panda;
}
