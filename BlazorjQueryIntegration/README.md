# BlazorjQueryIntegration

A comprehensive example demonstrating how to integrate jQuery and jQuery-based libraries (DataTables, jQuery UI) with Blazor Server applications while avoiding race conditions and DOM manipulation conflicts.

## 🎯 Problem Statement

When integrating jQuery with Blazor, developers encounter a critical challenge: **both Blazor's rendering engine and jQuery attempt to manipulate the same DOM elements**, leading to:

- ❌ Race conditions causing "Cannot read properties of null" errors
- ❌ Visual glitches and flickering
- ❌ Duplicate or missing elements
- ❌ DataTable initialization failures
- ❌ Unpredictable behavior during rapid user interactions

### Root Cause

`StateHasChanged()` **queues** a render operation and returns immediately—it does NOT wait for rendering to complete. If JavaScript is called immediately after, both systems modify the DOM simultaneously.

```
StateHasChanged() → Queues render → Returns immediately
                         ↓
               JavaScript executes while
               Blazor is still rendering
                         ↓
                    ⚠️ COLLISION
```

## ✅ Solution Overview

This project demonstrates the **correct pattern** for coordinating Blazor and jQuery:

1. **Destroy jQuery controls** before Blazor re-renders
2. **Update C# state** and call `StateHasChanged()`
3. **Set coordination flag** to indicate JavaScript needs to run
4. **Wait for render** completion (happens automatically)
5. **In `OnAfterRenderAsync`**, check flag and call JavaScript safely

```
C# Update → Destroy jQuery → StateHasChanged() → Blazor Renders 
→ OnAfterRenderAsync() → Check Flag → Re-initialize jQuery ✓
```

## 📂 Project Structure

```
BlazorjQueryIntegration/
├── Components/
│   ├── Pages/
│   │   ├── DataTableExample.razor         # ✅ Correct implementation
│   │   ├── DataTableExample.razor.js      # DataTable lifecycle management
│   │   ├── RaceConditionDemo.razor        # ❌ Broken example (educational)
│   │   └── RaceConditionDemo.razor.js     # DOM manipulation
│   └── Layout/
├── Services/
│   ├── IDataService.cs
│   └── DataService.cs                     # In-memory data with 10K records
├── Models/
│   └── Person.cs
├── Docs/
│   └── RaceConditionGuide.md              # 📖 Comprehensive guide (570+ lines)
├── wwwroot/
│   ├── jquery/                            # jQuery 3.7.1
│   ├── jqueryui/                          # jQuery UI 1.14.1
│   └── datatables.net/                    # DataTables 2.3.4
└── libman.json                            # Client library configuration
```

## 🚀 Getting Started

### Prerequisites
- .NET 10 SDK
- Visual Studio 2022 or VS Code
- Modern web browser

### Run the Project

```bash
cd BlazorjQueryIntegration
dotnet restore
dotnet run
```

Navigate to:
- `https://localhost:5001/datatable-example` - Working DataTables implementation
- `https://localhost:5001/race-condition-demo` - Race condition demonstration

## 📖 Documentation

### Quick Start Guides
- **[RaceConditionGuide.md](./Docs/RaceConditionGuide.md)** - Deep dive into race conditions with visual timelines

### Key Concepts Covered

1. **Blazor Lifecycle**
   - `OnInitializedAsync()` vs `OnAfterRenderAsync()`
   - Understanding `StateHasChanged()` behavior
   - Component disposal patterns

2. **JavaScript Interop**
   - ES6 module imports
   - IJSObjectReference management
   - Handling JSDisconnectedException

3. **jQuery Integration**
   - DataTable initialization/destruction
   - Preventing "Cannot reinitialise DataTable" errors
   - Managing jQuery UI controls

4. **Race Condition Prevention**
   - Flag-based coordination patterns
   - Sequential DOM update strategies
   - Testing for timing issues

## 💡 Code Examples

### ✅ Correct Pattern

