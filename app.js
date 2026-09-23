/* ============================================================
   見た目の処理。ふだんは触らなくて大丈夫です。
   編集するのは data.js だけです。
   ============================================================ */

const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ym = r => r.replace("-", ".");
const jp = d => d.replace(/-/g, ".");

const bookByTitle = t => books.find(b => b.title === t);
const qById = id => questions.find(q => q.id === id);
const childrenOf = id => questions.filter(q => q.from === id);
const descendants = id => childrenOf(id).reduce((n, k) => n + 1 + descendants(k.id), 0);
const rootQuestions = () => questions.filter(q => !q.from && childrenOf(q.id).length);
const questionsAbout = title => questions.filter(q => q.book === title);
const totalQuotes = () => books.reduce((n, b) => n + b.quotes.length, 0);

/* 引用は "文字列" でも { text, page } でも書けます */
const quoteOf = q => (typeof q === "string" ? { text: q, page: "" } : q);

/* 出典表記：著者『書名』訳者、出版社、参照した版の年（原著 年） */
function citation(b) {
  const parts = [
    `${b.author}『${b.title}』`,
    b.translator ? b.translator + "、" : "",
    b.publisher ? b.publisher + "、" : "",
    b.year || ""
  ].join("");
  return parts + (b.origYear ? `（原著 ${b.origYear}）` : "");
}

/* ---------- 共通の枠 ---------- */

const PAGES = [
  { key: "questions", href: "questions.html", label: "疑問" },
  { key: "books",     href: "books.html",     label: "読書" },
  { key: "columns",   href: "columns.html",   label: "コラム" },
  { key: "about",     href: "about.html",     label: "プロフィール" }
];

function renderSite(current) {
  const el = document.getElementById("site-header");
  if (el) {
    el.className = "side";
    el.innerHTML = `
      <a class="brand" href="index.html">${esc(SITE.name)}</a>
      <nav>${PAGES.map(p =>
        `<a href="${p.href}"${p.key === current ? ' aria-current="page"' : ""}>${esc(p.label)}</a>`
      ).join("")}</nav>`;
  }
  const f = document.getElementById("site-footer");
  if (f) {
    f.innerHTML = `
      <div class="site-footer">
        <span>${esc(SITE.owner)}${SITE.role ? " — " + esc(SITE.role) : ""}</span>
      </div>`;
  }
  buildDialog();
  openFromHash();
}

function buildDialog() {
  if (document.getElementById("detail")) return;
  const d = document.createElement("dialog");
  d.id = "detail";
  d.innerHTML = `<button class="d-close" aria-label="閉じる">×</button><div class="d-inner"></div>`;
  document.body.appendChild(d);
  d.querySelector(".d-close").addEventListener("click", () => d.close());
  d.addEventListener("click", e => { if (e.target === d) d.close(); });
}

function showDialog(html) {
  const d = document.getElementById("detail");
  d.querySelector(".d-inner").innerHTML = html;
  if (!d.open) d.showModal();
}

/* ---------- 言葉（本）のカード ---------- */

function wordCard(b) {
  const face = b.quotes.length ? quoteOf(b.quotes[0]).text : b.title;
  return `
    <button class="word" data-book="${esc(b.title)}">
      <p class="quote">${esc(face)}</p>
      <p class="src">
        <span class="title">${esc(b.title)}</span>
        <span class="sep"></span><span>${esc(b.author)}</span>
        <span class="sep"></span><span>${esc(b.tags[0])}</span>
        ${b.quotes.length > 1 ? `<span class="sep"></span><span class="more">ほか${b.quotes.length - 1}</span>` : ""}
      </p>
    </button>`;
}

/* おすすめの書籍（recommend: true の本） */
function recCard(b) {
  const meta = [b.author, b.translator, b.publisher, b.year].filter(Boolean);
  return `
    <button class="word rec" data-book="${esc(b.title)}">
      <p class="rec-title">${esc(b.title)}</p>
      <p class="src">${meta.map((m, i) =>
        `${i ? '<span class="sep"></span>' : ""}<span>${esc(m)}</span>`).join("")}</p>
      ${b.note ? `<p class="rec-note">${esc(b.note)}</p>` : ""}
    </button>`;
}

