// KIYO Login Page HTML Dump v2 — iframe/shadow DOM 포함, 모달/SPA 대응
// 사용법:
//   1) 로그인 페이지 또는 모달이 열린 상태로
//   2) F12 → Console → 이 코드 붙여넣기 → Enter
//   3) 전체 outerHTML이 클립보드에 복사됨 + 콘솔에 요약 표시

(function dumpLoginPage() {
  const info = {
    url: location.href,
    title: document.title,
    domain: location.hostname,
    timestamp: new Date().toISOString(),
    hasIframes: document.querySelectorAll('iframe').length,
    hasShadow: !!document.body?.shadowRoot,
  };

  // iframe 내부까지 재귀 탐색하여 input 수집
  function collectInputs(win, depth, acc) {
    try {
      const doc = win.document;
      if (!doc) return;
      // 일반 input
      doc.querySelectorAll('input').forEach((el) => acc.push({ ...elToObj(el), _source: `depth${depth}` }));
      // contenteditable
      doc.querySelectorAll('[contenteditable="true"]').forEach((el) =>
        acc.push({
          type: 'contenteditable',
          name: el.getAttribute('name') || el.getAttribute('data-name') || '',
          id: el.id,
          className: el.className,
          ariaLabel: el.getAttribute('aria-label'),
          text: (el.textContent || '').slice(0, 50),
          _source: `depth${depth}`,
        })
      );
      // shadow root
      doc.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) collectInputs({ document: el.shadowRoot }, depth + 1, acc);
      });
      // iframe 재귀
      doc.querySelectorAll('iframe').forEach((f) => {
        try {
          if (f.contentWindow) collectInputs(f.contentWindow, depth + 1, acc);
        } catch (e) {
          acc.push({ type: 'iframe', src: f.src, _source: `depth${depth}+cross-origin`, _error: e.message });
        }
      });
    } catch (e) {
      acc.push({ _source: `depth${depth}`, _error: e.message });
    }
  }

  function elToObj(el) {
    return {
      type: el.type,
      name: el.name,
      id: el.id,
      className: el.className,
      autocomplete: el.autocomplete,
      placeholder: el.placeholder,
      value: el.value,
      required: el.required,
      hidden: el.hidden || el.type === 'hidden',
      ariaLabel: el.getAttribute('aria-label'),
      ariaLabelledBy: el.getAttribute('aria-labelledby'),
    };
  }

  const allInputs = [];
  collectInputs(window, 0, allInputs);

  const forms = Array.from(document.forms).map((f) => ({
    id: f.id,
    name: f.name,
    action: f.action,
    method: f.method,
    autocomplete: f.autocomplete,
  }));

  // 핵심: outerHTML + iframe HTML 별도 수집
  let mainHTML = document.documentElement.outerHTML;
  const iframeHTMLs = [];
  document.querySelectorAll('iframe').forEach((f, i) => {
    try {
      const c = f.contentDocument;
      if (c) iframeHTMLs.push({ idx: i, src: f.src, html: c.documentElement.outerHTML });
    } catch (e) {
      iframeHTMLs.push({ idx: i, src: f.src, _error: e.message });
    }
  });

  const summary = {
    info,
    forms,
    inputCount: allInputs.length,
    visibleInputs: allInputs.filter((i) => !i.hidden && !i._error),
    autofillCandidates: allInputs.filter(
      (i) => i.autocomplete && ['username', 'email', 'current-password', 'new-password', 'one-time-code'].some((k) => i.autocomplete?.includes(k))
    ),
    passwordCandidates: allInputs.filter((i) => i.type === 'password'),
    allInputs,
    iframeCount: iframeHTMLs.length,
  };

  console.group('🔍 KIYO Login Dump v2 (with iframe/shadow)');
  console.log('📋 Summary:', summary);
  console.log('📄 Main HTML (' + mainHTML.length + ' chars):', mainHTML);
  iframeHTMLs.forEach((f) => {
    if (f.html) {
      console.log(`📄 iframe[${f.idx}] (${f.src}) HTML (${f.html.length} chars):`, f.html);
    } else {
      console.warn(`📄 iframe[${f.idx}] (${f.src}): cross-origin or error`, f._error);
    }
  });
  console.groupEnd();

  // 클립보드: main + 모든 iframe HTML 결합
  const combined = [
    `<!-- MAIN (${location.href}) -->`,
    mainHTML,
    ...iframeHTMLs.filter((f) => f.html).map((f) => `<!-- IFRAME[${f.idx}] ${f.src} -->\n${f.html}`),
  ].join('\n\n');

  if (navigator.clipboard) {
    navigator.clipboard.writeText(combined).then(
      () => console.log(`✅ Combined HTML (${combined.length} chars) copied to clipboard`),
      (e) => console.warn('❌ Clipboard failed:', e)
    );
  }

  return summary;
})();
