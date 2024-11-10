const themes = {
    basic: {
        background: '#ffffff',
        text: '#000000',
        highlight: '#0066cc'
    },
    sunset: {
        background: '#ffd700',
        text: '#ff4500',
        highlight: '#ff6347'
    },
    christmas: {
        background: '#006400',
        text: '#ff0000',
        highlight: '#ffffff'
    }
};

function applyTheme(themeName) {
    const theme = themes[themeName] || themes.basic;
    const root = document.documentElement;
    
    root.style.setProperty('--background-color', theme.background);
    root.style.setProperty('--text-color', theme.text);
    root.style.setProperty('--highlight-color', theme.highlight);
} 