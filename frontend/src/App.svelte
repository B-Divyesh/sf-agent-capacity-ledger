<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Ledger, SaveState, Source, SpendEntry } from './types';
  import { emptyLedger, sampleLedger } from './sample';
  import { attributedPercent, daysUntil, downloadCsv, remaining, risk, runoutDays, sourceValidationError } from './ledger';
  import { cachedLicenseValid, checkoutUrl, setLicense, storeLicenseFromUrl, verifyLicense } from './license';

  type Route = '/' | '/demo' | '/ledger' | '/privacy' | '/terms' | '/404';
  let route: Route = routeFromPath(location.pathname);
  let ledger: Ledger = route === '/demo' ? sampleLedger() : emptyLedger();
  let saveState: SaveState = 'idle';
  let statusMessage = '';
  let showSourceForm = false;
  let showSpendForm = false;
  let showImport = false;
  let importText = '';
  let importError = '';
  let sourceError = '';
  let licenseToken = '';
  let licensed = cachedLicenseValid();
  let licenseMessage = '';
  let online = navigator.onLine;
  let workspace = '';
  type DeletedItem =
    | { kind: 'source'; value: Source; index: number; spend: { value: SpendEntry; index: number }[]; fallbackSourceIds: string[] }
    | { kind: 'spend'; value: SpendEntry; index: number };
  let lastDeleted: DeletedItem | null = null;
  let undoTimer: number | undefined;
  let sourceDraft = blankSource();
  let spendDraft = blankSpend();
  let menuOpen = false;
  let editingSourceId = '';
  let previousFocus: HTMLElement | null = null;

  const pageMeta: Record<Route, [string, string]> = {
    '/': ['Agent Capacity Ledger — plan agent limits', 'Plan AI coding capacity, approved fallbacks, and project spend before a paid source runs dry.'],
    '/demo': ['Demo — Agent Capacity Ledger', 'Try a sample agent capacity plan without saving real team data.'],
    '/ledger': ['Ledger — Agent Capacity Ledger', 'Record agent limits, approved fallbacks, and project spend.'],
    '/privacy': ['Privacy — Agent Capacity Ledger', 'How Agent Capacity Ledger stores team capacity and license data.'],
    '/terms': ['Terms — Agent Capacity Ledger', 'Terms for using Agent Capacity Ledger.'],
    '/404': ['Page not found — Agent Capacity Ledger', 'Return to Agent Capacity Ledger.'],
  };

  function routeFromPath(path: string): Route {
    if (path === '/' || path === '/demo' || path === '/ledger' || path === '/privacy' || path === '/terms') return path;
    return '/404';
  }

  function blankSource(): Source {
    const reset = new Date();
    reset.setUTCDate(reset.getUTCDate() + 7);
    return { id: '', vendor: '', plan: '', limit: 100, used: 0, dailyPace: 5, resetsOn: reset.toISOString().slice(0, 10), monthlyCost: 0, fallbackId: '', notes: '' };
  }

  function blankSpend(): SpendEntry {
    return { id: '', date: new Date().toISOString().slice(0, 10), project: '', sourceId: ledger.sources[0]?.id ?? '', amount: 0 };
  }

  function go(path: Route, replace = false) {
    if (path === route) return;
    if (replace) history.replaceState({}, '', path); else history.pushState({}, '', path);
    route = path;
    menuOpen = false;
    if (path === '/demo') ledger = sampleLedger();
    if (path === '/ledger') void loadRealLedger();
    updateMeta();
    tick().then(() => {
      document.querySelector<HTMLElement>('h1')?.focus();
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }

  function nav(event: MouseEvent, path: Route) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(path);
  }

  function updateMeta() {
    const [title, description] = pageMeta[route];
    document.title = title;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', `https://agent-capacity-ledger.sociobot.in${route === '/' ? '/' : route}`);
  }

  function getWorkspace() {
    const shared = new URL(location.href).searchParams.get('workspace');
    if (shared && /^[a-zA-Z0-9_-]{8,64}$/.test(shared)) {
      localStorage.setItem('ledger:workspace', shared);
      return shared;
    }
    let value = localStorage.getItem('ledger:workspace');
    if (!value) {
      value = crypto.randomUUID();
      localStorage.setItem('ledger:workspace', value);
    }
    return value;
  }

  async function copyWorkspaceLink() {
    workspace ||= getWorkspace();
    const link = `${location.origin}/ledger?workspace=${encodeURIComponent(workspace)}`;
    try {
      await navigator.clipboard.writeText(link);
      statusMessage = 'Private workspace link copied. Share it only with your team.';
    } catch {
      statusMessage = `Copy this private workspace link: ${link}`;
    }
  }

  async function loadRealLedger() {
    workspace = getWorkspace();
    const cached = localStorage.getItem(`ledger:data:${workspace}`);
    if (cached) {
      try { ledger = JSON.parse(cached); } catch { ledger = emptyLedger(); }
    } else {
      ledger = emptyLedger();
    }
    if (!navigator.onLine) {
      saveState = 'offline';
      statusMessage = 'Offline. Changes stay on this device until you reconnect.';
      return;
    }
    try {
      const response = await fetch(`/api/ledger/${workspace}`);
      if (!response.ok) throw new Error('load');
      const body = await response.json();
      ledger = body.data;
      localStorage.setItem(`ledger:data:${workspace}`, JSON.stringify(ledger));
    } catch {
      saveState = 'error';
      statusMessage = 'The saved ledger could not load. Check the connection and reload.';
    }
  }

  async function save() {
    if (route === '/demo') {
      saveState = 'saved';
      statusMessage = 'Demo change applied. Nothing was added to your real ledger.';
      return;
    }
    workspace ||= getWorkspace();
    localStorage.setItem(`ledger:data:${workspace}`, JSON.stringify(ledger));
    if (!navigator.onLine) {
      saveState = 'offline';
      statusMessage = 'Offline. This change is queued on this device.';
      return;
    }
    saveState = 'saving';
    try {
      const response = await fetch(`/api/ledger/${workspace}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: ledger }),
      });
      if (!response.ok) throw new Error('save');
      saveState = 'saved';
      statusMessage = 'Ledger saved.';
    } catch {
      saveState = 'error';
      statusMessage = 'The server could not save this change. It remains on this device; try again.';
    }
  }

  function openSourceForm(source?: Source) {
    previousFocus = document.activeElement as HTMLElement;
    editingSourceId = source?.id ?? '';
    sourceDraft = source ? { ...source } : blankSource();
    sourceError = '';
    showSourceForm = true;
    tick().then(() => document.querySelector<HTMLInputElement>('#source-vendor')?.focus());
  }

  function openSpendForm() {
    previousFocus = document.activeElement as HTMLElement;
    spendDraft = blankSpend();
    showSpendForm = true;
    tick().then(() => document.querySelector<HTMLInputElement>('#spend-project')?.focus());
  }

  function closeDialogs() {
    showSourceForm = false;
    showSpendForm = false;
    sourceError = '';
    tick().then(() => previousFocus?.focus());
  }

  function handleDialogKeydown(event: KeyboardEvent) {
    if (!showSourceForm && !showSpendForm) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialogs();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = document.querySelector<HTMLDialogElement>('.dialog[open]');
    if (!dialog) return;
    const controls = [...dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  function saveSource() {
    sourceError = sourceValidationError(sourceDraft);
    if (sourceError) {
      sourceError = `${sourceError} Fix the value and save again.`;
      return;
    }
    if (!editingSourceId && ledger.sources.length >= 3 && !licensed && route !== '/demo') {
      licenseMessage = 'The free ledger holds three sources. Add the team plan for more.';
      sourceError = 'The free ledger holds three sources. Add the team plan to add more.';
      return;
    }
    if (editingSourceId) {
      ledger = { ...ledger, sources: ledger.sources.map((source) => source.id === editingSourceId ? { ...sourceDraft, id: editingSourceId } : source) };
    } else {
      const source = { ...sourceDraft, id: crypto.randomUUID() };
      ledger = { ...ledger, sources: [...ledger.sources, source] };
    }
    sourceDraft = blankSource();
    sourceError = '';
    editingSourceId = '';
    showSourceForm = false;
    tick().then(() => previousFocus?.focus());
    void save();
  }

  function addSpend() {
    const entry = { ...spendDraft, id: crypto.randomUUID() };
    ledger = { ...ledger, spend: [...ledger.spend, entry] };
    spendDraft = blankSpend();
    showSpendForm = false;
    tick().then(() => previousFocus?.focus());
    void save();
  }

  function updateUsage(source: Source, value: number) {
    ledger = { ...ledger, sources: ledger.sources.map((item) => item.id === source.id ? { ...item, used: Math.max(0, Math.min(value, item.limit)) } : item) };
  }

  function updateFallback(source: Source, fallbackId: string) {
    ledger = { ...ledger, sources: ledger.sources.map((item) => item.id === source.id ? { ...item, fallbackId } : item) };
    void save();
  }

  function deleteItem(kind: 'source' | 'spend', value: Source | SpendEntry, index: number) {
    if (kind === 'source') {
      const source = value as Source;
      lastDeleted = {
        kind,
        value: source,
        index,
        spend: ledger.spend.flatMap((item, spendIndex) => item.sourceId === source.id ? [{ value: item, index: spendIndex }] : []),
        fallbackSourceIds: ledger.sources.filter((item) => item.fallbackId === source.id).map((item) => item.id),
      };
      ledger = {
        ...ledger,
        sources: ledger.sources
          .filter((item) => item.id !== source.id)
          .map((item) => item.fallbackId === source.id ? { ...item, fallbackId: '' } : item),
        spend: ledger.spend.filter((item) => item.sourceId !== source.id),
      };
    } else {
      lastDeleted = { kind, value: value as SpendEntry, index };
      ledger = { ...ledger, spend: ledger.spend.filter((item) => item.id !== value.id) };
    }
    clearTimeout(undoTimer);
    undoTimer = window.setTimeout(() => lastDeleted = null, 8000);
    void save();
  }

  function undoDelete() {
    if (!lastDeleted) return;
    if (lastDeleted.kind === 'source') {
      const sources = ledger.sources.map((source) => lastDeleted?.kind === 'source' && lastDeleted.fallbackSourceIds.includes(source.id) ? { ...source, fallbackId: lastDeleted.value.id } : source);
      sources.splice(lastDeleted.index, 0, lastDeleted.value);
      const spend = [...ledger.spend];
      for (const related of lastDeleted.spend) spend.splice(Math.min(related.index, spend.length), 0, related.value);
      ledger = { ...ledger, sources, spend };
    } else {
      const items = [...ledger.spend]; items.splice(lastDeleted.index, 0, lastDeleted.value); ledger = { ...ledger, spend: items };
    }
    lastDeleted = null;
    void save();
  }

  function parseImport() {
    importError = '';
    const lines = importText.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { importError = 'No usage rows were found. Add a header and at least one row.'; return; }
    const headers = lines[0].split(',').map((item) => item.trim().toLowerCase());
    const required = ['vendor', 'plan', 'limit', 'used', 'daily_pace', 'resets_on', 'monthly_cost'];
    if (!required.every((name) => headers.includes(name))) {
      importError = `The CSV needs these columns: ${required.join(', ')}.`; return;
    }
    const imported: Source[] = [];
    for (const [rowIndex, line] of lines.slice(1).entries()) {
      const cells = line.split(',').map((item) => item.trim());
      const get = (name: string) => cells[headers.indexOf(name)] ?? '';
      const limit = Number(get('limit')); const used = Number(get('used')); const dailyPace = Number(get('daily_pace')); const monthlyCost = Number(get('monthly_cost'));
      if (!get('vendor') || ![limit, used, dailyPace, monthlyCost].every(Number.isFinite)) {
        importError = `Row ${rowIndex + 2} has missing or invalid values. Fix that row and import again.`; return;
      }
      const source = { id: crypto.randomUUID(), vendor: get('vendor'), plan: get('plan'), limit, used, dailyPace, resetsOn: get('resets_on'), monthlyCost, fallbackId: '', notes: '' };
      const validationError = sourceValidationError(source);
      if (validationError) { importError = `Row ${rowIndex + 2}: ${validationError}`; return; }
      imported.push(source);
    }
    if (ledger.sources.length + imported.length > 3 && !licensed && route !== '/demo') {
      importError = 'The free ledger holds three sources. Import fewer rows or add the team plan.'; return;
    }
    ledger = { ...ledger, sources: [...ledger.sources, ...imported] };
    showImport = false; importText = '';
    void save();
  }

  async function restoreLicense() {
    if (!licenseToken.trim()) { licenseMessage = 'Paste a license token first.'; return; }
    setLicense(licenseToken);
    licenseMessage = 'Checking the license…';
    try {
      licensed = await verifyLicense(true);
      licenseMessage = licensed ? 'Team plan active on this device.' : 'This license is not active. Check the token or buy a new plan.';
    } catch {
      licenseMessage = 'The license could not be checked. Check the connection and try again.';
    }
  }

  function resetDemo() {
    ledger = sampleLedger();
    statusMessage = 'Demo reset to its original sample data.';
  }

  onMount(() => {
    updateMeta();
    if (storeLicenseFromUrl()) licenseMessage = 'License received. Checking it now.';
    if (route === '/ledger') void loadRealLedger();
    if (route === '/demo') ledger = sampleLedger();
    window.addEventListener('popstate', () => {
      route = routeFromPath(location.pathname);
      updateMeta();
      if (route === '/ledger') void loadRealLedger();
      tick().then(() => document.querySelector<HTMLElement>('h1')?.focus());
    });
    window.addEventListener('online', () => { online = true; if (route === '/ledger') void save(); });
    window.addEventListener('offline', () => { online = false; saveState = 'offline'; statusMessage = 'Offline. Changes stay on this device until you reconnect.'; });
    if (localStorage.getItem('sb_license:agent-capacity-ledger')) {
      verifyLicense().then((value) => licensed = value).catch(() => undefined);
    }
  });
</script>

<svelte:window on:keydown={handleDialogKeydown} />

<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
  <a class="wordmark" href="/" on:click={(event) => nav(event, '/')} aria-label="Agent Capacity Ledger home">
    <span class="mark" aria-hidden="true"><i></i></span>
    <span>Agent Capacity<br />Ledger</span>
  </a>
  <button class="menu-button" aria-expanded={menuOpen} aria-controls="site-nav" on:click={() => menuOpen = !menuOpen}>Menu</button>
  <nav id="site-nav" aria-label="Main navigation" class:open={menuOpen}>
    <a href="/demo" aria-current={route === '/demo' ? 'page' : undefined} on:click={(event) => nav(event, '/demo')}>Demo</a>
    <a href="/ledger" aria-current={route === '/ledger' ? 'page' : undefined} on:click={(event) => nav(event, '/ledger')}>Ledger</a>
    <a href="/privacy" aria-current={route === '/privacy' ? 'page' : undefined} on:click={(event) => nav(event, '/privacy')}>Privacy</a>
  </nav>
</header>

{#if route === '/demo'}
  <aside class="demo-banner" aria-label="Demo mode">
    <span><strong>Demo</strong> — sample data, nothing is saved</span>
    <span class="banner-actions"><button class="text-button" on:click={resetDemo}>Reset demo</button><a href="/ledger" on:click={(event) => nav(event, '/ledger')}>Start for real</a></span>
  </aside>
{/if}

<div class="route-announcement" aria-live="polite">{pageMeta[route][0]}</div>

<main id="main">
  {#if route === '/'}
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">A shared watch for paid agent limits</p>
        <h1 tabindex="-1">Plan agent capacity before limits stop work</h1>
        <p class="lede">For small engineering teams juggling coding subscriptions, project spend, and approved backup tools.</p>
        <div class="hero-actions">
          <a class="primary-button" href="/demo" on:click={(event) => nav(event, '/demo')}>Try it with sample data</a>
          <span>See a filled team ledger next.</span>
        </div>
        <ul class="plain-facts" aria-label="Product facts">
          <li>No prompts collected</li>
          <li>CSV import and export</li>
          <li>$79 per team each month</li>
        </ul>
      </div>
      <figure class="hero-art">
        <picture>
          <source media="(max-width: 720px)" srcset="/assets/capacity-observatory-720.webp" />
          <img src="/assets/capacity-observatory-1200.webp" width="1200" height="800" fetchpriority="high" alt="An observatory measures three finite reservoirs before their channels run dry." />
        </picture>
        <figcaption>Each source is finite. The ledger watches the reset horizon.</figcaption>
      </figure>
    </section>

    <section class="preview-section" aria-labelledby="preview-title">
      <div class="section-heading"><p class="eyebrow">Live preview</p><h2 id="preview-title">See the interruption before it happens</h2></div>
      <div class="mini-ledger">
        <div><span class="status at-risk">At risk</span><strong>Claude Code · Max seat</strong><span>17 sessions left · reset in 6 days</span></div>
        <div class="mini-bar"><progress max="100" value="14" aria-label="14 percent capacity remaining">14%</progress></div>
        <p>Approved fallback: Codex Team</p>
      </div>
    </section>

    <section class="steps" aria-labelledby="steps-title">
      <div class="section-heading"><p class="eyebrow">How it works</p><h2 id="steps-title">Turn vendor readings into a team plan</h2></div>
      <ol>
        <li><span>01</span><div><h3>Record each source</h3><p>Add a vendor limit, current use, reset date, and daily pace.</p></div></li>
        <li><span>02</span><div><h3>Set approved fallbacks</h3><p>Choose where work may move without sharing accounts or credentials.</p></div></li>
        <li><span>03</span><div><h3>Attribute project spend</h3><p>Record costs by project, then export the full ledger as CSV.</p></div></li>
      </ol>
    </section>

    <section class="boundaries" aria-labelledby="boundaries-title">
      <div><p class="eyebrow">Clear boundaries</p><h2 id="boundaries-title">Capacity planning, not limit bypassing</h2></div>
      <div><p>The ledger does not proxy models, collect prompts, store vendor credentials, or encourage account sharing.</p><p>Forecasts use the limits and pace your team enters. Every forecast is labeled as an estimate.</p></div>
    </section>

    <section class="pricing" aria-labelledby="price-title">
      <p class="eyebrow">Team plan</p>
      <h2 id="price-title">Track every paid source for $79 a month</h2>
      <p>Free ledgers hold three sources. The team plan adds sources beyond that cap and lets your team use the license.</p>
      <a class="primary-button" href={checkoutUrl()}>Buy the team plan</a>
      <p class="fine-print">Sociobot hosts checkout and handles receipts and refunds.</p>
    </section>
  {:else if route === '/demo' || route === '/ledger'}
    <section class="app-shell">
      <div class="app-heading">
        <div>
          <p class="eyebrow">{route === '/demo' ? 'Sample workspace' : 'Team workspace'}</p>
          <h1 tabindex="-1">Watch capacity and route work early</h1>
          <p>{ledger.teamName} · forecasts are estimates</p>
        </div>
        <div class="app-actions">
          <button class="secondary-button" on:click={() => showImport = !showImport}>Import usage CSV</button>
          <button class="secondary-button" on:click={() => downloadCsv(ledger)}>Export CSV</button>
          {#if route === '/ledger'}<button class="secondary-button" on:click={copyWorkspaceLink}>Copy workspace link</button>{/if}
          <button class="primary-button" on:click={() => openSourceForm()}>Add a source</button>
        </div>
      </div>

      {#if !online || saveState === 'error' || statusMessage}
        <div class:error-notice={saveState === 'error'} class="notice" role="status">{statusMessage || 'Offline. Changes stay on this device until you reconnect.'}</div>
      {/if}

      {#if showImport}
        <section class="inline-form" aria-labelledby="import-title">
          <div class="form-heading"><h2 id="import-title">Import usage CSV</h2><button class="icon-button" aria-label="Close import form" on:click={() => showImport = false}>×</button></div>
          <p>Use columns: vendor, plan, limit, used, daily_pace, resets_on, monthly_cost.</p>
          <label for="csv-input">CSV rows</label>
          <textarea id="csv-input" bind:value={importText} rows="6" placeholder="vendor,plan,limit,used,daily_pace,resets_on,monthly_cost"></textarea>
          {#if importError}<p class="form-error" role="alert">{importError}</p>{/if}
          <button class="primary-button" on:click={parseImport}>Import sources</button>
        </section>
      {/if}

      <section class="forecast-strip" aria-label="Ledger totals">
        <div><span>Paid sources</span><strong>{ledger.sources.length}</strong></div>
        <div><span>Remaining sessions <em>estimate</em></span><strong>{ledger.sources.reduce((sum, source) => sum + remaining(source), 0)}</strong></div>
        <div><span>Monthly source cost</span><strong>${ledger.sources.reduce((sum, source) => sum + source.monthlyCost, 0).toFixed(0)}</strong></div>
        <div><span>Spend attributed</span><strong>{attributedPercent(ledger)}%</strong></div>
      </section>

      <section class="ledger-section" aria-labelledby="sources-title">
        <div class="section-toolbar"><div><p class="eyebrow">Capacity watch</p><h2 id="sources-title">Paid sources</h2></div></div>
        {#if ledger.sources.length === 0}
          <div class="empty-state"><span class="empty-orbit" aria-hidden="true"></span><h3>No sources to watch yet</h3><p>Your vendor limits and reset forecasts will appear here.</p><button class="primary-button" on:click={() => openSourceForm()}>Add your first source</button></div>
        {:else}
          <div class="source-list">
            {#each ledger.sources as source, index (source.id)}
              <article class="source-row">
                <div class="source-main">
                  <div class="source-title"><span class:at-risk={risk(source) === 'At risk'} class:watch={risk(source) === 'Watch'} class="status">{risk(source)}</span><h3>{source.vendor}</h3><span>{source.plan}</span></div>
                  <div class="capacity-line"><span><strong>{remaining(source)}</strong> of {source.limit} sessions left</span><span>Reset in {daysUntil(source.resetsOn)} days</span></div>
                  <div class="capacity-bar"><progress max={source.limit} value={remaining(source)} aria-label={`${Math.round(remaining(source) / source.limit * 100)} percent capacity remaining`}>{Math.round(remaining(source) / source.limit * 100)}%</progress></div>
                  <p class="forecast-note">At {source.dailyPace} sessions a day, this source lasts about {Number.isFinite(runoutDays(source)) ? Math.floor(runoutDays(source)) : '∞'} days. Estimate.</p>
                  {#if source.notes}<p class="source-notes">{source.notes}</p>{/if}
                </div>
                <div class="source-controls">
                  <label>Used sessions<input type="number" min="0" max={source.limit} value={source.used} on:change={(event) => { updateUsage(source, Number(event.currentTarget.value)); void save(); }} /></label>
                  <label>Approved fallback<select value={source.fallbackId} on:change={(event) => updateFallback(source, event.currentTarget.value)}><option value="">No fallback set</option>{#each ledger.sources.filter((item) => item.id !== source.id) as fallback}<option value={fallback.id}>{fallback.vendor}</option>{/each}</select></label>
                  <span class="cost">${source.monthlyCost.toFixed(0)}/month</span>
                  <span class="row-buttons"><button class="text-button" aria-label={`Edit ${source.vendor}`} on:click={() => openSourceForm(source)}>Edit</button><button class="delete-button" aria-label={`Remove ${source.vendor}`} on:click={() => deleteItem('source', source, index)}>Remove</button></span>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </section>

      <section class="ledger-section spend-section" aria-labelledby="spend-title">
        <div class="section-toolbar"><div><p class="eyebrow">Cost record</p><h2 id="spend-title">Project spend</h2></div><button class="secondary-button" disabled={ledger.sources.length === 0} on:click={openSpendForm}>Record spend</button></div>
        {#if ledger.spend.length === 0}
          <div class="empty-state compact"><h3>No project spend recorded</h3><p>Cost entries will show which projects use paid capacity.</p></div>
        {:else}
          <div class="spend-table" role="table" aria-label="Project spend">
            <div role="row" class="table-head"><span role="columnheader">Project</span><span role="columnheader">Source</span><span role="columnheader">Date</span><span role="columnheader">Cost</span><span></span></div>
            {#each ledger.spend as entry, index (entry.id)}
              <div role="row"><div role="cell"><strong>{entry.project}</strong></div><span role="cell">{ledger.sources.find((source) => source.id === entry.sourceId)?.vendor ?? 'Removed source'}</span><span role="cell">{entry.date}</span><span role="cell">${entry.amount.toFixed(2)}</span><div role="cell"><button class="delete-button" aria-label={`Remove ${entry.project} spend entry`} on:click={() => deleteItem('spend', entry, index)}>Remove</button></div></div>
            {/each}
          </div>
        {/if}
      </section>

      {#if route === '/ledger'}
        <section class="license-panel" aria-labelledby="license-title">
          <div><p class="eyebrow">Team plan</p><h2 id="license-title">{licensed ? 'Team plan active' : 'Add more than three sources'}</h2><p>{licensed ? 'This device can use the team source limit.' : '$79 per team each month. CSV export and three sources stay free.'}</p></div>
          {#if !licensed}<div class="license-actions"><a class="primary-button" href={checkoutUrl()}>Buy the team plan</a><label for="license-token">Have a license? Paste it<input id="license-token" bind:value={licenseToken} autocomplete="off" /></label><button class="secondary-button" on:click={restoreLicense}>Verify license</button></div>{/if}
          {#if licenseMessage}<p class="license-message" role="status">{licenseMessage}</p>{/if}
        </section>
      {/if}
    </section>
  {:else if route === '/privacy'}
    <article class="legal">
      <p class="eyebrow">Last updated 28 August 2026</p><h1 tabindex="-1">Privacy without prompt collection</h1>
      <p>Agent Capacity Ledger stores the capacity details you enter. It never asks for prompts, code, vendor passwords, or API keys.</p>
      <h2>What the service stores</h2><p>The server stores your workspace identifier, source limits, reset dates, fallback choices, project names, costs, and update time. Your browser keeps a matching copy for offline edits.</p><p>Anyone with a private workspace link can view and edit that ledger. Share the link only with your team.</p>
      <h2>Demo data</h2><p>The demo runs in memory. It does not read or write your real workspace.</p>
      <h2>Licenses and checkout</h2><p>Your browser stores a license token after checkout. It sends that token to Sociobot for verification no more than once a day. Sociobot hosts checkout.</p>
      <h2>Deletion</h2><p>Email <a href="mailto:privacy@sociobot.in">privacy@sociobot.in</a> with your workspace identifier to request deletion.</p>
    </article>
  {:else if route === '/terms'}
    <article class="legal">
      <p class="eyebrow">Last updated 28 August 2026</p><h1 tabindex="-1">Terms for honest capacity planning</h1>
      <p>Use this service to plan work within each vendor’s rules. Do not use it to share accounts, bypass limits, or store credentials.</p>
      <h2>Forecasts are estimates</h2><p>Forecasts depend on the limits, reset dates, and pace you enter. Confirm critical capacity decisions with the vendor.</p>
      <h2>Team plan</h2><p>The team plan costs $79 each month. Sociobot handles checkout, receipts, refunds, and license status.</p>
      <h2>Your data</h2><p>You are responsible for team names, project names, costs, and vendor readings you enter. Do not add confidential prompts or source code.</p>
      <h2>Availability</h2><p>The service is provided as available. Export your ledger before a critical planning event.</p>
    </article>
  {:else}
    <section class="not-found"><p class="eyebrow">404 · Outside the chart</p><h1 tabindex="-1">This page has no reading</h1><p>The ledger only maps places that exist.</p><a class="primary-button" href="/" on:click={(event) => nav(event, '/')}>Return to the ledger</a></section>
  {/if}
</main>

{#if showSourceForm}
  <div class="dialog-backdrop" role="presentation" on:click={(event) => { if (event.target === event.currentTarget) closeDialogs(); }}>
    <dialog open class="dialog" aria-modal="true" aria-labelledby="source-form-title">
      <div class="form-heading"><h2 id="source-form-title">{editingSourceId ? 'Edit paid source' : 'Add a paid source'}</h2><button class="icon-button" aria-label="Close source form" on:click={closeDialogs}>×</button></div>
      <form on:submit={(event) => { event.preventDefault(); saveSource(); }}>
        <label>Vendor<input id="source-vendor" bind:value={sourceDraft.vendor} required /></label><label>Plan<input bind:value={sourceDraft.plan} required /></label>
        <div class="field-pair"><label>Session limit<input type="number" min="1" bind:value={sourceDraft.limit} aria-describedby={sourceError ? 'source-error' : undefined} required /></label><label>Sessions used<input type="number" min="0" bind:value={sourceDraft.used} aria-describedby={sourceError ? 'source-error' : undefined} required /></label></div>
        <div class="field-pair"><label>Daily pace<input type="number" min="0" step="0.1" bind:value={sourceDraft.dailyPace} required /></label><label>Reset date<input type="date" bind:value={sourceDraft.resetsOn} required /></label></div>
        <label>Monthly cost in USD<input type="number" min="0" step="0.01" bind:value={sourceDraft.monthlyCost} required /></label><label>Notes<textarea bind:value={sourceDraft.notes} rows="2"></textarea></label>
        {#if sourceError}<p id="source-error" class="form-error" role="alert">{sourceError}</p>{/if}
        <div class="dialog-actions"><button type="button" class="secondary-button" on:click={closeDialogs}>Cancel</button><button class="primary-button">Save source</button></div>
      </form>
    </dialog>
  </div>
{/if}

{#if showSpendForm}
  <div class="dialog-backdrop" role="presentation" on:click={(event) => { if (event.target === event.currentTarget) closeDialogs(); }}>
    <dialog open class="dialog" aria-modal="true" aria-labelledby="spend-form-title">
      <div class="form-heading"><h2 id="spend-form-title">Record project spend</h2><button class="icon-button" aria-label="Close spend form" on:click={closeDialogs}>×</button></div>
      <form on:submit={(event) => { event.preventDefault(); addSpend(); }}>
        <label>Project<input id="spend-project" bind:value={spendDraft.project} required /></label><label>Source<select bind:value={spendDraft.sourceId} required>{#each ledger.sources as source}<option value={source.id}>{source.vendor} · {source.plan}</option>{/each}</select></label>
        <div class="field-pair"><label>Date<input type="date" bind:value={spendDraft.date} required /></label><label>Cost in USD<input type="number" min="0" step="0.01" bind:value={spendDraft.amount} required /></label></div>
        <div class="dialog-actions"><button type="button" class="secondary-button" on:click={closeDialogs}>Cancel</button><button class="primary-button">Save spend</button></div>
      </form>
    </dialog>
  </div>
{/if}

{#if lastDeleted}
  <div class="undo-toast" role="status"><span>{lastDeleted.kind === 'source' && lastDeleted.spend.length ? `Source and ${lastDeleted.spend.length} linked spend ${lastDeleted.spend.length === 1 ? 'entry' : 'entries'} removed.` : 'Item removed.'}</span><button on:click={undoDelete}>Undo</button></div>
{/if}

<footer>
  <div><strong>Agent Capacity Ledger</strong><p>Plan paid agent capacity before limits stop work.</p></div>
  <nav aria-label="Footer navigation"><a href="/privacy" on:click={(event) => nav(event, '/privacy')}>Privacy</a><a href="/terms" on:click={(event) => nav(event, '/terms')}>Terms</a><a href="https://sociobot.in">Built by Param Factory <span class="sr-only">(external site)</span></a></nav>
  <p>v1.0.0 · Generated artwork</p>
</footer>
