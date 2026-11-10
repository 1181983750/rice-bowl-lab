(() => {
  'use strict';
  const data = window.QUIZ_DATA;
  const STORE_KEY = 'rice-bowl-lab:ancient:v2';
  const ACCESS_KEY = 'rice-bowl-lab:access:v1';
  const ACCESS_CODE = '9900';
  const main = document.querySelector('#main');
  const mainCount = data.questions.length;
  const total = mainCount + 1;
  const steps = [...data.questions.map(question => question.topic), '此心所向'];
  let state = restore();
  let toastTimer, lastFocus;
  let unlocked = restoreAccess();
  let transitionId = 0;
  let transitioning = false;
  let activeAnimation;

  function emptyState() { return { version: 2, index: 0, answers: Array(mainCount).fill(null), core: null }; }
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved?.version !== 2 || !Number.isInteger(saved.index) || saved.index < 0 || saved.index > mainCount || !Array.isArray(saved.answers) || saved.answers.length !== mainCount || saved.answers.some(answer => answer !== null && !['A', 'B', 'C', 'D'].includes(answer)) || (saved.core !== null && !['E', 'F'].includes(saved.core))) return emptyState();
      const firstGap = saved.answers.indexOf(null);
      if (firstGap !== -1) { saved.answers.fill(null, firstGap); saved.core = null; saved.index = Math.min(saved.index, firstGap); }
      return saved;
    } catch { return emptyState(); }
  }
  function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }
  function restoreAccess() { try { return sessionStorage.getItem(ACCESS_KEY) === 'unlocked'; } catch { return false; } }
  function escape(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
  function icon(name, attributes = '') { return `<i data-lucide="${name}" ${attributes}></i>`; }
  function icons() { window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } }); }
  function mainComplete() { return state.answers.every(answer => ['A', 'B', 'C', 'D'].includes(answer)); }
  function complete() { return mainComplete() && ['E', 'F'].includes(state.core); }
  function count() { return state.answers.filter(Boolean).length + (state.core ? 1 : 0); }
  function answerAt(index) { return index === mainCount ? state.core : state.answers[index]; }
  function resultFor() {
    const evaluation = window.RiceBowlRules.evaluate(state.answers, state.core, mainCount);
    return { ...evaluation, results: evaluation.keys.map(key => data.results.find(result => result.key === key)) };
  }
  function theme(result) { return `--type-color:${result.color};--type-bg:${result.bg}`; }
  function toast(message) {
    const node = document.querySelector('#toast'); clearTimeout(toastTimer);
    node.textContent = message; node.classList.add('visible');
    toastTimer = setTimeout(() => node.classList.remove('visible'), 2800);
  }
  function route() { return location.hash.slice(1) || (complete() ? 'result' : 'quiz'); }
  function navigate(target) { if (location.hash === '#' + target) render(true); else location.hash = target; }
  function pageHeading(title, eyebrow, caption = '') {
    return `<div class="page-heading"><div><div class="eyebrow">饭碗研究所<span>/</span>${eyebrow}</div><h1>${title}</h1></div>${caption ? `<div class="heading-caption">${caption}</div>` : ''}</div>`;
  }
  function render(animate = false, focus = false) {
    document.querySelector('.main-nav').hidden = !unlocked;
    document.querySelector('.header-note').innerHTML = unlocked ? '<span class="status-dot"></span>今日开饭' : icon('lock-keyhole') + '档案待启';
    document.body.classList.toggle('access-locked', !unlocked);
    if (!unlocked) { renderGate(); icons(); document.title = data.title + ' · 访问验证'; return; }
    let view = route();
    if ((view === 'result' || view === 'answers') && !complete()) { view = 'quiz'; history.replaceState(null, '', '#quiz'); }
    if (!['quiz', 'types', 'result', 'answers'].includes(view)) { view = 'quiz'; history.replaceState(null, '', '#quiz'); }
    document.querySelectorAll('[data-nav]').forEach(node => {
      const active = node.dataset.nav === (view === 'types' ? 'types' : 'quiz'); node.classList.toggle('active', active);
      if (active) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
    });
    if (view === 'quiz') renderQuiz();
    if (view === 'types') renderTypes();
    if (view === 'result' || view === 'answers') renderResult(view === 'answers');
    icons();
    main.classList.remove('view-enter');
    if (animate) requestAnimationFrame(() => main.classList.add('view-enter'));
    if (focus) main.querySelector('.question-title, h1')?.focus({ preventScroll: true });
    document.title = `${view === 'result' || view === 'answers' ? resultFor().results.map(result => result.name).join(' · ') : data.title} · 饭碗研究所`;
    if (view === 'answers') requestAnimationFrame(() => document.querySelector('#answer-review')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }

  function renderGate() {
    main.innerHTML = `<section class="access-entry" aria-labelledby="access-title"><img class="access-photo" src="assets/rice.jpg" alt="一碗白米饭" width="100" height="100"><div class="eyebrow">饭碗研究所<span>/</span>私人档案</div><h1 id="access-title">你天生该吃哪碗饭？</h1><div class="access-seal">${icon('lock-keyhole')}访问验证</div><form id="access-form" class="access-form" novalidate><label for="access-code">四位访问码</label><div class="access-input-wrap"><input id="access-code" name="access-code" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" placeholder="四位数字" aria-describedby="access-error" required><button type="button" class="access-toggle" data-action="toggle-code" title="显示访问码" aria-label="显示访问码" aria-pressed="false">${icon('eye')}</button></div><p id="access-error" class="access-error" role="alert"></p><button type="submit" class="button primary access-submit">开启我的档案${icon('arrow-right')}</button></form><p class="access-bottom">人间烟火，各有所长。</p></section>`;
  }

  function unlock(event) {
    event.preventDefault();
    const input = document.querySelector('#access-code'), error = document.querySelector('#access-error');
    if (input.value !== ACCESS_CODE) {
      input.setAttribute('aria-invalid', 'true'); error.textContent = input.value.length !== 4 ? '请输入四位数字访问码。' : '访问码不正确，请再试一次。';
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelector('.access-input-wrap').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 220 });
      input.focus(); input.select(); return;
    }
    unlocked = true;
    try { sessionStorage.setItem(ACCESS_KEY, 'unlocked'); } catch {}
    history.replaceState(null, '', complete() ? '#result' : '#quiz'); render(true, true);
  }

  function cancelTransition() { transitionId++; activeAnimation?.cancel(); activeAnimation = null; transitioning = false; }
  async function changeQuestion(nextIndex, direction = 1, showSelection = false) {
    if (!unlocked || transitioning) return;
    transitioning = true;
    const id = ++transitionId, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const outgoing = main.querySelector('.question-surface');
    outgoing.inert = true; outgoing.setAttribute('aria-busy', 'true');
    try {
      if (!reduced) {
        activeAnimation = outgoing.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-18 * direction}px)` }], { delay: showSelection ? 180 : 0, duration: 140, easing: 'ease-in', fill: 'forwards' });
        await activeAnimation.finished;
      }
      if (id !== transitionId || route() !== 'quiz') return;
      if (nextIndex > mainCount) { navigate('result'); return; }
      state.index = nextIndex; persist(); render(false, true);
      const incoming = main.querySelector('.question-surface'); incoming.inert = true;
      if (!reduced) {
        activeAnimation = incoming.animate([{ opacity: 0, transform: `translateX(${18 * direction}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 230, easing: 'cubic-bezier(.2,.7,.2,1)' });
        await activeAnimation.finished;
      }
      if (id === transitionId) { incoming.inert = false; incoming.querySelector('.question-title')?.focus({ preventScroll: true }); }
    } catch (error) { if (error.name !== 'AbortError') throw error; }
    finally { if (id === transitionId) { transitioning = false; activeAnimation = null; } }
  }

  function renderQuiz() {
    const index = state.index, isCore = index === mainCount, selected = answerAt(index);
    const question = isCore ? { text: '做完这些抉择之后，此刻的你，更想怎样走向下一程？', icon: 'sprout', options: Object.entries(data.cores).map(([letter, core]) => ({ letter, text: core.text, subtitle: core.name })) } : data.questions[index];
    main.innerHTML = pageHeading('你天生该吃哪碗饭<span class="title-dot">？</span>', '古风天赋档案', '<b>十</b>番抉择，一念所向') + `
      <div class="quiz-layout">
        <aside class="quiz-sidebar" aria-label="答题进度">
          <img class="rice-image" src="assets/rice.jpg" alt="盛满白米饭的黑色饭碗" width="231" height="150">
          <div class="photo-caption"><span>人间烟火，各有所长。</span>${icon('utensils')}</div>
          <div class="steps-label"><strong>抉择卷目</strong><span>${count()} / ${total} 已完成</span></div>
          <div class="step-list">${steps.map((topic, i) => `<div class="step ${answerAt(i) ? 'done' : ''} ${i === index ? 'active' : ''} ${i === mainCount ? 'core-step' : ''}" ${i === index ? 'aria-current="step"' : ''}><span class="step-number">${answerAt(i) && i !== index ? icon('check') : i === mainCount ? icon('sprout') : String(i + 1).padStart(2, '0')}</span><span>${topic}</span>${i === index ? '<span class="step-marker"></span>' : ''}</div>`).join('')}</div>
          <div class="sidebar-bottom">${icon('coffee')}心有所向，自成滋味。</div>
        </aside>
        <section class="question-surface ${isCore ? 'core-surface' : ''}" aria-labelledby="question-title">
          <div class="mobile-progress" aria-label="答题进度">${steps.map((topic, i) => `<span class="mobile-step ${answerAt(i) ? 'done' : ''} ${i === index ? 'active' : ''}" aria-label="${i === mainCount ? '收尾题' : '第 ' + (i + 1) + ' 题'}：${topic}${answerAt(i) ? '，已作答' : ''}" ${i === index ? 'aria-current="step"' : ''}></span>`).join('')}</div>
          <div class="question-top"><span class="topic">${icon(question.icon)}${steps[index]}</span><span class="question-fraction">${isCore ? '<strong>收尾</strong> / 此心所向' : `<strong>${String(index + 1).padStart(2, '0')}</strong> / ${String(mainCount).padStart(2, '0')}`}</span></div>
          <div class="progress-track" aria-hidden="true"><span style="width:${(index + 1) / total * 100}%"></span></div>
          <h2 class="question-title" id="question-title" tabindex="-1">${escape(question.text)}</h2>
          <div class="options" role="group" aria-labelledby="question-title">${question.options.map(option => `<button class="option ${selected === option.letter ? 'selected' : ''}" data-answer="${option.letter}" aria-pressed="${selected === option.letter}"><span class="option-letter">${option.letter}</span><span class="option-text">${isCore ? `<strong class="core-name">${option.subtitle}</strong>` : ''}${escape(option.text)}</span>${icon('circle-check', 'class="option-check"')}</button>`).join('')}</div>
          <div class="question-bottom"><button class="icon-button prev-button" data-action="previous" title="上一题" aria-label="上一题" ${index === 0 ? 'disabled' : ''}>${icon('arrow-left')}</button><span class="question-status" role="status">${selected ? icon('check') + '已选择 ' + selected : '尚未选择'}</span><button class="button primary" data-action="next" ${!selected ? 'disabled' : ''}>${isCore ? '揭晓我的饭碗' : index === mainCount - 1 ? '此心所向' : '下一道'}${icon(isCore ? 'sparkles' : 'arrow-right')}</button></div>
          <div class="quiz-bottom-note"><span>${icon('heart')}心之所近，便是答案。</span><button class="text-button" data-action="restart" title="清空答案并重新开始">${icon('rotate-ccw')}重新开始</button></div>
        </section>
      </div>`;
  }

  function typeDetails(result) {
    return `<p>${escape(result.portrait)}</p><p>${escape(result.direction)}</p><p><b>贴心提示</b> · ${escape(result.reminder)}</p><p class="type-quote">${escape(result.quote)}</p>`;
  }
  function renderTypes() {
    main.innerHTML = `<div class="types-heading">${pageHeading('八只饭碗，各有归处。', '饭碗图鉴')}<p class="types-subtitle">有人立规掌舵，有人静守文心。世间的路，各有值得深耕的一程。</p></div><div class="types-grid ancient-types">${data.results.map(result => `<article class="type-card" style="${theme(result)}"><div class="type-symbol">${icon(result.icon)}</div><h2>${result.name}</h2><p class="type-description">${result.label}</p><div class="type-range"><span>${data.dimensions[result.letter].name}</span><b>${data.cores[result.core].name}</b></div><details><summary>读这碗饭${icon('chevron-down')}</summary>${typeDetails(result)}</details></article>`).join('')}</div><p class="test-notice">测试说明：${data.notice}</p><div class="types-return"><button class="button primary" data-action="${complete() ? 'result' : 'quiz'}">${complete() ? '查看我的结果' : count() ? '继续我的测试' : '测测我的饭碗'}${icon('arrow-right')}</button></div>`;
  }

  function renderProfile(result, isTie) {
    return `<section class="result-section result-profile" data-result-key="${result.key}" style="${theme(result)}"><div class="section-heading"><h2>${isTie ? `<span class="profile-icon">${icon(result.icon)}</span>${result.name}` : '<span class="section-number">01</span>这碗饭里的你'}</h2><span class="profile-label">${result.label}</span></div><div class="result-copy"><p>${escape(result.portrait)}</p></div><div class="direction-grid profile-directions"><div class="direction-item"><span>适合深耕的方向</span><p>${escape(result.direction)}</p></div><div class="direction-item"><span>贴心提示</span><p>${escape(result.reminder)}</p></div></div><p class="result-quote">${escape(result.quote)}</p></section>`;
  }
  function renderResult(expandAll = false) {
    const evaluation = resultFor(), { results, counts, highest } = evaluation, first = results[0], isTie = results.length > 1;
    main.innerHTML = `<div class="result-page" style="${isTie ? '--type-color:#38796b;--type-bg:#eaf3ee' : theme(first)}">
      <div class="result-toolbar"><a href="#quiz" class="text-button">${icon('arrow-left')}返回作答</a><span>古风天赋档案 / ${isTie ? '并列倾向' : String(data.results.indexOf(first) + 1).padStart(2, '0')}</span></div>
      <section class="result-intro" aria-labelledby="result-title"><div><div class="result-kicker">${icon('badge-check')}${isTie ? '你的天赋，有不止一种滋味' : '你的本命饭碗已出炉'}</div><h1 class="result-title ${isTie ? 'tied-title' : ''}" id="result-title" tabindex="-1">${isTie ? '一身所长，不止一碗。' : first.name}</h1><p class="result-summary">${isTie ? `${results.length} 种行动倾向各获 ${highest} 次选择，都是这次的主要倾向。` : first.label}</p><div class="result-tags">${isTie ? results.map(result => `<span class="tied-tag">${result.name}</span>`).join('') : first.label.split('，').map(tag => `<span>${tag}</span>`).join('')}<span>${data.cores[state.core].name}</span></div></div><div class="result-stamp" aria-hidden="true">${icon(isTie ? 'sprout' : first.icon)}<span>RICE BOWL LAB</span><strong>各有各的滋味</strong></div></section>
      <div class="result-actions"><button class="button primary" data-action="download">${icon('download')}保存结果卡</button><button class="button secondary" data-action="review">${icon('list-checks')}查看答题解析</button><button class="icon-button" data-action="restart" aria-label="重新测试" title="重新测试">${icon('rotate-ccw')}</button></div>
      <section class="tendency-section" aria-labelledby="tendency-title"><div class="section-heading"><h2 id="tendency-title">你的行动倾向</h2><span class="count-caption">十次抉择</span></div><div class="tendency-grid">${Object.entries(data.dimensions).map(([letter, dimension]) => `<div class="tendency-item ${evaluation.letters.includes(letter) ? 'is-leading' : ''}" style="--dimension-color:${dimension.color}" data-count-letter="${letter}"><div class="tendency-label">${icon(dimension.icon)}<span>${dimension.name}</span><strong>${counts[letter]}<small>次</small></strong></div><div class="tendency-track"><span style="width:${counts[letter] / mainCount * 100}%"></span></div><span class="dimension-description">${dimension.description}</span></div>`).join('')}</div><div class="core-result">${icon(data.cores[state.core].icon)}<span>此心所向</span><strong>${data.cores[state.core].name}</strong></div></section>
      ${results.map(result => renderProfile(result, isTie)).join('')}
      <section class="result-section" id="answer-review"><div class="section-heading"><h2><span class="section-number">${isTie ? '卷末' : '02'}</span>你的选择，有迹可循</h2><button class="text-button" data-action="toggle-reviews">${expandAll ? '收起全部' : '展开全部'}${icon(expandAll ? 'chevrons-up' : 'chevrons-down')}</button></div><div class="review-list">${data.questions.map((question, index) => {
        const chosen = question.options.find(option => option.letter === state.answers[index]);
        return `<details class="review-item" ${expandAll ? 'open' : ''}><summary><span class="review-index">${String(index + 1).padStart(2, '0')}</span><span class="review-question">${escape(question.text)}<span class="your-answer">你的选择 · ${chosen.letter} ${escape(chosen.text)}</span></span>${icon('chevron-down')}</summary><div class="review-options">${question.options.map(option => `<div class="review-option ${option.letter === chosen.letter ? 'is-yours' : ''}"><strong>${option.letter}. ${escape(option.text)}${option.letter === chosen.letter ? '<small>你的选择</small>' : ''}</strong><p>${escape(option.analysis)}</p><span class="review-dimension">${data.dimensions[option.letter].description}</span></div>`).join('')}</div></details>`;
      }).join('')}<details class="review-item" ${expandAll ? 'open' : ''}><summary><span class="review-index">终</span><span class="review-question">抉择之后，此心所向<span class="your-answer">你的选择 · ${state.core} ${data.cores[state.core].text}</span></span>${icon('chevron-down')}</summary><div class="review-options"><div class="review-option is-yours"><strong>${data.cores[state.core].name}</strong><p>${data.cores[state.core].analysis}</p></div></div></details></div></section>
      <p class="test-notice">测试说明：${data.notice}</p><div class="result-bottom"><p>饭碗不必只有一只，人生也可以换个菜单。</p><a href="#types" class="button secondary">看看其他饭碗${icon('arrow-up-right')}</a></div>
    </div>`;
  }

  function selectAnswer(letter) {
    if (!unlocked || transitioning) return;
    const accepted = state.index === mainCount ? ['E', 'F'] : ['A', 'B', 'C', 'D'];
    if (!accepted.includes(letter)) return;
    if (state.index === mainCount) state.core = letter; else state.answers[state.index] = letter;
    persist(); render(); main.querySelector(`[data-answer="${letter}"]`)?.focus({ preventScroll: true });
    next(true);
  }
  function next(showSelection = false) {
    if (!unlocked || transitioning || !answerAt(state.index)) return;
    if (state.index === mainCount) { if (complete()) changeQuestion(mainCount + 1, 1, showSelection); return; }
    if (state.answers.slice(0, state.index + 1).some(answer => !answer)) return;
    changeQuestion(state.index + 1, 1, showSelection);
  }
  function previous() { if (unlocked && !transitioning && state.index > 0) changeQuestion(state.index - 1, -1); }
  function restart() {
    if (count() === 0) { state = emptyState(); persist(); navigate('quiz'); return; }
    lastFocus = document.activeElement; document.querySelector('#restart-dialog').showModal();
  }
  function closeDialog() { document.querySelector('#restart-dialog').close(); lastFocus?.focus({ preventScroll: true }); }
  function toggleReviews() {
    const rows = [...main.querySelectorAll('.review-item')], shouldOpen = rows.some(row => !row.open);
    rows.forEach(row => { row.open = shouldOpen; });
    main.querySelector('[data-action="toggle-reviews"]').innerHTML = (shouldOpen ? '收起全部' : '展开全部') + icon(shouldOpen ? 'chevrons-up' : 'chevrons-down'); icons();
  }

  async function downloadResult() {
    const button = main.querySelector('[data-action="download"]'); if (button.disabled) return; button.disabled = true;
    try {
      const evaluation = resultFor(), { results, counts } = evaluation, isTie = results.length > 1;
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      const width = 1080, pad = 80, contentWidth = width - pad * 2, accent = isTie ? '#38796b' : results[0].color;
      canvas.width = width;
      const font = (size, weight = 400) => `${weight} ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      function split(text, size, maxWidth, weight) {
        context.font = font(size, weight); const rows = []; let line = '';
        for (const char of text) {
          if (char === '\n') { rows.push(line); line = ''; continue; }
          if (line && context.measureText(line + char).width > maxWidth) { rows.push(line); line = char; } else line += char;
        }
        if (line) rows.push(line); return rows;
      }
      // Measure and draw the same blocks so tied result cards cannot truncate their text.
      const blocks = [];
      const add = (text, size = 27, color = '#56635a', weight = 400, gap = 20, lineHeight = Math.round(size * 1.8)) => blocks.push({ rows: split(text, size, contentWidth, weight), size, color, weight, gap, lineHeight });
      add('饭碗研究所  /  古风天赋档案', 28, accent, 600, 65);
      add(isTie ? '一身所长，不止一碗。' : results[0].name, isTie ? 57 : 72, '#242c29', 700, 20, 100);
      if (isTie) add(results.map(result => result.name).join('  ·  '), 32, accent, 600, 25);
      add('此心所向 · ' + data.cores[state.core].name, 26, accent, 500, 25);
      add(Object.entries(counts).map(([letter, value]) => `${data.dimensions[letter].name} ${value} 次`).join('    '), 25, '#7b847f', 400, 55);
      for (const result of results) {
        if (isTie) add(result.name, 39, result.color, 650, 10);
        add(result.label, 27, result.color, 500, 25);
        add(result.portrait);
        add('适合方向 · ' + result.direction);
        add('贴心提示 · ' + result.reminder);
        add(result.quote, 30, result.color, 550, 55);
      }
      add('我的十次抉择', 32, '#242c29', 650, 25);
      data.questions.forEach((question, index) => {
        const selected = question.options.find(option => option.letter === state.answers[index]);
        add(`${String(index + 1).padStart(2, '0')}  ${question.text}`, 24, '#56635a', 500, 8);
        add(`${selected.letter}  ${selected.text}`, 24, accent, 400, 28);
      });
      add(`收尾 · ${state.core} ${data.cores[state.core].text}`, 24, accent, 400, 40);
      add('测试说明：' + data.notice, 22, '#7b847f', 400, 0);
      canvas.height = pad * 2 + blocks.reduce((height, block) => height + block.rows.length * block.lineHeight + block.gap, 0);
      context.fillStyle = '#f7f8f6'; context.fillRect(0, 0, width, canvas.height);
      let y = pad;
      for (const block of blocks) {
        context.font = font(block.size, block.weight); context.fillStyle = block.color; context.textBaseline = 'top';
        for (const row of block.rows) { context.fillText(row, pad, y); y += block.lineHeight; } y += block.gap;
      }
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Empty image')), 'image/png'));
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `我的饭碗-${results.map(result => result.name).join('与')}.png`; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000); toast('结果卡已生成。');
    } catch { toast('图片暂时无法保存，请稍后重试。'); }
    finally { button.disabled = false; }
  }

  document.addEventListener('click', event => {
    if (!unlocked) {
      const toggle = event.target.closest('[data-action="toggle-code"]');
      if (toggle) { const input = document.querySelector('#access-code'), show = input.type === 'password'; input.type = show ? 'text' : 'password'; toggle.innerHTML = icon(show ? 'eye-off' : 'eye'); toggle.title = toggle.ariaLabel = show ? '隐藏访问码' : '显示访问码'; toggle.setAttribute('aria-pressed', String(show)); icons(); input.focus(); }
      return;
    }
    if (transitioning) return;
    const answer = event.target.closest('[data-answer]'); if (answer) { selectAnswer(answer.dataset.answer); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'next') next();
    if (action === 'previous') previous();
    if (action === 'restart') restart();
    if (action === 'close-dialog') closeDialog();
    if (action === 'confirm-restart') { document.querySelector('#restart-dialog').close(); state = emptyState(); persist(); navigate('quiz'); window.scrollTo(0, 0); }
    if (action === 'quiz' || action === 'result') { navigate(action); window.scrollTo(0, 0); }
    if (action === 'review') { if (route() === 'answers') document.querySelector('#answer-review').scrollIntoView(); else navigate('answers'); }
    if (action === 'toggle-reviews') toggleReviews();
    if (action === 'download') downloadResult();
  });
  document.addEventListener('submit', event => { if (event.target.id === 'access-form') unlock(event); });
  document.addEventListener('input', event => { if (event.target.id === 'access-code') { event.target.removeAttribute('aria-invalid'); document.querySelector('#access-error').textContent = ''; } });
  document.addEventListener('keydown', event => {
    if (!unlocked || transitioning || event.repeat || route() !== 'quiz' || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const keys = state.index === mainCount ? ['E', 'F'] : ['A', 'B', 'C', 'D'];
    if (/^[1-4]$/.test(event.key) && keys[Number(event.key) - 1]) { event.preventDefault(); selectAnswer(keys[Number(event.key) - 1]); }
    if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
  });
  window.addEventListener('hashchange', () => { cancelTransition(); clearTimeout(toastTimer); document.querySelector('#toast').classList.remove('visible'); render(true); if (route() !== 'answers') window.scrollTo(0, 0); });
  window.addEventListener('storage', event => { if (event.key === STORE_KEY) { cancelTransition(); state = restore(); render(); } });
  if (!location.hash) history.replaceState(null, '', complete() ? '#result' : '#quiz');
  render();
})();
