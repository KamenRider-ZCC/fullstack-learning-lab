export function normalizeMultipartFilename(originalName: string) {
  // Busboy/Multer 可能把浏览器发送的 UTF-8 文件名字节按 Latin-1 解码。
  const containsUnicode = [...originalName].some(
    (character) => character.codePointAt(0)! > 255,
  );
  if (containsUnicode) return originalName;

  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? originalName : decoded;
}
