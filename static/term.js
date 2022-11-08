let term = new Terminal({
  // bellSound: "both",
  // bellStyle: "sound",
  cursorBlink: true,
  lineHeight: 1,
  fontSize: 18,
  fontFamily: "Andale Mono, courier-new, courier, monospace",
  scrollback: 1024 * 100,
});

const fit_addon = new FitAddon.FitAddon();
term.loadAddon(fit_addon);
term.loadAddon(new WebLinksAddon.WebLinksAddon());

term.onKey(async function (key) {
  key = (key.code == "Backspace") ? "\b" : key;
  key = (key.code == "Enter") ? "\n" : key;
  if (port) {
    const encoder = new TextEncoder();
    const writer = port.writable.getWriter();
    await writer.write(encoder.encode(key));
    writer.releaseLock();
  }
});

term.onData(function (data, ev) {
  console.debug(data);
});
