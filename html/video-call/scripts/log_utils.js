// Global logger that works in iOS PWA
window.appLog = function(type, ...args) {
    // Always log to console
    console.log(`[${type}]`, ...args);
    
    // Create log element if it doesn't exist
    let logDiv = document.getElementById('pwaLog');
    if (!logDiv) {
        logDiv = document.createElement('div');
        logDiv.id = 'pwaLog';
        logDiv.style.display = 'none';
        document.body.appendChild(logDiv);
    }
    
    // Add log entry
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toISOString()}] [${type}] ${args.join(' ')}`;
    logDiv.appendChild(entry);
    
    // Keep last 100 entries
    while (logDiv.children.length > 100)
        logDiv.removeChild(logDiv.firstChild);
};
