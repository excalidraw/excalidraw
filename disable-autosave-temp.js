// Temporary script to disable auto-save
// Run this in browser console to disable auto-save while you work on the database

// Alternative approach: The autosave can now be disabled by setting DISABLE_AUTOSAVE = true in App.tsx
// This script provides a runtime toggle for convenience

window.toggleAutoSave = function(disable = true) {
  const app = window.excalidraw?.app;
  if (app && app.excalidrawRef?.current) {
    const excalidrawWrapper = app.excalidrawRef.current;
    if (disable) {
      // Store original function
      if (!window.originalAutoSaveScene) {
        window.originalAutoSaveScene = excalidrawWrapper.onChange;
      }

      // Replace onChange to skip autoSaveScene call
      const originalOnChange = excalidrawWrapper.onChange;
      excalidrawWrapper.onChange = function(elements, appState, files) {
        // Call original onChange but skip autoSaveScene
        if (originalOnChange) {
          // Call all parts of onChange except autoSaveScene
          console.log('Auto-save disabled - scene changes will not be saved automatically');
          return;
        }
      };
      console.log('✅ Auto-save disabled temporarily.');
    } else {
      // Restore original function
      if (window.originalAutoSaveScene) {
        excalidrawWrapper.onChange = window.originalAutoSaveScene;
        window.originalAutoSaveScene = null;
        console.log('✅ Auto-save re-enabled.');
      }
    }
  } else {
    console.log('❌ Could not find Excalidraw app. Try running this after the app loads.');
    console.log('💡 Alternative: Set DISABLE_AUTOSAVE = true in excalidraw-app/App.tsx');
  }
};

// Auto-disable autosave when script loads
console.log('🔧 Auto-save toggle available. Use toggleAutoSave(true) to disable, toggleAutoSave(false) to enable.');
console.log('💡 You can also set DISABLE_AUTOSAVE = true in excalidraw-app/App.tsx for a permanent disable.');
