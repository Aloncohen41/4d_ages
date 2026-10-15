import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View, StyleProp, ViewStyle } from "react-native";

/*
 * The website's stand-in for the phone's web view: the same HTML in a frame on the page. The page inside talks to the app exactly as it does
 * on the phone (window.ReactNativeWebView.postMessage), and the app can run a line of script in it (injectJavaScript), so the book's
 * preview, the Customize view and the maps work unchanged.
 */
export interface WebFrameMessage { nativeEvent: { data: string } }

interface Props {
  source: { html: string; baseUrl?: string };
  /** What the frame shows, for screen readers ("The book's pages", "Map"): the frame's title. */
  accessibilityLabel?: string;
  onMessage?: (e: WebFrameMessage) => void;
  onLoadEnd?: () => void;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [other: string]: any; // the phone-only settings (file access, and so on) are simply not needed here
}

export interface WebFrameHandle { injectJavaScript: (code: string) => void }

const BRIDGE = `<script>window.ReactNativeWebView={postMessage:function(d){parent.postMessage({__webframe:window.name,data:String(d)},"*")}};</script>`;
let next = 0;

export const WebFrame = forwardRef<WebFrameHandle, Props>(function WebFrame({ source, onMessage, onLoadEnd, style, containerStyle, scrollEnabled = true, accessibilityLabel: title = "Content" }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const name = useMemo(() => `webframe-${++next}`, []);
  // the bridge goes first in the page, so its own scripts can talk from the start; a base address keeps relative links as they were
  const doc = useMemo(() => {
    const head = `${source.baseUrl && /^https?:/.test(source.baseUrl) ? `<base href="${source.baseUrl}">` : ""}${BRIDGE}`;
    return /<head[^>]*>/i.test(source.html) ? source.html.replace(/<head[^>]*>/i, (m: string) => m + head) : head + source.html;
  }, [source.html, source.baseUrl]);
  const latest = useRef(onMessage);
  latest.current = onMessage;
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data as { __webframe?: string; data?: string } | null;
      if (d && d.__webframe === name && typeof d.data === "string") latest.current?.({ nativeEvent: { data: d.data } });
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [name]);
  useImperativeHandle(ref, () => ({
    injectJavaScript: (code: string) => {
      try { (frame.current?.contentWindow as unknown as { eval: (c: string) => unknown } | null)?.eval(code); } catch { /* the page isn't ready yet */ }
    },
  }), []);
  return (
    <View style={[{ flex: 1, overflow: "hidden" }, containerStyle, style]}>
      {React.createElement("iframe", {
        ref: frame,
        name,
        title,
        srcDoc: doc,
        onLoad: () => onLoadEnd?.(),
        scrolling: scrollEnabled ? "auto" : "no",
        style: { border: 0, width: "100%", height: "100%", background: "transparent", overflow: scrollEnabled ? "auto" : "hidden" },
      })}
    </View>
  );
});
