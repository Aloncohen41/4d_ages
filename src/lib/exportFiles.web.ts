/** The website: a made file keeps its address (its proper name is given when it's downloaded or shared), and there's no folder to pick. */
export async function saveToFolder(_mimeType: string): Promise<((uri: string, fileName: string) => void) | null> {
  return null;
}
export async function withFriendlyName(uri: string, _fileName: string): Promise<string> {
  return uri;
}
