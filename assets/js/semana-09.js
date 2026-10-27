(() => {
  'use strict';
  const records = window.hornoWeek9Hazop;
  const select = document.getElementById('hazop-node');
  const container = document.getElementById('hazop-records');
  const summary = document.getElementById('hazop-node-summary');
  if (!Array.isArray(records) || !select || !container || !summary) return;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const classes = {'BAJO':'low','MEDIO':'medium','ALTO':'high','CRÍTICO':'critical'};
  function render() {
    const selected = records.filter(record => record.node === select.value);
    const critical = selected.filter(record => record.level === 'CRÍTICO').length;
    summary.textContent = select.value + ' · ' + selected.length + ' desviaciones · ' + critical + ' de categoría crítica inicial.';
    container.innerHTML = selected.map(record => '<details class="hazop-record" id="hazop-row-' + record.row + '"><summary><span class="hazop-guide">' + escapeHtml(record.guide) + '</span><span class="hazop-deviation">' + escapeHtml(record.deviation) + '</span><span class="risk-badge risk-' + classes[record.level] + '">' + record.risk + ' · ' + escapeHtml(record.level) + '</span></summary><div class="hazop-record-content"><dl><div><dt>Variable</dt><dd>' + escapeHtml(record.variable) + '</dd></div><div><dt>Causa considerada</dt><dd>' + escapeHtml(record.cause) + '</dd></div><div><dt>Consecuencia considerada</dt><dd>' + escapeHtml(record.consequence) + '</dd></div><div><dt>Acción registrada en la matriz</dt><dd>' + escapeHtml(record.action) + '</dd></div></dl><p class="hazop-score">P = ' + record.probability + ' · S = ' + record.severity + ' · P × S = ' + record.risk + ' (valoración inicial).</p><p class="source-note">Fuente: hoja «HAZOP 16 nodos», fila ' + record.row + ' del Excel original.</p></div></details>').join('');
  }
  select.addEventListener('change', render);
  render();
})();
