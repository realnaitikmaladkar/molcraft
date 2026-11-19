// js/app.js - UI Events & DOM Rendering for MolCraft

import { ELEMENTS } from './elements.js';
import { parseFormula } from './parser.js';
import { balanceEquation } from './balancer.js';
import { calculateMolarMass, calculateMassPercent, convertUnits } from './stoichiometry.js';

// --- UI Helpers ---
function showError(msg) {
    const banner = document.getElementById('error-banner');
    banner.textContent = msg;
    banner.classList.remove('hidden');
}

function clearError() {
    const banner = document.getElementById('error-banner');
    banner.classList.add('hidden');
}

// Format chemical formula with HTML subscripts (e.g., H2O -> H<sub>2</sub>O)
function formatFormulaHTML(formula) {
    return formula.replace(/([A-Za-z\)\]])([0-9]+)/g, '$1<sub>$2</sub>');
}

// --- Theme Toggle ---
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    html.setAttribute('data-theme', current === 'light' ? 'dark' : 'light');
});

// --- Tab Navigation ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        clearError();
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));

        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    });
});

// --- TAB 1: EQUATION BALANCER ---
const eqInput = document.getElementById('eq-input');
const balanceBtn = document.getElementById('balance-btn');

function classifyReaction(reactants, products) {
    if (reactants.length === 1 && products.length > 1) return "Decomposition";
    if (reactants.length > 1 && products.length === 1) return "Synthesis";
    const rFormulas = reactants.map(r => r.formula);
    const pFormulas = products.map(p => p.formula);
    if (rFormulas.includes('O2') && pFormulas.includes('CO2') && pFormulas.includes('H2O')) {
        return "Combustion";
    }
    if (reactants.length === 2 && products.length === 2) return "Replacement / Redox";
    return "General Chemical Reaction";
}

function handleBalance() {
    clearError();
    const rawEq = eqInput.value.trim();
    if (!rawEq) {
        showError("Please enter a chemical equation to balance.");
        return;
    }

    try {
        const res = balanceEquation(rawEq);

        // Render balanced equation string
        const formatSide = side => side.map(s => {
            const coeff = s.coefficient === 1 ? '' : `${s.coefficient} `;
            return `${coeff}${formatFormulaHTML(s.formula)}`;
        }).join(' + ');

        const balancedHTML = `${formatSide(res.reactants)} &rarr; ${formatSide(res.products)}`;
        document.getElementById('balanced-display').innerHTML = balancedHTML;
        document.getElementById('reaction-type').textContent = `Type: ${classifyReaction(res.reactants, res.products)}`;

        // Atom Conservation Table & Total Mass
        const tbody = document.getElementById('conservation-body');
        tbody.innerHTML = '';

        let totalReactantMass = 0;
        let totalProductMass = 0;

        res.reactants.forEach(r => {
            totalReactantMass += calculateMolarMass(parseFormula(r.formula)) * r.coefficient;
        });
        res.products.forEach(p => {
            totalProductMass += calculateMolarMass(parseFormula(p.formula)) * p.coefficient;
        });

        res.elements.forEach(el => {
            let rCount = 0;
            let pCount = 0;
            res.reactants.forEach(r => {
                const map = parseFormula(r.formula);
                rCount += (map[el] || 0) * r.coefficient;
            });
            res.products.forEach(p => {
                const map = parseFormula(p.formula);
                pCount += (map[el] || 0) * p.coefficient;
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${el}</strong> (${ELEMENTS[el]?.name || el})</td>
                <td>${rCount}</td>
                <td>${pCount}</td>
                <td>✓ Conserved</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('mass-conservation-summary').textContent =
            `Total Mass Conserved: ${totalReactantMass.toFixed(2)} g/mol = ${totalProductMass.toFixed(2)} g/mol`;

        document.getElementById('balance-result').classList.remove('hidden');
    } catch (err) {
        showError(err.message);
        document.getElementById('balance-result').classList.add('hidden');
    }
}

balanceBtn.addEventListener('click', handleBalance);
eqInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') handleBalance();
});

document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        eqInput.value = chip.dataset.eq;
        handleBalance();
    });
});

document.getElementById('copy-eq-btn').addEventListener('click', () => {
    const text = document.getElementById('balanced-display').textContent;
    navigator.clipboard.writeText(text);
});

// --- TAB 2: MOLE & MASS LAB ---
let currentMolarMass = 0;
const formulaInput = document.getElementById('formula-input');
const calcMoleBtn = document.getElementById('calc-mole-btn');

const BAR_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

