// The measuring code shared by design-check and DW's canonical design step.
// It runs in a real browser (Playwright) on a real page.

// The lengths defined in styles/variables.css, in pixels (rem is 16 px).
export function lengthsFromVariables(css) {
  const lengths = new Set();
  for (const match of css.matchAll(/--[a-z0-9-]+\s*:\s*(-?[\d.]+)(rem|px)\s*;/gi)) {
    const px = match[2].toLowerCase() === "rem" ? parseFloat(match[1]) * 16 : parseFloat(match[1]);
    if (px !== 0) lengths.add(Math.round(px * 1000) / 1000);
  }
  return [...lengths];
}

// The sizes sorted, the ratio between each size and the next, the best single ratio and the largest gap from it.
export function ratioReport(sizes) {
  const sorted = [...sizes].sort((a, b) => a - b);
  const ratios = [];
  for (let i = 1; i < sorted.length; i++) ratios.push(sorted[i] / sorted[i - 1]);
  if (ratios.length === 0) return { best: null, largest_gap: 0, ratios: [] };
  const best = Math.pow(sorted[sorted.length - 1] / sorted[0], 1 / ratios.length);
  const largest_gap = Math.max(...ratios.map((r) => Math.abs(r - best)));
  const round = (n) => Math.round(n * 1000) / 1000;
  return { best: round(best), largest_gap: round(largest_gap), ratios: ratios.map(round) };
}

// Runs inside the page. Returns raw measurements.
function collect(scaleLengths) {
  const skipTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "META", "LINK", "TITLE"]);
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const all = [...document.body.querySelectorAll("*")].filter(
    (el) => !skipTags.has(el.tagName) && !el.tagName.includes("-") && !el.closest("[data-nextjs-dev-overlay], nextjs-portal") && visible(el),
  );
  const textEls = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));

  // sizes
  const sizeSet = new Set();
  for (const el of textEls) sizeSet.add(Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100);

  // measure: width of each p inside main, in the width of "0" in its own font
  const measures = [];
  for (const p of document.querySelectorAll("main p")) {
    if (!visible(p)) continue;
    const cs = getComputedStyle(p);
    if (cs.display === "inline") continue;
    const width = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const probe = document.createElement("span");
    probe.textContent = "0";
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
    p.appendChild(probe);
    const zero = probe.getBoundingClientRect().width;
    probe.remove();
    if (zero > 0 && width > 0) measures.push(Math.floor((width / zero) * 100) / 100);
  }

  // spacing: every non-zero margin, padding and gap in px
  const props = [
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "row-gap", "column-gap",
  ];
  let total = 0;
  let onScale = 0;
  for (const el of all) {
    const map = el.computedStyleMap?.();
    if (!map) continue;
    for (const prop of props) {
      const v = map.get(prop);
      if (!v || v.unit !== "px" || v.value === 0) continue; // auto, normal, percentages and zero are skipped
      total += 1;
      if (scaleLengths.some((len) => Math.abs(len - v.value) <= 0.5)) onScale += 1;
    }
  }

  // contrast
  const parse = (value) => {
    let m = value.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.%]+))?\s*\)$/);
    if (m) {
      let a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), a];
    }
    m = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\s*\)$/);
    if (m) {
      let a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return [parseFloat(m[1]) * 255, parseFloat(m[2]) * 255, parseFloat(m[3]) * 255, a];
    }
    return null;
  };
  const blend = (top, bottom) => {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
  };
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const background = (el) => {
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage !== "none") return null; // cannot resolve a picture or gradient
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) layers.push(c);
      if (c && c[3] === 1) break;
    }
    let result = [255, 255, 255, 1];
    for (const layer of layers.reverse()) result = blend(layer, result);
    return result;
  };
  const failures = [];
  const seen = new Set();
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    const fgRaw = parse(cs.color);
    const bg = background(el);
    if (!fgRaw || !bg) continue;
    const fg = fgRaw[3] < 1 ? blend(fgRaw, bg) : fgRaw;
    const l1 = lum(fg);
    const l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").slice(0, 40);
      const key = `${el.tagName}|${text}|${cs.color}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures.push({ element: el.tagName.toLowerCase(), text, ratio: Math.round(ratio * 100) / 100, needs: need });
    }
  }

  const mainText = (document.querySelector("main")?.innerText ?? "").trim();
  return {
    sizes: [...sizeSet].sort((a, b) => a - b),
    measures,
    spacing: { total, onScale },
    contrast_failures: failures,
    main_text_length: mainText.length,
  };
}

export async function measurePage(page, scaleLengths) {
  const raw = await page.evaluate(collect, scaleLengths);
  return {
    main_text_length: raw.main_text_length,
    sizes: raw.sizes,
    ratio: ratioReport(raw.sizes),
    measure_ch: raw.measures.length ? { min: Math.min(...raw.measures), max: Math.max(...raw.measures) } : null,
    spacing_share: raw.spacing.total ? Math.round((raw.spacing.onScale / raw.spacing.total) * 1000) / 1000 : null,
    contrast_failures: raw.contrast_failures,
  };
}

export async function newestArticlePath(baseUrl) {
  try {
    const html = await (await fetch(`${baseUrl}/blog`)).text();
    const match = html.match(/href="(\/blog\/[a-z0-9-]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function lighthouseScore(url, chromePath) {
  const [{ default: lighthouse }, chromeLauncher] = await Promise.all([import("lighthouse"), import("chrome-launcher")]);
  const chrome = await chromeLauncher.launch({
    chromePath: chromePath || undefined,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "silent",
      onlyCategories: ["accessibility"],
      formFactor: "desktop",
      screenEmulation: { mobile: false, width: 1280, height: 800, deviceScaleFactor: 1, disabled: false },
    });
    return Math.round((result?.lhr.categories.accessibility.score ?? 0) * 100);
  } finally {
    await chrome.kill();
  }
}
