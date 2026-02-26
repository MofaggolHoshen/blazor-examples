# 🎓 Blazor + JavaScript Race Condition: Complete Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [How to Reproduce](#how-to-reproduce)
3. [The Problem Explained](#the-problem-explained)
4. [Visual Diagrams](#visual-diagrams)
5. [Code Examples](#code-examples)
6. [The Solution](#the-solution)
7. [Best Practices](#best-practices)

---

## Overview

### What is a Race Condition?

A **race condition** occurs when two operations try to access/modify the same resource simultaneously, and the outcome depends on the timing of their execution.

In Blazor + JavaScript integration:
- **Blazor**: Updates the DOM through its rendering pipeline
- **JavaScript**: Directly manipulates the DOM
- **Conflict**: Both try to modify the same elements at the same time

### Common Symptoms:
- ❌ `TypeError: Cannot read properties of null (reading 'removeChild')`
- ❌ `TypeError: Cannot read properties of undefined`
- ❌ Elements flicker or disappear
- ❌ Animations skip or behave erratically
- ❌ Content gets overwritten unexpectedly

---

## How to Reproduce

### Using the Demo Component

1. **Navigate** to `/race-condition-demo` in your browser
2. **Open browser console** (F12 → Console tab)
3. **Click "Run Wrong Approach"** button
4. **Observe**:
   - Check console for timing logs
   - Watch for errors
   - Notice any flickering or inconsistent behavior
5. **Compare** with "Run Correct Approach" button
6. **Repeat** multiple times to see the race condition manifest

### Manual Reproduction in Any Component

```csharp
// ❌ This code will likely cause a race condition:

private async Task ButtonClick()
{
    myData = "New Value";
    StateHasChanged();                        // Schedules render (non-blocking)
    await jsModule.InvokeVoidAsync("animate"); // ❌ Runs before render completes!
}
```

**Expected behavior**: After 3-5 clicks, you'll encounter DOM manipulation errors or see flickering.

---

## The Problem Explained

### The Misconception

Many developers assume `StateHasChanged()` works like this:

```csharp
StateHasChanged();  // ❌ WRONG: Thinking it waits for render
// Render is complete here
await JS.InvokeVoidAsync("doSomething"); // Safe, right?
```

### The Reality

`StateHasChanged()` actually works like this:

```csharp
StateHasChanged();  // ✓ Only QUEUES the render task
// Render is NOT complete - it's queued and will execute asynchronously
await JS.InvokeVoidAsync("doSomething"); // ❌ Runs DURING render - CONFLICT!
```

### Why This Happens

Blazor uses an **asynchronous rendering queue** for performance:

1. **StateHasChanged()** adds a render task to the queue and returns immediately
2. **Render task** executes asynchronously in the background
3. **Your code** continues executing while render is happening
4. **JavaScript call** executes while Blazor is still updating the DOM
5. **💥 Collision**: Both frameworks fight over the same DOM elements

---

## Visual Diagrams

### Diagram 1: StateHasChanged() Timeline

```
CODE EXECUTION          RENDER QUEUE           DOM STATE
══════════════          ════════════           ═════════

Line 1: Update data
myData = "New";         
                                               [Old DOM]
                        
Line 2: StateHasChanged()
StateHasChanged(); ──> [Task Queued]          [Old DOM]
        │                   │
        │ Returns            │
        │ immediately        │
        ↓                    ↓
Line 3: Call JS         [Executing...]        [Updating...]
await JS("animate"); ──────────────────────> [Modifying DOM]
        │                   │                      │
        │                   │                      │
        ↓                   ↓                      ↓
                       [Complete]             [Modified]
                            │                      │
                            └──> CONFLICT! <───────┘
```

### Diagram 2: Race Condition in Action

```
THREAD 1: BLAZOR                    THREAD 2: JAVASCRIPT
════════════════════                ════════════════════

StateHasChanged()
    │
    ├─> Queue Render Task
    │
    └─> Return ✓
                                     await JS("animate")
Render Task Starts                      │
    │                                   └─> Start animation
    ├─> Find element #box               
    │                                   ├─> Find element #box
    ├─> Update textContent              │
    │                                   ├─> Add CSS class
    ├─> Update child nodes          ◄───┼─> CONFLICT!
    │                                   │
    ├─> Remove old nodes                ├─> Modify style
    │                               ◄───┘
    └─> Error: Can't find node!
```

### Diagram 3: Correct Pattern (Sequential)

```
THREAD 1: BLAZOR                    THREAD 2: JAVASCRIPT
════════════════════                ════════════════════

isJsNeeded = true;
StateHasChanged()
    │
    ├─> Queue Render Task
    │
    └─> Return ✓
         
Render Task Starts
    │
    ├─> Find element #box
    ├─> Update textContent
    ├─> Update child nodes
    └─> Complete ✓
         │
         ↓
OnAfterRenderAsync()
    │
    ├─> Check: isJsNeeded? true
    │
    └─> await JS("animate") ─────> Start animation
                                        │
                                        ├─> Find element #box ✓
                                        ├─> Add CSS class ✓
                                        ├─> Modify style ✓
                                        └─> Complete ✓

✅ No conflict - operations are sequential!
```

---

## Code Examples

### ❌ Example 1: Race Condition with jQuery DataTable

```csharp
private async Task UpdateTable()
{
    people.Add(newPerson);
    StateHasChanged();                          // Queue render
    await jsModule.InvokeVoidAsync("refresh"); // ❌ DataTable updates during Blazor render
}
```

**What goes wrong:**
1. Blazor starts updating `<tbody>` rows
2. jQuery's `refresh()` destroys and re-initializes DataTable
3. Both manipulate the same `<tr>` elements
4. Result: `"Cannot read properties of null (reading 'removeChild')"`

---

### ❌ Example 2: Race Condition with Animation

```csharp
private async Task AnimateElement()
{
    content = "New content";
    StateHasChanged();                               // Queue render
    await jsModule.InvokeVoidAsync("fadeIn", "box"); // ❌ Animates during render
}
```

**What goes wrong:**
1. Blazor updates the element's content
2. JavaScript tries to read element to start fade-in
3. Blazor may be in the middle of replacing child nodes
4. JavaScript gets inconsistent state or null reference

---

### ❌ Example 3: Race Condition with Chart Library

```csharp
private async Task UpdateChart()
{
    chartData = GetNewData();
    StateHasChanged();                           // Queue render
    await jsModule.InvokeVoidAsync("drawChart"); // ❌ Chart draws during render
}
```

**What goes wrong:**
1. Blazor updates the `<canvas>` or chart container
2. Chart library tries to draw on the canvas
3. Blazor may be replacing or modifying the canvas element
4. Chart library gets confused about element dimensions or context

---

## The Solution

### ✅ Correct Pattern: Use OnAfterRenderAsync

```csharp
// Private field to coordinate between methods and lifecycle
private bool needsJsUpdate = false;

// User action handler
private async Task UpdateData()
{
    // 1. Update your data
    people.Add(newPerson);
    
    // 2. Set flag BEFORE StateHasChanged
    needsJsUpdate = true;
    
    // 3. Schedule render (returns immediately)
    StateHasChanged();
    
    // 4. DO NOT call JavaScript here!
}

// Lifecycle method - called AFTER render completes
protected override async Task OnAfterRenderAsync(bool firstRender)
{
    // Import JS module on first render
    if (firstRender)
    {
        jsModule = await JS.InvokeAsync<IJSObjectReference>("import", "./script.js");
    }

    // Check flag to see if we need to call JavaScript
    if (jsModule != null && needsJsUpdate)
    {
        // ✓ DOM is stable now - safe to call JavaScript
        await jsModule.InvokeVoidAsync("updateDOM");
        
        // Reset flag
        needsJsUpdate = false;
    }
}
```

### Why This Works:

```
Time    Event
════    ═════════════════════════════════════════════════════════════
T1      User clicks button
T2      UpdateData() executes
T3      needsJsUpdate = true
T4      StateHasChanged() queues render and returns
T5      UpdateData() completes
        
        [Render task executes asynchronously]
        
T6      Blazor render starts
T7      Blazor updates DOM elements
T8      Blazor render completes
T9      OnAfterRenderAsync() is called ← Framework guarantees this timing!
T10     JavaScript executes (DOM is stable)
T11     No conflict!
```

---

## Best Practices

### ✅ DO: Call JavaScript in OnAfterRenderAsync

```csharp
protected override async Task OnAfterRenderAsync(bool firstRender)
{
    if (needsJsCall)
    {
        await jsModule.InvokeVoidAsync("doWork");
        needsJsCall = false;
    }
}
```

### ✅ DO: Destroy external DOM controllers before Blazor updates

```csharp
private async Task UpdateData()
{
    // Destroy jQuery DataTable before Blazor re-renders
    await jsModule.InvokeVoidAsync("destroy");
    
    people = newData;
    StateHasChanged();
    
    // Re-initialize happens in OnAfterRenderAsync
}
```

### ✅ DO: Use a flag to coordinate

```csharp
private bool needsRefresh = false;

private void OnButtonClick()
{
    data = newData;
    needsRefresh = true;  // Signal to OnAfterRenderAsync
    StateHasChanged();
}
```

### ❌ DON'T: Call JavaScript immediately after StateHasChanged

```csharp
StateHasChanged();
await JS.InvokeVoidAsync("update"); // ❌ Race condition!
```

### ❌ DON'T: Assume StateHasChanged waits for render

```csharp
StateHasChanged(); // ❌ This returns immediately!
// DOM is NOT updated yet at this point
```

### ❌ DON'T: Call StateHasChanged inside OnAfterRenderAsync without guards

```csharp
protected override async Task OnAfterRenderAsync(bool firstRender)
{
    StateHasChanged(); // ❌ Infinite loop!
    // This triggers another render, which calls OnAfterRenderAsync again
}
```

**If you must call StateHasChanged in OnAfterRenderAsync**, use a guard:

```csharp
protected override async Task OnAfterRenderAsync(bool firstRender)
{
    if (someFlag)
    {
        someFlag = false;     // ✓ Reset flag first
        StateHasChanged();    // ✓ Now safe
    }
}
```

---

## Quick Reference Table

| Pattern | StateHasChanged Behavior | JavaScript Timing | Result |
|---------|-------------------------|-------------------|--------|
| ❌ `StateHasChanged(); await JS()` | Queues render, returns | JS runs during render | Race condition |
| ✅ `await JS(); StateHasChanged()` | Waits for JS first | JS runs before render | Sequential ✓ |
| ✅ Flag + `OnAfterRenderAsync` | Queues render | JS runs after render | Sequential ✓ |
| ❌ `OnAfterRenderAsync() { StateHasChanged(); }` | Triggers render | Infinite loop | Stack overflow |
| ✅ `OnAfterRenderAsync() { flag=false; StateHasChanged(); }` | Triggers render once | Controlled | Safe with guard ✓ |

---

## Common Scenarios

### Scenario 1: jQuery Plugins (DataTable, Select2, etc.)

**Problem**: Plugin wraps/modifies DOM, conflicts with Blazor's updates

**Solution**:
```csharp
private async Task UpdateData()
{
    await jsModule.InvokeVoidAsync("destroyPlugin"); // Destroy first
    data = newData;
    needsRefresh = true;
    StateHasChanged();
}

protected override async Task OnAfterRenderAsync(bool firstRender)
{
    if (needsRefresh)
    {
        await jsModule.InvokeVoidAsync("initPlugin"); // Re-init after render
        needsRefresh = false;
    }
}
```

### Scenario 2: Chart Libraries (Chart.js, D3.js, etc.)

**Problem**: Chart draws while Blazor updates canvas/container

**Solution**:
```csharp
private async Task UpdateChart()
{
    chartData = newData;
    needsChartUpdate = true;
    StateHasChanged(); // Let Blazor render first
}

protected override async Task OnAfterRenderAsync(bool firstRender)
{
    if (needsChartUpdate)
    {
        await jsModule.InvokeVoidAsync("drawChart", chartData); // Draw after render
        needsChartUpdate = false;
    }
}
```

### Scenario 3: DOM Measurements

**Problem**: JavaScript measures element while Blazor is resizing it

**Solution**:
```csharp
private void Resize()
{
    width = newWidth;
    needsMeasurement = true;
    StateHasChanged();
}

protected override async Task OnAfterRenderAsync(bool firstRender)
{
    if (needsMeasurement)
    {
        var size = await jsModule.InvokeAsync<int>("measureElement", "box");
        needsMeasurement = false;
    }
}
```

---

## Deep Dive: StateHasChanged() Internals

### What StateHasChanged() Actually Does:

```csharp
// Simplified pseudo-code of what happens inside StateHasChanged()
public void StateHasChanged()
{
    if (alreadyQueued) return; // Prevent duplicate queue entries
    
    renderQueue.Enqueue(new RenderTask 
    {
        Component = this,
        Priority = Normal
    });
    
    // ⚠️ RETURNS IMMEDIATELY - Does NOT wait for render!
}
```

### The Render Queue

Blazor maintains a queue of render tasks:

```
Render Queue (Asynchronous):
┌─────────────────────────────┐
│ [Task 1: ComponentA Render] │ ← Currently executing
├─────────────────────────────┤
│ [Task 2: ComponentB Render] │ ← Queued
├─────────────────────────────┤
│ [Task 3: ComponentC Render] │ ← Queued (your StateHasChanged)
└─────────────────────────────┘

Your Code Execution:
─────────────────────────────────
StateHasChanged();        ← Returns immediately
await JS("animate");      ← Executes now (Task 3 still queued!)
```

---

## Threading Visualization

### Wrong Approach (Race Condition)

```
MAIN THREAD                 RENDER THREAD          JS THREAD
═══════════                 ═════════════          ═════════

UpdateData()
  │
  ├─ data = "New"
  │
  ├─ StateHasChanged()
  │    └──────────────────> [Render Queued]
  │                              │
  ├─ await JS("update")          │
  │    └─────────────────────────────────────> JS starts
  │                              │                  │
  │                         [Render starts]         │
  │                              │                  │
  │                         [Update #box]      [Modify #box]
  │                              │                  │
  │                              └──────┬───────────┘
  │                                     │
  └─ Complete                    ❌ CONFLICT!
```

### Correct Approach (Sequential)

```
MAIN THREAD                 RENDER THREAD          JS THREAD
═══════════                 ═════════════          ═════════

UpdateData()
  │
  ├─ data = "New"
  │
  ├─ needsJS = true
  │
  ├─ StateHasChanged()
  │    └──────────────────> [Render Queued]
  │                              │
  └─ Complete                    │
                                 ↓
                           [Render starts]
                                 │
                           [Update #box]
                                 │
                           [Complete] ✓
                                 │
                                 ↓
                         OnAfterRenderAsync()
                                 │
                                 ├─ if needsJS
                                 │
                                 └─ await JS("update") ────────> JS starts
                                                                      │
                                                                 [Modify #box] ✓
                                                                      │
                                                                 [Complete] ✓

✅ No conflict - operations are sequential!
```

---

## Real-World Example: jQuery DataTable

### The Problem

```csharp
private async Task AddRow()
{
    people.Add(newPerson);          // Update C# list
    StateHasChanged();               // Blazor updates <tbody>
    
    // ❌ RACE CONDITION:
    // Blazor is adding a <tr> element
    // jQuery is trying to destroy/re-init which removes/adds elements
    // Both manipulate the same <tbody>
    $('#table').DataTable().destroy();
    $('#table').DataTable();
}
```

### Timeline of the Race:

```
T0: people.Add(newPerson)
    C# List: [Person1, Person2, Person3] ✓

T1: StateHasChanged()
    Render Queued ✓

T2: DataTable().destroy()
    └─> Removes pagination, search controls
    └─> Removes wrapper divs
    └─> Tries to clean up event handlers on rows

T3: [Blazor Render Executing]
    └─> Generates new <tr> for Person3
    └─> Tries to insert into <tbody>

T4: DataTable()
    └─> Tries to find table rows
    └─> Tries to wrap table with controls

T5: CONFLICT!
    - Blazor: "I'm adding a <tr>"
    - jQuery: "I'm removing event handlers from <tr>"
    - Both: Trying to access element.removeChild()
    - Element is null or in inconsistent state
    - Error: Cannot read properties of null
```

### The Solution

```csharp
private async Task AddRow()
{
    // Destroy FIRST (before Blazor updates)
    await jsModule.InvokeVoidAsync("destroy");
    
    people.Add(newPerson);
    isDataTableRefreshed = true;  // Set flag
    StateHasChanged();             // Queue render
    
    // JavaScript will be called in OnAfterRenderAsync after render completes
}

protected override async Task OnAfterRenderAsync(bool firstRender)
{
    if (jsModule != null && isDataTableRefreshed)
    {
        // Re-initialize AFTER Blazor is done
        await jsModule.InvokeVoidAsync("refresh");
        isDataTableRefreshed = false;
    }
}
```

### Timeline (Fixed):

```
T0: await destroy()
    └─> DataTable removed ✓
    └─> DOM is clean ✓

T1: people.Add(newPerson)
    C# List: [Person1, Person2, Person3] ✓

T2: isDataTableRefreshed = true
    Flag set ✓

T3: StateHasChanged()
    Render Queued ✓
    Returns immediately ✓

T4: [Blazor Render Executing]
    └─> Generates new <tr> for Person3
    └─> Inserts into <tbody>
    └─> Render complete ✓

T5: OnAfterRenderAsync()
    └─> Checks flag: isDataTableRefreshed = true
    └─> await refresh()
        └─> DataTable re-initialized with new rows ✓

T6: No conflict - sequential operations! ✓
```

---

## Common Questions

### Q: Why can't I just await StateHasChanged()?

**A**: `StateHasChanged()` returns `void`, not a `Task`. It's designed to be non-blocking for performance. Blazor batches multiple `StateHasChanged()` calls into a single render.

### Q: Can I use Task.Delay() to wait?

```csharp
StateHasChanged();
await Task.Delay(100);  // ❌ BAD: Timing-dependent hack
await JS.InvokeVoidAsync("update");
```

**A**: No! This is unreliable:
- Render time varies (device speed, complexity)
- May work on fast machines, fail on slow ones
- Not deterministic - can still have race conditions
- Use `OnAfterRenderAsync` instead - it's guaranteed

### Q: What if I need to call JavaScript immediately?

**A**: Call it BEFORE `StateHasChanged()`:

```csharp
await jsModule.InvokeVoidAsync("doWork");  // ✓ Do this first
myData = "New";
StateHasChanged();                         // ✓ Then render
```

This ensures sequential execution: JS → Render (no overlap).

### Q: Can I use InvokeAsync instead of InvokeVoidAsync?

**A**: Yes, both can cause race conditions if called after `StateHasChanged()`:

```csharp
StateHasChanged();
var result = await JS.InvokeAsync<string>("getValue"); // ❌ Still a race!
```

The issue isn't the return type - it's the timing of the call.

---

## Debugging Race Conditions

### Console Logging Strategy

Add logs to see the timing:

**C# side:**
```csharp
private async Task UpdateData()
{
    Console.WriteLine($"[C#] UpdateData start: {DateTime.Now:HH:mm:ss.fff}");
    
    StateHasChanged();
    Console.WriteLine($"[C#] StateHasChanged called: {DateTime.Now:HH:mm:ss.fff}");
    
    await jsModule.InvokeVoidAsync("update");
    Console.WriteLine($"[C#] JS call complete: {DateTime.Now:HH:mm:ss.fff}");
}

protected override async Task OnAfterRenderAsync(bool firstRender)
{
    Console.WriteLine($"[C#] OnAfterRenderAsync: {DateTime.Now:HH:mm:ss.fff}");
}
```

**JavaScript side:**
```javascript
export function update() {
    console.log(`[JS] update start: ${new Date().toISOString()}`);
    // DOM manipulation
    console.log(`[JS] update complete: ${new Date().toISOString()}`);
}
```

**Expected output (race condition):**
```
[C#] UpdateData start: 14:23:45.123
[C#] StateHasChanged called: 14:23:45.124
[JS] update start: 14:23:45.125          ← JS starts
[C#] OnAfterRenderAsync: 14:23:45.126    ← Render happening simultaneously!
[JS] update complete: 14:23:45.127
[C#] JS call complete: 14:23:45.128
```

**Expected output (correct pattern):**
```
[C#] UpdateData start: 14:23:45.123
[C#] StateHasChanged called: 14:23:45.124
[C#] OnAfterRenderAsync: 14:23:45.126    ← Render completes first
[JS] update start: 14:23:45.127          ← JS starts after render
[JS] update complete: 14:23:45.128
```

---

## Summary Checklist

When integrating JavaScript with Blazor, always:

- [ ] Import JS modules in `OnAfterRenderAsync(firstRender)`
- [ ] Call DOM-manipulating JS in `OnAfterRenderAsync`, not in event handlers
- [ ] Use a boolean flag to coordinate between event handlers and `OnAfterRenderAsync`
- [ ] Set the flag before `StateHasChanged()`
- [ ] Reset the flag after JS call completes
- [ ] Destroy external DOM controllers (jQuery plugins) before Blazor re-renders
- [ ] Re-initialize external controllers in `OnAfterRenderAsync` after Blazor re-renders
- [ ] Never call JavaScript immediately after `StateHasChanged()`
- [ ] Remember: `StateHasChanged()` returns immediately - it does NOT wait

---

## Additional Resources

- **Blazor Lifecycle**: https://learn.microsoft.com/en-us/aspnet/core/blazor/components/lifecycle
- **JavaScript Interop**: https://learn.microsoft.com/en-us/aspnet/core/blazor/javascript-interoperability/
- **OnAfterRenderAsync**: https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.components.componentbase.onafterrenderasync

---

**Remember**: In Blazor + JavaScript integration, **timing is everything**. Use `OnAfterRenderAsync` to ensure proper sequencing and avoid race conditions! 🎯
