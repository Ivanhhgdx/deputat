'use strict';
/* Shared catalog. Content hashes invalidate read marks after substantive changes. */
window.MaterialStatus = (() => {
  const data = window.DEPUTY_MATERIALS, catalog = new Map();
  function hash(value) {
    let result = 2166136261;
    for (const char of JSON.stringify(value)) {
      result ^= char.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(16);
  }
  function add(id, content, route, title) {
    if (catalog.has(id)) throw new Error('Duplicate material ID: ' + id);
    catalog.set(id, {id, version: hash(content), route, title});
  }
  for (const agenda of data.agendas) for (const item of agenda.items)
    add(item.id, {date:agenda.date, source:agenda.source, item}, 'agendas', item.title);
  for (const item of data.culture) add('culture-plan-2026-06-22:' + item.id, item, 'territory', item.title);
  for (const item of data.health) add('health:' + item.id, item, 'initiatives', item.title);
  for (const [route, revision, keys, title] of [
    ['budget',1,['q1','tables','changes','budgetPreamble','explanation','ksp','financeNote'],'Бюджетная подборка'],
    ['situation',1,['forecast'],'Обстановка: сводка и прогноз на 1 октября 2026'],
    ['initiatives',1,[],'Инициатива поддержки учителей · август 2026']
  ]) add('collection:' + route, {revision, data:keys.map(key=>data[key])}, route, title);
  for (const item of window.PUBLIC_MUNICIPAL_NEWS || []) {
    if (!/^news:[a-z0-9-]+$/.test(item.id) || !item.version ||
        !Object.hasOwn(item,'publishedAt') ||
        !item.updatedAt || !item.addedAt || !item.source?.name ||
        !item.title || !item.summary)
      throw new Error('Invalid public news metadata: ' + item.id);
    for(const address of [item.source.url, ...(item.source.indexUrl?[item.source.indexUrl]:[])]) {
      if(typeof address!=='string' || !/^https:\/\//.test(address)) throw new Error('Invalid public news source: '+item.id);
      const sourceURL=new URL(address);
      if(sourceURL.username || sourceURL.password) throw new Error('News source must be a public URL');
    }
    const dates=[item.updatedAt,item.addedAt];
    if(item.publishedAt!==null) dates.push(item.publishedAt);
    for(const value of [item.eventAt,item.source.checkedAt]) if(value!==undefined) dates.push(value);
    for(const value of dates)
      if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value)
        throw new Error('Invalid news date: '+item.id);
    add(item.id, item, 'materials', item.title);
  }
  const prefix='deputat-material-read-v1:';
  const versions=new Map();
  function migrate(personal) {
    let imported;
    try {imported=JSON.parse(localStorage.getItem('deputat-material-read-legacy-v1')||'null');} catch {}
    if(!imported || typeof imported!=='object' || Array.isArray(imported)) {
      imported={};
      for(const id of personal.read) if(Object.hasOwn(window.MATERIAL_BASELINES,id)) imported[id]=window.MATERIAL_BASELINES[id];
      try {localStorage.setItem('deputat-material-read-legacy-v1',JSON.stringify(imported));} catch {}
    }
    for (const id of catalog.keys()) {
      let record;
      try {record=JSON.parse(localStorage.getItem(prefix+id)||'null');} catch {}
      if (record && (typeof record.version==='string' || record.version===null)) versions.set(id,record.version);
      else if (typeof imported[id]==='string') versions.set(id,imported[id]);
    }
  }
  function isRead(personal, id) {return versions.get(id) === catalog.get(id)?.version;}
  function state(personal, id) {return isRead(personal,id) ? 'Прочитано' : versions.get(id) ? 'Обновлено' : 'Новое';}
  function toggle(personal, id) {
    const item=catalog.get(id); if (!item) return false;
    const version=isRead(personal,id)?null:item.version;
    versions.set(id,version);
    try {localStorage.setItem(prefix+id,JSON.stringify({version}));return true;} catch {return false;}
  }
  window.addEventListener('storage', event => {
    if(event.key===null){versions.clear();document.dispatchEvent(new Event('material-status-change'));return;}
    if(!event.key.startsWith(prefix)) return;
    const id=event.key.slice(prefix.length);
    try {const record=JSON.parse(event.newValue||'null');versions.set(id,typeof record?.version==='string'?record.version:null);} catch {versions.set(id,null);}
    document.dispatchEvent(new Event('material-status-change'));
  });
  return {catalog,migrate,isRead,state,toggle};
})();
