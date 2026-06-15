const EXAMPLE_CASE = "Pelaku mengambil motor korban di parkiran minimarket tanpa izin. Korban melapor karena motor hilang. Saksi melihat pelaku membawa motor tersebut dan menjualnya kepada orang lain.";
const API_BASE_URL = String(window.JUSTIKA_API_BASE_URL || "").replace(/\/+$/, "");

function apiEndpoint(path) {
    return `${API_BASE_URL}${path}`;
}

const form = document.querySelector("#analysis-form");
const fillExampleButton = document.querySelector("#fill-example");
const clearButton = document.querySelector("#clear-button");
const submitButton = document.querySelector("#submit-button");
const caseText = document.querySelector("#case-text");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");
const errorState = document.querySelector("#error-state");
const resultState = document.querySelector("#result-state");
const decisionCard = document.querySelector("#decision-card");
const analysisPanel = document.querySelector("#tab-analysis");
const sourcesPanel = document.querySelector("#tab-sources");

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
    let out = escapeHtml(value);
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    return out;
}

function renderMarkdown(markdown) {
    const lines = String(markdown || "").split(/\r?\n/);
    const html = [];
    let inList = false;

    function closeList() {
        if (inList) {
            html.push("</ul>");
            inList = false;
        }
    }

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line.trim()) {
            closeList();
            continue;
        }
        if (line.startsWith("### ")) {
            closeList();
            html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
        } else if (line.startsWith("## ")) {
            closeList();
            html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
        } else if (line.startsWith("# ")) {
            closeList();
            html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
        } else if (line.startsWith("> ")) {
            closeList();
            html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
        } else if (/^[-*]\s+/.test(line)) {
            if (!inList) {
                html.push("<ul>");
                inList = true;
            }
            html.push(`<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`);
        } else if (/^\d+\.\s+/.test(line)) {
            closeList();
            html.push(`<p>${inlineMarkdown(line)}</p>`);
        } else {
            closeList();
            html.push(`<p>${inlineMarkdown(line)}</p>`);
        }
    }
    closeList();
    return `<div class="markdown-body">${html.join("")}</div>`;
}

function statusClass(code) {
    const value = String(code || "").toLowerCase();
    if (value === "danger") return "status-danger";
    if (value === "warn") return "status-warn";
    return "status-ok";
}

function setState(state) {
    emptyState.classList.toggle("hidden", state !== "empty");
    loadingState.classList.toggle("hidden", state !== "loading");
    errorState.classList.toggle("hidden", state !== "error");
    resultState.classList.toggle("hidden", state !== "result");
    submitButton.disabled = state === "loading";
    submitButton.textContent = state === "loading" ? "Menganalisis..." : "Analisis Sekarang";
}

function renderDecision(decision) {
    if (!decision) {
        decisionCard.innerHTML = "";
        return;
    }
    const label = decision.label || "-";
    const candidate = decision.citation || "-";
    decisionCard.innerHTML = `
        <div class="decision-hero ${statusClass(decision.severity)}">
            <span>Keputusan Awal</span>
            <h2>${escapeHtml(label)}</h2>
            <p>Dasar hukum utama: <strong>${escapeHtml(candidate)}</strong></p>
        </div>
    `;
}

function renderChecklist(checklist) {
    if (!Array.isArray(checklist) || checklist.length === 0) return "";
    const rows = checklist.slice(0, 12).map((item) => `
        <tr>
            <td>${escapeHtml(item.text || "-")}</td>
            <td>${escapeHtml(item.status || "-")}</td>
        </tr>
    `).join("");
    return `
        <table>
            <thead>
                <tr>
                    <th>Unsur</th>
                    <th>Penilaian Awal</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderSubArticles(subArticles, fallbackText = "") {
    if (!Array.isArray(subArticles) || subArticles.length === 0) {
        const focus = String(fallbackText || "").replace(/\s+/g, " ").trim();
        return `
            <h3>Fokus Isi Pasal</h3>
            <p>${escapeHtml(focus || "Isi pasal menjadi rujukan utama untuk dicocokkan dengan kronologi.")}</p>
        `;
    }
    const rows = subArticles.slice(0, 6).map((item) => `
        <li>
            <b>${escapeHtml(item.label || "Subpasal")}</b>
            <span>${escapeHtml(item.text || "-")}</span>
        </li>
    `).join("");
    return `
        <h3>Subpasal / Ayat Terkait</h3>
        <ul class="subarticle-list">${rows}</ul>
    `;
}

function renderSources(sources) {
    if (!Array.isArray(sources) || sources.length === 0) {
        sourcesPanel.innerHTML = "<p>Belum ada dasar hukum utama yang dapat ditampilkan.</p>";
        return;
    }
    sourcesPanel.innerHTML = sources.slice(0, 3).map((source, index) => {
        const citation = source.citation || "Sumber tanpa citation";
        const penalty = source.penalty_text
            ? `<h3>Ancaman pidana dalam pasal</h3><pre>${escapeHtml(source.penalty_text)}</pre>`
            : "";
        return `
            <article class="source-card ${index === 0 ? "open" : ""}">
                <div class="source-summary" role="button" tabindex="0">
                    <b>${escapeHtml(source.role || (index === 0 ? "Utama" : "Pendukung"))}: ${escapeHtml(citation)}</b>
                    <span>lihat dasar hukum</span>
                </div>
                <div class="source-body">
                    <p>${escapeHtml(source.law_title || "Judul peraturan tidak tersedia")}</p>
                    ${renderSubArticles(source.sub_articles, source.focus_text || source.text_preview)}
                    <pre>${escapeHtml(source.text_preview || "")}</pre>
                    ${penalty}
                    ${renderChecklist(source.element_checklist)}
                </div>
            </article>
        `;
    }).join("");

    document.querySelectorAll(".source-summary").forEach((summary) => {
        summary.addEventListener("click", () => {
            summary.closest(".source-card").classList.toggle("open");
        });
        summary.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                summary.closest(".source-card").classList.toggle("open");
            }
        });
    });
}

function renderResult(result) {
    renderDecision(result.decision);
    analysisPanel.innerHTML = renderMarkdown(result.answer || "");
    renderSources(result.sources || []);
    setState("result");
}

function activateTab(name) {
    document.querySelectorAll(".tab-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === name);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${name}`);
    });
}

document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
});

fillExampleButton?.addEventListener("click", () => {
    caseText.value = EXAMPLE_CASE;
    caseText.focus();
});

clearButton?.addEventListener("click", () => {
    form.reset();
    caseText.value = "";
    activateTab("analysis");
    setState("empty");
});

form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const payload = {
        case_text: String(data.get("case_text") || ""),
        provider: "gemini",
        top_k: Number(data.get("top_k") || 5),
        decision_mode: Boolean(data.get("decision_mode")),
    };

    if (!payload.case_text.trim()) {
        errorState.textContent = "Masukkan kronologi/fakta terlebih dahulu.";
        setState("error");
        return;
    }

    setState("loading");
    activateTab("analysis");

    try {
        const response = await fetch(apiEndpoint("/api/analyze"), {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        });
        const body = await response.json();
        if (!response.ok || !body.ok) {
            throw new Error(body.error || "Analisis gagal.");
        }
        renderResult(body.result);
    } catch (error) {
        errorState.textContent = error.message || "Analisis gagal.";
        setState("error");
    }
});
