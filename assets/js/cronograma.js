(() => {
  'use strict';
  const source = window.hornoSchedule;
  if (!source || !Array.isArray(source.tasks)) return;
  const tasks = source.tasks, byId = new Map(tasks.map(task => [task.uid, task]));
  const stages = tasks.filter(task => task.level === 1);
  const stageIndex = new Map(stages.map((task, index) => [task.uid, index + 1]));
  const elements = Object.fromEntries(['search','stage','view','scale','critical','links','expand','shell','scroller','grid','axis','body','rows','connections','empty','count','link-count'].map(key => [key, document.getElementById('gantt-' + key)]));
  const dialog = document.getElementById('task-dialog');
  const dialogContent = document.getElementById('task-dialog-content');
  const expandedWeeks = new Set();
  const DAY = 86400000;
  const parseDate = value => Date.parse(value + 'Z');
  const start = Date.parse(source.project.start.slice(0, 10) + 'T00:00:00Z');
  const end = Date.parse(source.project.finish.slice(0, 10) + 'T00:00:00Z') + DAY;
  const days = (end - start) / DAY;
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const shortDate = value => new Intl.DateTimeFormat('es-PE', {day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(typeof value === 'number' ? value : parseDate(value))).replace('.', '');
  const fullDate = value => new Intl.DateTimeFormat('es-PE', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}).format(new Date(parseDate(value)));
  const percent = value => Math.max(0, Math.min(100, (parseDate(value) - start) / (end - start) * 100));
  const textById = new Map(tasks.map(task => [task.uid, normalize([task.name,task.outline,task.id,task.notes,...task.resources.map(r => r.name)].join(' '))]));
  let visible = [], timelineWidth = 832, inspected = null;

  function ancestors(task) {
    const result = [];
    for (let parent = byId.get(task.parent); parent; parent = byId.get(parent.parent)) result.push(parent);
    return result;
  }
  function getVisible() {
    const query = normalize(elements.search.value.trim());
    const stage = elements.stage.value, view = elements.view.value;
    let candidates = tasks.filter(task => (!stage || task.stage === stage) && (view !== 'milestones' || task.summary || task.milestone));
    if (query) {
      const matches = new Set(candidates.filter(task => textById.get(task.uid).includes(query)).map(task => task.uid));
      candidates = candidates.filter(task => matches.has(task.uid) || ancestors(task).some(parent => matches.has(parent.uid)));
      const included = new Set(candidates.map(task => task.uid));
      candidates.forEach(task => ancestors(task).forEach(parent => included.add(parent.uid)));
      return tasks.filter(task => included.has(task.uid) && (!stage || task.stage === stage));
    }
    if (view === 'all' || view === 'milestones') return candidates;
    return candidates.filter(task => task.level <= 2 || expandedWeeks.has(task.parent));
  }
  function updateWidth() {
    const labelWidth = parseFloat(getComputedStyle(elements.grid).getPropertyValue('--label-width')) || 330;
    timelineWidth = elements.scale.value === 'day' ? days * 28 : Math.max(days / 7 * 52, elements.scroller.clientWidth - labelWidth - 2);
    elements.grid.style.setProperty('--timeline-width', timelineWidth + 'px');
    elements.grid.style.setProperty('--unit', (elements.scale.value === 'day' ? 28 : timelineWidth / (days / 7)) + 'px');
  }
  function renderAxis() {
    const monthLabels = [];
    let current = start;
    while (current < end) {
      const date = new Date(current);
      const next = Math.min(Date.UTC(date.getUTCFullYear(), date.getUTCMonth()+1, 1), end);
      const name = new Intl.DateTimeFormat('es-PE', (next-current)/DAY < 14 ? {month:'short',timeZone:'UTC'} : {month:'long',year:'numeric',timeZone:'UTC'}).format(date).replace('.', '');
      monthLabels.push('<span style="width:' + ((next-current)/(end-start)*100) + '%">' + escapeHtml(name) + '</span>');
      current = next;
    }
    const ticks = [];
    if (elements.scale.value === 'day') {
      for (let i=0;i<days;i++) {
        const date = new Date(start+i*DAY);
        ticks.push('<span class="' + ([0,6].includes(date.getUTCDay())?'is-weekend':'') + '" style="width:28px">' + date.getUTCDate() + '</span>');
      }
    } else {
      for (let i=0;i<days/7;i++) ticks.push('<span style="width:' + (timelineWidth/(days/7)) + 'px"><b>S' + String(i+1).padStart(2,'0') + '</b><small>' + escapeHtml(shortDate(start+i*7*DAY)) + '</small></span>');
    }
    elements.axis.innerHTML = '<div class="gantt-axis-label"><strong>Actividad y fechas</strong><span>Plan de 16 semanas · 2026</span></div><div class="gantt-axis-timeline"><div class="gantt-months">' + monthLabels.join('') + '</div><div class="gantt-ticks">' + ticks.join('') + '</div></div>';
  }
  function renderRows() {
    const canToggle = elements.view.value === 'weeks' && !elements.search.value.trim();
    elements.rows.innerHTML = visible.map(task => {
      const phase = stageIndex.get(task.stage);
      const left = percent(task.start), finish = percent(task.finish), width = Math.max(finish-left,0.04);
      const rowClass = 'gantt-row row-level-' + task.level + (task.milestone ? ' is-milestone' : '') + (task.critical ? ' is-critical' : '') + (task.summary ? ' is-summary' : '');
      const name = task.level === 2 ? task.name.replace(/^SEMANA\s+\d+\s*[—–-]\s*/i,'') : task.name;
      const prefix = task.level === 2 ? '<span class="week-code">S' + String(task.week).padStart(2,'0') + '</span>' : task.level === 3 ? '<span class="task-id">' + task.id + '</span>' : '';
      const toggle = task.level === 2 && canToggle ? '<button type="button" class="week-toggle" data-toggle="' + task.uid + '" aria-expanded="' + expandedWeeks.has(task.uid) + '" aria-label="' + (expandedWeeks.has(task.uid)?'Ocultar':'Desplegar') + ' actividades de la semana ' + task.week + '">' + (expandedWeeks.has(task.uid)?'−':'+') + '</button>' : '<span class="toggle-spacer"></span>';
      const dates = task.level === 1 ? '' : '<small>' + escapeHtml(shortDate(task.start)) + ' — ' + escapeHtml(shortDate(task.finish)) + (task.milestone?' · Hito':'') + '</small>';
      const bar = '<button class="gantt-bar' + (task.milestone?' milestone-mark':task.summary?' summary-mark':'') + '" type="button" data-inspect="' + task.uid + '" style="left:' + left + '%;' + (task.milestone?'':'width:' + width + '%;') + '" aria-label="' + escapeHtml(task.name + '. ' + shortDate(task.start) + ' a ' + shortDate(task.finish) + '. Consultar ficha.') + '"><span class="bar-mark"' + (task.milestone?'':' style="width:' + Math.max(width/100*timelineWidth,3) + 'px"') + '></span></button>';
      return '<div class="' + rowClass + '" data-phase="' + phase + '" data-row="' + task.uid + '"><div class="gantt-task-label">' + toggle + '<button class="task-name" type="button" data-inspect="' + task.uid + '">' + prefix + '<span class="task-name-copy"><span>' + escapeHtml(name) + '</span>' + dates + '</span></button></div><div class="gantt-lane">' + bar + '</div></div>';
    }).join('');
    elements.empty.hidden = visible.length > 0;
    elements.count.textContent = visible.length + ' filas visibles · ' + ({weeks:'Resumen por semanas',all:'Todas las actividades',milestones:'Solo hitos'}[elements.view.value]);
    elements.shell.classList.toggle('highlight-critical', elements.critical.checked);
  }
  function drawLinks() {
    const svg = elements.connections;
    svg.replaceChildren();
    elements['link-count'].textContent = '';
    if (!elements.links.checked || !visible.length) return;
    const visibleIds = new Set(visible.map(task => task.uid));
    const rowMap = new Map([...elements.rows.children].map(row => [row.dataset.row, row]));
    const height = elements.rows.offsetHeight;
    svg.setAttribute('viewBox','0 0 ' + timelineWidth + ' ' + height);
    svg.style.height = height + 'px';
    const NS='http://www.w3.org/2000/svg';
    const defs=document.createElementNS(NS,'defs');
    const marker=document.createElementNS(NS,'marker');
    marker.id='gantt-arrow'; marker.setAttribute('viewBox','0 0 8 8'); marker.setAttribute('refX','7'); marker.setAttribute('refY','4'); marker.setAttribute('markerWidth','6'); marker.setAttribute('markerHeight','6'); marker.setAttribute('orient','auto');
    const arrow=document.createElementNS(NS,'path'); arrow.setAttribute('d','M0 0 L8 4 L0 8 Z'); arrow.setAttribute('fill','currentColor'); marker.append(arrow); defs.append(marker); svg.append(defs);
    let count=0;
    for(const task of visible) for(const predecessor of task.predecessors) {
      if(!visibleIds.has(predecessor.uid)) continue;
      const previous=byId.get(predecessor.uid), from=rowMap.get(previous.uid), to=rowMap.get(task.uid);
      const x1=percent(previous.finish)/100*timelineWidth, x2=percent(task.start)/100*timelineWidth;
      const y1=from.offsetTop+from.offsetHeight/2, y2=to.offsetTop+to.offsetHeight/2;
      const elbow=x2>x1+20 ? (x1+x2)/2 : Math.min(timelineWidth-3,Math.max(x1,x2)+13);
      const path=document.createElementNS(NS,'path'); path.setAttribute('d','M '+x1+' '+y1+' H '+elbow+' V '+y2+' H '+x2); path.setAttribute('marker-end','url(#gantt-arrow)'); svg.append(path); count++;
    }
    elements['link-count'].textContent=count ? count+' dependencias visibles' : 'Despliega actividades para ver sus dependencias.';
  }
  function render() {
    visible = getVisible();
    updateWidth(); renderAxis(); renderRows(); drawLinks();
  }
  function relationButtons(list) {
    if (!list.length) return '<p class="task-detail-muted">Ninguna registrada en esta fila.</p>';
    return '<div class="task-relations">' + list.map(task => '<button type="button" data-inspect="' + task.uid + '"><span>' + task.id + '</span>' + escapeHtml(task.name) + '</button>').join('') + '</div>';
  }
  function inspect(uid) {
    const task=byId.get(uid); if(!task) return;
    inspected=uid;
    const predecessors=task.predecessors.map(link=>byId.get(link.uid)).filter(Boolean);
    const successors=tasks.filter(other=>other.predecessors.some(link=>link.uid===uid));
    const workDays=task.hours/(source.project.minutesPerDay/60);
    const duration=task.milestone?'Hito · duración 0':new Intl.NumberFormat('es-PE',{maximumFractionDigits:2}).format(workDays)+' '+(workDays===1?'día':'días')+' ('+task.hours+' h)';
    const resourceList=task.resources.length?'<ul class="task-resources">'+task.resources.map(resource=>'<li><strong>'+escapeHtml(resource.name)+'</strong><span>'+Math.round(resource.units*100)+' % de asignación</span></li>').join('')+'</ul>':'<p class="task-detail-muted">Sin asignación específica en esta fila de Project.</p>';
    dialogContent.innerHTML='<p class="eyebrow label-plain">'+(task.level===1?'ETAPA':task.level===2?'SEMANA '+String(task.week).padStart(2,'0'):task.milestone?'HITO PLANIFICADO':'ACTIVIDAD PLANIFICADA')+'</p><h2 id="task-dialog-title">'+escapeHtml(task.name)+'</h2><div class="task-detail-meta"><span>ID Project '+task.id+'</span><span>EDT '+escapeHtml(task.outline)+'</span>'+(task.critical?'<span>Crítica según Project</span>':'')+'</div><dl class="task-dates"><div><dt>Comienzo previsto</dt><dd>'+escapeHtml(fullDate(task.start))+'</dd></div><div><dt>Fin previsto</dt><dd>'+escapeHtml(fullDate(task.finish))+'</dd></div><div><dt>Duración en Project</dt><dd>'+escapeHtml(duration)+'</dd></div></dl><h3>Equipo asignado</h3>'+resourceList+(task.notes?'<h3>Notas del plan</h3><p class="task-notes">'+escapeHtml(task.notes)+'</p>':'')+'<h3>Tareas predecesoras · Fin a inicio</h3>'+relationButtons(predecessors)+'<h3>Tareas sucesoras</h3>'+relationButtons(successors)+'<div class="task-detail-actions"><button type="button" data-locate="'+uid+'">Ubicar en el Gantt →</button>'+(task.week?'<a href="semanas/semana-'+String(task.week).padStart(2,'0')+'.html">Abrir bitácora de la semana '+task.week+' ↗</a>':'')+'</div>';
    if(!dialog.open) dialog.showModal();
    dialogContent.scrollTop=0;
  }
  function locate(uid) {
    const task=byId.get(uid); if(!task) return;
    elements.search.value=''; elements.stage.value=''; elements.view.value=task.level===3?'all':'weeks';
    render(); dialog.close();
    const row=elements.rows.querySelector('[data-row="'+uid+'"]');
    if(row) {
      elements.scroller.scrollTop=Math.max(0,row.offsetTop-100);
      const x=percent(task.start)/100*timelineWidth;
      elements.scroller.scrollLeft=Math.max(0,x-100);
      row.classList.add('is-located');
      row.querySelector('.task-name').focus({preventScroll:true});
    }
  }
  function toggleExpanded() {
    const expanded=elements.shell.classList.toggle('is-expanded');
    elements.expand.setAttribute('aria-pressed',String(expanded));
    elements.expand.textContent=expanded?'Cerrar vista ampliada ✕':'Ampliar vista ↗';
    document.body.classList.toggle('gantt-fullscreen',expanded);
    render();
  }
  elements.rows.addEventListener('click',event=>{
    const toggle=event.target.closest('[data-toggle]');
    if(toggle){const id=toggle.dataset.toggle; expandedWeeks.has(id)?expandedWeeks.delete(id):expandedWeeks.add(id);render();elements.rows.querySelector('[data-toggle="'+id+'"]')?.focus({preventScroll:true});return;}
    const button=event.target.closest('[data-inspect]'); if(button) inspect(button.dataset.inspect);
  });
  dialogContent.addEventListener('click',event=>{
    const inspectButton=event.target.closest('[data-inspect]'); if(inspectButton)inspect(inspectButton.dataset.inspect);
    const locateButton=event.target.closest('[data-locate]'); if(locateButton)locate(locateButton.dataset.locate);
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  elements.search.addEventListener('input',render);
  ['stage','view','scale','critical','links'].forEach(key=>elements[key].addEventListener('change',render));
  elements.expand.addEventListener('click',toggleExpanded);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&elements.shell.classList.contains('is-expanded')&&!dialog.open)toggleExpanded();});
  let resizing;
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizing);resizing=requestAnimationFrame(render);});
  render();
})();