function openBook(title) {
  const b = bookByTitle(title);
  if (!b) return;
  const qs = questionsAbout(title);
  showDialog(`
    <h2 class="d-title">${esc(b.title)}</h2>
    <p class="d-author">${esc(b.author)}</p>
    <div class="d-meta">
      ${b.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}
    </div>
    ${b.quotes.length ? `
      <div class="d-sec"><span class="label">言葉</span>
        <div class="quotes">${b.quotes.map(q => {
          const { text, page } = quoteOf(q);
          return `<blockquote>${esc(text)}${page ? `<cite>${esc(page)}</cite>` : ""}</blockquote>`;
        }).join("")}</div>
      </div>` : ""}
    <div class="d-sec"><span class="label">出典</span>
      <p class="d-cite">${esc(citation(b))}</p>
    </div>
    ${b.note ? `<div class="d-sec"><span class="label">メモ</span><p class="d-note">${esc(b.note)}</p></div>` : ""}
    ${qs.length ? `
      <div class="d-sec"><span class="label">この本から出た問い</span>
        <ul class="d-list">${qs.map(q =>
          `<li><a href="questions.html#q=${encodeURIComponent(q.id)}">${esc(q.q)}</a></li>`).join("")}</ul>
      </div>` : ""}
    ${b.shared ? `
      <div class="d-sec"><span class="label">外部の記事</span>
        <a class="link-chip" href="${esc(b.shared)}" target="_blank" rel="noopener">こちらでも書いています →</a>
      </div>` : ""}`);
}

function renderBooks() {
  const shelf = document.getElementById("shelf");
  const filters = document.getElementById("filters");
  let active = "すべて";

  const tags = ["すべて", ...new Set(books.flatMap(b => b.tags)), "書籍"];
  filters.innerHTML = tags.map(t =>
    `<button class="chip" data-tag="${esc(t)}" aria-pressed="${t === active}">${esc(t)}</button>`).join("");

  filters.addEventListener("click", e => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    active = btn.dataset.tag;
    filters.querySelectorAll(".chip").forEach(c =>
      c.setAttribute("aria-pressed", String(c.dataset.tag === active)));
    draw();
  });

  function draw() {
    if (active === "書籍") {
      const recs = books.filter(b => b.recommend)
        .sort((a, b) => b.read.localeCompare(a.read));
      shelf.innerHTML = recs.length
        ? `<div class="words rec-list">${recs.map(recCard).join("")}</div>`
        : `<p class="empty">まだありません。</p>`;
      return;
    }

    const list = books
      .filter(b => b.quotes.length)
      .filter(b => active === "すべて" || b.tags.includes(active))
      .sort((a, b) => b.read.localeCompare(a.read));
    const years = [...new Set(list.map(b => b.read.slice(0, 4)))];

    shelf.innerHTML = years.map(y => {
      const inYear = list.filter(b => b.read.startsWith(y));
      return `
        <div class="year-group">
          <div class="year-head"><span>${y}</span><i></i><span>${inYear.length}冊</span></div>
          <div class="words">${inYear.map(wordCard).join("")}</div>
        </div>`;
    }).join("");
  }

  draw();
}

/* ---------- 問い ---------- */

function relRow(q) {
  const kids = childrenOf(q.id);
  const rows = [];
  if (q.from) rows.push(`<span><b>出自</b><span class="t">${esc(qById(q.from).q)}</span></span>`);
  if (kids.length) rows.push(`<span><b>派生</b><span class="t">この問いから ${kids.length} 件</span></span>`);
  if (q.book) rows.push(`<span><b>本</b><span class="t">${esc(q.book)}</span></span>`);
  return rows.length ? `<div class="rel">${rows.join("")}</div>` : "";
}

