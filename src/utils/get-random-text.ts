const texts = [
  { key: "text1", value: "生活就像海洋，只有意志坚强的人才能到达彼岸" },
  { key: "text2", value: "失败是成功之母，每一次失败都是通往成功的垫脚石" },
  {
    key: "text3",
    value: "机会总是留给有准备的人，只有不断学习和积累，才能抓住它",
  },
  { key: "text4", value: "光阴似箭，岁月不等人，珍惜当下，活在此刻" },
  {
    key: "text5",
    value: "世界上没有绝对的公平，但我们可以努力去创造自己的机会",
  },
  { key: "text6", value: "在成长的道路上，勇敢做自己，不为他人的眼光而动摇" },
  { key: "text7", value: "每个看似不可能的梦想，都是从一个坚定的信念开始的" },
  {
    key: "text8",
    value: "成功不是终点，失败也不是末日，只有持续的勇气才是最终的胜利",
  },
  {
    key: "text9",
    value: "人生是一场旅行，重要的不是目的地，而是沿途的风景和看风景的心情",
  },
  { key: "text10", value: "每一朵乌云都有银色的光边，困境中总能找到希望" },
  {
    key: "text11",
    value: "改变自己是一个艰难的决定，但却是一个充满力量的过程",
  },
  { key: "text12", value: "梦想的大小并不重要，重要的是去追逐它们的勇气" },
  {
    key: "text13",
    value: "生活并非总是公平的，但是我们可以选择以积极的态度面对每一天",
  },
  { key: "text14", value: "勇敢地走出舒适区，才能发现新天地和更多可能" },
  {
    key: "text15",
    value: "谦虚不是在低估自己，而是在给予他人赞美的同时保持自我反思",
  },
];

export const getRandomText = () => {
  return texts[Math.floor(Math.random() * texts.length)].key;
};
