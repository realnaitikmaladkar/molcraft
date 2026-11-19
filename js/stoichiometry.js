// js/stoichiometry.js - Molar Mass, Mass Percent & Unit Conversions for MolCraft

import { ELEMENTS } from './elements.js';

const AVOGADRO = 6.02214076e23;
const STP_MOLAR_VOLUME = 22.414; // L/mol at 0 °C, 1 atm

// 1. Calculate Standard Molar Mass (g/mol) from an atom map
export function calculateMolarMass(atomMap) {
    let molarMass = 0;
    for (let [symbol, count] of Object.entries(atomMap)) {
        if (ELEMENTS[symbol]) {
            molarMass += ELEMENTS[symbol].mass * count;
        }
    }
    return parseFloat(molarMass.toFixed(3));
}

// 2. Calculate Mass Percent Composition for each element
export function calculateMassPercent(atomMap) {
    let totalMass = calculateMolarMass(atomMap);
    if (totalMass === 0) return {};

    let percentages = {};
    for (let [symbol, count] of Object.entries(atomMap)) {
        if (ELEMENTS[symbol]) {
            let elementTotalMass = ELEMENTS[symbol].mass * count;
            percentages[symbol] = parseFloat(((elementTotalMass / totalMass) * 100).toFixed(2));
        }
    }
    return percentages;
}

// 3. Bidirectional converter for Mass, Moles, Particles, and STP Volume
export function convertUnits(value, inputType, molarMass) {
    if (isNaN(value) || value < 0) return null;
    let moles = 0;

    // Step A: Convert input to moles as base unit
    if (inputType === 'grams') {
        if (molarMass <= 0) return null;
        moles = value / molarMass;
    } else if (inputType === 'moles') {
        moles = value;
    } else if (inputType === 'particles') {
        moles = value / AVOGADRO;
    } else if (inputType === 'liters') {
        moles = value / STP_MOLAR_VOLUME;
    } else {
        return null;
    }

    // Step B: Derive all other units from moles
    return {
        grams: parseFloat((moles * molarMass).toFixed(4)),
        moles: parseFloat(moles.toFixed(4)),
        particles: moles * AVOGADRO,
        liters: parseFloat((moles * STP_MOLAR_VOLUME).toFixed(4))
    };
}