(() => {
  const search = document.getElementById('bom-search');
  const group = document.getElementById('bom-group');
  const rows = [...document.querySelectorAll('[data-bom-row]')];
  const count = document.getElementById('bom-count');
  const empty = document.getElementById('bom-empty');
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const texts = rows.map(row => normalize(row.textContent));
  function update() {
    const query = normalize(search.value.trim());
    let visible = 0;
    rows.forEach((row, index) => {
      const show = (group.value === 'all' || group.value === row.dataset.group) && texts[index].includes(query);
      row.hidden = !show;
      if (show) visible++;
    });
    count.textContent = visible + ' de ' + rows.length + ' partidas';
    empty.hidden = visible > 0;
  }
  search.addEventListener('input', update);
  group.addEventListener('change', update);
  document.getElementById('print-bom').addEventListener('click', () => window.print());
  update();
})();
