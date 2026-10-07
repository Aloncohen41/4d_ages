// A tiny stand-in for zustand, used only by the store tests (no persistence, no React).
function create() {
  return (init) => {
    let state; const listeners = new Set();
    const setState = (p, replace) => { const next = typeof p === "function" ? p(state) : p; if (next === state) return; const prev = state; state = replace ? next : { ...state, ...next }; listeners.forEach((l) => l(state, prev)); };
    const getState = () => state;
    const api = { setState, getState, subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); } };
    state = init(setState, getState, api);
    const hook = (sel) => (sel ? sel(state) : state);
    Object.assign(hook, api);
    return hook;
  };
}
module.exports = { create };