function qCard(q) {
  return `
    <button class="qcard" data-q="${esc(q.id)}">
      <span class="meta">
        <span>${jp(q.date)}</span>
      </span>
      <p class="q">${esc(q.q)}</p>
      ${relRow(q)}
    </button>`;
}

function openQ(id) {
  const q = qById(id);
  if (!q) return;
  const kids = childrenOf(id);
  showDialog(`
    <p class="d-q">${esc(q.q)}</p>
    <div class="d-meta">${jp(q.date)}${q.where ? " / " + esc(q.where) : ""}</div>
    ${q.note ? `<div class="d-sec"><span class="label">メモ</span><p class="d-note">${esc(q.note)}</p></div>` : ""}
    ${q.from ? `
      <div class="d-sec"><span class="label">この問いのもとになった問い</span>
        <ul class="d-list"><li><button data-q="${esc(q.from)}">${esc(qById(q.from).q)}</button></li></ul>
      </div>` : ""}
    ${kids.length ? `
      <div class="d-sec"><span class="label">ここから出てきた問い</span>
        <ul class="d-list">${kids.map(k =>
          `<li><button data-q="${esc(k.id)}">${esc(k.q)}</button></li>`).join("")}</ul>
      </div>` : ""}
    ${q.book ? `
      <div class="d-sec"><span class="label">きっかけになった本</span>
        <a class="link-chip" href="books.html#b=${encodeURIComponent(q.book)}">${esc(q.book)} →</a>
      </div>` : ""}`);
}

function branch(id) {
  const kids = childrenOf(id);
  if (!kids.length) return "";
  return `<ul class="branch">${kids.map(k => `
    <li>
      <button class="node" data-q="${esc(k.id)}">${esc(k.q)}<span class="d">${jp(k.date)}</span></button>
      ${branch(k.id)}
    </li>`).join("")}</ul>`;
}

function renderQuestions() {
  const body = document.getElementById("qbody");
  let view = "time";

  function draw() {
    if (view === "time") {
      const list = [...questions].sort((a, b) => b.date.localeCompare(a.date));
      body.innerHTML = `<div class="wall">${list.map(qCard).join("")}</div>`;
    } else {
      const rs = rootQuestions();
      const loose = questions.filter(q => !q.from && !childrenOf(q.id).length);
      body.innerHTML = `
        <div class="tree">
          ${rs.map(r => `
            <div>
              <button class="root-q" data-q="${esc(r.id)}">${esc(r.q)}</button>
              <div class="root-meta">${jp(r.date)} — ここから ${descendants(r.id)} 件</div>
              ${branch(r.id)}
            </div>`).join("")}
          ${loose.length ? `
            <div class="loose">
              <span class="label">まだ どこにも つながっていない問い</span>
              <ul>${loose.map(q =>
                `<li><button class="node" data-q="${esc(q.id)}">${esc(q.q)}<span class="d">${jp(q.date)}</span></button></li>`
              ).join("")}</ul>
            </div>` : ""}
        </div>`;
    }
  }

  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
    view = t.dataset.view;
    document.querySelectorAll(".tab").forEach(x =>
      x.setAttribute("aria-pressed", String(x.dataset.view === view)));
    draw();
  }));

  draw();
}

/* ---------- 今日の問い ---------- */

let todayId = null;
function pickToday() {
  const pool = questions.filter(q => q.id !== todayId);
  const q = pool[Math.floor(Math.random() * pool.length)];
  todayId = q.id;
  const el = document.getElementById("today-q");
  el.textContent = q.q;
  el.dataset.q = q.id;
  document.getElementById("today-foot").textContent =
    `${jp(q.date)}${q.where ? " / " + q.where : ""}`;
}

function mountToday() {
  const btn = document.getElementById("reroll");
  if (btn) btn.addEventListener("click", pickToday);
  pickToday();
}

/* ---------- 今日の言葉 ---------- */

