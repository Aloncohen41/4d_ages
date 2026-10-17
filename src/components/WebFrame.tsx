/** A page drawn from HTML inside the app (the book's pages, the maps): Android's web view on the phone. See WebFrame.web.tsx for the website. */
export { WebView as WebFrame } from "react-native-webview";
export type { WebViewMessageEvent as WebFrameMessage } from "react-native-webview";
/** What a WebFrame ref can do (the same on the phone and the website): run a line of script in the page. */
export interface WebFrameHandle { injectJavaScript: (code: string) => void }
