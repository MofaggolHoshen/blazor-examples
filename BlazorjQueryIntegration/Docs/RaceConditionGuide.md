# Understanding Race Conditions in Blazor + JavaScript Integration

## Table of Contents
- [What is a Race Condition?](#what-is-a-race-condition)
- [The Problem: Blazor vs JavaScript DOM Access](#the-problem-blazor-vs-javascript-dom-access)
- [Race Condition Scenario: The Delete Operation](#race-condition-scenario-the-delete-operation)
- [Visual Explanation](#visual-explanation)
- [The Wrong Approach: RaceConditionDemo](#the-wrong-approach-raceconditiondemo)
- [Why This Fails](#why-this-fails)
- [The Correct Approach](#the-correct-approach)
- [Key Takeaways](#key-takeaways)
- [Best Practices](#best-practices)

---

## What is a Race Condition?

A **race condition** occurs when two or more operations execute concurrently and compete to access/modify the same resource, and the final outcome depends on the unpredictable timing of their execution. In the context of Blazor + JavaScript integration, this happens when:

1. **Blazor's rendering engine** tries to update the DOM
2. **JavaScript code** tries to manipulate the same DOM elements
3. Both happen **simultaneously** or in unpredictable order

The result? DOM corruption, null reference errors, visual glitches, or complete component failure.

---

## The Problem: Blazor vs JavaScript DOM Access

### Blazor's Rendering Model
```
User Action → Update Component State → StateHasChanged() → Queue Render → Render DOM
                                              ↓
                                      ASYNCHRONOUS OPERATION
                                      (doesn't wait for completion)
```

**Critical Understanding:**
- `StateHasChanged()` **schedules** a render but **returns immediately**
- The actual DOM update happens **later** on the render queue
- This is asynchronous and non-blocking

### JavaScript's Direct DOM Manipulation
```
JS Interop Call → document.getElementById() → Immediate DOM Manipulation
                              ↓
                    SYNCHRONOUS OPERATION
                    (executes immediately)
```

### The Conflict Zone
```
Timeline of Race Condition:
┌────────────────────────────────────────────────────────────┐
│ T0: User clicks Delete                                     │
│ T1: items.RemoveAll(x => x.Id == id)  [C# removes item]  │
│ T2: StateHasChanged()  [Queues render, returns INSTANTLY] │
│ T3: jsModule.InvokeVoidAsync("deleteElement")  [JS runs]  │
│                                                            │
│     Meanwhile... Blazor's render queue:                    │
│ T2.5: Blazor starts removing <div> from DOM               │
│                                                            │
│     COLLISION! Both manipulating same DOM element:         │
│     - Blazor: Removing <div id="item-3">                  │
│     - JavaScript: document.getElementById("item-3").remove│
│                                                            │
│ Result: "Cannot read properties of null (reading          │
│          'removeChild')" or element removed twice          │
└────────────────────────────────────────────────────────────┘
```

---

## Race Condition Scenario: The Delete Operation

Let's examine the problematic code from `RaceConditionDemo.razor`:

```csharp
// ❌ THIS CAUSES RACE CONDITION
private async Task DeleteItem(int id)
{
    // STEP 1: Remove from C# collection
    items.RemoveAll(x => x.Id == id);
    
    // STEP 2: Tell Blazor to re-render (schedules, doesn't wait!)
    StateHasChanged();
    
    // STEP 3: Tell JavaScript to remove the element (executes immediately!)
    if (jsModule != null)
    {
        await jsModule.InvokeVoidAsync("deleteElement", $"item-{id}");
    }
}
```

### JavaScript Side
```javascript
// RaceConditionDemo.razor.js
export function deleteElement(elementId) {
    document.getElementById(elementId)?.remove();
}
```

---

## Visual Explanation

### Scenario: User Clicks "Delete" on Item #3

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE DELETE                                │
├─────────────────────────────────────────────────────────────────┤
│  Browser DOM:                  C# State:                        │
│  <div id="item-1">             items = [                        │
│    John Doe                      { Id: 1, Name: "John Doe" },   │
│  </div>                          { Id: 2, Name: "Jane Smith" }, │
│  <div id="item-2">               { Id: 3, Name: "Bob Johnson" } │
│    Jane Smith                  ]                                │
│  </div>                                                         │
│  <div id="item-3">                                              │
│    Bob Johnson ← [DELETE]                                       │
│  </div>                                                         │
└─────────────────────────────────────────────────────────────────┘
```

### ❌ The Race Condition Timeline

```
┌──────────────────────────────────────────────────────────────────┐
│  TIME    │  C# THREAD         │  RENDER QUEUE      │  JS THREAD  │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T0      │ User clicks        │                    │             │
│          │ Delete             │                    │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T1      │ items.RemoveAll()  │                    │             │
│          │ (item 3 removed    │                    │             │
│          │  from list)        │                    │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T2      │ StateHasChanged()  │ RENDER QUEUED      │             │
│          │ ↓ returns          │ (waiting to run)   │             │
│          │ immediately!       │                    │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T3      │ JS interop call    │ Starting render... │ Gets call   │
│          │ await Invoke...    │ Diffing DOM...     │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T4      │                    │ Removing <div      │ Looking for │
│          │                    │  id="item-3">      │ item-3 in   │
│          │                    │ ← Blazor touching  │ DOM...      │
│          │                    │    the element     │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T5      │                    │ Calling DOM        │ Calling     │
│          │                    │ .removeChild()     │ .remove()   │
│          │         ⚠️  COLLISION - BOTH MANIPULATING SAME NODE    │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T6      │                    │ 💥 ERROR:          │             │
│          │                    │ "Cannot read       │             │
│          │                    │  properties of     │             │
│          │                    │  null (reading     │             │
│          │                    │  'removeChild')"   │             │
└──────────┴────────────────────┴────────────────────┴─────────────┘
```

### What's Happening?

1. **T1-T2**: Item removed from C# list, render scheduled
2. **T2-T3**: `StateHasChanged()` returns immediately (non-blocking)
3. **T3**: JavaScript interop is called while render is still queued
4. **T4-T5**: **RACE BEGINS**
   - Blazor's diff algorithm: "Item 3 is gone from list, remove its `<div>`"
   - JavaScript: "Remove `<div id='item-3'>`"
   - Both try to remove the same DOM node
5. **T6**: One succeeds, the other finds `null` → **ERROR**

---

## The Wrong Approach: RaceConditionDemo

### Component Code Analysis

```csharp
@page "/race-condition-demo"
@rendermode InteractiveServer
@inject IJSRuntime JS
@implements IAsyncDisposable

<div class="container mt-4">
    <h2>Race Condition Demo: Delete Operation</h2>
    <p class="text-muted">Click delete buttons rapidly to trigger race condition</p>

    @foreach(var item in items)
    {
        var id = $"item-{item.Id}";
        <div id=@id class="d-flex justify-content-between align-items-center mb-2">
            <span>@item.Name</span>
            <button class="btn btn-danger btn-sm" @onclick="() => DeleteItem(item.Id)">
                Delete
            </button>
        </div>
    }
</div>

@code {
    private IJSObjectReference? jsModule;
    private List<DataItem> items = new();

    // ❌ PROBLEMATIC METHOD
    private async Task DeleteItem(int id)
    {
        // Remove item from list
        items.RemoveAll(x => x.Id == id);
        
        // ❌ PROBLEM: StateHasChanged() doesn't wait!
        StateHasChanged();  // Queues render, returns immediately
        
        // ❌ PROBLEM: JavaScript runs while Blazor is rendering
        if (jsModule != null)
        {
            await jsModule.InvokeVoidAsync("deleteElement", $"item-{id}");
        }
    }
}
```

---

## Why This Fails

### Issue #1: StateHasChanged() is Non-Blocking
```csharp
StateHasChanged();  // ← Doesn't wait for render to complete!
// Code continues immediately...
await jsModule.InvokeVoidAsync("deleteElement", $"item-{id}");  // ← Runs too early!
```

**The Misconception:**
```
❌ What developers think happens:
   StateHasChanged() → Wait for render → DOM updated → Continue

✅ What actually happens:
   StateHasChanged() → Queue render → Return immediately → Continue
                            ↓
                    (Render happens later in background)
```

### Issue #2: Rapid Clicks Amplify the Problem
```
User clicks Delete multiple times quickly:
┌────────────────────────────────────────────────┐
│ Click 1 → DeleteItem(1) → Queue render + JS   │
│ Click 2 → DeleteItem(2) → Queue render + JS   │
│ Click 3 → DeleteItem(3) → Queue render + JS   │
│                                                │
│ Result: 3 renders + 3 JS calls all happening  │
│         simultaneously = CHAOS                 │
└────────────────────────────────────────────────┘
```

### Issue #3: The @foreach Rebuild
When Blazor re-renders the `@foreach` loop:
```csharp
@foreach(var item in items)  // ← Blazor rebuilds this entire section
{
    // If JavaScript already removed an element,
    // Blazor's diff algorithm gets confused
}
```

**DOM Diff Conflict:**
```
Expected DOM (Blazor's view):      Actual DOM (after JS):
<div id="item-1">...</div>         <div id="item-1">...</div>
<div id="item-2">...</div>         <div id="item-2">...</div>
<div id="item-3">...</div>  ←──────  MISSING! (JS removed it)

Blazor: "I need to remove item-3"
Reality: "It's already gone"
Result: Error trying to remove null
```

---

## The Correct Approach

### Solution Pattern: Use OnAfterRenderAsync

```csharp
private bool pendingDeletion = false;
private int itemToDelete = 0;

// ✅ CORRECT: Schedule JavaScript for after render
private async Task DeleteItem(int id)
{
    // STEP 1: Update state
    items.RemoveAll(x => x.Id == id);
    
    // STEP 2: Set flag to indicate JavaScript needs to run
    pendingDeletion = true;
    itemToDelete = id;
    
    // STEP 3: Queue render (returns immediately)
    StateHasChanged();
    
    // JavaScript will be called in OnAfterRenderAsync
    // AFTER Blazor finishes rendering
}

// ✅ Called AFTER Blazor completes DOM updates
protected override async Task OnAfterRenderAsync(bool firstRender)
{
    if (firstRender)
    {
        jsModule = await JS.InvokeAsync<IJSObjectReference>(
            "import", "./Components/Pages/RaceConditionDemo.razor.js");
    }
    
    // Check if we have pending JavaScript work
    if (pendingDeletion && jsModule != null)
    {
        // NOW it's safe - Blazor finished rendering
        await jsModule.InvokeVoidAsync("deleteElement", $"item-{itemToDelete}");
        
        // Reset flag
        pendingDeletion = false;
    }
}
```

### Timeline with Correct Approach

```
┌──────────────────────────────────────────────────────────────────┐
│  TIME    │  C# THREAD         │  RENDER QUEUE      │  JS THREAD  │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T0      │ User clicks        │                    │             │
│          │ Delete             │                    │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T1      │ items.RemoveAll()  │                    │             │
│          │ Set flag = true    │                    │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T2      │ StateHasChanged()  │ RENDER QUEUED      │             │
│          │ ↓ returns          │                    │             │
│          │ Method ends        │                    │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T3      │ (waiting...)       │ Rendering...       │ (idle)      │
│          │                    │ Diffing DOM...     │             │
│          │                    │ Updating elements  │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T4      │                    │ Render COMPLETE ✓  │             │
│          │                    │ DOM fully updated  │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T5      │ OnAfterRenderAsync │                    │             │
│          │ called             │                    │             │
│          │ Check flag = true  │                    │             │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│  T6      │ Invoke JS          │ (idle)             │ Gets call   │
│          │                    │                    │ Safely      │
│          │                    │                    │ removes     │
│          │                    │                    │ element ✓   │
├──────────┼────────────────────┼────────────────────┼─────────────┤
│          │          ✅ NO COLLISION - SEQUENTIAL EXECUTION        │
└──────────┴────────────────────┴────────────────────┴─────────────┘
```

### Key Difference
```
❌ Wrong:  StateHasChanged() → JS runs immediately → COLLISION

✅ Correct: StateHasChanged() → Wait for render → OnAfterRenderAsync 
           → JS runs safely → NO COLLISION
```

---

## Key Takeaways

### 1. StateHasChanged() is Asynchronous
```csharp
StateHasChanged();  // ← Queues render, doesn't wait
// Code here runs BEFORE render completes ← DANGER ZONE
```

### 2. Use OnAfterRenderAsync for Post-Render JavaScript
```csharp
protected override async Task OnAfterRenderAsync(bool firstRender)
{
    // This runs AFTER DOM is updated
    // Safe to call JavaScript here
}
```

### 3. Flag Pattern for Coordination
```csharp
private bool needsJavaScript = false;

void UserAction()
{
    // Update state
    needsJavaScript = true;
    StateHasChanged();
}

async Task OnAfterRenderAsync(bool firstRender)
{
    if (needsJavaScript)
    {
        // Run JavaScript
        needsJavaScript = false;
    }
}
```

### 4. Sequential Execution Pattern
```
Always ensure sequential execution:
1. Update C# state
2. Set coordination flag
3. Call StateHasChanged() (queues render)
4. Wait (automatically) for render to complete
5. OnAfterRenderAsync executes
6. JavaScript runs safely
```

---

## Best Practices

### ✅ DO
- Use `OnAfterRenderAsync` for post-render JavaScript calls
- Implement flag-based coordination between C# and JavaScript
- Test with rapid user interactions (rapid clicks)
- Handle `JSDisconnectedException` in dispose methods
- Document timing requirements in your code
- Think sequentially: Blazor first, JavaScript second

### ❌ DON'T
- Call JavaScript immediately after `StateHasChanged()`
- Assume `StateHasChanged()` waits for render completion
- Let Blazor and JavaScript manipulate the same DOM simultaneously
- Forget to clean up JavaScript modules in `DisposeAsync()`
- Ignore timing issues that only appear under rapid user interaction
- Skip testing with rapid clicks and concurrent operations

### Testing for Race Conditions
```
1. Rapid clicking: Click buttons 5+ times quickly
2. Network delay: Throttle network in DevTools
3. Slow devices: Test on slower hardware
4. Multiple tabs: Open component in multiple browser tabs
5. Concurrent operations: Trigger multiple operations simultaneously
```

---

## Debugging Tips

### Console Error Indicators
```
Common race condition errors:
• "Cannot read properties of null (reading 'removeChild')"
• "Cannot read properties of undefined"
• "Node was not found in the DOM"
• Visual glitches (elements not removed/added properly)
• Flickering or duplicate elements
```

### Diagnostic Logging
```csharp
private async Task DeleteItem(int id)
{
    Console.WriteLine($"[T0] DeleteItem called for id={id}");
    
    items.RemoveAll(x => x.Id == id);
    Console.WriteLine($"[T1] Item removed from list");
    
    StateHasChanged();
    Console.WriteLine($"[T2] StateHasChanged called (doesn't wait!)");
    
    // ❌ This runs immediately at T2
    if (jsModule != null)
    {
        Console.WriteLine($"[T3] Calling JavaScript (DANGER!)");
        await jsModule.InvokeVoidAsync("deleteElement", $"item-{id}");
    }
}

protected override async Task OnAfterRenderAsync(bool firstRender)
{
    Console.WriteLine($"[T4] OnAfterRenderAsync - DOM is updated");
    // JavaScript should be called here, not in DeleteItem
}
```

Expected output showing race condition:
```
[T0] DeleteItem called for id=3
[T1] Item removed from list
[T2] StateHasChanged called (doesn't wait!)
[T3] Calling JavaScript (DANGER!)  ← Too early!
[T4] OnAfterRenderAsync - DOM is updated  ← Happens after T3!
```

---

## Visual Summary: The Two Approaches

### ❌ Wrong Approach (Race Condition)
```
User Action
    ↓
Update State
    ↓
StateHasChanged() ──→ (Queues render, returns immediately)
    ↓                          ↓
JavaScript Call           Blazor Rendering...
    ↓                          ↓
    └─────── COLLISION! ───────┘
```

### ✅ Correct Approach (No Race Condition)
```
User Action
    ↓
Update State
    ↓
Set Flag = true
    ↓
StateHasChanged() ──→ (Queues render, returns immediately)
    ↓                          ↓
Method Ends                Blazor Rendering...
                              ↓
                          Render Complete
                              ↓
                      OnAfterRenderAsync()
                              ↓
                       Check Flag = true?
                              ↓
                       JavaScript Call
                              ↓
                          SUCCESS ✓
```

---

## Summary

Race conditions in Blazor + JavaScript integration occur when:
1. **StateHasChanged()** is mistakenly treated as blocking
2. JavaScript is called **before** Blazor finishes rendering
3. Both systems try to modify the **same DOM elements**

The solution is **sequential coordination**:
```
C# State Update → StateHasChanged() → Blazor Renders → OnAfterRenderAsync → JavaScript
```

Always remember: **Blazor renders first, JavaScript acts second**.

---

## Related Resources
- [RaceConditionDemo.razor](../Components/Pages/RaceConditionDemo.razor) - Demonstrates the problem
- [Blazor Lifecycle Documentation](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/lifecycle)
- [JavaScript Interop in Blazor](https://learn.microsoft.com/en-us/aspnet/core/blazor/javascript-interoperability)

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-28  
**Author:** Generated documentation for BlazorjQueryIntegration project