const allQuotes = () =>
  books.flatMap(b => b.quotes.map(q => ({ text: quoteOf(q).text, book: b })));

let todayWord = null;
function pickTodayWord() {
  const pool = allQuotes().filter(w => w.text !== todayWord);
  if (!pool.length) return;
  const w = pool[Math.floor(Math.random() * pool.length)];
  todayWord = w.text;
  const el = document.getElementById("today-word");
  el.textContent = w.text;
  el.dataset.book = w.book.title;
  document.getElementById("today-word-foot").textContent =
    `${w.book.author}『${w.book.title}』`;
}

function mountTodayWord() {
  const btn = document.getElementById("reroll-word");
  if (btn) btn.addEventListener("click", pickTodayWord);
  pickTodayWord();
}

/* ---------- コラム ---------- */

const columnById = id => columns.find(c => c.id === id);

function renderColumns() {
  const el = document.getElementById("columns");
  if (!el) return;

  const h = decodeURIComponent(location.hash.slice(1));
  const one = h.startsWith("c=") ? columnById(h.slice(2)) : null;

  if (one) {
    el.innerHTML = `
      <article class="article">
        <p class="a-date">${jp(one.date)}</p>
        <h1 class="a-title">${esc(one.title)}</h1>
        ${one.body.map(p => `<p>${esc(p)}</p>`).join("")}
        <p class="a-back"><a href="columns.html">← コラム一覧へ</a></p>
      </article>`;
    window.scrollTo(0, 0);
  } else if (!columns.length) {
    el.innerHTML = `<p class="empty">準備中です。</p>`;
  } else {
    el.innerHTML = `
      <ul class="cols">${[...columns]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(c => `
          <li>
            <span class="d">${jp(c.date)}</span>
            <span class="t">
              <a href="columns.html#c=${encodeURIComponent(c.id)}">${esc(c.title)}</a>
              <span class="lead">${esc(c.lead || (c.body[0] || "").slice(0, 60))}</span>
            </span>
          </li>`).join("")}</ul>`;
  }
}

/* ---------- ニュース ---------- */

function renderNews() {
  const el = document.getElementById("news");
  if (!el) return;
  el.innerHTML = `<ul class="news">${[...news]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(n => `
      <li>
        <span class="d">${jp(n.date)}</span>
        <span class="t">${n.link ? `<a href="${esc(n.link)}">${esc(n.text)}</a>` : esc(n.text)}</span>
      </li>`).join("")}</ul>`;
}

/* ---------- ホーム ---------- */

function renderHome() {
  mountToday();
  mountTodayWord();
  renderNews();
}

/* ---------- プロフィール ---------- */

function renderAbout() {
  document.getElementById("about-name").textContent = SITE.owner;
  const roleEl = document.getElementById("about-role");
  roleEl.textContent = SITE.role;
  roleEl.hidden = !SITE.role;
  document.getElementById("about-body").innerHTML =
    SITE.about.map((p, i) => `<p class="${i === 0 ? "lead" : ""}">${esc(p)}</p>`).join("");
  document.getElementById("about-site").textContent = SITE.siteAbout;
  document.getElementById("about-links").innerHTML =
    SITE.links.map(l => `
      <dt>${esc(l.label)}</dt>
      <dd>${l.href ? `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.text)}</a>` : esc(l.text)}</dd>`
    ).join("");
}

/* ---------- 全ページ共通のクリック処理 ---------- */

document.addEventListener("click", e => {
  const b = e.target.closest("[data-book]");
  if (b) { openBook(b.dataset.book); return; }
  const q = e.target.closest("[data-q]");
  if (q) { openQ(q.dataset.q); }
});

/* 他のページから飛んできたとき、その本／問いを開く */
function openFromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("b=")) openBook(h.slice(2));
  if (h.startsWith("q=")) openQ(h.slice(2));
  if (document.getElementById("columns")) renderColumns();
}
window.addEventListener("hashchange", openFromHash);