```csharp
private bool isDataTableRefreshed = false;

private async Task AddRandomPerson()
{
    // 1. Destroy jQuery control BEFORE Blazor re-renders
    if (jsModule != null)
        await jsModule.InvokeVoidAsync("destroy");
    
    // 2. Update data
    await DataService.AddPersonAsync(newPerson);
    people = await DataService.GetAllPersonsAsync();
    
    // 3. Set flag
    isDataTableRefreshed = true;
    
    // 4. Queue render (returns immediately)
    StateHasChanged();
    
    // JavaScript will be called in OnAfterRenderAsync
}

protected override async Task OnAfterRenderAsync(bool firstRender)
{
    // 5. After render completes, safely call JavaScript
    if (jsModule != null && isDataTableRefreshed)
    {
        await jsModule.InvokeVoidAsync("refresh");
        isDataTableRefreshed = false;
    }
}
```

### ❌ Wrong Pattern (Race Condition)

```csharp
private async Task DeleteItem(int id)
{
    items.RemoveAll(x => x.Id == id);
    
    // ❌ Queues render, returns immediately
    StateHasChanged();
    
    // ❌ Runs while Blazor is still rendering → COLLISION
    await jsModule.InvokeVoidAsync("deleteElement", $"item-{id}");
}
```

## 🎓 Learning Path

1. **Start with DataTableExample.razor** - Read the inline comments (270+ lines of documentation)
2. **Review RaceConditionGuide.md** - Understand the theory with visual timelines
3. **Test RaceConditionDemo.razor** - See what happens when done incorrectly
4. **Experiment with rapid clicks** - Trigger race conditions intentionally
5. **Implement your own** - Apply patterns to your projects

## 🧪 Testing for Race Conditions

```
✓ Rapid clicking: Click buttons 5-10 times quickly
✓ Network throttling: Simulate slow connections in DevTools
✓ Concurrent operations: Open multiple browser tabs
✓ Slow devices: Test on lower-end hardware
✓ Console errors: Watch for "Cannot read properties of null"
```

## 🔧 Technologies Used

- **Blazor Server** - Interactive Server rendering mode
- **jQuery 3.7.1** - DOM manipulation library
- **jQuery UI 1.14.1** - UI widgets and themes
- **DataTables 2.3.4** - Advanced table plugin
- **Bootstrap 5** - Responsive styling
- **LibMan** - Client-side library management

## 📊 Features Demonstrated

- ✅ jQuery DataTables with 10,000 records
- ✅ Server-side pagination, sorting, filtering
- ✅ Add/delete operations with proper coordination
- ✅ Multiple DataTable instances on same page
- ✅ Custom theming (jQuery UI Blitzer theme)
- ✅ Proper disposal and cleanup
- ✅ SignalR reconnection handling

## ⚠️ Common Pitfalls

| Mistake | Consequence | Solution |
|---------|-------------|----------|
| Calling JS immediately after `StateHasChanged()` | Race condition | Use `OnAfterRenderAsync` |
| Not destroying DataTable before re-render | "Cannot reinitialise" error | Call `destroy()` first |
| Forgetting to reset coordination flags | Infinite JS calls | Reset flag after use |
| Not handling `JSDisconnectedException` | Error logs on navigation | Try-catch in disposal |

## 🤝 Contributing

Found an issue or have an improvement? Contributions welcome!

## 📝 Notes

- This project uses `.slnx` (XML solution format)
- Requires .NET 10 Preview SDK
- `BlazorDisableThrowNavigationException` enabled for better UX
- Static asset mapping enabled for optimal performance

## 📚 Additional Resources

- [Blazor JavaScript Interop](https://learn.microsoft.com/en-us/aspnet/core/blazor/javascript-interoperability)
- [Blazor Lifecycle](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/lifecycle)
- [jQuery DataTables Documentation](https://datatables.net/)

---

**Project Type:** Educational Example  
**Difficulty Level:** Intermediate to Advanced  
**Last Updated:** February 2026

[← Back to Main Repository](../README.md)
