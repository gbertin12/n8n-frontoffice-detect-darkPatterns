'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────
const WEBHOOK_URL = 'https://n8n.develle.fr/webhook/763481ba-ae2f-441d-b36b-5fb3423f7bdc';

// ─── Category Metadata ───────────────────────────────────────────────────────
const CATEGORIES = {
  emotional_manipulation: {
    label: 'Manipulation émotionnelle',
    icon: '😰',
    desc: 'Exploite les émotions (peur, urgence, culpabilité) pour forcer une décision',
  },
  choice_manipulation: {
    label: 'Manipulation du choix',
    icon: '🧩',
    desc: "Guide subtilement l'utilisateur vers un choix défavorable",
  },
  obstruction: {
    label: 'Obstruction',
    icon: '🚧',
    desc: "Rend volontairement difficile l'accomplissement d'actions légitimes",
  },
  hidden_costs: {
    label: 'Coûts cachés',
    icon: '💸',
    desc: "Dissimule des frais supplémentaires jusqu'au dernier moment",
  },
  fake_social_proof: {
    label: 'Fausse preuve sociale',
    icon: '👥',
    desc: 'Utilise de faux avis ou indicateurs de popularité',
  },
};

// ─── Example texts ───────────────────────────────────────────────────────────
const EXAMPLES = {
  urge: "🔥 OFFRE LIMITÉE ! Il ne reste que 3 articles en stock ! Plus de 15 987 personnes regardent ce produit en ce moment. Cette offre expirera dans 00:04:32. Ne laissez pas vos proches sans protection. Achetez MAINTENANT avant qu'il soit trop tard !",
  safe: "Notre produit est disponible en plusieurs coloris. Livraison estimée sous 3 à 5 jours ouvrés. Vous pouvez retourner l'article dans les 30 jours suivant la réception si vous n'êtes pas satisfait.",
};

// ─── State ───────────────────────────────────────────────────────────────────
let isAnalyzing = false;

