const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let today = new Date();
let companies = [], investors = [], activeQuick = '', currentRank = 'valuation', fx = {}, activeInvestorId = '', investorPage = 1, modalOrigin = null;
const universityNames = ['香港大学','香港中文大学','香港科技大学','香港城市大学','香港理工大学','香港浸会大学','香港中文大学（深圳）','香港科技大学（广州）'];
const sectorNames = {physical_ai:'具身 / 物理 AI',ai_software:'AI 软件',ai_hardware:'AI 硬件',semiconductor:'半导体',quantum:'量子科技',biotech:'生物科技',medtech:'医疗科技',healthcare:'医疗健康',new_energy:'新能源',advanced_materials:'先进材料',consumer:'消费科技',saas:'SaaS',fintech:'金融科技',consumer_hardware:'消费硬件',space:'商业航天',logistics:'物流科技',agritech:'农业科技',greentech:'绿色科技',edtech:'教育科技',other:'其他',unknown:'未分类',digital_assets:'数字资产',hr_service:'人力资源服务',embodied_ai:'具身智能',humanoid_robotics:'人形机器人',llm:'大模型',multimodal_ai:'多模态 AI',generative_ai:'生成式 AI',ai_agent:'AI Agent',computer_vision:'计算机视觉',data_infrastructure:'数据基础设施','3d_animation':'3D 动画',digital_human:'数字人',service_robot:'服务机器人','3d_vision':'3D 视觉',ivd:'体外诊断',wearable:'可穿戴设备',space_resource_mining:'太空资源',photonics:'光子学',edge_ai:'边缘 AI'};
const roundStageNames = {seed:'种子轮',angel:'天使轮',pre_a:'Pre-A',a:'A 轮',b:'B 轮',c_or_later:'C 轮及以后',strategic:'战略投资',undisclosed:'未披露'};
const activityLabels = {entrepreneurial_intent:'有创业意向',company_founded:'成立公司',fundraising:'正在融资',funding_completed:'完成融资',unconfirmed:'完成状态待核实'};
function completedDeal(e) { return e.status==='funding_completed' && e.countInFundingStats===true; }
function activityDescription(e) {
  const note=e.dateBasis==='report_month'?'按报道月份计入':e.datePrecision==='year'?'仅知年份':'';
  const detail=['entrepreneurial_intent','company_founded'].includes(e.status)?e.summary:(e.investors?.slice(0,3).join('、')||(e.status==='fundraising'?'融资进行中 · 尚未完成':'投资方未披露'));
  return [detail,note].filter(Boolean).join(' · ');
}
function fmtDate(value) { return value ? value.replaceAll('-', '.') : '日期未详'; }
function localDateValue(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function escapeHtml(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function eventDate(e) { return e.date ? new Date(e.date.length===4 ? `${e.date}-01-01` : e.date.length===7 ? `${e.date}-01` : e.date) : null; }
function sectorLabel(key) { return sectorNames[key] || key.replaceAll('_', ' '); }
function compactUSD(value) {
  if (value >= 1e9) return `$${(value/1e9).toFixed(value >= 1e10 ? 1 : 2).replace(/0+$/,'').replace(/\.$/,'')}B`;
  if (value >= 1e6) return `$${(value/1e6).toFixed(value >= 1e8 ? 0 : 1)}M`;
  if (value >= 1e3) return `$${Math.round(value/1e3)}K`;
  return `$${Math.round(value).toLocaleString('en-US')}`;
}
function isDisclosed(v) { return !!v && v.kind.startsWith('disclosed'); }
function valuationLabel(v) {
  if (!v) return '估值未披露';
  if (v.highUsd == null) return `≥ ${compactUSD(v.lowUsd)}`;
  if (Math.abs(v.highUsd-v.lowUsd) < 1) return `${v.kind==='disclosed'?'':'≈ '}${compactUSD(v.sortUsd)}`;
  return `≈ ${compactUSD(v.lowUsd)}–${compactUSD(v.highUsd)}`;
}
function getRecent() {
  const months=Number($('#recent-months')?.value||1), scope=$('#recent-round-scope')?.value||'all';
  const since=monthsAgo(months);
  const status=$('#recent-status')?.value||'all';
  return companies.flatMap(c=>{
    const grouped=new Map();
    for(const e of c.activities||[]) {
      const d=eventDate(e), start=e.date?.length===7?new Date(since.getFullYear(),since.getMonth(),1):since;
      if(e.display===false||!e.date||e.date.length<7||!d||d<start||d>today) continue;
      const month=e.date.slice(0,7); if(!grouped.has(month))grouped.set(month,[]); grouped.get(month).push(e);
    }
    return [...grouped.values()].flatMap(members=>{
      const matches=members.filter(e=>(status==='all'||e.status===status)&&(['entrepreneurial_intent','company_founded'].includes(e.status)||scope!=='pre_a'||['seed','angel','pre_a'].includes(e.roundGroup)));
      if(!matches.length)return [];
      const sorted=[...matches].sort((a,b)=>eventDate(b)-eventDate(a));
      const lead=sorted.find(e=>['fundraising','funding_completed'].includes(e.status))||sorted[0];
      return [{...lead,company:c,members,statuses:[...new Set(members.map(e=>e.status))],isFirstFinancing:members.some(e=>e.isFirstFinancing),date:members.map(e=>e.date).sort().at(-1)}];
    });
  }).sort((a,b)=>eventDate(b)-eventDate(a)||(a.company.id||'').localeCompare(b.company.id||''));
}
function renderActivityRow(e) {
  const statuses=e.statuses||[e.status], fundraising=statuses.includes('fundraising');
  const finance=e.members.filter(x=>['fundraising','funding_completed'].includes(x.status));
  const amounts=[...new Set(finance.map(x=>(x.status==='fundraising'?'目标：':'')+(x.amountDisplay||x.amount||'')).filter(x=>x&&x!=='目标：'))];
  const tags=statuses.map(s=>`<span class="activity-status status-${s}">${activityLabels[s]}</span>`).join('');
  const rounds=[...new Set(finance.map(x=>x.round))].map(x=>escapeHtml(x)).join(' / ');
  const detail=[e.members.length>1?'本月进展已合并':null,e.disclosureNote,activityDescription(e)].filter(Boolean).join(' · ');
  return `<button class="recent-event ${e.isFirstFinancing?'is-first-financing':''} ${fundraising?'is-fundraising':''}" data-company="${escapeHtml(e.company.id)}" aria-label="查看${escapeHtml(e.company.name)}公司档案"><span class="event-date"><span>${e.date.slice(0,4)}</span><b>${e.members.length>1?e.date.slice(5,7)+'月':fmtDate(e.date.slice(5))+(e.date.length===7?'月':'')}</b></span><span class="event-main"><span class="event-company"><b>${escapeHtml(e.company.name)}</b><span class="event-tags">${tags}${e.isFirstFinancing?'<span class="first-financing-label">首次融资</span>':''}</span></span>${rounds?`<span class="event-rounds">${rounds}</span>`:''}<span class="event-description" title="${escapeHtml(detail)}">${escapeHtml(detail)}</span></span><span class="event-amount">${amounts.length?amounts.map(a=>`<span>${escapeHtml(a)}</span>`).join(''):finance.length?'金额未披露':'—'}</span><span class="row-arrow" aria-hidden="true">↗</span></button>`;
}
function renderHome() {
  const recent=getRecent(), months=Number($('#recent-months')?.value||1), scope=$('#recent-round-scope')?.value||'all';
  const windowStart=monthsAgo(months); $('#recent-window').textContent=`${fmtDate(localDateValue(windowStart))} — ${fmtDate(localDateValue(today))} · 月份记录按月匹配，轮次仅筛选融资`;
  $('#stat-companies').textContent=companies.length; $('#stat-funding').textContent=recent.length;
  $('#stat-funding-label').textContent=`近 ${months} 个月动态`;
  $('#home-signal-window').textContent=`近 ${months} 个月`;
  $('#funding-result-count').textContent=recent.length;
  $('#home-round-note').textContent=`${scope==='pre_a'?'A 轮之前':'全部轮次'} · ${activityLabels[$('#recent-status')?.value]||'全部状态'}`;
  $('#recent-funding').innerHTML=recent.length?recent.map(renderActivityRow).join(''):`<div class="empty-note"><b>这个窗口里暂时没有对应动态</b><p>可尝试近 3 个月，或切换状态及轮次。没有可靠月份的记录仍保留在公司档案。</p></div>`;
  const sectors=new Map();recent.forEach(e=>{const key=e.company.primarySectors?.[0]||'unknown';sectors.set(key,(sectors.get(key)||0)+1);});
  const ranked=[...sectors].sort((a,b)=>b[1]-a[1]);
  $('#home-sector-chart').innerHTML=ranked.length?ranked.slice(0,5).map(([key,count])=>`<div class="insight-row"><div class="insight-label"><span>${escapeHtml(sectorLabel(key))}</span><b>${count} <small>起</small></b></div><div class="insight-track"><i style="width:${count/recent.length*100}%"></i></div></div>`).join(''):'<p class="muted">暂无对应赛道记录</p>';
  $('#home-observation').innerHTML=ranked.length?`<b>${escapeHtml(sectorLabel(ranked[0][0]))}</b> 记录最多，占本期动态 <b>${Math.round(ranked[0][1]/recent.length*100)}%</b>。<br>共涉及 ${new Set(recent.map(e=>e.company.id)).size} 家公司。`:'当前筛选范围暂无记录。扩大观察窗口，寻找更多创业与融资线索。';
  $('#home-campuses').innerHTML=universityNames.slice(0,3).map(u=>`<button class="campus-link" data-campus="${escapeHtml(u)}">${escapeHtml(u)}<span>${companies.filter(c=>c.universities.includes(u)).length} 家 ↗</span></button>`).join('');

}
function setupFilters() {
  const unis=[...new Set(companies.flatMap(c=>c.universities).filter(u=>universityNames.includes(u)))].sort();
  const sectors=[...new Set(companies.flatMap(c=>c.primarySectors))].sort((a,b)=>sectorLabel(a).localeCompare(sectorLabel(b),'zh-Hans-CN'));
  unis.forEach(x=>$('#filter-university').insertAdjacentHTML('beforeend',`<option>${escapeHtml(x)}</option>`));
  sectors.forEach(x=>$('#filter-sector').insertAdjacentHTML('beforeend',`<option value="${escapeHtml(x)}">${escapeHtml(sectorLabel(x))}</option>`));
  [...new Set(companies.map(c=>c.round))].sort().forEach(x=>$('#filter-round').insertAdjacentHTML('beforeend',`<option>${escapeHtml(x)}</option>`));
  const primary=[...new Set(companies.flatMap(c=>c.primarySectors))].sort();
  ['#rank-sector','#growth-sector'].forEach(sel=>primary.forEach(x=>$(sel).insertAdjacentHTML('beforeend',`<option value="${escapeHtml(x)}">${escapeHtml(sectorLabel(x))}</option>`)));
  $('#quick-universities').innerHTML=unis.map(u=>`<button class="tag-chip" data-univ="${escapeHtml(u)}">${escapeHtml(u)}</button>`).join('');
}
function filteredCompanies() {
  const q=$('#search').value.toLowerCase().trim(),u=$('#filter-university').value,s=$('#filter-sector').value,r=$('#filter-round').value,v=$('#filter-valuation').value;
  return companies.filter(c=>(!q||[c.name,c.nameEn,c.summary,c.positioningSummary,...c.founders,...c.sectors,...c.technologyTags,...c.businessModels,...c.applicationTags,...c.profileFacts.map(f=>f.summary),...c.peopleDetails.map(p=>[p.name_zh,p.name_en,p.title_raw,...(p.career||[]).map(x=>x.organization+' '+x.role)].join(' '))].join(' ').toLowerCase().includes(q))&&(!u||c.universities.includes(u))&&(!s||c.primarySectors.includes(s))&&(!r||c.round===r)&&(!v||(v==='available'?!!c.latestValuation:!c.latestValuation))&&(!activeQuick||c.universities.includes(activeQuick)));
}
function renderCompanies() {
  const rows=filteredCompanies(); $('#result-count').textContent=rows.length;
  $('#company-grid').innerHTML=rows.length?rows.map(c=>`<article class="company-card" tabindex="0" data-id="${c.id}" title="点击查看详情"><div class="company-top"><div class="company-logo">${escapeHtml((c.nameEn||c.name).slice(0,1))}</div><div class="company-title"><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.nameEn||c.location||'港校关联')}</small></div><span class="company-round">${escapeHtml(c.round)}</span></div><div class="company-summary">${escapeHtml(c.positioningSummary||c.summary)}</div><div class="company-meta"><span>${escapeHtml(c.location||'地点未详')}</span><span>${c.profileFacts.length} 条资料 · ${c.events.length} 条融资</span></div><div class="company-tags">${c.latestValuation?`<span class="mini-tag">${isDisclosed(c.latestValuation.valuationUsd)?'披露':'估算'} ${escapeHtml(valuationLabel(c.latestValuation.valuationUsd))}</span>`:''}${c.universities.slice(0,2).map(x=>`<span class="mini-tag">${escapeHtml(x)}</span>`).join('')}${c.sectors.slice(0,2).map(x=>`<span class="mini-tag">${escapeHtml(x)}</span>`).join('')}</div></article>`).join(''):'<div class="empty-results">没有符合条件的公司，试试清除部分筛选条件。</div>';
  $$('.company-card').forEach(card=>{card.addEventListener('click',()=>showCompany(card.dataset.id));card.addEventListener('keydown',e=>{if(e.key==='Enter')showCompany(card.dataset.id);});});
}
function renderBoard() {
  const sector=$('#rank-sector').value;
  let rows=companies.filter(c=>c.latestValuation&&(!sector||c.primarySectors.includes(sector))).map(c=>({company:c,event:c.latestValuation,v:c.latestValuation.valuationUsd}));
  rows.sort((a,b)=>b.v.sortUsd-a.v.sortUsd);
  $('#rank-title').textContent=sector?`Top ${sectorLabel(sector)} Startups`:'Top Startups';
  $('#rank-subtitle').textContent=`${rows.length} 家有估值数据 · USD 排序`;
  $('#valuation-rows').innerHTML=rows.length?rows.map((r,i)=>`<div class="rank-row" tabindex="0" data-id="${r.company.id}" title="${escapeHtml(r.company.summary)} · 点击查看完整资料"><span class="rank-no ${i<3?'top':''}">${String(i+1).padStart(2,'0')}</span><div class="rank-company"><span class="company-logo">${escapeHtml((r.company.nameEn||r.company.name).slice(0,1))}</span><span>${escapeHtml(r.company.name)}<small>${isDisclosed(r.v)?'公开披露':'融资额 × 10 估算'} · ${escapeHtml(r.event.date||'日期未详')}</small></span></div><span class="rank-round">${escapeHtml(r.event.round)}</span><span class="rank-value" title="${escapeHtml(r.v.method||'Profile 明确披露；按统一美元榜单换算')}">${escapeHtml(valuationLabel(r.v))}</span><span class="rank-school">${escapeHtml(r.company.universities.filter(x=>universityNames.includes(x)).slice(0,2).join('、')||'—')}</span></div>`).join(''):'<div class="empty-results">当前筛选下没有可计算估值的公司。</div>';
  const disclosed=companies.filter(c=>isDisclosed(c.latestValuation?.valuationUsd)).length;
  $('#valuation-note').textContent=`当前 ${disclosed} 家使用已披露估值，其他有金额的融资按金额 × 10 估算；“数千万”按原币种 2,000万–9,000万形成估值区间，“亿元级”取 1 亿元下限。CNY/HKD 使用 ${fx.date||'最新'} ECB 参考汇率换算为 USD。汇率：$1 = CNY ${(1/fx.usdPerUnit.CNY).toFixed(3)}；HKD ${(1/fx.usdPerUnit.HKD).toFixed(3)}。估值均为研究估算，不代表公司披露或投资建议。`;
}
function growthRows() {
  return companies.map(company=>{
    const points=company.valuationRecords.map(e=>({date:eventDate(e),rawDate:e.date,value:e.valuationUsd?.sortUsd,kind:e.valuationUsd?.kind})).filter(p=>p.date&&p.value!=null).sort((a,b)=>a.date-b.date);
    if(points.length<2)return null;
    const first=points[0],last=points.at(-1),years=(last.date-first.date)/(365.25*86400000);
    if(years<=0)return null;
    return {company,points,slope:(last.value-first.value)/years,years,first,last};
  }).filter(Boolean);
}
function sparkline(points) {
  const vals=points.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),spread=max-min||Math.max(max*.1,1),w=120,h=34,pad=4;
  const coords=points.map((p,i)=>`${pad+i*(w-2*pad)/(points.length-1)},${h-pad-((p.value-min)/spread)*(h-2*pad)}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" aria-label="估值记录变化"><polyline points="${coords}"/>${points.map((p,i)=>`<circle cx="${pad+i*(w-2*pad)/(points.length-1)}" cy="${h-pad-((p.value-min)/spread)*(h-2*pad)}" r="2.6"/>`).join('')}</svg>`;
}
function renderGrowth() {
  const sector=$('#growth-sector').value;
  const rows=growthRows().filter(r=>!sector||r.company.primarySectors.includes(sector)).sort((a,b)=>b.slope-a.slope);
  $('#growth-rows').innerHTML=rows.length?rows.map((r,i)=>`<div class="growth-row" tabindex="0" data-id="${r.company.id}" title="${escapeHtml(r.company.summary)} · 点击查看完整资料"><span class="rank-no ${i<3?'top':''}">${String(i+1).padStart(2,'0')}</span><div class="rank-company"><span class="company-logo">${escapeHtml((r.company.nameEn||r.company.name).slice(0,1))}</span><span>${escapeHtml(r.company.name)}<small>${fmtDate(r.first.rawDate)} → ${fmtDate(r.last.rawDate)} · ${r.points.length} 个估值点</small></span></div><div>${sparkline(r.points)}</div><span class="growth-slope">${r.slope<0?'−':''}${compactUSD(Math.abs(r.slope))} / 年<small>${r.points.some(p=>!p.kind.startsWith('disclosed'))?'含融资额估算':'披露估值'}</small></span></div>`).join(''):'<div class="empty-results">当前节点中没有足够的历史估值点计算增速；至少需要两轮融资金额或估值记录。</div>';
}
function companyFoundedDate(company) {
  const value=String(company.founded||'');
  if(!/^\d{4}(-\d{2})?(-\d{2})?$/.test(value))return null;
  return new Date(value.length===4?`${value}-01-01`:value.length===7?`${value}-01`:value);
}
function monthsAgo(months) {
  const d=new Date(today.getFullYear(),today.getMonth()-months,1);
  d.setDate(Math.min(today.getDate(),new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
  return d;
}
function statsBounds() {
  const value=$('#stats-window').value;
  if(value==='custom')return [$('#stats-from').value,$('#stats-to').value];
  if(value.startsWith('year:')) {const y=value.slice(5);return [`${y}-01-01`,`${y}-12-31`];}
  return [value==='all'?'0001-01-01':localDateValue(monthsAgo(Number(value))),localDateValue(today)];
}
function inStatsRange(value) {
  if(!value)return $('#stats-window').value==='all';
  const [from,to]=statsBounds(), raw=String(value);
  // Partial dates are included only when their whole period fits the range.
  const low=raw.length===4?`${raw}-01-01`:raw.length===7?`${raw}-01`:raw;
  const high=raw.length===4?`${raw}-12-31`:raw.length===7?`${raw}-${new Date(Number(raw.slice(0,4)),Number(raw.slice(5,7)),0).getDate()}`:raw;
  const asOf=localDateValue(today);
  return low>=from&&(high<asOf?high:asOf)<=to&&low<=asOf;
}
function barChart(el, rows, denominator, empty='暂无可统计数据') {
  const max=Math.max(1,...rows.map(x=>x.count));
  el.innerHTML=rows.length?rows.map(x=>`<div class="bar-item"><div class="bar-label"><span>${escapeHtml(x.label)}</span><b>${x.count}<small>${denominator?`${Math.round(x.count/denominator*100)}%`:''}</small></b></div><div class="bar-track"><i style="width:${Math.max(2,x.count/max*100)}%"></i></div></div>`).join(''):`<div class="chart-empty">${empty}</div>`;
}
const chartPalette=['#3667c4','#173e77','#6d96d4','#3b8097','#8a9fc8','#667d9f','#b2c6de','#d3deec','#e6edf6'];
function donutChart(el, rows, unit='家公司') {
  const positive=rows.filter(x=>x.count>0), total=positive.reduce((a,b)=>a+b.count,0);
  if(!total){el.innerHTML='<div class="chart-empty">暂无可统计数据</div>';return;}
  let offset=0;
  const stops=positive.map((x,i)=>{const from=offset;offset+=x.count/total*100;return `${chartPalette[i%chartPalette.length]} ${from.toFixed(2)}% ${offset.toFixed(2)}%`;});
  el.innerHTML=`<div class="donut-ring" style="--donut:conic-gradient(${stops.join(',')})"><div><b>${total}</b><span>${unit}</span></div></div><div class="donut-legend">${positive.map((x,i)=>`<div><i style="--swatch:${chartPalette[i%chartPalette.length]}"></i><span>${escapeHtml(x.label)}</span><b title="${x.count} / ${total}">${x.count} · ${(x.count/total*100).toFixed(1)}%</b></div>`).join('')}</div>`;
}
function renderStatistics() {
  const custom=$('#stats-window').value==='custom';$('#stats-custom').classList.toggle('hidden',!custom);
  const [from,to]=statsBounds(), valid=from&&to&&from<=to;
  $('#stats-range-note').textContent=valid?`${from==='0001-01-01'?'全部记录':fmtDate(from)} — ${fmtDate(to)} · 公司按成立日期，融资按事件日期筛选`:'请选择有效日期范围，开始日期不能晚于结束日期。';
  const selectedCompanies=valid?companies.filter(c=>inStatsRange(c.founded)):[];
  const events=valid?companies.flatMap(company=>company.events.map(event=>({...event,company}))).filter(e=>completedDeal(e)&&e.date&&inStatsRange(e.date)):[];
  const schools=new Map(), sectors=new Map(), rounds=new Map(), active=new Map();
  selectedCompanies.forEach(c=>{
    new Set(c.universities.filter(u=>universityNames.includes(u))).forEach(u=>schools.set(u,(schools.get(u)||0)+1));
    const sector=c.primarySectors?.[0]||'unknown';sectors.set(sector,(sectors.get(sector)||0)+1);
  });
  events.forEach(e=>{
    const label=roundStageNames[e.roundGroup]||roundStageNames.undisclosed;rounds.set(label,(rounds.get(label)||0)+1);
    new Set(e.investorIds||[]).forEach(id=>active.set(id,(active.get(id)||0)+1));
  });
  $('#stats-kpis').innerHTML=`<div class="stat-card"><span>观察范围内公司</span><strong>${selectedCompanies.length}</strong><small>${$('#stats-window').value==='all'?'包含成立日期未知的公司':'按成立日期筛选 · 日期不详不计入'}</small></div><div class="stat-card accent"><span>已完成融资披露</span><strong>${events.length}</strong><small>联合披露计一次 · 排除计划及重复合计</small></div><div class="stat-card"><span>活跃投资实体</span><strong>${active.size}</strong><small>按唯一机构 ID 去重</small></div>`;
  const sorted=map=>[...map].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count);
  $('#school-chart-note').textContent=`${selectedCompanies.length} 家样本公司 · 多校关联可重叠，不代表毕业生创业率`;
  barChart($('#school-chart'),sorted(schools),selectedCompanies.length);
  $('#sector-chart-note').textContent='每家公司按第一个主领域计入一次；缺失分类归入未分类';
  const sectorRows=sorted(sectors).map(x=>({...x,label:sectorLabel(x.label)})), top=sectorRows.slice(0,7), rest=sectorRows.slice(7).reduce((a,b)=>a+b.count,0);
  if(rest)top.push({label:'其他领域',count:rest});donutChart($('#sector-chart'),top);
  $('#round-chart-note').textContent=`${events.length} 起融资 · 与上方观察范围一致`;
  barChart($('#round-chart'),sorted(rounds),events.length);
  barChart($('#active-investor-chart'),sorted(active).slice(0,10).map(x=>({...x,label:investors.find(i=>i.id===x.label)?.name||x.label})),0);
  const annual=new Map();events.forEach(e=>annual.set(e.date.slice(0,4),(annual.get(e.date.slice(0,4))||0)+1));
  const year=$('#stats-year').value, monthly=Array(12).fill(0);
  events.filter(e=>e.date.startsWith(year)&&e.date.length>=7&&e.datePrecision!=='year').forEach(e=>monthly[Number(e.date.slice(5,7))-1]++);
  const yearEvents=events.filter(e=>e.date.startsWith(year));
  $('#funding-chart-title').textContent=`${year} 年融资节奏`;
  $('#funding-chart-note').textContent=`观察范围内 ${yearEvents.length} 起 · ${yearEvents.filter(e=>e.date.length<7||e.datePrecision==='year').length} 起仅知年份，不分配到月份 · 无完成时间按报道月份 · 不含轮次合计`;
  const max=Math.max(1,...monthly);
  $('#monthly-chart').innerHTML=monthly.map((count,i)=>{const future=Number(year)>today.getFullYear()||(Number(year)===today.getFullYear()&&i>today.getMonth());return `<div class="month-column" tabindex="0" aria-label="${year}年${i+1}月 ${future?'尚未发生':count+'起'}" title="${year}年${i+1}月 · ${count} 起"><div class="month-count">${future?'—':count}</div><div class="month-bar" style="height:${count/max*100}%"></div><span>${i+1} 月</span></div>`;}).join('');
  barChart($('#annual-chart'),[...annual].sort((a,b)=>a[0].localeCompare(b[0])).map(([label,count])=>({label:`${label} 年`,count})),0);
}
function investorEvents(investor, months) {
  const start=monthsAgo(Number(months));
  return (investor?.events||[]).filter(e=>{const d=eventDate(e);return e.date?.length>=7&&d&&d>=start&&d<=today;}).sort((a,b)=>eventDate(b)-eventDate(a));
}
function renderInvestorProfile() {
  const investor=investors.find(x=>x.id===activeInvestorId);if(!investor)return;
  const period=$('#investor-period').value, recent=investorEvents(investor,period), companyIds=new Set(recent.map(e=>e.companyId));
  const portfolio=[...new Map([...recent].reverse().map(e=>[e.companyId,e])).values()].sort((a,b)=>eventDate(b)-eventDate(a));
  const mix=new Map();portfolio.forEach(e=>mix.set(e.sector||'unknown',(mix.get(e.sector||'unknown')||0)+1));
  $('#investor-profile-kpis').innerHTML=`<div class="stat-card accent"><span>观察期内投资事件</span><strong>${recent.length}</strong><small>近 ${period} 个月</small></div><div class="stat-card"><span>涉及公司</span><strong>${companyIds.size}</strong><small>按公司实体去重</small></div><div class="stat-card"><span>历史记录</span><strong>${investor.events.length}</strong><small>Profile 中已记录</small></div>`;
  donutChart($('#investor-type-chart'),[...mix].map(([key,count])=>({label:sectorLabel(key),count})).sort((a,b)=>b.count-a.count));
  $('#investor-portfolio-note').textContent=`${companyIds.size} 家公司 · 近 ${period} 个月`;
  $('#investor-portfolio').innerHTML=portfolio.length?portfolio.map(e=>`<article tabindex="0" role="button" class="portfolio-card" data-company="${escapeHtml(e.companyId)}"><div class="portfolio-date">${fmtDate(e.date)}</div><div><b>${escapeHtml(e.company)}</b><span>${escapeHtml(sectorLabel(e.sector||'unknown'))} · ${escapeHtml(e.round||'轮次未详')}</span></div><small>${escapeHtml(e.amountDisplay||e.amount||'金额未披露')}</small></article>`).join(''):'<div class="chart-empty">该时间范围内没有带明确日期的投资记录</div>';
  const all=[...investor.events].sort((a,b)=>{const da=eventDate(a),db=eventDate(b);if(!da&&!db)return 0;if(!da)return 1;if(!db)return-1;return db-da;});
  $('#investor-history').innerHTML=all.length?all.map(e=>`<div tabindex="0" role="button" data-company="${escapeHtml(e.companyId)}" class="history-row"><time>${fmtDate(e.date)}</time><div><b>${escapeHtml(e.company)}</b><span>${escapeHtml(sectorLabel(e.sector||'unknown'))} · ${escapeHtml(e.round||'轮次未详')} · ${escapeHtml(e.amountDisplay||e.amount||'金额未披露')}</span></div></div>`).join(''):'<div class="chart-empty">暂无融资事件记录</div>';
}
function openInvestorProfile(id) {
  activeInvestorId=id;const investor=investors.find(x=>x.id===id);if(!investor)return;
  $('#investor-profile-name').textContent=investor.name;
  $('#investor-profile-aliases').textContent=investor.aliases?.length?`记录别名：${investor.aliases.join('、')}`:'标准机构名称';

  $('#investor-directory').classList.add('hidden');$('#investor-profile').classList.remove('hidden');renderInvestorProfile();window.scrollTo(0,0);
}
function renderInvestors() {
  $('#investor-count').textContent=investors.length; const q=$('#investor-search').value.toLowerCase().trim();
  const matches=investors.filter(x=>`${x.name} ${(x.aliases||[]).join(' ')}`.toLowerCase().includes(q));
  const pageSize=24,totalPages=Math.max(1,Math.ceil(matches.length/pageSize));investorPage=Math.min(investorPage,totalPages);const shown=matches.slice((investorPage-1)*pageSize,investorPage*pageSize);
  $('#investor-list').innerHTML=shown.map(x=>`<button class="investor-item" data-investor-id="${escapeHtml(x.id)}"><span class="investor-item-name"><b>${escapeHtml(x.name)}</b>${x.aliases?.length?`<small>别名：${escapeHtml(x.aliases.slice(0,3).join('、'))}</small>`:''}</span><span>投资事件</span><em>${x.investmentCount}</em></button>`).join('')||'<div class="chart-empty">没有匹配的机构</div>';
  $('#investor-list-note').textContent=`共 ${matches.length} 家 · 第 ${investorPage} / ${totalPages} 页 · 按投资事件数排列`;
  $('#investor-prev').disabled=investorPage===1;$('#investor-next').disabled=investorPage===totalPages;
  let events=companies.flatMap(c=>c.events.filter(completedDeal).map(e=>({...e,company:c})));
  events.sort((a,b)=>{const da=eventDate(a),db=eventDate(b);if(!da&&!db)return 0;if(!da)return 1;if(!db)return-1;return $('#timeline-sort').value==='desc'?db-da:da-db;});
  $('#investor-timeline').innerHTML=events.map(e=>`<div class="timeline-event"><div class="timeline-date">${fmtDate(e.date)}</div><div class="timeline-marker"></div><div class="timeline-body"><b>${escapeHtml(e.company.name)} · ${escapeHtml(e.round)}</b><p>${escapeHtml(e.amount||'融资金额未披露')}${e.valuation?` · 投后估值 ${escapeHtml(e.valuation)}`:''}${e.valuationUsd&&!isDisclosed(e.valuationUsd)?` · 估算 ${escapeHtml(valuationLabel(e.valuationUsd))}`:''}</p><p class="investor-names">${escapeHtml(e.investors.join('、')||'投资方未披露')}</p><small>${escapeHtml(e.verification||'来源状态未标注')}</small></div></div>`).join('');
}
function showCompany(id) {
  const c=companies.find(x=>x.id===id); if(!c)return;
  const groups=[['company_background','公司概况'],['founder_background','创始人背景'],['team_background','团队与顾问'],['technology','技术与产品'],['business','商业模式'],['operating_progress','业务进展'],['financing_background','融资背景']];
  const factsHtml=groups.map(([key,label])=>{const items=c.profileFacts.filter(f=>f.category===key);if(!items.length)return '';return `<details class="profile-fact-group" ${['company_background','technology','business'].includes(key)?'open':''}><summary>${label}<span>${items.length} 条</span></summary><div class="profile-fact-list">${items.map(f=>`<div class="profile-fact"><p>${escapeHtml(f.summary)}</p>${f.eventDate?`<small>${escapeHtml(f.eventDate)}</small>`:''}</div>`).join('')}</div></details>`}).join('');
  const peopleHtml=c.peopleDetails.length?c.peopleDetails.map(p=>`<article class="person-card"><div><b>${escapeHtml(p.name_zh||p.name_en||'姓名未详')}</b>${p.name_en&&p.name_zh?` <span>${escapeHtml(p.name_en)}</span>`:''}<small>${escapeHtml(p.title_raw||p.relation||'团队成员')}${p.joined_at?` · ${escapeHtml(p.joined_at)} 加入`:''}</small></div>${(p.education||[]).length?`<p>教育：${escapeHtml(p.education.map(e=>[e.institution,e.degree,e.discipline].filter(Boolean).join(' · ')).join('；'))}</p>`:''}${(p.career||[]).length?`<p>经历：${escapeHtml(p.career.map(e=>[e.organization,e.role,e.start&&e.end?`${e.start}–${e.end}`:e.start||e.end].filter(Boolean).join(' · ')).join('；'))}</p>`:''}</article>`).join(''):'<p>Profile 暂无人物记录。</p>';
  const sourceHtml=c.profileSources.length?`<details class="profile-fact-group"><summary>资料来源<span>${c.profileSources.length} 条</span></summary><div class="profile-source-list">${c.profileSources.map(s=>`<div><a href="${escapeHtml(s.url||'#')}" target="_blank" rel="noreferrer">${escapeHtml(s.title||s.id||'来源')} ↗</a><small>${escapeHtml([s.publisher,s.publishedAt?.slice(0,10),s.bodyReviewStatus].filter(Boolean).join(' · '))}</small></div>`).join('')}</div></details>`:'';
  $('#modal-content').innerHTML=`<div class="modal-header"><div class="eyebrow">Company profile · ${c.profileFacts.length} 条资料</div><h2>${escapeHtml(c.name)}</h2><p>${escapeHtml([c.nameEn,c.location,c.founded?`成立于 ${c.founded}`:null].filter(Boolean).join(' · ')||'港校关联创业公司')}</p></div><div class="modal-block"><h4>简介</h4><p>${escapeHtml(c.summary)}</p></div><div class="modal-block"><h4>标签</h4><div class="modal-tags">${[...c.universities,...c.sectors,...c.technologyTags,...c.businessModels,...c.applicationTags].map(x=>`<span class="mini-tag">${escapeHtml(x)}</span>`).join('')}</div>${c.tagCaveat?`<p class="tag-caveat">${escapeHtml(c.tagCaveat)}</p>`:''}</div><section class="modal-block"><h4>公司资料 · ${c.profileFacts.length} 条已标记为展示的信息</h4>${factsHtml||'<p>暂无已标记展示的事实。</p>'}</section><section class="modal-block"><h4>创始人及团队 · ${c.peopleDetails.length} 人</h4><div class="people-grid">${peopleHtml}</div></section><div class="modal-block"><h4>创业与融资进展</h4>${(c.activities||[]).filter(a=>a.display!==false).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(a=>`<div class="modal-event"><span class="activity-status status-${escapeHtml(a.status)}">${activityLabels[a.status]}</span> ${fmtDate(a.date)}${a.dateBasis==='report_month'?' · 按报道月份计入':''}<p>${escapeHtml(a.summary)}</p><small>来源：${escapeHtml(a.sourceIds.join('、')||'未关联')}</small></div>`).join('')||'<p>暂无可核实进展。</p>'}</div><div class="modal-block"><h4>融资与估值 · ${c.events.length} 条记录</h4>${c.events.length?c.events.map(e=>`<div class="modal-event">${e.dateBasis==='historical_date_unknown'?'早期融资 · 日期未详':fmtDate(e.date)} · ${activityLabels[e.status]||'状态待核实'} · ${escapeHtml(e.round)} · ${e.status==='fundraising'?'目标金额：':''}${escapeHtml(e.amountDisplay||e.amount||'金额未披露')} ${e.valuation?`<b>· 已披露估值 ${escapeHtml(e.valuation)}</b>`:''}${e.valuationUsd&&!isDisclosed(e.valuationUsd)?`<b>· 估算投后估值 ${escapeHtml(valuationLabel(e.valuationUsd))}</b>`:''}<br>投资方：${escapeHtml(e.investors.join('、')||'未披露')}</div>`).join(''):'<p>当前 Profile 暂无融资事件记录。</p>'}</div>${c.website?`<div class="modal-block modal-links"><h4>公司官网</h4><p><a target="_blank" rel="noreferrer" href="${escapeHtml(c.website)}">${escapeHtml(c.website)} ↗</a></p></div>`:''}${sourceHtml}`;
  modalOrigin=document.activeElement;$('#modal').classList.remove('hidden');document.body.style.overflow='hidden';$('.detail-modal').scrollTop=0;$('#modal-close').focus();
}
function closeCompany() {
  $('#modal').classList.add('hidden');document.body.style.overflow='';if(modalOrigin?.isConnected)modalOrigin.focus();
}
function setupSegments(id) {
  const select=$('#'+id), group=document.createElement('div');group.className='segments';group.setAttribute('role','group');group.setAttribute('aria-label',select.getAttribute('aria-label')||'观察窗口');
  group.innerHTML=[...select.options].map(o=>`<button type="button" data-value="${o.value}" aria-pressed="${o.selected}">${o.textContent}</button>`).join('');
  select.classList.add('native-segment');select.setAttribute('aria-hidden','true');select.tabIndex=-1;select.after(group);
  const sync=()=>{[...group.children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===select.value)));};
  group.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;select.value=b.dataset.value;select.dispatchEvent(new Event('change'));sync();});select.addEventListener('change',sync);
}
function goView(view) {
  $$('.view').forEach(x=>x.classList.toggle('active',x.id===`view-${view}`));
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  $$('.nav-item').forEach(x=>{if(x.dataset.view===view)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');});
  $('#crumb').textContent={home:'动态首页',startups:'公司库',rankings:'榜单',statistics:'统计分析',investors:'投资机构'}[view]; window.scrollTo(0,0);
}
let dataRevision='', refreshBusy=false;
async function loadData() {
  const response=await fetch('./data.json',{cache:'no-store'});if(!response.ok)throw new Error('数据读取失败');
  const data=await response.json();companies=data.companies; investors=data.investors||[]; fx=data.fx;
  today=new Date();
  const years=[...new Set(companies.flatMap(c=>c.events.map(e=>e.date?.slice(0,4))).filter(Boolean))].sort().reverse();
  const selectedYear=$('#stats-year').value;
  $('#stats-year').innerHTML=years.map(y=>`<option>${y}</option>`).join('');
  if(years.includes(selectedYear))$('#stats-year').value=selectedYear;
  const windowValue=$('#stats-window').value;
  $$('#stats-window option[data-year]').forEach(x=>x.remove());
  years.forEach(y=>$('#stats-window').insertAdjacentHTML('beforeend',`<option data-year value="year:${y}">${y} 年</option>`));
  $('#stats-window').value=windowValue;
  const filterIds=['filter-university','filter-sector','filter-round','rank-sector','growth-sector'];
  const selected=filterIds.map(id=>$('#'+id).value);
  filterIds.forEach(id=>{$('#'+id).innerHTML=$('#'+id).options[0].outerHTML;});

  $('#nav-company-count').textContent=companies.length; $('#snapshot-company-count').textContent=companies.length;
  const stamp=data.asOf.replaceAll('-','.'); $('#snapshot-date').textContent=stamp; $('#footer-date').textContent=stamp; $('#rank-snapshot-date').textContent=stamp;
  $('#hero-asof').textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'2-digit',year:'numeric'}).format(new Date(`${data.asOf}T00:00:00`)).toUpperCase();
  setupFilters();filterIds.forEach((id,i)=>{if([...$('#'+id).options].some(o=>o.value===selected[i]))$('#'+id).value=selected[i];});
  renderHome(); renderCompanies(); renderBoard(); renderGrowth(); renderStatistics(); renderInvestors();
  if(activeInvestorId)renderInvestorProfile();
}
async function refreshData() {
  if(refreshBusy||document.hidden)return;refreshBusy=true;
  try {
    const hosted=!['localhost','127.0.0.1'].includes(location.hostname);
    const response=await fetch(hosted?'./release.json':'/api/status',{cache:'no-store'});
    if(!response.ok){$('.update-status').textContent='已发布快照 · 暂未取得更新状态';return;}
    const status=await response.json();
    if(status.revision!==dataRevision){await loadData();dataRevision=status.revision;}
    $('.update-status').textContent=status.error?'同步失败 · 保留上次数据':'● 数据已同步';
    $('.update-status').title=status.error||'每 15 秒检查已发布数据版本';
  }catch(e){$('.update-status').textContent='连接中断 · 显示上次数据';}
  finally{refreshBusy=false;}
}
async function init() {
  $('#stats-from').value=`${today.getFullYear()}-01-01`;$('#stats-to').value=localDateValue(today);
  await loadData();setInterval(refreshData,15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshData();});
  $('#investor-profile').addEventListener('click',e=>{const card=e.target.closest('[data-company]');if(card)showCompany(card.dataset.company);});
  $('#investor-profile').addEventListener('keydown',e=>{const card=e.target.closest('[data-company]');if(card&&['Enter',' '].includes(e.key)){e.preventDefault();showCompany(card.dataset.company);}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!$('#modal').classList.contains('hidden'))closeCompany();
    if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&$('#modal').classList.contains('hidden')){e.preventDefault();$('#global-search').focus();}
    if(e.key==='Tab'&&!$('#modal').classList.contains('hidden')){
      const focusable=[...$('.detail-modal').querySelectorAll('button,a[href],summary,input,select,[tabindex="0"]')].filter(x=>x.getClientRects().length),first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  $('#global-search').addEventListener('keydown',e=>{if(e.key==='Enter'){$('#search').value=e.target.value;goView('startups');renderCompanies();$('#search').focus();}});
  $('#clear-filters').addEventListener('click',()=>{['search','global-search','filter-university','filter-sector','filter-round','filter-valuation'].forEach(id=>$('#'+id).value='');activeQuick='';$$('.tag-chip').forEach(x=>x.classList.remove('active'));renderCompanies();});
  $('#recent-funding').addEventListener('click',e=>{const b=e.target.closest('[data-company]');if(b)showCompany(b.dataset.company);});
  $('#home-campuses').addEventListener('click',e=>{const b=e.target.closest('[data-campus]');if(b){activeQuick='';$('#filter-university').value=b.dataset.campus;goView('startups');renderCompanies();}});
  ['recent-months','investor-period'].forEach(setupSegments);
  $('#investor-prev').addEventListener('click',()=>{investorPage--;renderInvestors();$('#investor-directory').scrollIntoView({block:'start'});});
  $('#investor-next').addEventListener('click',()=>{investorPage++;renderInvestors();$('#investor-directory').scrollIntoView({block:'start'});});

  $('.brand').addEventListener('click',()=>goView('home'));

  $('#main-nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)goView(b.dataset.view);});
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.go)));
  ['search','filter-university','filter-sector','filter-round','filter-valuation'].forEach(id=>$('#'+id).addEventListener('input',renderCompanies));
  $('#quick-universities').addEventListener('click',e=>{const b=e.target.closest('[data-univ]');if(!b)return;activeQuick=activeQuick===b.dataset.univ?'':b.dataset.univ;$$('.tag-chip').forEach(x=>x.classList.toggle('active',x.dataset.univ===activeQuick));renderCompanies();});
  ['recent-months','recent-round-scope','recent-status'].forEach(id=>$('#'+id).addEventListener('change',renderHome));
  ['stats-window','stats-from','stats-to','stats-year'].forEach(id=>$('#'+id).addEventListener('change',()=>{if(id==='stats-window'&&$('#stats-window').value.startsWith('year:'))$('#stats-year').value=$('#stats-window').value.slice(5);renderStatistics();}));
  $('#rank-sector').addEventListener('change',renderBoard); $('#growth-sector').addEventListener('change',renderGrowth);
  ['valuation-rows','growth-rows'].forEach(id=>{const el=$('#'+id);el.addEventListener('click',e=>{const row=e.target.closest('[data-id]');if(row)showCompany(row.dataset.id);});el.addEventListener('keydown',e=>{const row=e.target.closest('[data-id]');if(row&&e.key==='Enter')showCompany(row.dataset.id);});});
  $('#investor-search').addEventListener('input',()=>{investorPage=1;renderInvestors();}); $('#timeline-sort').addEventListener('change',renderInvestors);
  $('#investor-list').addEventListener('click',e=>{const button=e.target.closest('[data-investor-id]');if(button)openInvestorProfile(button.dataset.investorId);});
  $('#investor-period').addEventListener('change',renderInvestorProfile);
  document.querySelector('[data-investor-back]').addEventListener('click',()=>{$('#investor-profile').classList.add('hidden');$('#investor-directory').classList.remove('hidden');window.scrollTo(0,0);});
  $$('[data-rank]').forEach(b=>b.addEventListener('click',()=>{currentRank=b.dataset.rank;$$('[data-rank]').forEach(x=>x.classList.toggle('active',x===b));$('#valuation-board').classList.toggle('hidden',currentRank!=='valuation');$('#growth-board').classList.toggle('hidden',currentRank!=='growth');}));
  $('#modal-close').addEventListener('click',closeCompany);
  $('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeCompany();});
  $('#global-search').disabled=false;$$('#main-nav button').forEach(b=>b.disabled=false);refreshData();
}
init().catch(e=>{console.error(e);$('#load-error').classList.remove('hidden');$('#load-error').textContent='暂时无法读取档案。请确认本地数据服务已启动，然后刷新页面重试。';$('.update-status').textContent='数据未载入';});
