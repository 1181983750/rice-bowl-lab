(function (root, factory) {
  'use strict';
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.RiceBowlRules = rules;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function evaluate(answers, core, questionCount = 10) {
    if (!Array.isArray(answers) || answers.length !== questionCount || Array.from(answers).some(answer => !['A', 'B', 'C', 'D'].includes(answer))) throw new Error('请完成全部古风抉择题');
    if (!['E', 'F'].includes(core)) throw new Error('请选择最后的行动内核');
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    answers.forEach(answer => { counts[answer]++; });
    const highest = Math.max(...Object.values(counts));
    const letters = Object.keys(counts).filter(letter => counts[letter] === highest);
    return { counts, highest, letters, core, keys: letters.map(letter => letter + core) };
  }
  return { evaluate };
});
