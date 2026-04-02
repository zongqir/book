export type DiscoverThemeConfig = {
  slug: string;
  title: string;
  summary: string;
  prompt: string;
  tags: string[];
  optionalTags?: string[];
  sectionKeys?: string[];
};

export const DISCOVER_THEMES: DiscoverThemeConfig[] = [
  {
    slug: "judgment",
    title: "判断与决策",
    summary: "当你想把判断做稳一点，不再被表象、口号和情绪牵着走。",
    prompt: "先补判断框架，再回到具体问题。",
    tags: ["决策", "批判性思维", "思想方法", "反馈"],
    optionalTags: ["信息判断", "论证检验", "提问方法", "问题定义", "认识论"],
    sectionKeys: ["01_关键技能", "05_思想方法", "07_商业管理"],
  },
  {
    slug: "investment",
    title: "投资与市场",
    summary: "当你想建立一套能长期使用的投资框架，而不是只追当下热点。",
    prompt: "先抓底层框架，再回到个股、估值和周期。",
    tags: ["投资", "经济学", "中国经济", "金融史"],
    optionalTags: ["估值", "成长股", "安全边际", "市场周期"],
    sectionKeys: ["04_理财", "08_历史传记"],
  },
  {
    slug: "institutions",
    title: "制度与权力",
    summary: "当你想看清规则、组织与权力如何塑造结果，而不只盯着个人好坏。",
    prompt: "先看制度怎么运转，再看人物怎么行动。",
    tags: ["制度史", "制度分析", "权力", "人性"],
    optionalTags: ["制度演化", "中国经济史", "门阀政治", "魏晋史", "近代史"],
    sectionKeys: ["05_思想方法", "07_商业管理", "08_历史传记", "04_理财"],
  },
  {
    slug: "emotion",
    title: "情绪与心理",
    summary: "当你想理解情绪、内在冲突和习惯回路如何影响你的行动。",
    prompt: "先看情绪机制，再看怎么改。",
    tags: ["心理学", "精神分析", "神经症", "霍妮"],
    optionalTags: ["情绪", "说服", "行为改变"],
    sectionKeys: ["06_心理学", "03_沟通人际"],
  },
  {
    slug: "communication",
    title: "沟通与推进",
    summary: "当你想把对话从表达自己，推进到真正把事情往前推。",
    prompt: "先把对话推进起来，再追求漂亮表达。",
    tags: ["倾听", "谈判", "说服", "反馈"],
    optionalTags: ["表达", "提问方法", "组织行为"],
    sectionKeys: ["03_沟通人际", "07_商业管理", "01_关键技能"],
  },
  {
    slug: "learning",
    title: "学习与提问",
    summary: "当你不是缺信息，而是缺一套能持续学进去、问到点上的方法。",
    prompt: "先学怎么问，再学怎么记、怎么复盘。",
    tags: ["批判性思维", "提问方法", "学习科学", "记忆"],
    optionalTags: ["问题定义", "信息判断", "反馈", "思想方法"],
    sectionKeys: ["01_关键技能", "05_思想方法"],
  },
];
