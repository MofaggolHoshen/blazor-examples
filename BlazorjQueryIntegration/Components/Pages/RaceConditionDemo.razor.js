// ============================================
// RACE CONDITION DEMONSTRATION
// ============================================
// This module contains functions that manipulate the DOM to demonstrate
// race conditions between Blazor rendering and JavaScript execution

/**
 * animateBox()
 * Animates a DOM element by adding a CSS class and modifying its content
 * 
 * @param {string} elementId - The ID of the element to animate
 * 
 * Race Condition Scenario:
 * - When called immediately after StateHasChanged(), Blazor may still be updating the DOM
 * - This function tries to read/modify the element while Blazor is also modifying it
 * - Result: Timing conflicts, null references, or unpredictable behavior
 * 
 * Safe Usage:
 * - Call this from OnAfterRenderAsync() AFTER Blazor completes rendering
 * - This ensures the DOM is stable before JavaScript manipulates it
 */
export function animateBox(elementId) {
    console.log(`[JS] animateBox called for: ${elementId} at ${new Date().toISOString()}`);
    
    // STEP 1: Get the DOM element by ID
    // If Blazor is still rendering, this element might be in an inconsistent state
    const element = document.getElementById(elementId);
    
    // STEP 2: Check if element exists
    if (!element) {
        // This can happen in a race condition:
        // - Blazor removed the element
        // - Blazor hasn't added the element yet
        // - Element ID changed during render
        console.error(`[JS] Element '${elementId}' not found! Race condition likely occurred.`);
        throw new Error(`Element '${elementId}' not found - DOM may be inconsistent due to race condition`);
    }

    console.log(`[JS] Element found, starting animation...`);

    // STEP 3: Add animation class
    // This modifies the element's classList
    // If Blazor is simultaneously updating the element, conflicts can occur
    element.classList.add('animate-flash');

    // STEP 4: Modify the DOM directly (simulates jQuery or other DOM manipulation)
    // This is where race conditions become dangerous:
    // - JavaScript is modifying element properties
    // - Blazor may be updating the same properties
    // - Whichever runs last wins, causing flickering or lost updates
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = '#90EE90'; // Light green
    element.style.transition = 'all 0.5s ease';

    // STEP 5: Schedule removal of animation after delay
    setTimeout(() => {
        console.log(`[JS] Animation complete for: ${elementId}`);
        
        // Remove animation class
        element.classList.remove('animate-flash');
        
        // Restore original background
        element.style.backgroundColor = originalBg;
    }, 500);

    console.log(`[JS] Animation triggered for: ${elementId}`);
}

/**
 * simulateHeavyOperation()
 * Simulates a heavy DOM manipulation operation
 * Used to make race conditions more obvious
 * 
 * @param {string} elementId - The ID of the element to manipulate
 */
export function simulateHeavyOperation(elementId) {
    console.log(`[JS] Starting heavy operation on: ${elementId}`);
    
    const element = document.getElementById(elementId);
    if (!element) {
        throw new Error(`Element '${elementId}' not found during heavy operation`);
    }

    // Simulate multiple DOM reads/writes that could conflict with Blazor
    for (let i = 0; i < 100; i++) {
        // Read from DOM
        const currentContent = element.textContent;
        
        // Modify DOM
        element.setAttribute('data-iteration', i.toString());
        
        // This loop makes timing conflicts more likely if Blazor is also updating
    }

    console.log(`[JS] Heavy operation complete for: ${elementId}`);
}

/**
 * getElementState()
 * Returns the current state of an element
 * Used for debugging race conditions
 * 
 * @param {string} elementId - The ID of the element
 * @returns {object} Object with element state information
 */
export function getElementState(elementId) {
    const element = document.getElementById(elementId);
    
    if (!element) {
        return {
            exists: false,
            message: 'Element not found - may indicate race condition'
        };
    }

    return {
        exists: true,
        id: element.id,
        tagName: element.tagName,
        classList: Array.from(element.classList),
        hasChildren: element.children.length > 0,
        innerHTML: element.innerHTML.substring(0, 100) // First 100 chars
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * logTimestamp()
 * Logs a message with precise timestamp for debugging timing issues
 */
function logTimestamp(message) {
    const now = new Date();
    const timestamp = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}.${now.getMilliseconds()}`;
    console.log(`[${timestamp}] ${message}`);
}
