/**
 * 处理示例列表中的图片URL，根据不同region使用不同的域名
 * @param exampleList 示例列表
 * @param region 区域代码，0表示中国大陆，其他值表示海外
 * @returns 处理后的示例列表
 */
export const processExamples = <T extends { img: string }>(
  exampleList: T[],
  region?: number
) => {
  return exampleList.map((example) => {
    if (region === 0) {
      // 中国大陆地区使用cn域名
      return {
        ...example,
        img: example.img.replace("file.302.ai", "file.302ai.cn"),
      };
    }
    return example;
  });
};

/**
 * 处理音频URL，根据不同region使用不同的域名
 * @param audioUrl 音频URL
 * @param region 区域代码，0表示中国大陆，其他值表示海外
 * @returns 处理后的音频URL
 */
export const processAudioUrl = (audioUrl: string, region?: number): string => {
  if (!audioUrl) return audioUrl;

  // if (region === 0) {
  //   // 中国大陆地区使用cn域名
  //   return audioUrl.replace("file.302.ai", "file.302ai.cn");
  // }
  return audioUrl;
};