// ─── DOM Refs ────────────────────────────────────────────────────────────────
const textInput = document.getElementById('textInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const scanOverlay = document.getElementById('scanOverlay');
const resultsSection = document.getElementById('resultsSection');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function updateCharCount() {
  document.getElementById('charCount').textContent =
    `${textInput.value.length.toLocaleString('fr-FR')} car.`;
}

function fillExample(type) {
  textInput.value = EXAMPLES[type] || '';
  updateCharCount();
  textInput.focus();
  resultsSection.innerHTML = '';
}

function setLoading(on) {
  isAnalyzing = on;
  analyzeBtn.disabled = on;
  textInput.disabled = on;
  scanOverlay.classList.toggle('hidden', !on);
  scanOverlay.classList.toggle('flex', on);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function analyzeText() {
  if (isAnalyzing) return;
  const text = textInput.value.trim();
  if (!text) {
    textInput.focus();
    textInput.style.borderColor = 'rgba(239,68,68,0.5)';
    setTimeout(() => (textInput.style.borderColor = ''), 1500);
    return;
  }

  resultsSection.innerHTML = '';
  setLoading(true);

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*' },
      body: JSON.stringify({ message: text }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);

    // Lire le texte brut d'abord, puis tenter de parser en JSON
    const raw = await res.text();
    if (!raw || !raw.trim()) {
      throw new Error('Réponse vide reçue de n8n. Vérifiez que le nœud "Respond to Webhook" est bien configuré.');
    }

    let data;
    try {
      data = JSON.parse(raw);
      if (Array.isArray(data)) data = data[0] || {};
    } catch {
      // Réponse texte brut
      data = { message: raw };
    }

    setLoading(false);
    renderResult(data);
  } catch (err) {
    setLoading(false);
    renderError(err.message);
    console.error('[DPD]', err);
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function renderResult(data) {
  if (data.is_dark_pattern === false || data.is_dark_pattern === 'false') {
    renderSuccess(data);
  } else if (data.is_dark_pattern === true || data.is_dark_pattern === 'true') {
    renderDanger(data);
  } else {
    renderRaw(data);
  }
}

function renderSuccess(data) {
  resultsSection.innerHTML = `
    <div class="animate-slide-up rounded-2xl border border-green-500/25 bg-green-950/20 p-6 flex items-start gap-5">
      <div class="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-2xl flex-shrink-0">✅</div>
      <div>
        <h2 class="text-xl font-bold text-green-400 mb-1">Texte éthique validé !</h2>
        <p class="text-slate-400 text-sm leading-relaxed mb-4">${esc(data.message || 'Aucun dark pattern détecté.')}</p>
        <div class="bg-green-950/40 border border-green-500/15 rounded-xl p-3 flex items-center gap-2 text-xs text-green-300">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Ce texte respecte les bonnes pratiques d'éthique numérique.
        </div>
      </div>
    </div>`;
}

function renderDanger(data) {
  const cat = CATEGORIES[data.categorie_detectee] || { label: data.categorie_detectee, icon: '⚠️', desc: '' };
  const score = Math.round((data.score_confiance || 0) * 100);
  const votes = data.details_des_votes || {};

  const bars = Object.entries(votes)
    .sort((a, b) => b[1] - a[1])
    .map(([key, val], i) => {
      const c = CATEGORIES[key] || { label: key, icon: '•', desc: '' };
      const pct = Math.round(val * 100);
      const main = key === data.categorie_detectee;
      return `
        <div class="space-y-1.5" style="animation-delay:${i * 80}ms">
          <div class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-1.5 ${main ? 'text-white font-semibold' : 'text-slate-400'}">
              ${c.icon} ${c.label}
            </span>
            <span class="${main ? 'text-orange-400 font-bold' : 'text-slate-500'}">${pct}%</span>
          </div>
          <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="progress-fill h-full rounded-full ${main ? 'bg-gradient-to-r from-red-500 to-orange-400' : 'bg-slate-600'}"
              data-width="${pct}" style="width:0%"></div>
          </div>
          <p class="text-xs text-slate-600">${esc(c.desc)}</p>
        </div>`;
    }).join('');

  resultsSection.innerHTML = `
    <div class="animate-slide-up space-y-4">
      <!-- Alert card -->
      <div class="rounded-2xl border border-red-500/30 bg-red-950/20 overflow-hidden">
        <div class="bg-gradient-to-r from-red-950/50 to-orange-950/20 px-6 py-5 border-b border-red-500/20">
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl flex-shrink-0">⚠️</div>
              <div>
                <h2 class="text-xl font-bold text-white">Dark Pattern détecté !</h2>
                <p class="text-sm text-slate-400 mt-0.5">${cat.icon} ${cat.label}</p>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="text-3xl font-black text-red-400">${score}%</div>
              <div class="text-xs text-slate-500">confiance</div>
            </div>
          </div>
          ${data.phrase_originale ? `
          <div class="bg-red-900/20 border border-red-500/15 rounded-xl px-4 py-3 text-xs text-red-300/80">
            <span class="text-red-400/60 font-semibold uppercase tracking-wider text-[10px]">Phrase analysée</span>
            <p class="mt-1 italic">"${esc(data.phrase_originale)}"</p>
          </div>` : ''}
        </div>
        <!-- Ethical alternative -->
        <div class="p-6">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <svg class="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <span class="text-sm font-semibold text-teal-400">Alternative éthique proposée</span>
          </div>
          <div class="bg-teal-950/30 border border-teal-500/20 rounded-xl p-4 flex items-start justify-between gap-3">
            <p class="text-sm text-teal-200 leading-relaxed italic" id="ethicalPhrase">"${esc(data.phrase_ethique_proposee || '')}"</p>
            <button onclick="copyPhrase()" title="Copier"
              class="flex-shrink-0 w-8 h-8 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 rounded-lg flex items-center justify-center transition-all duration-150">
              <svg class="w-3.5 h-3.5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <!-- Detail card -->
      <div class="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6">
        <h3 class="text-sm font-semibold text-slate-300 mb-5 flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          Détail de l'analyse par catégorie
        </h3>
        <div class="space-y-5">${bars}</div>
      </div>
    </div>`;

  // Animate progress bars
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.progress-fill').forEach(el => {
        el.style.width = el.dataset.width + '%';
      });
    });
  });
}

function renderError(msg) {
  resultsSection.innerHTML = `
    <div class="animate-slide-up rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 flex items-start gap-4">
      <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl flex-shrink-0">❌</div>
      <div>
        <h2 class="font-semibold text-white mb-1">Erreur de connexion au workflow</h2>
        <p class="text-sm text-slate-500">${esc(msg)}</p>
      </div>
    </div>`;
}

function renderRaw(data) {
  resultsSection.innerHTML = `
    <div class="animate-slide-up rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6">
      <h2 class="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Réponse brute</h2>
      <pre class="text-xs text-slate-400 bg-slate-950/60 rounded-xl p-4 overflow-auto">${esc(JSON.stringify(data, null, 2))}</pre>
    </div>`;
}

// ─── Copy ────────────────────────────────────────────────────────────────────
function copyPhrase() {
  const el = document.getElementById('ethicalPhrase');
  if (!el) return;
  const text = el.textContent.replace(/^"|"$/g, '');
  navigator.clipboard.writeText(text).then(() => showToast('📋 Phrase copiée !'));
}

// ─── Toast ───────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  document.querySelector('.dpd-toast')?.remove();
  clearTimeout(toastTimer);
  const t = document.createElement('div');
  t.className = 'dpd-toast';
  t.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);
    background:rgba(15,10,40,0.95);border:1px solid rgba(139,92,246,0.35);
    backdrop-filter:blur(12px);color:#e2e8f0;font-family:Inter,sans-serif;
    font-size:13px;font-weight:500;padding:10px 20px;border-radius:12px;
    z-index:9999;opacity:0;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);
    box-shadow:0 8px 32px rgba(0,0,0,0.4);`;
  document.body.appendChild(t);
  t.textContent = msg;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  }));
  toastTimer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(12px)';
    setTimeout(() => t.remove(), 350);
  }, 2800);
}
