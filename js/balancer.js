// js/balancer.js - Rational Matrix Equation Balancer for MolCraft

import { parseFormula } from './parser.js';

// Greatest Common Divisor
function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
        let t = b;
        b = a % b;
        a = t;
    }
    return a;
}

// Least Common Multiple
function lcm(a, b) {
    if (a === 0 || b === 0) return 0;
    return Math.abs(a * b) / gcd(a, b);
}

// Simplify a fraction {n, d}
function simplifyFraction(frac) {
    if (frac.n === 0) return { n: 0, d: 1 };
    let common = gcd(frac.n, frac.d);
    let n = frac.n / common;
    let d = frac.d / common;
    if (d < 0) {
        n = -n;
        d = -d;
    }
    return { n, d };
}

// Fraction arithmetic helpers
function addFrac(f1, f2) {
    let commonD = lcm(f1.d, f2.d);
    let n = (f1.n * (commonD / f1.d)) + (f2.n * (commonD / f2.d));
    return simplifyFraction({ n, d: commonD });
}

function subFrac(f1, f2) {
    let commonD = lcm(f1.d, f2.d);
    let n = (f1.n * (commonD / f1.d)) - (f2.n * (commonD / f2.d));
    return simplifyFraction({ n, d: commonD });
}

function mulFrac(f1, f2) {
    return simplifyFraction({ n: f1.n * f2.n, d: f1.d * f2.d });
}

function divFrac(f1, f2) {
    if (f2.n === 0) throw new Error("Division by zero in fraction arithmetic");
    return simplifyFraction({ n: f1.n * f2.d, d: f1.d * f2.n });
}

// Main balancer function taking an equation string like "C3H8 + O2 -> CO2 + H2O"
export function balanceEquation(equationStr) {
    // 1. Split into reactants and products
    let sides = equationStr.split(/->|=/);
    if (sides.length !== 2) {
        throw new Error("Invalid equation format. Must contain '->' or '='.");
    }

    let reactantStrs = sides[0].split('+').map(s => s.trim()).filter(Boolean);
    let productStrs = sides[1].split('+').map(s => s.trim()).filter(Boolean);

    if (reactantStrs.length === 0 || productStrs.length === 0) {
        throw new Error("Equation must have both reactants and products.");
    }

    // 2. Parse all species
    let reactants = reactantStrs.map(s => ({ raw: s, map: parseFormula(s) }));
    let products = productStrs.map(s => ({ raw: s, map: parseFormula(s) }));

    // 3. Collect unique elements across all species
    let elementSet = new Set();
    [...reactants, ...products].forEach(species => {
        Object.keys(species.map).forEach(el => elementSet.add(el));
    });
    let elements = Array.from(elementSet);

    let numRows = elements.length;
    let speciesList = [...reactants, ...products];
    let numCols = speciesList.length;

    // 4. Build stoichiometric matrix A (Reactants +, Products -)
    // Represent every entry as an exact fraction object {n, d}
    let matrix = [];
    for (let r = 0; r < numRows; r++) {
        let row = [];
        let el = elements[r];
        for (let c = 0; c < numCols; c++) {
            let count = 0;
            if (c < reactants.length) {
                count = reactants[c].map[el] || 0;
            } else {
                count = -(products[c - reactants.length].map[el] || 0);
            }
            row.push({ n: count, d: 1 });
        }
        matrix.push(row);
    }

    // 5. Gaussian Elimination / RREF over exact fractions
    let lead = 0;
    for (let r = 0; r < numRows; r++) {
        if (lead >= numCols) break;
        let i = r;
        while (matrix[i][lead].n === 0) {
            i++;
            if (i === numRows) {
                i = r;
                lead++;
                if (lead === numCols) break;
            }
        }
        if (lead === numCols) break;

        // Swap rows r and i
        let temp = matrix[r];
        matrix[r] = matrix[i];
        matrix[i] = temp;

        // Scale pivot row
        let val = matrix[r][lead];
        for (let c = 0; c < numCols; c++) {
            matrix[r][c] = divFrac(matrix[r][c], val);
        }

        // Eliminate other rows
        for (let i = 0; i < numRows; i++) {
            if (i !== r) {
                let factor = matrix[i][lead];
                for (let c = 0; c < numCols; c++) {
                    let subVal = mulFrac(factor, matrix[r][c]);
                    matrix[i][c] = subFrac(matrix[i][c], subVal);
                }
            }
        }
        lead++;
    }

    // 6. Extract coefficients assuming 1-dimensional null space (standard for balanceable equations)
    // Set the last column (free variable) to 1 (or denominator LCM)
    let coeffs = new Array(numCols).fill({ n: 0, d: 1 });
    coeffs[numCols - 1] = { n: 1, d: 1 };

    // Back-substitute or extract from RREF rows
    for (let r = numRows - 1; r >= 0; r--) {
        let pivotCol = -1;
        for (let c = 0; c < numCols; c++) {
            if (matrix[r][c].n !== 0) {
                pivotCol = c;
                break;
            }
        }
        if (pivotCol !== -1) {
            let sum = { n: 0, d: 1 };
            for (let c = pivotCol + 1; c < numCols; c++) {
                let prod = mulFrac(matrix[r][c], coeffs[c]);
                sum = addFrac(sum, prod);
            }
            // coeffs[pivotCol] = -sum (since matrix[r][pivotCol] is 1)
            coeffs[pivotCol] = simplifyFraction({ n: -sum.n, d: sum.d });
        }
    }

    // 7. Find LCM of all coefficient denominators to clear fractions
    let commonDenominator = 1;
    coeffs.forEach(f => {
        commonDenominator = lcm(commonDenominator, f.d);
    });

    let integerCoeffs = coeffs.map(f => (f.n * (commonDenominator / f.d)));

    // Ensure all coefficients are positive integers
    let overallGcd = integerCoeffs.reduce((acc, val) => gcd(acc, val), Math.abs(integerCoeffs[0]));
    if (overallGcd === 0) overallGcd = 1;

    let finalCoeffs = integerCoeffs.map(val => val / overallGcd);

    if (finalCoeffs.some(c => c <= 0)) {
        throw new Error("Could not find a valid positive coefficient balance for this equation.");
    }

    return {
        reactants: reactants.map((r, idx) => ({ formula: r.raw, coefficient: finalCoeffs[idx] })),
        products: products.map((p, idx) => ({ formula: p.raw, coefficient: finalCoeffs[reactants.length + idx] })),
        elements
    };
}