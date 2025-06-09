/**
 * 下载音频文件
 * @param audioUrl 音频文件的URL
 * @param filename 下载的文件名（可选）
 */
export const downloadAudio = async (audioUrl: string, filename?: string) => {
  if (!audioUrl) {
    console.warn("音频URL为空，无法下载");
    return;
  }

  try {
    // 使用fetch获取音频文件
    const response = await fetch(audioUrl);

    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }

    // 转换为blob
    const blob = await response.blob();

    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // 设置文件名
    const defaultFilename = `tts_audio_${Date.now()}.${getFileExtension(audioUrl)}`;
    link.download = filename || defaultFilename;

    // 模拟点击下载
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    console.log("音频下载成功");
  } catch (error) {
    console.error("下载音频失败:", error);
    throw error;
  }
};

/**
 * 从URL中提取文件扩展名
 * @param url 文件URL
 * @returns 文件扩展名，默认为'mp3'
 */
const getFileExtension = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split(".").pop()?.toLowerCase();

    // 常见音频格式
    const audioExtensions = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];

    if (extension && audioExtensions.includes(extension)) {
      return extension;
    }

    return "mp3"; // 默认扩展名
  } catch {
    return "mp3"; // 解析失败时的默认扩展名
  }
};

/**
 * 生成下载文件名
 * @param voiceId 音色ID
 * @param text 文本内容（可选）
 * @param side 左侧或右侧标识
 * @returns 格式化的文件名
 */
export const generateDownloadFilename = (
  voiceId: string,
  text?: string,
  side?: "left" | "right"
): string => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const voiceName = voiceId.split(":").pop() || "unknown";
  const sideText = side ? `_${side}` : "";
  const textPreview = text ? `_${text.slice(0, 10)}` : "";

  return `tts_${voiceName}${sideText}${textPreview}_${timestamp}.mp3`;
};
