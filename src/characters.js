// Original fictional companions; chapter assignments describe their work in the shop.
export const CHARACTERS = [
  {
    id: 'crane',
    chapter: 1,
    species: '丹顶鹤',
    name: '清禾',
    role: '引菜人',
    greeting: '我是清禾，陪你认菜，也听你说说这一桌的故事。',
    description: '说话轻轻的，记菜却很仔细。总爱把新收来的菜卡整整齐齐地放进食谱。',
    image: 'assets/character-crane.svg',
  },
  {
    id: 'panda',
    chapter: 2,
    species: '熊猫',
    name: '团团',
    role: '小铺掌柜',
    greeting: '我是掌柜团团，一起把每位客人的这一餐照顾好吧。',
    description: '性子温和，遇到忙碌的时候也不慌张。喜欢招呼伙伴围坐一桌，慢慢分享新学到的味道。',
    image: 'assets/character-panda.svg',
  },
  {
    id: 'tiger',
    chapter: 3,
    species: '老虎',
    name: '阿寅',
    role: '出餐帮手',
    greeting: '我是阿寅，菜单交给你，好菜交给我来端。',
    description: '笑声爽朗，做事认真。端菜前总会再看一眼顺序，盼着每一盘都稳稳到桌。',
    image: 'assets/character-tiger.svg',
  },
  {
    id: 'snow-leopard',
    chapter: 4,
    species: '雪豹',
    name: '小霁',
    role: '理单员',
    greeting: '我是小霁，客人改了菜单，我们就一起把顺序理清。',
    description: '喜欢安静地观察，也善于留意小小变化。手边有一本记事簿，装着伙伴们分享的菜肴趣事。',
    image: 'assets/character-snow-leopard.svg',
  },
  {
    id: 'dragon',
    chapter: 5,
    species: '龙',
    name: '云生',
    role: '山海宴召集人',
    greeting: '我是云生，把一路收集的好味道摆成一桌山海宴吧。',
    description: '好奇又热心，最爱邀请新朋友来小铺。每当食谱添上新的一页，就想和大家一起庆祝。',
    image: 'assets/character-dragon.svg',
  },
];

export const characterById = Object.fromEntries(
  CHARACTERS.map((character) => [character.id, character]),
);

export function characterForChapter(id) {
  return CHARACTERS.find((character) => character.chapter === Number(id)) ?? characterById.panda;
}
