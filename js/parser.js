// js/parser.js - Stack-Based Chemical Formula Parser for MolCraft

import { isValidElement } from './elements.js';

// Convert unicode subscripts to normal digits 
function normalizeSubscripts(str) {
    const subMap = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'};
    return str.replace(/[₀-₀]/g, match => subMap[match]);
}

// Parse a single chemical formula segment (without hydrate dots)
function parseSegment(formula) {
    let cleaned = normalizeSubscripts(formula.trim());
    let stack = [{}];
    let i = 0;

    // Regex to match symbols, brackets, and trailing numbers
    // Matches: open/close brackets, element symbols ([A-Z][a-z]?), and optional numbers
    while (i < cleaned.length){
        let char = cleaned[i];
        if (char === '(' || char === '[') {
            stack.push({});
            i++;
        } else if (char === ')' || char === ']') {
            i++;
            // Parse trailing number after closing bracket
            let numStr = '';
            while (i < cleaned.length && /[0-9]/.test(cleaned[i])) {
                numStr += cleaned[i];
                i++;
            }
            let multiplier = numStr === '' ? 1 : parseInt(numStr, 10);            
        if (stack.length <= 1) {
            throw new Error(`Unmatched closing bracket in formula: ${formula}`);
        }
        let poppedMap = stack.pop();
        let topMap = stack[stack.length - 1];

        for (let [el, count] of Object.entries(poppedMap)) {
            topMap[el] = (topMap[el] || 0) + count * multiplier;
        }
        } else if (/[A-Z]/.test(char)) {
            //Parse element symbol (1 r 2 letters)
            let symbol = char;
            i++;
            if (i < cleaned.length && /[a-z]/.test(cleaned[i])) {
                symbol += cleaned[i];
                i++;
            }
            if (!isValidElement(symbol)) {
                throw new error(`Invalid or unknown element symbol: "${symbol}" in formula: ${formula}`);
            }
            // parse trailing number for element
            let numStr = '';
            while (i < cleaned.length && /[0-9]/.test(cleaned[i])) {
                numStr += cleaned[i];
                i++;
            }
            let count = numStr === '' ? 1 : parseInt(numStr, 10);
            let topMap = stack[stack.length - 1];
            topMap[symbol] = (topMap[symbol] || 0) + count;
        } else {
            throw new Error(`Unexpected character "${char}" in formula; ${formula}`);
        }
    }
    if (stack.length !==1) {
        throw new Error(`Unclosed bracket in formula: ${formula}`);
    }
    return stack[0];
}

// Main parser function supporting hydrates (eg., CuSO4.5H2O)
export function parseFormula(formula) {
    if (!formula || typeof formula !== 'string') {
        throw new Error("Formula must be a valid non-empty string.");
    }

    // Split by hydrate separators (., ·, *)
    let hydrateParts = formula.split(/[\.·*]/);
    let totalAtoMap = {};
    for (let index = 0; index < hydrateParts.length; index++) {
        let part = hydrateParts[index].trim();
        if (!part) continue;

        //check if this hydrate part has a leading coefficient (eg., "5H20")
        let match = part.match(/^([0-9]+)(.+)$/);
        let hydrateMultiplier = 1;
        let chemicalPart = part;

        if (match) {
            hydrateMultiplier = parseInt(match[1], 10);
            chemicalPart = match[2].trim();
        }
        let segmentMap = parseSegment(chemicalPart);
        
        // Merge into total atom map
        for (let [el, count] of Object.entries(segmentMap)) {
            totalAtoMap[el] = (totalAtoMap[el] || 0) + count * hydrateMultiplier;
        }
    }
    return totalAtoMap;
}