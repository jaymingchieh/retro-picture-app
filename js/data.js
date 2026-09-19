/* ===================================================================
   RETRO STUDIO — options data + prompt templates
   Every option carries a zh (Chinese) and en (English) fragment that
   gets stitched into a full ChatGPT prompt. Content is modelled on the
   Marie Claire "如果我活在80年代" advanced prompt example.
   =================================================================== */

window.RETRO_DATA = {
  // 選項清單。每個項目: { id, label(選單顯示), zh(中文指令片段), en(英文指令片段) }
  options: {
    era: [
      { id: "1980s", label: "1980 年代", zh: "1980 年代", en: "the 1980s" },
      { id: "1970s", label: "1970 年代", zh: "1970 年代", en: "the 1970s" },
      { id: "1990s", label: "1990 年代", zh: "1990 年代", en: "the 1990s" },
    ],
    scene: [
      { id: "asia-urban", label: "亞洲都會女性", zh: "亞洲都會女性", en: "an Asian metropolitan woman" },
      { id: "hk-movie", label: "香港電影女主角", zh: "香港電影女主角", en: "a leading lady from a Hong Kong movie" },
      { id: "tokyo", label: "東京都會女性", zh: "東京都會女性", en: "a Tokyo city woman" },
      { id: "studio", label: "復古寫真館", zh: "復古寫真館裡拍攝的人物", en: "a subject photographed in a vintage portrait studio" },
      { id: "american", label: "美式復古", zh: "美式復古風格的人物", en: "a person in classic American vintage style" },
      { id: "campus", label: "校園青春", zh: "充滿青春感的校園女孩", en: "a youthful campus girl" },
    ],
    brow: [
      { id: "thick", label: "自然粗眉、明顯眉峰", zh: "自然粗眉、明顯眉峰", en: "natural thick brows with a defined arch" },
      { id: "soft", label: "柔和自然眉", zh: "柔和自然的眉型", en: "soft natural brows" },
      { id: "bold", label: "濃黑一字眉", zh: "濃黑有份量的一字眉", en: "bold dark straight brows" },
    ],
    eye: [
      { id: "rose-brown", label: "玫瑰棕眼影", zh: "玫瑰棕眼影", en: "rose-brown eyeshadow" },
      { id: "blue", label: "繽紛藍色眼影", zh: "繽紛的藍色眼影", en: "vivid blue eyeshadow" },
      { id: "purple", label: "紫色煙燻眼影", zh: "紫色煙燻眼影", en: "purple smokey eyeshadow" },
      { id: "pink", label: "粉紅眼影", zh: "粉紅色眼影", en: "pink eyeshadow" },
      { id: "gray-brown", label: "灰棕耐看眼影", zh: "灰棕色的耐看眼影", en: "understated gray-brown eyeshadow" },
    ],
    blush: [
      { id: "cheekbone", label: "顴骨斜暈腮紅", zh: "從顴骨斜向太陽穴暈染的高顴骨腮紅", en: "blush swept diagonally from the cheekbones toward the temples for a sculpted look" },
      { id: "peach", label: "自然蜜桃腮紅", zh: "自然的蜜桃色腮紅", en: "natural peach blush" },
      { id: "rosy", label: "紅潤腮紅", zh: "明顯紅潤的腮紅", en: "prominent rosy blush" },
    ],
    lip: [
      { id: "brick", label: "磚紅色唇妝", zh: "磚紅色唇妝", en: "brick-red lips" },
      { id: "true-red", label: "正紅唇", zh: "飽和的正紅色唇妝", en: "true classic red lips" },
      { id: "wine", label: "酒紅唇", zh: "酒紅色唇妝", en: "wine-red lips" },
      { id: "berry", label: "莓果紅唇", zh: "莓果紅色唇妝", en: "berry-red lips" },
    ],
    hair: [
      { id: "big-curls", label: "蓬鬆大旁分長捲髮", zh: "有蓬鬆髮根的大旁分長捲髮", en: "voluminous side-parted long curls with lifted roots" },
      { id: "big-waves", label: "大波浪捲髮", zh: "蓬鬆的大波浪捲髮", en: "big voluminous waves" },
      { id: "flip", label: "外翻層次髮", zh: "外翻層次的蓬鬆髮型", en: "flipped-out layered voluminous hair" },
      { id: "perm", label: "爆炸蓬鬆捲", zh: "非常蓬鬆的爆炸捲髮", en: "big fluffy permed hair" },
    ],
    outfit: [
      { id: "power-suit", label: "寬肩墊肩西裝", zh: "80 年代寬肩墊肩西裝、高腰西裝褲與絲質襯衫", en: "an 80s wide-shouldered padded blazer, high-waisted trousers and a silk blouse" },
      { id: "dress", label: "復古洋裝", zh: "80 年代剪裁的復古洋裝", en: "a vintage 80s-cut dress" },
      { id: "denim", label: "復古丹寧", zh: "高腰丹寧褲搭配復古上衣", en: "high-waisted denim with a retro top" },
      { id: "sporty", label: "復古運動風", zh: "復古的運動風套裝", en: "a retro sporty tracksuit look" },
    ],
    film: [
      { id: "film-warm", label: "底片顆粒＋褪色暖調", zh: "畫面像使用底片相機拍攝的街頭照片，帶有自然底片顆粒、微微褪色的暖色調與柔和日光", en: "the image looks like a street photo shot on film, with natural film grain, slightly faded warm tones and soft daylight" },
      { id: "studio-light", label: "寫真館柔光", zh: "畫面像復古寫真館的柔和棚拍光線，帶有細緻底片質感", en: "the image has the soft studio lighting of a vintage portrait studio with fine film texture" },
      { id: "flash", label: "夜間閃燈快照", zh: "畫面像夜晚使用閃光燈拍攝的復古快照，帶有底片顆粒與濃郁色彩", en: "the image looks like a vintage night snapshot taken with flash, with film grain and rich colors" },
      { id: "polaroid", label: "拍立得質感", zh: "畫面帶有拍立得的柔和發色與輕微褪色邊緣", en: "the image has the soft Polaroid color rendering with slightly faded edges" },
    ],
  },

  // 各選項的預設值 (以文章的進階範例為預設)
  defaults: {
    era: "1980s",
    scene: "asia-urban",
    brow: "thick",
    eye: "rose-brown",
    blush: "cheekbone",
    lip: "brick",
    hair: "big-curls",
    outfit: "power-suit",
    film: "film-warm",
  },

  // 濾鏡預設
  filterPresets: [
    { id: "80s-warm", label: "80 年代暖黃" },
    { id: "faded-film", label: "褪色底片" },
    { id: "sepia", label: "泛黃老照片" },
    { id: "cool-retro", label: "冷調復古" },
    { id: "high-contrast", label: "高對比寫真" },
  ],
};
