// KIYO Login Page HTML Dump — 브라우저 콘솔 스니펫
// 사용법: 로그인 페이지에서 F12 → Console 탭 → 이 코드 붙여넣기 → Enter
// 결과: 현재 페이지의 outerHTML이 클립보드에 복사되고 콘솔에 표시됨

(function dumpLoginPage() {
  // 1. 페이지 기본 정보
  const info = {
    url: location.href,
    title: document.title,
    domain: location.hostname,
    webDomain: location.hostname,
    timestamp: new Date().toISOString(),
  };

  // 2. input 필드만 추출 (KIYO FieldScorer가 보는 신호)
  const inputs = Array.from(document.querySelectorAll('input')).map((el) => ({
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
  }));

  // 3. form 정보
  const forms = Array.from(document.forms).map((f) => ({
    id: f.id,
    name: f.name,
    action: f.action,
    method: f.method,
    autocomplete: f.autocomplete,
  }));

  // 4. 전체 outerHTML
  const outerHTML = document.documentElement.outerHTML;

  // 5. JSON 요약 (콘솔용)
  const summary = {
    info,
    forms,
    inputCount: inputs.length,
    visibleInputs: inputs.filter((i) => !i.hidden),
    autofillCandidates: inputs.filter((i) =>
      i.autocomplete &&
      ['username', 'email', 'current-password', 'new-password', 'one-time-code'].some(
        (kw) => i.autocomplete.includes(kw)
      )
    ),
    inputs,
  };

  console.group('🔍 KIYO Login Page Dump');
  console.log('📋 Summary:', summary);
  console.log('📄 Full HTML (' + outerHTML.length + ' chars):', outerHTML);
  console.groupEnd();

  // 6. 클립보드 복사 (outerHTML만)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(outerHTML).then(
      () => console.log('✅ outerHTML 복사됨 (전체 HTML)'),
      (err) => console.warn('❌ 클립보드 복사 실패:', err)
    );
  } else {
    // 클립보드 API 없으면 텍스트 영역 fallback
    const ta = document.createElement('textarea');
    ta.value = outerHTML;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      console.log('✅ outerHTML 복사됨 (fallback)');
    } catch (e) {
      console.warn('❌ 복사 실패. 콘솔에서 직접 복사하세요');
    }
    document.body.removeChild(ta);
  }

  // 7. 자동 다운로드 (선택) — 다음 줄 주석 해제 시 .html 파일로 저장
  // const blob = new Blob([outerHTML], { type: 'text/html' });
  // const a = document.createElement('a');
  // a.href = URL.createObjectURL(blob);
  // a.download = info.domain.replace(/\./g, '_') + '_' + Date.now() + '.html';
  // a.click();

  return summary;
})();