function analyzeFormula() {
    clearError();
    const formula = formulaInput.value.trim();
    if (!formula) {
        showError("Please enter a chemical formula.");
        return;
    }

    try {
        const atomMap = parseFormula(formula);
        currentMolarMass = calculateMolarMass(atomMap);
        const percentages = calculateMassPercent(atomMap);

        document.getElementById('molar-mass-val').textContent = `${currentMolarMass.toFixed(3)} g/mol`;

        const bar = document.getElementById('mass-percent-bar');
        const tbody = document.getElementById('mass-percent-body');
        bar.innerHTML = '';
        tbody.innerHTML = '';

        Object.entries(atomMap).forEach(([symbol, count], idx) => {
            const pct = percentages[symbol] || 0;
            const contrib = (ELEMENTS[symbol].mass * count).toFixed(3);
            const color = BAR_COLORS[idx % BAR_COLORS.length];

            const segment = document.createElement('div');
            segment.style.width = `${pct}%`;
            segment.style.backgroundColor = color;
            segment.title = `${symbol}: ${pct}%`;
            bar.appendChild(segment);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong style="color:${color}">${symbol}</strong> (${ELEMENTS[symbol].name})</td>
                <td>${count}</td>
                <td>${contrib}</td>
                <td>${pct.toFixed(2)}%</td>
            `;
            tbody.appendChild(tr);
        });

        // Default conversion for 1.000 mol
        updateConverters('moles', 1);
        document.getElementById('mole-result').classList.remove('hidden');
    } catch (err) {
        showError(err.message);
        document.getElementById('mole-result').classList.add('hidden');
    }
}

function updateConverters(sourceType, rawVal) {
    if (currentMolarMass <= 0) return;
    const val = parseFloat(rawVal);
    if (isNaN(val) || val < 0) return;

    const converted = convertUnits(val, sourceType, currentMolarMass);
    if (!converted) return;

    if (sourceType !== 'grams') document.getElementById('conv-grams').value = converted.grams;
    if (sourceType !== 'moles') document.getElementById('conv-moles').value = converted.moles;
    if (sourceType !== 'particles') document.getElementById('conv-particles').value = converted.particles.toExponential(3);
    if (sourceType !== 'liters') document.getElementById('conv-liters').value = converted.liters;
}

calcMoleBtn.addEventListener('click', analyzeFormula);
formulaInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') analyzeFormula();
});

['grams', 'moles', 'particles', 'liters'].forEach(unit => {
    document.getElementById(`conv-${unit}`).addEventListener('input', e => {
        updateConverters(unit, e.target.value);
    });
});

// --- TAB 3: PERIODIC TABLE ---
function renderPeriodicTable() {
    const grid = document.getElementById('periodic-grid');
    const search = document.getElementById('pt-search').value.toLowerCase();
    const filter = document.getElementById('pt-category-filter').value;
    grid.innerHTML = '';

    Object.entries(ELEMENTS).forEach(([symbol, data]) => {
        const matchesSearch = symbol.toLowerCase().includes(search) ||
            data.name.toLowerCase().includes(search) ||
            String(data.number) === search;
        const matchesCat = filter === 'all' || data.category === filter;

        if (!matchesSearch || !matchesCat) return;

        const cell = document.createElement('div');
        cell.className = 'element-cell';
        cell.style.gridColumn = data.group || 'auto';
        cell.style.gridRow = data.period || 'auto';
        cell.innerHTML = `
            <span class="atomic-number">${data.number}</span>
            <span class="symbol">${symbol}</span>
            <span class="mass">${data.mass}</span>
        `;

        cell.addEventListener('click', () => {
            const inspector = document.getElementById('element-inspector');
            inspector.classList.remove('hidden');
            inspector.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <div>
                        <h3>${data.name} (${symbol}) — #${data.number}</h3>
                        <p class="subtitle">Category: ${data.category} | Phase at STP: ${data.phase || 'N/A'}</p>
                        <p class="subtitle">IUPAC Mass: ${data.mass} g/mol | Config: ${data.config || 'N/A'} | Electronegativity: ${data.electronegativity ?? 'N/A'}</p>
                    </div>
                    <button id="send-to-lab-btn" class="btn-primary">Send to Mole Lab</button>
                </div>
            `;
            document.getElementById('send-to-lab-btn').addEventListener('click', () => {
                formulaInput.value = symbol;
                document.querySelector('[data-tab="mole-lab"]').click();
                analyzeFormula();
            });
        });

        grid.appendChild(cell);
    });
}

document.getElementById('pt-search').addEventListener('input', renderPeriodicTable);
document.getElementById('pt-category-filter').addEventListener('change', renderPeriodicTable);
renderPeriodicTable();

// --- TAB 4: QUIZ MODE ---
const QUIZ_BANK = [
    { eq: "H2 + O2 -> H2O", answer: [2, 1, 2] },
    { eq: "N2 + H2 -> NH3", answer: [1, 3, 2] },
    { eq: "CH4 + O2 -> CO2 + H2O", answer: [1, 2, 1, 2] },
    { eq: "Fe + O2 -> Fe2O3", answer: [4, 3, 2] },
    { eq: "KClO3 -> KCl + O2", answer: [2, 2, 3] }
];

let currentQuizIdx = 0;
let streak = 0;

function loadQuiz() {
    const item = QUIZ_BANK[currentQuizIdx % QUIZ_BANK.length];
    const [left, right] = item.eq.split('->');
    const reactants = left.split('+').map(s => s.trim());
    const products = right.split('+').map(s => s.trim());

    let idx = 0;
    const renderTerm = f => {
        const input = `<input type="number" class="quiz-coeff" data-idx="${idx++}" min="1" value="1" style="width:55px; text-align:center; margin-right:4px;">`;
        return `${input}${formatFormulaHTML(f)}`;
    };

    document.getElementById('quiz-equation').innerHTML =
        `${reactants.map(renderTerm).join(' + ')} &rarr; ${products.map(renderTerm).join(' + ')}`;
    document.getElementById('quiz-feedback').textContent = '';
}

document.getElementById('check-quiz-btn').addEventListener('click', () => {
    const item = QUIZ_BANK[currentQuizIdx % QUIZ_BANK.length];
    const inputs = Array.from(document.querySelectorAll('.quiz-coeff')).map(i => parseInt(i.value, 10));
    const isCorrect = inputs.every((val, i) => val === item.answer[i]);

    if (isCorrect) {
        streak++;
        document.getElementById('quiz-streak').textContent = `Streak: ${streak}`;
        document.getElementById('quiz-feedback').textContent = "✓ Correct! Well balanced.";
    } else {
        streak = 0;
        document.getElementById('quiz-streak').textContent = `Streak: ${streak}`;
        document.getElementById('quiz-feedback').textContent = "✗ Not quite — check atom counts on both sides and try again.";
    }
});

document.getElementById('next-quiz-btn').addEventListener('click', () => {
    currentQuizIdx++;
    loadQuiz();
});

loadQuiz();