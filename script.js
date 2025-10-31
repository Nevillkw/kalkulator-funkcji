// Global variables for data traces
let loadedDataTrace = null; // Trace dla importowanych danych 2D (CSV/API)
let loadedData3DTrace = null; // Trace dla importowanych danych 3D (CSV/API)
let currentAnalysisData = { zeros: [], extrema: [], inflections: [], intersections: [], integral: null, derivative: '', areaBetween: null }; // Initialize early for 3D access

// History management
let plotHistory = [];
const MAX_HISTORY_ITEMS = 20;

// Funkcja do renderowania wykresu 3D
function handle3DPlot(data) {
    console.log('Otrzymane dane 3D:', data);
    // Apply theme colors for 3D plots
    let t3 = { 
        paper:'#ffffff', plot:'#ffffff', grid:'#d0d0d0', font:'#263238',
        axis:'#607d8b', tick:'#546e7a', zeroline:'#9e9e9e'
    };
    try {
        const tn = (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) || 'default';
        if (tn === 'deflatul') {
            t3 = { paper:'#eef3f8', plot:'#eef3f8', grid:'#cfd8e3', font:'#2b3b55', axis:'#6a7f97', tick:'#3b4b63', zeroline:'#a9bdd3' };
        }
    } catch(_) {}
    
    // Store derivative info if present and non-empty
    if (data.derivative && typeof currentAnalysisData !== 'undefined') {
        // Check if derivative has actual values
        if ((data.derivative.dzDx && data.derivative.dzDy) || 
            (typeof data.derivative === 'string' && data.derivative.trim() !== '')) {
            currentAnalysisData.derivative = data.derivative;
            if (typeof displayAnalysisResults === 'function') {
                displayAnalysisResults();
            }
        }
    }
    
    // Sprawdź, czy dane są poprawne
    if (!data.x || !data.y || !data.z || !Array.isArray(data.z)) {
        console.error('Brak wymaganych danych dla wykresu 3D');
        errorDisplay.textContent = 'Błąd: Nieprawidłowe dane dla wykresu 3D';
        return;
    }

    // Upewnij się, że dane są w odpowiednim formacie
    const x = Array.isArray(data.x) ? data.x : [];
    const y = Array.isArray(data.y) ? data.y : [];
    const z = Array.isArray(data.z) ? data.z : [];

    console.log('Wymiary danych:', {
        x: x.length,
        y: y.length,
        z: z.length,
        'z[0]': z[0] ? z[0].length : 'brak'
    });

    // Sprawdź, czy mamy macierz 2D dla z
    if (!z.every(row => Array.isArray(row))) {
        console.error('Nieprawidłowy format danych Z');
        errorDisplay.textContent = 'Błąd: Nieprawidłowy format danych';
        return;
    }

    const trace = {
        type: 'surface',
        x: x,
        y: y,
        z: z,
        colorscale: 'Viridis',
        showscale: true,
        hoverongaps: false,
        connectgaps: false
    };
    
    // Zbierz wszystkie ślady do renderowania
    const traces = [trace];
    
    // Dodaj ślad danych 3D, jeśli istnieje
    if (loadedData3DTrace) {
        traces.push(loadedData3DTrace);
    }

    const layout = {
        title: { text: 'Wykres powierzchni 3D', font: { size: 18, weight: 600 } },
        scene: {
            xaxis: { 
                title: { text: 'X', font: { size: 14, weight: 600 } },
                gridcolor: t3.grid,
                gridwidth: 2,
                linecolor: t3.axis,
                tickfont: { color: t3.tick },
                zerolinecolor: t3.zeroline
            },
            yaxis: { 
                title: { text: 'Y', font: { size: 14, weight: 600 } },
                gridcolor: t3.grid,
                gridwidth: 2,
                linecolor: t3.axis,
                tickfont: { color: t3.tick },
                zerolinecolor: t3.zeroline
            },
            zaxis: { 
                title: { text: 'Z', font: { size: 14, weight: 600 } },
                gridcolor: t3.grid,
                gridwidth: 2,
                linecolor: t3.axis,
                tickfont: { color: t3.tick },
                zerolinecolor: t3.zeroline
            },
            camera: {
                eye: { x: 1.5, y: 1.5, z: 1.5 }
            },
            aspectmode: 'cube',
            bgcolor: t3.plot
        },
        autosize: true,
        margin: { l: 0, r: 0, b: 0, t: 50 },
        paper_bgcolor: t3.paper,
        plot_bgcolor: t3.plot,
        font: { color: t3.font }
    };

    console.log('Konfiguracja wykresu:', { traces, layout });
    
    // Wyczyść poprzedni wykres
    Plotly.purge('myChart');
    
    // Renderuj nowy wykres
    // Add custom fullscreen button (parity with 2D)
    const chartContainerEl = document.getElementById('chartContainer');
    const fsIcon = { width: 512, height: 512, path: 'M0,96 L0,0 96,0 96,32 32,32 32,96 Z M416,0 512,0 512,96 480,96 480,32 416,32 Z M0,416 32,416 32,480 96,480 96,512 0,512 Z M480,416 512,416 512,512 416,512 416,480 480,480 Z' };
    const fsButton = {
        name: 'fullscreen',
        title: 'Pełny ekran (F)',
        icon: fsIcon,
        click: () => {
            try {
                if (document.fullscreenElement === chartContainerEl) {
                    if (document.exitFullscreen) document.exitFullscreen();
                } else if (chartContainerEl && chartContainerEl.requestFullscreen) {
                    chartContainerEl.requestFullscreen();
                }
                setTimeout(() => { try { const div = document.getElementById('myChart'); if (div) Plotly.Plots.resize(div); } catch(_) {} }, 100);
            } catch (_) {}
        }
    };

    const config3d = {
        responsive: true,
        scrollZoom: true,
        displayModeBar: true,
        modeBarButtonsToAdd: [fsButton]
    };

    Plotly.newPlot('myChart', traces, layout, config3d).then(() => {
        console.log('Wykres został wyrenderowany');
        errorDisplay.textContent = '';
    }).catch(error => {
        console.error('Błąd podczas renderowania wykresu:', error);
        errorDisplay.textContent = 'Błąd: Nie udało się wyrenderować wykresu';
    });
}

// Główny blok: czekaj na załadowanie DOM
// Funkcja do wstawiania wzorów funkcji
function insertFunction(func) {
    // Znajdź aktywny input
    const activeElement = document.activeElement;
    console.log('Active element:', activeElement);
    console.log('Active element ID:', activeElement ? activeElement.id : null);
    
    const allowed = ['functionInput', 'function2Input', 'xParamInput', 'yParamInput', 'rInput', 'surfaceInput'];
    let input = null;

    if (activeElement && activeElement.tagName === 'INPUT' && allowed.includes(activeElement.id)) {
        input = activeElement;
        console.log('Using active input:', input.id);
    } else {
        // Jeśli nie ma aktywnego pola, wybierz domyślne na podstawie trybu
        const modeEl = document.getElementById('plotMode');
        const mode = (modeEl && modeEl.value) ? modeEl.value : 'cartesian';
        console.log('Current mode:', mode);
        
        if (mode === 'cartesian') {
            input = document.getElementById('functionInput');
        } else if (mode === 'parametric') {
            input = document.getElementById('xParamInput');
        } else if (mode === 'polar') {
            input = document.getElementById('rInput');
        } else if (mode === '3d') {
            input = document.getElementById('surfaceInput');
        }
        console.log('Using default input for mode:', input ? input.id : null);
    }
    if (!input) input = document.getElementById('functionInput');
    try {
        const start = input.selectionStart || input.value.length;
        const end = input.selectionEnd || input.value.length;
        const text = input.value || '';
        input.value = text.substring(0, start) + func + text.substring(end);
        input.focus();
        // Ustaw kursor na końcu wstawionego tekstu
        input.setSelectionRange(start + func.length, start + func.length);
    } catch (e) {
        // fallback: append
        input.value = (input.value || '') + func;
        input.focus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Pobierz elementy interfejsu
    const functionInput = document.getElementById('functionInput');
    const function2Input = document.getElementById('function2Input');
    const plotButton = document.getElementById('plotButton');
    const myChartCanvas = document.getElementById('myChart');
    const errorDisplay = document.getElementById('errorDisplay');
    const xMinInput = document.getElementById('xMin');
    const xMaxInput = document.getElementById('xMax');
    const yMinInput = document.getElementById('yMin');
    const yMaxInput = document.getElementById('yMax');
    const resetViewButton = document.getElementById('resetView');
    const clearAnalysisButton = document.getElementById('clearAnalysisButton');
    const modeHelper = document.getElementById('modeHelper');
    const plotMode = document.getElementById('plotMode');
    const samplingPreset = document.getElementById('samplingPreset');
    const calculateIntegralButton = document.getElementById('calculateIntegralButton');
    let calculateBetweenButton = document.getElementById('calculateBetweenButton');
    const integralA = document.getElementById('integralA');
    const integralB = document.getElementById('integralB');
    let betweenA = document.getElementById('betweenA');
    let betweenB = document.getElementById('betweenB');

    // Fallback: dynamically inject "Pole między krzywymi" controls if missing (older HTML)
    let betweenCurvesControls = document.querySelector('.between-curves-controls');
    if (!betweenCurvesControls || !calculateBetweenButton || !betweenA || !betweenB) {
        const analysisOptions = document.querySelector('.analysis-options');
        const groupContent = analysisOptions ? analysisOptions.parentElement : null;
        if (groupContent) {
            betweenCurvesControls = document.createElement('div');
            betweenCurvesControls.className = 'between-curves-controls';
            betweenCurvesControls.style.borderTop = '1px solid #dee2e6';
            betweenCurvesControls.style.paddingTop = '8px';
            betweenCurvesControls.style.marginTop = '8px';
            betweenCurvesControls.innerHTML = `
                <label style="display:block;margin-bottom:6px;font-weight:500;font-size:12px;">📐 Pole między krzywymi:</label>
                <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
                    <label for="betweenA" style="font-size:12px;">a:</label>
                    <input type="text" id="betweenA" value="0" style="width:80px;padding:4px;font-size:12px;" placeholder="np. -1" title="Lewa granica przedziału">
                    <label for="betweenB" style="font-size:12px;">b:</label>
                    <input type="text" id="betweenB" value="1" style="width:80px;padding:4px;font-size:12px;" placeholder="np. 1" title="Prawa granica przedziału">
                </div>
                <button id="calculateBetweenButton" style="width:100%;font-size:12px;padding:6px;" title="Automatycznie oblicza się po zmianie granic">📐 Oblicz i zacieniuj</button>
            `;
            groupContent.appendChild(betweenCurvesControls);

            calculateBetweenButton = betweenCurvesControls.querySelector('#calculateBetweenButton');
            betweenA = betweenCurvesControls.querySelector('#betweenA');
            betweenB = betweenCurvesControls.querySelector('#betweenB');
        }
    }
    const analysisResults = document.getElementById('analysisResults');
    const analysisResultsContent = document.getElementById('analysisResultsContent');
    const dataInput = document.getElementById('dataInput');
    const dataURL = document.getElementById('dataURL');
    const loadDataButton = document.getElementById('loadDataButton');
    const fetchDataButton = document.getElementById('fetchDataButton');
    const clearDataButton = document.getElementById('clearDataButton');
    const historyList = document.getElementById('historyList');
    const clearHistoryButton = document.getElementById('clearHistoryButton');
    const fsClearHistoryButton = document.getElementById('fsClearHistoryButton');
    const insightsToggle = document.getElementById('insightsToggle');
    const chartContainer = document.getElementById('chartContainer');
    // Theme toggle (deflatul)
    const deflatulToggle = document.getElementById('deflatulThemeToggle');
    // FS HUD elements
    const fsRangeEl = document.getElementById('fsRange');
    const fsAutoFitBtn = document.getElementById('fsAutoFit');
    const fsResetBtn = document.getElementById('fsReset');
    const fsExitBtn = document.getElementById('fsExit');
    const fsReplotBtn = document.getElementById('fsReplot');
    const fsDock = document.getElementById('fsDock');
    const fsDockHeader = document.getElementById('fsDockHeader');
    const fsDockToggle = document.getElementById('fsDockToggle');
    const fsInputsContainer = document.getElementById('fsInputs');
    const fsIntA = document.getElementById('fsIntA');
    const fsIntB = document.getElementById('fsIntB');
    const fsIntegralButton = document.getElementById('fsIntegralButton');
    const fsIntRangeRow = document.getElementById('fsIntRangeRow');
    const fsBetweenSection = document.getElementById('fsBetweenSection');
    const fsBetweenA = document.getElementById('fsBetweenA');
    const fsBetweenB = document.getElementById('fsBetweenB');
    const fsBetweenButton = document.getElementById('fsBetweenButton');
    const fsParamsContainer = document.getElementById('fsParams');
    const fsPlotMode = document.getElementById('fsPlotMode');
    const fsModeHelper = document.getElementById('fsModeHelper');
    const fsAngleMode = document.getElementById('fsAngleMode');
    const fsSamplingPreset = document.getElementById('fsSamplingPreset');
    const fsPiAxis = document.getElementById('fsPiAxis');
    const fsZoomIn = document.getElementById('fsZoomIn');
    const fsZoomOut = document.getElementById('fsZoomOut');
    const fsPanLeft = document.getElementById('fsPanLeft');
    const fsPanRight = document.getElementById('fsPanRight');
    const fsPanUp = document.getElementById('fsPanUp');
    const fsPanDown = document.getElementById('fsPanDown');
    // FS left controls
    const fsControls = document.getElementById('fsControls');
    // FS analysis toggles
    const fsZeros = document.getElementById('fsZeros');
    const fsExtrema = document.getElementById('fsExtrema');
    const fsInflections = document.getElementById('fsInflections');
    const fsIntersections = document.getElementById('fsIntersections');
    const fsDerivative = document.getElementById('fsDerivative');
    const fsLegend = document.getElementById('fsLegend');
    const fsGrid = document.getElementById('fsGrid');
    const fsZeroLines = document.getElementById('fsZeroLines');
    const fsTicks = document.getElementById('fsTicks');
    const fsEqualAspect = document.getElementById('fsEqualAspect');
    const fsDark = document.getElementById('fsDark');
    const fsStartMinimizedMobile = document.getElementById('fsStartMinimizedMobile');
    const fsLineWidth = document.getElementById('fsLineWidth');

    // 1) Zapamiętywanie stanu rozwinięcia panelu (details)
    try {
        const savedOpen = localStorage.getItem('insightsOpen');
        if (insightsToggle && (savedOpen === '0' || savedOpen === '1')) {
            insightsToggle.open = savedOpen === '1';
        }
        if (insightsToggle) {
            insightsToggle.addEventListener('toggle', () => {
                try { localStorage.setItem('insightsOpen', insightsToggle.open ? '1' : '0'); } catch (_) {}
            });
        }
    } catch (_) {}

    // (usunięto belkę do zmiany wysokości — brak dodatkowej logiki)
    // Przywrócona regulacja wysokości wyników/historii (resizer) + wyrównanie wysokości sidebaru
    (function setupInsightsResizerAndSidebarSync(){
        const resizer = document.getElementById('insightsResizer');
        const insightsDetails = document.getElementById('insightsToggle');
        const insightsRow = document.querySelector('.insights-row');
        const sidebar = document.querySelector('.calculator-sidebar');
        const chart = document.getElementById('myChart');
        const root = document.documentElement;

        function applyStoredInsightsHeight(){
            try {
                const stored = localStorage.getItem('insightsHeight');
                if (stored) {
                    root.style.setProperty('--insights-height', stored);
                }
            } catch(_) {}
        }

        function updateSidebarMaxHeight(){
            try {
                // Nie rób nic gdy layout mobilny układa kolumny pionowo
                const mq = window.matchMedia('(max-width: 768px)');
                if (mq.matches) { if (sidebar) sidebar.style.maxHeight = ''; return; }
                if (!sidebar || !chart) return;
                let total = chart.getBoundingClientRect().height;
                if (insightsDetails && insightsDetails.open && insightsRow) {
                    total += insightsRow.getBoundingClientRect().height + 12 /*summary padding approx*/;
                }
                // Dodaj niewielki margines bezpieczeństwa
                total += 8;
                sidebar.style.maxHeight = Math.max(200, Math.floor(total)) + 'px';
            } catch(_) {}
        }

        function startDrag(e){
            if (!insightsRow) return;
            const startY = (e.touches ? e.touches[0] : e).clientY;
            const startH = insightsRow.getBoundingClientRect().height;
            function onMove(ev){
                const y = (ev.touches ? ev.touches[0] : ev).clientY;
                let h = startH + (y - startY);
                // Granice: min 140px, max 60vh
                const vh = Math.max(200, Math.floor(window.innerHeight * 0.6));
                h = Math.max(140, Math.min(h, vh));
                const val = h + 'px';
                root.style.setProperty('--insights-height', val);
                try { localStorage.setItem('insightsHeight', val); } catch(_) {}
                updateSidebarMaxHeight();
                ev.preventDefault();
            }
            function onUp(){
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, {passive:false});
            document.addEventListener('touchend', onUp);
            e.preventDefault();
        }

        if (resizer) {
            resizer.addEventListener('mousedown', startDrag);
            resizer.addEventListener('touchstart', startDrag, {passive:false});
        }

        // Aktualizuj po zmianach układu
        ['load','resize'].forEach(evt => window.addEventListener(evt, () => { applyStoredInsightsHeight(); updateSidebarMaxHeight(); }));
        if (insightsDetails) {
            insightsDetails.addEventListener('toggle', () => { applyStoredInsightsHeight(); updateSidebarMaxHeight(); });
        }
        // Po zakończonym rysowaniu/relayout też zsynchronizujemy (gdziekoldwiek wywoływane)
        setTimeout(() => { applyStoredInsightsHeight(); updateSidebarMaxHeight(); }, 0);
    })();

    // 2) Motyw: deflatul (globalny)
    const THEMES = {
        default: {
            paper: '#ffffff', plot: '#ffffff', grid: '#e9ecef',
            axis: '#607d8b', tick: '#546e7a', zeroline: '#9e9e9e', font: '#263238',
            legendBg: 'rgba(255,255,255,0.95)',
            legendBorder: '#cccccc',
            shadePos: 'rgba(76, 175, 80, 0.28)',
            shadeNeg: 'rgba(244, 67, 54, 0.25)',
            shadeBetween: 'rgba(100, 150, 255, 0.10)',
            shadeBetweenLine: 'rgba(100, 150, 255, 0.9)',
            lines: {
                primary: 'rgb(75,192,192)',
                secondary: 'rgb(255,99,132)',
                derivative1: 'rgb(123, 31, 162)',
                derivative2: 'rgb(156, 39, 176)'
            },
            markers: {
                zeros: { color: '#1565c0', line: '#0d47a1' },
                extrema: { color: '#fb8c00', line: '#ef6c00' },
                intersections: { color: '#e53935', line: '#b71c1c' },
                inflections: { color: '#8e24aa', line: '#4a148c' }
            }
        },
        deflatul: {
            paper: '#eef3f8', plot: '#eef3f8', grid: '#d7e0ea',
            axis: '#6a7f97', tick: '#3b4b63', zeroline: '#a9bdd3', font: '#2b3b55',
            legendBg: 'rgba(238,243,248,0.92)',
            legendBorder: '#9db8da',
            shadePos: 'rgba(90, 160, 255, 0.22)',
            shadeNeg: 'rgba(255, 120, 120, 0.20)',
            shadeBetween: 'rgba(120, 170, 255, 0.12)',
            shadeBetweenLine: 'rgba(90,130,210,0.9)',
            lines: {
                primary: '#3e7bd9',
                secondary: '#ff7d99',
                derivative1: '#6a4fb3',
                derivative2: '#8a6bd1'
            },
            markers: {
                zeros: { color: '#2b6cb0', line: '#1e4e8c' },
                extrema: { color: '#e39b35', line: '#c47d1a' },
                intersections: { color: '#d25b6d', line: '#9b3240' },
                inflections: { color: '#6a4fb3', line: '#4a3a8c' }
            }
        }
    };
    function getActiveThemeName(){ try { return localStorage.getItem('theme') || 'default'; } catch(_) { return 'default'; } }
    function getActiveTheme(){ const name = getActiveThemeName(); return THEMES[name] || THEMES.default; }
    function applyTheme(themeName){
        const theme = THEMES[themeName] || THEMES.default;
        const root = document.body || document.documentElement;
        if (themeName === 'deflatul') root.classList.add('theme-deflatul'); else root.classList.remove('theme-deflatul');
        // Update Plotly layout colors (both normal and fullscreen)
        try {
            if (myChart && window.Plotly) {
                const relayout = {
                    'paper_bgcolor': theme.paper,
                    'plot_bgcolor': theme.plot,
                    'xaxis.gridcolor': theme.grid,
                    'yaxis.gridcolor': theme.grid,
                    'xaxis.linecolor': theme.axis,
                    'yaxis.linecolor': theme.axis,
                    'xaxis.tickfont.color': theme.tick,
                    'yaxis.tickfont.color': theme.tick,
                    'xaxis.zerolinecolor': theme.zeroline,
                    'yaxis.zerolinecolor': theme.zeroline,
                    'font.color': theme.font,
                    'legend.bgcolor': theme.legendBg,
                    'legend.bordercolor': theme.legendBorder
                };
                // If 3D scene present, theme its axes too
                if (myChart.layout && myChart.layout.scene) {
                    Object.assign(relayout, {
                        'scene.bgcolor': theme.plot,
                        'scene.xaxis.gridcolor': theme.grid,
                        'scene.yaxis.gridcolor': theme.grid,
                        'scene.zaxis.gridcolor': theme.grid,
                        'scene.xaxis.linecolor': theme.axis,
                        'scene.yaxis.linecolor': theme.axis,
                        'scene.zaxis.linecolor': theme.axis,
                        'scene.xaxis.tickfont.color': theme.tick,
                        'scene.yaxis.tickfont.color': theme.tick,
                        'scene.zaxis.tickfont.color': theme.tick,
                        'scene.xaxis.zerolinecolor': theme.zeroline,
                        'scene.yaxis.zerolinecolor': theme.zeroline,
                        'scene.zaxis.zerolinecolor': theme.zeroline,
                    });
                }
                Plotly.relayout(myChart, relayout);
            }
        } catch(_) {}
        try { localStorage.setItem('theme', themeName); } catch(_) {}
    }
    // Initialize theme from storage and bind toggle (default to 'deflatul' for first-time users)
    try {
        const savedTheme = localStorage.getItem('theme');
        const initialTheme = savedTheme || 'deflatul';
        if (deflatulToggle) deflatulToggle.checked = (initialTheme === 'deflatul');
        applyTheme(initialTheme);
        if (deflatulToggle) deflatulToggle.addEventListener('change', () => {
            applyTheme(deflatulToggle.checked ? 'deflatul' : 'default');
        });
    } catch(_) {}

    // 3) Pełny ekran dla wykresu
    (function setupFullscreen(){
        if (!chartContainer) return;
        const plotDiv = document.getElementById('myChart');

        const toggle = () => {
            if (document.fullscreenElement === chartContainer) {
                if (document.exitFullscreen) document.exitFullscreen();
            } else {
                if (chartContainer.requestFullscreen) chartContainer.requestFullscreen();
            }
        };

        // Skrót klawiaturowy: F (poza polami edycji)
        document.addEventListener('keydown', (e) => {
            const t = e.target;
            const isEditable = t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
            if (!isEditable && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); toggle(); }
        });

        document.addEventListener('fullscreenchange', () => {
            try { if (window.Plotly && plotDiv) Plotly.Plots.resize(plotDiv); } catch(_) {}
            // odśwież zakres w HUD po zmianie stanu pełnego ekranu
            try { if (myChart) updateFsRangeFromLayout(myChart.layout); } catch(_) {}
            // zsynchronizuj lewy panel z bieżącym layoutem
            try { if (myChart) syncFsControlsFromLayout(myChart.layout); } catch(_) {}
            // zsynchronizuj przełączniki analizy z panelem głównym
            try { syncFsAnalysisFromMain(); } catch(_) {}
            // Przywróć pozycję panelu dock
            try { restoreFsDockPosition(); } catch(_) {}
            // Zbuduj i zsynchronizuj pola wejściowe w docku
            try { if (document.fullscreenElement === chartContainer) { buildFsInputsUI(); syncFsInputsFromMain(); initFsSectionCollapsing(); applyFsDockCollapsed(); applyFsDockMinimized(); } } catch(_) {}
            // Zsynchronizuj sekcję całek i zbuduj parametry
            try { if (document.fullscreenElement === chartContainer) { syncFsIntegralFromMain(); syncFsBetweenFromMain(); buildFsParamsUI(); syncFsParamsFromMain(); syncFsRenderFromMain(); syncFsModeFromMain(); updateFsDockModeVisibility(); displayAnalysisResults(); renderHistoryList(); } } catch(_) {}
            // Zastosuj motyw po zmianie fullscreen (kolory Plotly)
            try { const t = (localStorage.getItem('theme') || 'default'); applyTheme(t); } catch(_) {}
            // W fullscreen w kartezjańskim dopasuj osie, aby znaczniki analizy były widoczne
            try { if (myChart) expandRangeToFitMarkers(myChart); } catch(_) {}
            // Ustaw stan przełącznika "Startuj zminimalizowany" z pamięci
            try {
                const cb = document.getElementById('fsStartMinimizedMobile');
                if (cb) cb.checked = (localStorage.getItem('fsDockStartMinimizedMobile') === '1');
            } catch(_) {}
            // Na małych ekranach po wejściu w fullscreen zastosuj preferencję startową
            try {
                if (document.fullscreenElement === chartContainer) {
                    const isSmall = window.innerWidth <= 640;
                    const startPref = localStorage.getItem('fsDockStartMinimizedMobile');
                    if (isSmall) {
                        if (startPref === '1') { localStorage.setItem('fsDockMinimized', '1'); applyFsDockMinimized(); }
                        else if (startPref === '0') { localStorage.setItem('fsDockMinimized', '0'); applyFsDockMinimized(); }
                        else {
                            // brak preferencji: domyślnie zminimalizuj, by nie zasłaniać wykresu
                            localStorage.setItem('fsDockMinimized', '1');
                            applyFsDockMinimized();
                        }
                    }
                } else {
                    // po wyjściu z fullscreen nie trzymaj stanu minimalizacji
                    localStorage.removeItem('fsDockMinimized');
                    if (fsDock) fsDock.classList.remove('minimized');
                }
            } catch(_) {}
        });
    })();

    // Podpięcie akcji HUD (bez resetowania stylów)
    if (fsAutoFitBtn) fsAutoFitBtn.addEventListener('click', () => {
        if (!myChart) return;
        try {
            Plotly.relayout(myChart, { 'xaxis.autorange': true, 'yaxis.autorange': true })
                 .then(() => updateFsRangeFromLayout(myChart.layout));
        } catch (_) {}
    });
    if (fsResetBtn) fsResetBtn.addEventListener('click', () => {
        // Reset: clear all analysis, set ranges to defaults, redraw only functions
        resetPlotViewAndAnalysis();
    });
    if (fsExitBtn) fsExitBtn.addEventListener('click', () => {
        if (document.exitFullscreen) document.exitFullscreen();
    });
    if (fsReplotBtn) fsReplotBtn.addEventListener('click', () => {
        // przerysuj wykres na podstawie aktualnych pól (w tym xMin/xMax/yMin/yMax)
        const plotButton = document.getElementById('plotButton');
        if (plotButton) plotButton.click();
    });

    // Funkcja pomocnicza: aktualizacja etykiety zakresu w HUD
    function updateFsRangeFromLayout(layout) {
        if (!fsRangeEl || !document.fullscreenElement) return;
        try {
            const xr = (layout && layout.xaxis && layout.xaxis.range) ? layout.xaxis.range : null;
            const yr = (layout && layout.yaxis && layout.yaxis.range) ? layout.yaxis.range : null;
            const fmt = (v) => (isFinite(v) ? Number(v).toFixed(2) : '—');
            const label = `x:[${fmt(xr ? xr[0] : NaN)}, ${fmt(xr ? xr[1] : NaN)}]  y:[${fmt(yr ? yr[0] : NaN)}, ${fmt(yr ? yr[1] : NaN)}]`;
            fsRangeEl.textContent = label;
        } catch (_) {}
    }

    // Pomocnicze: pobierz indeksy ścieżek liniowych 2D (scatter)
    function getLineTraceIndices(gd) {
        try {
            const inds = [];
            (gd.data || []).forEach((t, i) => {
                const hasModeLines = t && t.mode && typeof t.mode === 'string' && t.mode.indexOf('lines') !== -1;
                const hasLineObj = t && t.line;
                if (t && t.type === 'scatter' && (hasModeLines || hasLineObj)) {
                    inds.push(i);
                }
            });
            return inds;
        } catch (_) { return []; }
    }

    // Zastosuj styl pełnoekranowy zależny od przełączników
    function applyFsControls() {
        if (!myChart) return;
        const gd = myChart;
        const relayout = {};

        if (fsLegend) relayout['showlegend'] = !!fsLegend.checked;
        if (fsGrid) {
            relayout['xaxis.showgrid'] = !!fsGrid.checked;
            relayout['yaxis.showgrid'] = !!fsGrid.checked;
        }
        if (fsZeroLines) {
            relayout['xaxis.zeroline'] = !!fsZeroLines.checked;
            relayout['yaxis.zeroline'] = !!fsZeroLines.checked;
        }
        if (fsTicks) {
            relayout['xaxis.showticklabels'] = !!fsTicks.checked;
            relayout['yaxis.showticklabels'] = !!fsTicks.checked;
        }
        if (fsEqualAspect) {
            if (fsEqualAspect.checked) {
                relayout['yaxis.scaleanchor'] = 'x';
                relayout['yaxis.scaleratio'] = 1;
            } else {
                relayout['yaxis.scaleanchor'] = null;
                relayout['yaxis.scaleratio'] = null;
            }
        }

        if (fsDark) {
            if (fsDark.checked) {
                relayout['paper_bgcolor'] = '#0b1020';
                relayout['plot_bgcolor'] = '#0b1020';
                relayout['xaxis.gridcolor'] = '#2a3355';
                relayout['yaxis.gridcolor'] = '#2a3355';
                relayout['xaxis.linecolor'] = '#90a4ae';
                relayout['yaxis.linecolor'] = '#90a4ae';
                relayout['xaxis.tickfont.color'] = '#cfd8dc';
                relayout['yaxis.tickfont.color'] = '#cfd8dc';
                relayout['xaxis.zerolinecolor'] = '#607d8b';
                relayout['yaxis.zerolinecolor'] = '#607d8b';
                relayout['font.color'] = '#eceff1';
            } else {
                const t = getActiveTheme();
                relayout['paper_bgcolor'] = t.paper;
                relayout['plot_bgcolor'] = t.plot;
                relayout['xaxis.gridcolor'] = t.grid;
                relayout['yaxis.gridcolor'] = t.grid;
                relayout['xaxis.linecolor'] = t.axis;
                relayout['yaxis.linecolor'] = t.axis;
                relayout['xaxis.tickfont.color'] = t.tick;
                relayout['yaxis.tickfont.color'] = t.tick;
                relayout['xaxis.zerolinecolor'] = t.zeroline;
                relayout['yaxis.zerolinecolor'] = t.zeroline;
                relayout['font.color'] = t.font;
            }
        }

        try { Plotly.relayout(gd, relayout); } catch(_) {}

        // Linia: grubość
        if (fsLineWidth) {
            const w = parseInt(fsLineWidth.value, 10) || 3;
            const inds = getLineTraceIndices(gd);
            if (inds.length) {
                try { Plotly.restyle(gd, { 'line.width': w }, inds); } catch(_) {}
            }
        }
    }

    // Zainicjalizuj kontrolki na podstawie aktualnego layoutu
    function syncFsControlsFromLayout(layout) {
        if (!layout) return;
        if (fsLegend) fsLegend.checked = !!layout.showlegend;
        if (fsGrid) fsGrid.checked = layout.xaxis?.showgrid !== false && layout.yaxis?.showgrid !== false;
        if (fsZeroLines) fsZeroLines.checked = layout.xaxis?.zeroline !== false && layout.yaxis?.zeroline !== false;
        if (fsTicks) fsTicks.checked = layout.xaxis?.showticklabels !== false && layout.yaxis?.showticklabels !== false;
        if (fsEqualAspect) fsEqualAspect.checked = (layout.yaxis && layout.yaxis.scaleanchor === 'x');
        if (fsLineWidth) {
            try {
                const firstLine = (myChart?.data || []).find(t => t && t.type === 'scatter' && t.line);
                if (firstLine && firstLine.line && firstLine.line.width) fsLineWidth.value = firstLine.line.width;
            } catch(_) {}
        }
    }

    // Słuchacze kontrolek
    [fsLegend, fsGrid, fsZeroLines, fsTicks, fsEqualAspect, fsDark].forEach(el => {
        if (el) el.addEventListener('change', applyFsControls);
    });
    if (fsLineWidth) fsLineWidth.addEventListener('input', applyFsControls);
    if (fsStartMinimizedMobile) {
        fsStartMinimizedMobile.addEventListener('change', () => {
            try { localStorage.setItem('fsDockStartMinimizedMobile', fsStartMinimizedMobile.checked ? '1' : '0'); } catch(_) {}
        });
    }

    // Dopasuj zakresy w fullscreen w trybie kartezjańskim tak, aby punkty analizy (ekstrema, zera, itd.) były w pełni widoczne
    function expandRangeToFitMarkers(gd) {
        try {
            if (!gd || !gd.data || !gd.layout) return;
            const modeEl = document.getElementById('plotMode');
            const mode = modeEl ? modeEl.value : 'cartesian';
            if (mode !== 'cartesian') return;
            if (document.fullscreenElement !== chartContainer) return;
            // Zbierz min/max dla x i y na podstawie danych (z wyłączeniem null/NaN)
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            (gd.data || []).forEach(tr => {
                // Pomijaj ślady niekartezjańskie
                if (tr.type && tr.type.indexOf('polar') !== -1) return;
                const xs = tr.x || [];
                const ys = tr.y || [];
                for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
                    const xv = xs[i];
                    const yv = ys[i];
                    if (isFinite(xv)) { if (xv < minX) minX = xv; if (xv > maxX) maxX = xv; }
                    if (isFinite(yv)) { if (yv < minY) minY = yv; if (yv > maxY) maxY = yv; }
                }
            });
            if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) return;
            // Bieżące zakresy
            const curX = (gd.layout.xaxis && gd.layout.xaxis.range) ? gd.layout.xaxis.range.slice() : null;
            const curY = (gd.layout.yaxis && gd.layout.yaxis.range) ? gd.layout.yaxis.range.slice() : null;
            if (!curX || !curY) return;
            // Marginesy, aby znaczniki nie były obcięte
            const padX = Math.max( (maxX - minX) * 0.06, 0.5 );
            const padY = Math.max( (maxY - minY) * 0.10, 0.5 );
            const needExpandX = minX - padX < curX[0] || maxX + padX > curX[1];
            const needExpandY = minY - padY < curY[0] || maxY + padY > curY[1];
            const upd = {};
            if (needExpandX) {
                upd['xaxis.range'] = [ Math.min(curX[0], minX - padX), Math.max(curX[1], maxX + padX) ];
            }
            if (needExpandY) {
                upd['yaxis.range'] = [ Math.min(curY[0], minY - padY), Math.max(curY[1], maxY + padY) ];
            }
            if (Object.keys(upd).length) {
                Plotly.relayout(gd, upd).then(() => { try { updateFsRangeFromLayout(gd.layout); } catch(_) {} });
            }
        } catch(_) {}
    }

    // Przenoszenie (drag) panelu fsDock + zapamiętywanie pozycji
    function clamp(val, min, max){ return Math.max(min, Math.min(max, val)); }
    function restoreFsDockPosition(){
        if (!fsDock) return;
        const saved = localStorage.getItem('fsDockPos');
        if (!saved) return;
        try {
            const pos = JSON.parse(saved);
            const rect = chartContainer.getBoundingClientRect();
            const dockRect = fsDock.getBoundingClientRect();
            let x = clamp(pos.x, 0, rect.width - dockRect.width);
            let y = clamp(pos.y, 0, rect.height - dockRect.height);
            fsDock.style.left = x + 'px';
            fsDock.style.top = y + 'px';
            fsDock.style.bottom = 'auto';
        } catch(_) {}
    }
    (function setupDockDrag(){
        if (!fsDock || !fsDockHeader) return;
        let dragging = false; let startX=0, startY=0; let baseX=0, baseY=0;
        function onMove(e){ if(!dragging) return; const p = e.touches? e.touches[0]: e; const dx=p.clientX-startX, dy=p.clientY-startY; const rect=chartContainer.getBoundingClientRect(); const dockRect=fsDock.getBoundingClientRect(); let nx = clamp(baseX+dx, 0, rect.width-dockRect.width); let ny = clamp(baseY+dy, 0, rect.height-dockRect.height); fsDock.style.left=nx+'px'; fsDock.style.top=ny+'px'; fsDock.style.bottom='auto'; }
        function onUp(){ if(!dragging) return; dragging=false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onUp); try{ const rect=fsDock.getBoundingClientRect(); const parent=chartContainer.getBoundingClientRect(); const pos={ x: rect.left-parent.left, y: rect.top-parent.top }; localStorage.setItem('fsDockPos', JSON.stringify(pos)); }catch(_){} }
        function onDown(e){
            // Nie rozpoczynaj przeciągania, jeśli dotknięcie/klik nastąpił na przycisku zwijania lub innym kontrolce
            const tgt = e.target;
            if (tgt && (tgt.closest && (tgt.closest('#fsDockToggle') || tgt.closest('button') || tgt.closest('input') || tgt.closest('select') || tgt.closest('textarea')))) {
                return; // pozwól działać kliknięciu
            }
            const p = e.touches? e.touches[0]: e;
            const rect=fsDock.getBoundingClientRect(); const parent=chartContainer.getBoundingClientRect();
            startX=p.clientX; startY=p.clientY; baseX=rect.left-parent.left; baseY=rect.top-parent.top; dragging=true;
            document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, {passive:false}); document.addEventListener('touchend', onUp);
            e.preventDefault();
        }
        fsDockHeader.addEventListener('mousedown', onDown);
        fsDockHeader.addEventListener('touchstart', onDown, {passive:false});
    })();

    // === FS Dock collapsing (whole panel & per-section) + mobile minimize ===
    function applyFsDockCollapsed(){
        if (!fsDock) return;
        try {
            const collapsed = localStorage.getItem('fsDockCollapsed') === '1';
            if (collapsed) fsDock.classList.add('collapsed'); else fsDock.classList.remove('collapsed');
        } catch(_) {}
    }
    function toggleFsDockCollapsed(){
        if (!fsDock) return;
        fsDock.classList.toggle('collapsed');
        try { localStorage.setItem('fsDockCollapsed', fsDock.classList.contains('collapsed') ? '1' : '0'); } catch(_) {}
    }
    // Minimize (hide whole dock) for mobile, controlled by floating button
    const fsMobileToggle = document.getElementById('fsMobileToggle');
    function applyFsDockMinimized(){
        if (!fsDock) return;
        try {
            const minimized = localStorage.getItem('fsDockMinimized') === '1';
            if (minimized) fsDock.classList.add('minimized'); else fsDock.classList.remove('minimized');
        } catch(_) {}
    }
    function toggleFsDockMinimized(){
        if (!fsDock) return;
        fsDock.classList.toggle('minimized');
        try { localStorage.setItem('fsDockMinimized', fsDock.classList.contains('minimized') ? '1' : '0'); } catch(_) {}
    }
    if (fsDockToggle) {
        fsDockToggle.addEventListener('click', (e) => { e.stopPropagation(); toggleFsDockCollapsed(); });
    }
    if (fsDockHeader) {
        fsDockHeader.addEventListener('dblclick', (e) => { e.preventDefault(); toggleFsDockCollapsed(); });
    }
    if (fsMobileToggle) {
        fsMobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFsDockMinimized();
        });
    }

    function loadFsSectionState(){
        try { return JSON.parse(localStorage.getItem('fsDockSections')||'{}'); } catch(_) { return {}; }
    }
    function saveFsSectionState(state){
        try { localStorage.setItem('fsDockSections', JSON.stringify(state||{})); } catch(_) {}
    }
    function initFsSectionCollapsing(){
        if (!fsDock) return;
        const body = fsDock.querySelector('.fs-dock-body');
        if (!body) return;
        // Apply saved or default states to all sections
        const state = loadFsSectionState() || {};
        let stateChanged = false;
        body.querySelectorAll('.fs-dock-section[data-key]').forEach(sec => {
            const key = sec.getAttribute('data-key');
            // Default: collapse all sections except navigation ('nav')
            let collapsed = state.hasOwnProperty(key) ? !!state[key] : (key !== 'nav');
            // Persist default on first run so it's stable across sessions
            if (!state.hasOwnProperty(key)) { state[key] = collapsed; stateChanged = true; }
            if (collapsed) sec.classList.add('collapsed'); else sec.classList.remove('collapsed');
        });
        if (stateChanged) saveFsSectionState(state);
        // Bind a single delegated click handler once
        if (!body.dataset.collapseBound) {
            body.addEventListener('click', (e) => {
                // Find nearest title clicked
                const titleEl = e.target && (e.target.closest ? e.target.closest('.fs-dock-title') : null);
                if (!titleEl || !body.contains(titleEl)) return;
                // Ignore clicks originating from form controls inside title (if any)
                const tn = (e.target.tagName || '').toUpperCase();
                if (tn === 'INPUT' || tn === 'SELECT' || tn === 'BUTTON' || tn === 'TEXTAREA') return;
                const section = titleEl.closest('.fs-dock-section');
                if (!section) return;
                const key = section.getAttribute('data-key');
                section.classList.toggle('collapsed');
                const s = loadFsSectionState();
                s[key] = section.classList.contains('collapsed');
                saveFsSectionState(s);
            });
            body.dataset.collapseBound = '1';
        }
    }
    // Initialize immediately if elements are present
    try { initFsSectionCollapsing(); applyFsDockCollapsed(); applyFsDockMinimized(); } catch(_) {}

    // === Fullscreen Dock: Inputs for formulas and ranges ===
    function buildFsInputsUI() {
        if (!fsInputsContainer) return;
        const mode = (plotMode && plotMode.value) || 'cartesian';
        let html = '';
        if (mode === 'cartesian') {
            html = `
                <div class="fs-row">
                    <div>
                        <label for="fsFunction1">f₁(x) =</label>
                        <input type="text" id="fsFunction1" placeholder="np. sin(x) lub x^2">
                    </div>
                    <div>
                        <label for="fsFunction2">f₂(x) =</label>
                        <input type="text" id="fsFunction2" placeholder="druga funkcja (opcjonalnie)">
                    </div>
                </div>
                <div class="fs-grid-4col" style="margin-top:6px;">
                    <div><label for="fsXMin">X min</label><input type="text" id="fsXMin" placeholder="np. -2*pi"></div>
                    <div><label for="fsXMax">X max</label><input type="text" id="fsXMax" placeholder="np. 2*pi"></div>
                    <div><label for="fsYMin">Y min</label><input type="text" id="fsYMin"></div>
                    <div><label for="fsYMax">Y max</label><input type="text" id="fsYMax"></div>
                </div>
                <div class="hint">Podpowiedź: możesz wpisywać wyrażenia z π, np. pi/3, 2*pi.</div>
            `;
        } else if (mode === 'parametric') {
            html = `
                <div class="fs-row">
                    <div>
                        <label for="fsXParam">x(t) =</label>
                        <input type="text" id="fsXParam" placeholder="np. cos(t)">
                    </div>
                    <div>
                        <label for="fsYParam">y(t) =</label>
                        <input type="text" id="fsYParam" placeholder="np. sin(t)">
                    </div>
                </div>
                <div class="fs-grid-2col" style="margin-top:6px;">
                    <div><label for="fsTMin">t min</label><input type="text" id="fsTMin" placeholder="np. 0"></div>
                    <div><label for="fsTMax">t max</label><input type="text" id="fsTMax" placeholder="np. 2*pi"></div>
                </div>
            `;
        } else if (mode === 'polar') {
            html = `
                <div class="fs-row">
                    <div>
                        <label for="fsR">r(t) =</label>
                        <input type="text" id="fsR" placeholder="np. 1 + 0.5*cos(6*t)">
                    </div>
                </div>
                <div class="fs-grid-2col" style="margin-top:6px;">
                    <div><label for="fsThetaMin">θ min</label><input type="text" id="fsThetaMin" placeholder="0"></div>
                    <div><label for="fsThetaMax">θ max</label><input type="text" id="fsThetaMax" placeholder="2*pi"></div>
                </div>
            `;
        } else if (mode === '3d') {
            html = `
                <div class="fs-row">
                    <div>
                        <label for="fsSurface">z(x,y) =</label>
                        <input type="text" id="fsSurface" placeholder="np. sin(x)*cos(y)">
                    </div>
                </div>
                <div class="fs-grid-4col" style="margin-top:6px;">
                    <div><label for="fsXMin3D">X min</label><input type="text" id="fsXMin3D"></div>
                    <div><label for="fsXMax3D">X max</label><input type="text" id="fsXMax3D"></div>
                    <div><label for="fsYMin3D">Y min</label><input type="text" id="fsYMin3D"></div>
                    <div><label for="fsYMax3D">Y max</label><input type="text" id="fsYMax3D"></div>
                </div>
                <div class="fs-grid-2col" style="margin-top:6px;">
                    <div><label for="fsResolution3D">Rozdzielczość</label><input type="text" id="fsResolution3D" placeholder="np. 50"></div>
                </div>
            `;
        }
        fsInputsContainer.innerHTML = html;
        wireFsInputsForMode();
    }

    function wireFsInputsForMode() {
        const mode = (plotMode && plotMode.value) || 'cartesian';
        const enterToPlot = (el) => { if (!el) return; el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const btn = document.getElementById('plotButton'); if (btn) btn.click(); } }); };
        const mirrorSet = (fsEl, mainEl) => {
            if (!fsEl || !mainEl) return;
            // FS -> Main
            const forward = () => { if (mainEl.value !== fsEl.value) { mainEl.value = fsEl.value; mainEl.dispatchEvent(new Event('input', { bubbles: true })); } };
            fsEl.addEventListener('input', forward);
            fsEl.addEventListener('change', forward);
            enterToPlot(fsEl);
        };
        if (mode === 'cartesian') {
            mirrorSet(document.getElementById('fsFunction1'), document.getElementById('functionInput'));
            mirrorSet(document.getElementById('fsFunction2'), document.getElementById('function2Input'));
            mirrorSet(document.getElementById('fsXMin'), document.getElementById('xMin'));
            mirrorSet(document.getElementById('fsXMax'), document.getElementById('xMax'));
            mirrorSet(document.getElementById('fsYMin'), document.getElementById('yMin'));
            mirrorSet(document.getElementById('fsYMax'), document.getElementById('yMax'));
        } else if (mode === 'parametric') {
            mirrorSet(document.getElementById('fsXParam'), document.getElementById('xParamInput'));
            mirrorSet(document.getElementById('fsYParam'), document.getElementById('yParamInput'));
            mirrorSet(document.getElementById('fsTMin'), document.getElementById('tMinInput'));
            mirrorSet(document.getElementById('fsTMax'), document.getElementById('tMaxInput'));
        } else if (mode === 'polar') {
            mirrorSet(document.getElementById('fsR'), document.getElementById('rInput'));
            mirrorSet(document.getElementById('fsThetaMin'), document.getElementById('thetaMinInput'));
            mirrorSet(document.getElementById('fsThetaMax'), document.getElementById('thetaMaxInput'));
        } else if (mode === '3d') {
            mirrorSet(document.getElementById('fsSurface'), document.getElementById('surfaceInput'));
            mirrorSet(document.getElementById('fsXMin3D'), document.getElementById('xMin3D'));
            mirrorSet(document.getElementById('fsXMax3D'), document.getElementById('xMax3D'));
            mirrorSet(document.getElementById('fsYMin3D'), document.getElementById('yMin3D'));
            mirrorSet(document.getElementById('fsYMax3D'), document.getElementById('yMax3D'));
            mirrorSet(document.getElementById('fsResolution3D'), document.getElementById('resolution3D'));
        }
    }

    function syncFsInputsFromMain() {
        if (!fsInputsContainer || document.fullscreenElement !== chartContainer) return;
        const mode = (plotMode && plotMode.value) || 'cartesian';
        const copy = (fsId, mainId) => {
            const fsEl = document.getElementById(fsId);
            const mainEl = document.getElementById(mainId);
            if (fsEl && mainEl && fsEl.value !== mainEl.value) fsEl.value = mainEl.value;
        };
        if (mode === 'cartesian') {
            copy('fsFunction1','functionInput');
            copy('fsFunction2','function2Input');
            copy('fsXMin','xMin');
            copy('fsXMax','xMax');
            copy('fsYMin','yMin');
            copy('fsYMax','yMax');
        } else if (mode === 'parametric') {
            copy('fsXParam','xParamInput');
            copy('fsYParam','yParamInput');
            copy('fsTMin','tMinInput');
            copy('fsTMax','tMaxInput');
        } else if (mode === 'polar') {
            copy('fsR','rInput');
            copy('fsThetaMin','thetaMinInput');
            copy('fsThetaMax','thetaMaxInput');
        } else if (mode === '3d') {
            copy('fsSurface','surfaceInput');
            copy('fsXMin3D','xMin3D');
            copy('fsXMax3D','xMax3D');
            copy('fsYMin3D','yMin3D');
            copy('fsYMax3D','yMax3D');
            copy('fsResolution3D','resolution3D');
        }
    }

    // Pokaż/ukryj elementy w panelu fullscreen zależnie od trybu
    function updateFsDockModeVisibility() {
        const mode = (plotMode && plotMode.value) || 'cartesian';
        const show = (el, vis = true) => { if (!el) return; el.style.display = vis ? '' : 'none'; };
        // Pole między krzywymi tylko w kartezjańskim
        show(fsBetweenSection, mode === 'cartesian');
        // Całka a/b nie dotyczy 3D
        show(fsIntRangeRow, mode !== '3d');
        // Zaktualizuj podpis pochodnej w docku jak w panelu głównym
        const fsDerivLabel = document.getElementById('fsDerivativeLabelText');
        if (fsDerivLabel) {
            if (mode === 'cartesian') fsDerivLabel.textContent = "Rysuj/licz pochodną f'(x)";
            else if (mode === 'parametric') fsDerivLabel.textContent = 'Rysuj/licz dx/dt, dy/dt';
            else if (mode === 'polar') fsDerivLabel.textContent = 'Rysuj/licz dr/dθ';
        }
        // Analiza: pokaż właściwe pola jak w panelu bocznym
        const setLabelVis = (inputEl, vis) => {
            if (!inputEl) return;
            const label = inputEl.closest && inputEl.closest('label');
            if (label) label.style.display = vis ? '' : 'none';
        };
        if (mode === 'cartesian') {
            setLabelVis(fsZeros, true);
            setLabelVis(fsExtrema, true);
            setLabelVis(fsInflections, true);
            setLabelVis(fsIntersections, true);
            setLabelVis(fsDerivative, true);
        } else if (mode === 'parametric') {
            setLabelVis(fsZeros, false);
            setLabelVis(fsExtrema, false);
            setLabelVis(fsInflections, false);
            setLabelVis(fsIntersections, false);
            setLabelVis(fsDerivative, true);
        } else if (mode === 'polar') {
            setLabelVis(fsZeros, false);
            setLabelVis(fsExtrema, false);
            setLabelVis(fsInflections, false);
            setLabelVis(fsIntersections, false);
            setLabelVis(fsDerivative, true);
        } else if (mode === '3d') {
            setLabelVis(fsZeros, false);
            setLabelVis(fsExtrema, false);
            setLabelVis(fsInflections, false);
            setLabelVis(fsIntersections, false);
            setLabelVis(fsDerivative, false);
        }
    }

    // === Fullscreen Dock: Tryb i Renderowanie — dwukierunkowa synchronizacja ===
    function updateFsModeHelperText(mode) {
        if (!fsModeHelper) return;
        const helperTexts = {
            cartesian: 'Użyj zmiennej x do zdefiniowania funkcji, np. sin(x) lub x^2',
            parametric: 'Użyj zmiennej t do zdefiniowania obu równań x(t) i y(t)',
            polar: 'Użyj zmiennej t do zdefiniowania równania r(t) w układzie biegunowym',
            '3d': 'Użyj zmiennych x i y do zdefiniowania funkcji powierzchni z(x,y), np. sin(x)*cos(y)'
        };
        fsModeHelper.textContent = helperTexts[mode] || '';
    }
    function syncFsModeFromMain() {
        if (fsPlotMode && plotMode && fsPlotMode.value !== plotMode.value) fsPlotMode.value = plotMode.value;
        updateFsModeHelperText((plotMode && plotMode.value) || 'cartesian');
    }
    if (fsPlotMode && plotMode) {
        fsPlotMode.addEventListener('change', () => {
            if (plotMode.value !== fsPlotMode.value) {
                plotMode.value = fsPlotMode.value;
                plotMode.dispatchEvent(new Event('change', { bubbles:true }));
            }
            updateFsModeHelperText(fsPlotMode.value);
        });
        // Initialize helper text
        updateFsModeHelperText(plotMode.value);
    }

    function syncFsRenderFromMain() {
        const angleModeEl = document.getElementById('angleMode');
        const piAxisEl = document.getElementById('piAxisCheckbox');
        if (fsAngleMode && angleModeEl && fsAngleMode.value !== angleModeEl.value) fsAngleMode.value = angleModeEl.value;
        if (fsSamplingPreset && samplingPreset && fsSamplingPreset.value !== samplingPreset.value) fsSamplingPreset.value = samplingPreset.value;
        if (fsPiAxis && piAxisEl) fsPiAxis.checked = !!piAxisEl.checked;
    }
    // FS -> Main
    if (fsAngleMode) fsAngleMode.addEventListener('change', () => {
        const angleModeEl = document.getElementById('angleMode');
        if (angleModeEl && angleModeEl.value !== fsAngleMode.value) {
            angleModeEl.value = fsAngleMode.value;
            angleModeEl.dispatchEvent(new Event('change', { bubbles:true }));
        }
    });
    if (fsSamplingPreset) fsSamplingPreset.addEventListener('change', () => {
        if (samplingPreset && samplingPreset.value !== fsSamplingPreset.value) {
            samplingPreset.value = fsSamplingPreset.value;
            samplingPreset.dispatchEvent(new Event('change', { bubbles:true }));
        }
    });
    if (fsPiAxis) fsPiAxis.addEventListener('change', () => {
        const piAxisEl = document.getElementById('piAxisCheckbox');
        if (piAxisEl && piAxisEl.checked !== fsPiAxis.checked) {
            piAxisEl.checked = fsPiAxis.checked;
            piAxisEl.dispatchEvent(new Event('change', { bubbles:true }));
        }
    });
    // Main -> FS live sync
    const angleModeElLive = document.getElementById('angleMode');
    if (angleModeElLive) angleModeElLive.addEventListener('change', () => { try { syncFsRenderFromMain(); } catch(_) {} });
    if (samplingPreset) samplingPreset.addEventListener('change', () => { try { syncFsRenderFromMain(); } catch(_) {} });
    const piAxisElLive = document.getElementById('piAxisCheckbox');
    if (piAxisElLive) piAxisElLive.addEventListener('change', () => { try { syncFsRenderFromMain(); } catch(_) {} });

    // FS Nawigacja — podłącz do głównych akcji lub zastosuj fallback
    function fallbackAdjust(action) {
        if (!myChart) return;
        const gd = myChart;
        const xr = (gd.layout && gd.layout.xaxis && gd.layout.xaxis.range) ? gd.layout.xaxis.range.slice() : [parseNumberInput(xMinInput.value), parseNumberInput(xMaxInput.value)];
        const yr = (gd.layout && gd.layout.yaxis && gd.layout.yaxis.range) ? gd.layout.yaxis.range.slice() : [parseNumberInput(yMinInput.value), parseNumberInput(yMaxInput.value)];
        const xmid = (xr[0] + xr[1]) / 2;
        const ymid = (yr[0] + yr[1]) / 2;
        if (action === 'zoom-in') {
            const xhalf = (xr[1] - xr[0]) * (1 - ZOOM_FACTOR) / 2;
            const yhalf = (yr[1] - yr[0]) * (1 - ZOOM_FACTOR) / 2;
            Plotly.relayout(gd, { 'xaxis.range': [xmid - xhalf, xmid + xhalf], 'yaxis.range': [ymid - yhalf, ymid + yhalf] });
        } else if (action === 'zoom-out') {
            const xhalf = (xr[1] - xr[0]) * (1 + ZOOM_FACTOR) / 2;
            const yhalf = (yr[1] - yr[0]) * (1 + ZOOM_FACTOR) / 2;
            Plotly.relayout(gd, { 'xaxis.range': [xmid - xhalf, xmid + xhalf], 'yaxis.range': [ymid - yhalf, ymid + yhalf] });
        } else if (action === 'left') {
            const shift = (xr[1] - xr[0]) * PAN_FACTOR; Plotly.relayout(gd, { 'xaxis.range': [xr[0] - shift, xr[1] - shift] });
        } else if (action === 'right') {
            const shift = (xr[1] - xr[0]) * PAN_FACTOR; Plotly.relayout(gd, { 'xaxis.range': [xr[0] + shift, xr[1] + shift] });
        } else if (action === 'up') {
            const shift = (yr[1] - yr[0]) * PAN_FACTOR; Plotly.relayout(gd, { 'yaxis.range': [yr[0] + shift, yr[1] + shift] });
        } else if (action === 'down') {
            const shift = (yr[1] - yr[0]) * PAN_FACTOR; Plotly.relayout(gd, { 'yaxis.range': [yr[0] - shift, yr[1] - shift] });
        }
    }
    function bindFsNav(btn, mainId, action) {
        if (!btn) return;
        btn.addEventListener('click', () => {
            const mainBtn = document.getElementById(mainId);
            if (mainBtn && typeof mainBtn.onclick === 'function') mainBtn.onclick();
            else fallbackAdjust(action);
        });
    }
    bindFsNav(fsZoomIn, 'zoomIn', 'zoom-in');
    bindFsNav(fsZoomOut, 'zoomOut', 'zoom-out');
    bindFsNav(fsPanLeft, 'panLeft', 'left');
    bindFsNav(fsPanRight, 'panRight', 'right');
    bindFsNav(fsPanUp, 'panUp', 'up');
    bindFsNav(fsPanDown, 'panDown', 'down');

    // === Fullscreen Dock: Integrals ===
    function syncFsIntegralFromMain() {
        if (!document.fullscreenElement || document.fullscreenElement !== chartContainer) return;
        if (fsIntA && integralA && fsIntA.value !== integralA.value) fsIntA.value = integralA.value;
        if (fsIntB && integralB && fsIntB.value !== integralB.value) fsIntB.value = integralB.value;
    }
    if (fsIntA && integralA) {
        fsIntA.addEventListener('input', () => { if (integralA.value !== fsIntA.value) { integralA.value = fsIntA.value; integralA.dispatchEvent(new Event('input', { bubbles:true })); } });
        fsIntA.addEventListener('change', () => { integralA.dispatchEvent(new Event('change', { bubbles:true })); });
    }
    if (fsIntB && integralB) {
        fsIntB.addEventListener('input', () => { if (integralB.value !== fsIntB.value) { integralB.value = fsIntB.value; integralB.dispatchEvent(new Event('input', { bubbles:true })); } });
        fsIntB.addEventListener('change', () => { integralB.dispatchEvent(new Event('change', { bubbles:true })); });
    }
    if (fsIntegralButton) {
        fsIntegralButton.addEventListener('click', () => {
            const btn = document.getElementById('calculateIntegralButton');
            if (btn) btn.click();
        });
    }
    // Keep FS integrals in sync when main changes
    if (integralA) integralA.addEventListener('input', () => { try { syncFsIntegralFromMain(); } catch(_) {} });
    if (integralB) integralB.addEventListener('input', () => { try { syncFsIntegralFromMain(); } catch(_) {} });

    // === Fullscreen Dock: Pole między krzywymi ===
    function syncFsBetweenFromMain() {
        const mainA = document.getElementById('betweenA');
        const mainB = document.getElementById('betweenB');
        if (!mainA || !mainB) return;
        if (fsBetweenA && fsBetweenA.value !== mainA.value) fsBetweenA.value = mainA.value;
        if (fsBetweenB && fsBetweenB.value !== mainB.value) fsBetweenB.value = mainB.value;
    }
    if (fsBetweenA) {
        fsBetweenA.addEventListener('input', () => {
            const mainA = document.getElementById('betweenA');
            if (mainA && mainA.value !== fsBetweenA.value) { mainA.value = fsBetweenA.value; mainA.dispatchEvent(new Event('input', { bubbles:true })); }
        });
        fsBetweenA.addEventListener('change', () => {
            const mainA = document.getElementById('betweenA');
            if (mainA) mainA.dispatchEvent(new Event('change', { bubbles:true }));
        });
    }
    if (fsBetweenB) {
        fsBetweenB.addEventListener('input', () => {
            const mainB = document.getElementById('betweenB');
            if (mainB && mainB.value !== fsBetweenB.value) { mainB.value = fsBetweenB.value; mainB.dispatchEvent(new Event('input', { bubbles:true })); }
        });
        fsBetweenB.addEventListener('change', () => {
            const mainB = document.getElementById('betweenB');
            if (mainB) mainB.dispatchEvent(new Event('change', { bubbles:true }));
        });
    }
    if (fsBetweenButton) {
        fsBetweenButton.addEventListener('click', () => {
            const btn = document.getElementById('calculateBetweenButton');
            if (btn) btn.click();
        });
    }
    // Main -> FS sync for between controls
    const mainBetweenA = document.getElementById('betweenA');
    const mainBetweenB = document.getElementById('betweenB');
    if (mainBetweenA) mainBetweenA.addEventListener('input', () => { try { syncFsBetweenFromMain(); } catch(_) {} });
    if (mainBetweenB) mainBetweenB.addEventListener('input', () => { try { syncFsBetweenFromMain(); } catch(_) {} });

    // === Fullscreen Dock: Parameters mirror ===
    function buildFsParamsUI() {
        if (!fsParamsContainer) return;
        const mainContainer = document.getElementById('paramControls');
        if (!mainContainer) { fsParamsContainer.innerHTML = ''; return; }
        const sliders = mainContainer.querySelectorAll('input[type="range"][id^="slider-"]');
        if (!sliders.length) {
            fsParamsContainer.innerHTML = '<div style="font-size:12px;color:#78909c;">Brak parametrów</div>';
            return;
        }
        const parts = [];
        sliders.forEach(inp => {
            const name = inp.id.replace(/^slider-/, '');
            const val = inp.value;
            const min = inp.min;
            const max = inp.max;
            const step = inp.step;
            parts.push(`
                <div class="fs-param" data-name="${name}">
                    <div class="fs-param-head"><strong>${name}</strong><span class="fs-param-value">${Number(val).toFixed(2)}</span></div>
                    <input type="range" id="fs-slider-${name}" min="${min}" max="${max}" step="${step}" value="${val}">
                </div>
            `);
        });
        fsParamsContainer.innerHTML = parts.join('');
        // Wire events FS -> main
        fsParamsContainer.querySelectorAll('input[type="range"]').forEach(fsSl => {
            const name = fsSl.id.replace(/^fs-slider-/, '');
            const mainSl = document.getElementById(`slider-${name}`);
            const valueEl = fsSl.parentElement.querySelector('.fs-param-value');
            fsSl.addEventListener('input', () => {
                if (valueEl) valueEl.textContent = Number(fsSl.value).toFixed(2);
                if (mainSl && mainSl.value !== fsSl.value) {
                    mainSl.value = fsSl.value;
                    mainSl.dispatchEvent(new Event('input', { bubbles:true }));
                }
            });
            fsSl.addEventListener('change', () => {
                if (mainSl) mainSl.dispatchEvent(new Event('change', { bubbles:true }));
            });
        });
    }
    function syncFsParamsFromMain() {
        if (!fsParamsContainer) return;
        fsParamsContainer.querySelectorAll('input[type="range"]').forEach(fsSl => {
            const name = fsSl.id.replace(/^fs-slider-/, '');
            const mainSl = document.getElementById(`slider-${name}`);
            if (mainSl) {
                if (fsSl.min !== mainSl.min) fsSl.min = mainSl.min;
                if (fsSl.max !== mainSl.max) fsSl.max = mainSl.max;
                if (fsSl.step !== mainSl.step) fsSl.step = mainSl.step;
                if (fsSl.value !== mainSl.value) {
                    fsSl.value = mainSl.value;
                    const valueEl = fsSl.parentElement.querySelector('.fs-param-value');
                    if (valueEl) valueEl.textContent = Number(fsSl.value).toFixed(2);
                }
            }
        });
    }
    // Observe paramControls for structural changes and value inputs
    const paramControls = document.getElementById('paramControls');
    if (paramControls) {
        const mo = new MutationObserver(() => { if (document.fullscreenElement === chartContainer) { buildFsParamsUI(); syncFsParamsFromMain(); } });
        mo.observe(paramControls, { childList:true, subtree:true });
        paramControls.addEventListener('input', (e) => {
            if (document.fullscreenElement === chartContainer && e.target && e.target.type === 'range') {
                syncFsParamsFromMain();
            }
        });
    }

    // Analiza: synchronizacja i przełączniki
    function syncFsAnalysisFromMain() {
        if (fsZeros) fsZeros.checked = !!document.getElementById('zerosCheckbox')?.checked;
        if (fsExtrema) fsExtrema.checked = !!document.getElementById('extremaCheckbox')?.checked;
        if (fsInflections) fsInflections.checked = !!document.getElementById('inflectionsCheckbox')?.checked;
        if (fsIntersections) fsIntersections.checked = !!document.getElementById('intersectionsCheckbox')?.checked;
        if (fsDerivative) fsDerivative.checked = !!document.getElementById('derivativePlotCheckbox')?.checked;
    }
    function toggleMainCheckbox(id, checked) {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.checked !== checked) { el.checked = checked; el.dispatchEvent(new Event('change', { bubbles: true })); }
        // po zmianie uruchom rysowanie, aby przeliczyć analizy (lekko, bo i tak robimy w wątku)
        const plotButton = document.getElementById('plotButton');
        if (plotButton) plotButton.click();
    }
    [
        [fsZeros, 'zerosCheckbox'],
        [fsExtrema, 'extremaCheckbox'],
        [fsInflections, 'inflectionsCheckbox'],
        [fsIntersections, 'intersectionsCheckbox'],
        [fsDerivative, 'derivativePlotCheckbox']
    ].forEach(([el, id]) => {
        if (el) el.addEventListener('change', () => toggleMainCheckbox(id, el.checked));
    });

    // Śledź ostatnio aktywne pole wprowadzania
    let lastActiveInput = null;
    const inputs = ['functionInput', 'function2Input', 'xParamInput', 'yParamInput', 'rInput'];
    
    // Nasłuchuj fokus na polach wprowadzania
    inputs.push('surfaceInput'); // Dodaj pole powierzchni 3D do śledzonych inputów
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('focus', () => {
                lastActiveInput = input;
            });
        }
    });

    // Obsługa kliknięć w szybkie funkcje: zawsze wpisuj do pola w tym samym wierszu
    document.querySelectorAll('.quick-functions span').forEach(span => {
        span.addEventListener('click', (e) => {
            const func = e.target.getAttribute('data-func');
            if (!func) return;

            // Znajdź kontener wiersza i skojarzone INPUT
            const field = e.target.closest('.function-field');
            let targetInput = field ? field.querySelector('input[type="text"]') : null;

            // Jeśli nie znaleziono po strukturze DOM, użyj poprzedniej logiki jako fallback
            if (!targetInput) {
                if (lastActiveInput) targetInput = lastActiveInput;
                else return insertFunction(func);
            }

            try {
                // Wstaw z zachowaniem kursora (nawet gdy input nie miał fokusa)
                const start = targetInput.selectionStart ?? targetInput.value.length;
                const end = targetInput.selectionEnd ?? targetInput.value.length;
                const text = targetInput.value || '';
                targetInput.value = text.substring(0, start) + func + text.substring(end);
                targetInput.focus();
                targetInput.setSelectionRange(start + func.length, start + func.length);
                lastActiveInput = targetInput;
            } catch (_) {
                targetInput.value = (targetInput.value || '') + func;
                targetInput.focus();
            }
        });
    });

    // Inline presety są zawsze widoczne w aktywnej sekcji (steruje tym updateModeUI)

    // Funkcja do aktualizacji pomocy i przykładów
    function updateModeUI(mode) {
    // Ukryj tylko grupy inputów trybów; szybkie funkcje są teraz inline i będą ukrywane razem z grupą
        document.getElementById('cartesianInputs').style.display = 'none';
        document.getElementById('parametricInputs').style.display = 'none';
        document.getElementById('polarInputs').style.display = 'none';
        document.getElementById('3dInputs').style.display = 'none';
        
    // Szybkie funkcje są osadzone przy polach i pokażą się wraz z grupą
        
        // Pokaż odpowiednie pola wprowadzania
        const inputsId = mode + 'Inputs';
        const inputs = document.getElementById(inputsId);
        if (inputs) inputs.style.display = 'block';
        // Upewnij się, że inline preset toolbary w aktywnej grupie są widoczne
        if (inputs) {
            inputs.querySelectorAll('.inline-presets').forEach(el => el.style.display = 'flex');
        }

        // Ustaw domyślne wartości funkcji/zakresów dla ładnego i szybkiego startu (tylko gdy puste)
        const isEmpty = (v) => v == null || String(v).trim() === '';
        let justDefaulted = false;
        if (mode === 'cartesian') {
            // Funkcja sinusoidalna - dobrze wygląda w szerszym przedziale
            if (functionInput && isEmpty(functionInput.value)) { functionInput.value = 'sin(x)'; justDefaulted = true; }
            if (function2Input && isEmpty(function2Input.value)) { function2Input.value = ''; }
            // Domyślnie 20x20 pole: -10..10 na obu osiach dla lepszej widoczności sin(x)
            if (xMinInput && isEmpty(xMinInput.value)) xMinInput.value = '-10';
            if (xMaxInput && isEmpty(xMaxInput.value)) xMaxInput.value = '10';
            if (yMinInput && isEmpty(yMinInput.value)) yMinInput.value = '-2';
            if (yMaxInput && isEmpty(yMaxInput.value)) yMaxInput.value = '2';
            // Domyślnie nie przełączaj osi X na wielokrotności pi
            const piAxis = document.getElementById('piAxisCheckbox');
            if (piAxis && justDefaulted) piAxis.checked = false;
        } else if (mode === 'parametric') {
            // Gładka parabola bez trygonometrii: x=t, y=t^2
            if (xParamInput && isEmpty(xParamInput.value)) { xParamInput.value = 't'; justDefaulted = true; }
            if (yParamInput && isEmpty(yParamInput.value)) { yParamInput.value = 't^2'; justDefaulted = true; }
            const tMinEl = document.getElementById('tMinInput');
            const tMaxEl = document.getElementById('tMaxInput');
            if (tMinEl && isEmpty(tMinEl.value)) tMinEl.value = '-2';
            if (tMaxEl && isEmpty(tMaxEl.value)) tMaxEl.value = '2';
            if (xMinInput && isEmpty(xMinInput.value)) xMinInput.value = '-2.5';
            if (xMaxInput && isEmpty(xMaxInput.value)) xMaxInput.value = '2.5';
            if (yMinInput && isEmpty(yMinInput.value)) yMinInput.value = '-0.5';
            if (yMaxInput && isEmpty(yMaxInput.value)) yMaxInput.value = '4.5';
        } else if (mode === 'polar') {
            // Prosta spirala: r(t) = 0.2*t (bez trygonometrii)
            if (rInput && isEmpty(rInput.value)) { rInput.value = '0.2*t'; justDefaulted = true; }
            const thMinEl = document.getElementById('thetaMinInput');
            const thMaxEl = document.getElementById('thetaMaxInput');
            if (thMinEl && isEmpty(thMinEl.value)) thMinEl.value = '0';
            if (thMaxEl && isEmpty(thMaxEl.value)) thMaxEl.value = '6.283';
            if (xMinInput && isEmpty(xMinInput.value)) xMinInput.value = '-4';
            if (xMaxInput && isEmpty(xMaxInput.value)) xMaxInput.value = '4';
            if (yMinInput && isEmpty(yMinInput.value)) yMinInput.value = '-4';
            if (yMaxInput && isEmpty(yMaxInput.value)) yMaxInput.value = '4';
        } else if (mode === '3d') {
            const s = document.getElementById('surfaceInput');
            if (s) {
                // Przyjemna paraboloida: z = x^2 + y^2 (bez trygonometrii)
                if (isEmpty(s.value)) { s.value = 'x^2 + y^2'; justDefaulted = true; }
                s.focus();
                try { const len = s.value.length; s.setSelectionRange(len, len); } catch(_) {}
            }
            const xMin3D = document.getElementById('xMin3D');
            const xMax3D = document.getElementById('xMax3D');
            const yMin3D = document.getElementById('yMin3D');
            const yMax3D = document.getElementById('yMax3D');
            const res3D = document.getElementById('resolution3D');
            if (xMin3D && isEmpty(xMin3D.value)) xMin3D.value = '-5';
            if (xMax3D && isEmpty(xMax3D.value)) xMax3D.value = '5';
            if (yMin3D && isEmpty(yMin3D.value)) yMin3D.value = '-5';
            if (yMax3D && isEmpty(yMax3D.value)) yMax3D.value = '5';
            if (res3D && isEmpty(res3D.value)) res3D.value = '40';
            // Jeśli dostępny, odśwież wykryte parametry, aby pokazać suwaki a,b,c
            try { if (typeof paramsUpdater !== 'undefined' && paramsUpdater) paramsUpdater(); } catch(_) {}
        }
        
        // Aktualizuj tekst pomocniczy
        const helperTexts = {
            cartesian: 'Użyj zmiennej x do zdefiniowania funkcji, np. sin(x) lub x^2',
            parametric: 'Użyj zmiennej t do zdefiniowania obu równań x(t) i y(t)',
            polar: 'Użyj zmiennej t do zdefiniowania równania r(t) w układzie biegunowym',
            '3d': 'Użyj zmiennych x i y do zdefiniowania funkcji powierzchni z(x,y), np. sin(x)*cos(y)'
        };
        modeHelper.textContent = helperTexts[mode] || '';

        // Tryb 3D: ustaw domyślną funkcję i fokus, a także zainicjuj suwaki parametrów
        // (Sekcja 3D domyślna została przeniesiona wyżej, aby ustawić ładne wartości startowe)
    }

    // Słuchacz zmiany trybu
    if (plotMode) {
        plotMode.addEventListener('change', (e) => {
            updateModeUI(e.target.value);
            // Clear all analysis data when mode changes
            clearAllAnalysisData();
            // Trigger replot to clear visualization
            if (plotButton) plotButton.click();
            // If we are in fullscreen, rebuild fs inputs for the new mode
            if (document.fullscreenElement === chartContainer) {
                try { buildFsInputsUI(); syncFsInputsFromMain(); syncFsIntegralFromMain(); syncFsBetweenFromMain(); buildFsParamsUI(); syncFsParamsFromMain(); syncFsRenderFromMain(); syncFsModeFromMain(); updateFsDockModeVisibility(); } catch(_) {}
            }
            // Update FS plot mode selector/helper if present (even outside fullscreen)
            try { syncFsModeFromMain(); updateFsDockModeVisibility(); } catch(_) {}
        });
        // Inicjalizacja przy załadowaniu
        updateModeUI(plotMode.value);
    }

    // Przyciski nawigacji
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const panLeftBtn = document.getElementById('panLeft');
    const panRightBtn = document.getElementById('panRight');
    const panUpBtn = document.getElementById('panUp');
    const panDownBtn = document.getElementById('panDown');
    const autoFitBtn = document.getElementById('autoFit');

    // Konfiguracja nawigacji
    const ZOOM_FACTOR = 0.1;
    const PAN_FACTOR = 0.2;

    // Plot mode elements (cartesian/parametric/polar)
    const plotModeSelect = document.getElementById('plotMode');
    const parametricInputs = document.getElementById('parametricInputs');
    const polarInputs = document.getElementById('polarInputs');
    const cartesianInputs = document.getElementById('cartesianInputs');
    const xParamInput = document.getElementById('xParamInput');
    const yParamInput = document.getElementById('yParamInput');
    const tMinInput = document.getElementById('tMinInput');
    const tMaxInput = document.getElementById('tMaxInput');
    const rInput = document.getElementById('rInput');
    const thetaMinInput = document.getElementById('thetaMinInput');
    const thetaMaxInput = document.getElementById('thetaMaxInput');

    function updateModeVisibility() {
        const mode = (plotModeSelect && plotModeSelect.value) || 'cartesian';

        if (parametricInputs) parametricInputs.style.display = (mode === 'parametric') ? 'block' : 'none';
        if (polarInputs) polarInputs.style.display = (mode === 'polar') ? 'block' : 'none';
        if (cartesianInputs) cartesianInputs.style.display = (mode === 'cartesian') ? 'block' : 'none';

    const zerosCheckbox = document.getElementById('zerosCheckbox');
    const extremaCheckbox = document.getElementById('extremaCheckbox');
    const intersectionsCheckbox = document.getElementById('intersectionsCheckbox');
    const inflectionsCheckbox = document.getElementById('inflectionsCheckbox');
    const inflectionsQualityWrap = document.getElementById('inflectionsQualityWrap');
    const inflectionsQuality = document.getElementById('inflectionsQuality');
    const derivativePlotCheckbox = document.getElementById('derivativePlotCheckbox');
    const integralControls = document.querySelector('.integral-controls');
    const betweenCurvesControls = document.querySelector('.between-curves-controls');

        if (mode === 'cartesian') {
            if (zerosCheckbox) zerosCheckbox.parentElement.style.display = 'block';
            if (extremaCheckbox) extremaCheckbox.parentElement.style.display = 'block';
            if (intersectionsCheckbox) intersectionsCheckbox.parentElement.style.display = 'block';
            if (inflectionsCheckbox) inflectionsCheckbox.parentElement.style.display = 'block';
            if (inflectionsQualityWrap) inflectionsQualityWrap.style.display = 'block';
            if (derivativePlotCheckbox) {
                derivativePlotCheckbox.parentElement.style.display = 'block';
                updateDerivativeLabel(derivativePlotCheckbox, "Rysuj/licz pochodną f'(x)");
            }
            if (integralControls) {
                integralControls.style.display = 'block';
                updateIntegralLabel(mode);
            }
            if (betweenCurvesControls) {
                betweenCurvesControls.style.display = 'block';
            }
        } else if (mode === 'parametric') {
            if (zerosCheckbox) zerosCheckbox.parentElement.style.display = 'none';
            if (extremaCheckbox) extremaCheckbox.parentElement.style.display = 'none';
            if (intersectionsCheckbox) intersectionsCheckbox.parentElement.style.display = 'none';
            if (inflectionsCheckbox) inflectionsCheckbox.parentElement.style.display = 'none';
            if (inflectionsQualityWrap) inflectionsQualityWrap.style.display = 'none';
            if (derivativePlotCheckbox) {
                derivativePlotCheckbox.parentElement.style.display = 'block';
                updateDerivativeLabel(derivativePlotCheckbox, "Rysuj/licz dx/dt, dy/dt");
            }
            if (integralControls) {
                integralControls.style.display = 'block';
                updateIntegralLabel(mode);
            }
            if (betweenCurvesControls) {
                betweenCurvesControls.style.display = 'none';
            }
        } else if (mode === 'polar') {
            if (zerosCheckbox) zerosCheckbox.parentElement.style.display = 'none';
            if (extremaCheckbox) extremaCheckbox.parentElement.style.display = 'none';
            if (intersectionsCheckbox) intersectionsCheckbox.parentElement.style.display = 'none';
            if (inflectionsCheckbox) inflectionsCheckbox.parentElement.style.display = 'none';
            if (inflectionsQualityWrap) inflectionsQualityWrap.style.display = 'none';
            if (derivativePlotCheckbox) {
                derivativePlotCheckbox.parentElement.style.display = 'block';
                updateDerivativeLabel(derivativePlotCheckbox, "Rysuj/licz dr/dθ");
            }
            if (integralControls) {
                integralControls.style.display = 'block';
                updateIntegralLabel(mode);
            }
            if (betweenCurvesControls) {
                betweenCurvesControls.style.display = 'none';
            }
        } else if (mode === '3d') {
            if (zerosCheckbox) zerosCheckbox.parentElement.style.display = 'none';
            if (extremaCheckbox) extremaCheckbox.parentElement.style.display = 'none';
            if (intersectionsCheckbox) intersectionsCheckbox.parentElement.style.display = 'none';
            if (inflectionsCheckbox) inflectionsCheckbox.parentElement.style.display = 'none';
            if (inflectionsQualityWrap) inflectionsQualityWrap.style.display = 'none';
            if (derivativePlotCheckbox) derivativePlotCheckbox.parentElement.style.display = 'none';
            if (integralControls) integralControls.style.display = 'none';
            if (betweenCurvesControls) betweenCurvesControls.style.display = 'none';
        }

        function updateDerivativeLabel(checkbox, newText) {
            const spanElement = document.getElementById('derivativeLabelText');
            if (spanElement) {
                spanElement.textContent = newText;
            }
        }

        function updateIntegralLabel(selectedMode) {
            const integralLabelSpan = document.getElementById('integralLabelText');
            const integralButton = document.getElementById('calculateIntegralButton');

            if (selectedMode === 'cartesian') {
                if (integralLabelSpan) {
                    integralLabelSpan.textContent = 'Całka oznaczona:';
                }
                if (integralButton) {
                    integralButton.textContent = 'Oblicz i zacieniuj';
                }
            } else if (selectedMode === 'parametric') {
                if (integralLabelSpan) {
                    integralLabelSpan.textContent = 'Całka krzywoliniowa (t):';
                }
                if (integralButton) {
                    integralButton.textContent = 'Oblicz długość krzywej';
                }
            } else if (selectedMode === 'polar') {
                if (integralLabelSpan) {
                    integralLabelSpan.textContent = 'Pole obszaru (θ):';
                }
                if (integralButton) {
                    integralButton.textContent = 'Oblicz pole';
                }
                if (betweenCurvesControls) {
                    betweenCurvesControls.style.display = 'none';
                }
            }
        }

        try {
            if (typeof paramsUpdater !== 'undefined' && paramsUpdater) paramsUpdater();
        } catch (e) {
            // paramsUpdater not ready yet; will be initialized shortly
        }
    }

    if (plotModeSelect) {
        plotModeSelect.addEventListener('change', updateModeVisibility);
        updateModeVisibility();
    }

    // Helper: zaokrąglanie do 2 miejsc po przecinku
    function roundRange(value) {
        return Math.round(value * 100) / 100;
    }

    // Helper: walidacja zakresu
    function validateRange(value) {
        const num = parseFloat(value);
        if (!isFinite(num)) return 0;
        if (num < -1000) return -1000;
        if (num > 1000) return 1000;
        return num;
    }

    // Helper: parse number-like input allowing expressions with pi/π
    function parseNumberInput(raw) {
        if (raw == null) return NaN;
        const s = String(raw).trim()
            .replace(/π/gi, 'pi')
            .replace(/,/g, '.');
        if (s === '') return NaN;
        // Fast path: plain number
        const direct = Number(s);
        if (isFinite(direct)) return direct;
        // Fallback: evaluate with math.js
        try {
            const v = math.evaluate(s);
            return (isFinite(v) ? v : NaN);
        } catch (_) {
            return NaN;
        }
    }

    // Helper: parse number-like input allowing expressions with pi/π
    function parseNumberInput(raw) {
        if (raw == null) return NaN;
        const s = String(raw).trim()
            .replace(/π/gi, 'pi')
            .replace(/,/g, '.');
        if (s === '') return NaN;
        // Fast path: plain number
        const direct = Number(s);
        if (isFinite(direct)) return direct;
        // Fallback: evaluate with math.js
        try {
            const v = math.evaluate(s);
            return (isFinite(v) ? v : NaN);
        } catch (_) {
            return NaN;
        }
    }

    // Nie przywracamy zakresów z localStorage - zawsze startujemy z czystymi polami
    // Domyślne wartości będą ustawione przez updateModeUI() w zależności od trybu
    let myChart = null; // referencja do wykresu Plotly (graph div)
    let currentIntegralTrace = null; // track shaded integral area (can be a single trace or an array of traces)
    let currentIntegralShapes = null; // layout shapes for integral (band + boundaries)
    let currentIntegralAnnotations = null; // layout annotations for integral (labels a, b)
    // currentAnalysisData is now declared globally at top of file for 3D access
    let currentPolarIntegralTraces = null; // polar wedge and optional label marker
    let currentParametricHighlightTrace = null; // highlighted segment for t in [a,b]
    let currentAreaBetweenTrace = null;

    // Calculator worker - handles heavy computations
    let calcWorker = null;
    try {
        // Cache-bust worker to avoid stale code in browsers
        calcWorker = new Worker('calculator-worker.js?v=20251031');
    } catch (e) {
        console.warn('Nie udało się utworzyć Web Workera:', e);
        calcWorker = null;
    }

    // Helper function to render math formulas with KaTeX
    function renderMathFormula(formula) {
        if (typeof katex === 'undefined') {
            // KaTeX not loaded yet, return plain text
            return formula;
        }
        try {
            return katex.renderToString(formula, {
                throwOnError: false,
                displayMode: false
            });
        } catch (e) {
            // If KaTeX fails, return original formula
            return formula;
        }
    }

    // Function to display analysis results
    function displayAnalysisResults() {
        const insightsToggle = document.getElementById('insightsToggle');
        const fsAnalysisEl = document.getElementById('fsAnalysisResultsContent');
    const { zeros, extrema, inflections, integral, intersections, derivative } = currentAnalysisData;
        const parts = [];
        
        // Display derivative formulas based on mode
        if (derivative) {
            if (derivative.dx && derivative.dy) {
                // Parametric mode
                const dxRendered = renderMathFormula(`\\frac{dx}{dt} = ${derivative.dx}`);
                const dyRendered = renderMathFormula(`\\frac{dy}{dt} = ${derivative.dy}`);
                parts.push(`<div style="margin-bottom:10px;line-height:1.8;"><strong style="font-size:14px;color:#2c3e50;">Pochodne parametryczne:</strong><br><span style="font-size:13px;color:#495057;">${dxRendered}</span><br><span style="font-size:13px;color:#495057;">${dyRendered}</span></div>`);
            } else if (derivative.dzDx && derivative.dzDy) {
                // 3D mode
                const dzDxRendered = renderMathFormula(`\\frac{\\partial z}{\\partial x} = ${derivative.dzDx}`);
                const dzDyRendered = renderMathFormula(`\\frac{\\partial z}{\\partial y} = ${derivative.dzDy}`);
                parts.push(`<div style="margin-bottom:10px;line-height:1.8;"><strong style="font-size:14px;color:#2c3e50;">Pochodne cząstkowe:</strong><br><span style="font-size:13px;color:#495057;">${dzDxRendered}</span><br><span style="font-size:13px;color:#495057;">${dzDyRendered}</span></div>`);
            } else if (typeof derivative === 'string' && derivative.trim() !== '') {
                // String derivative: need to determine if cartesian or polar by checking current mode
                const modeEl = document.getElementById('plotMode');
                const currentMode = modeEl ? modeEl.value : 'cartesian';
                
                if (currentMode === 'polar') {
                    // Polar mode
                    const drRendered = renderMathFormula(`\\frac{dr}{d\\theta} = ${derivative}`);
                    parts.push(`<div style="margin-bottom:10px;line-height:1.8;"><strong style="font-size:14px;color:#2c3e50;">Pochodna biegunowa:</strong><br><span style="font-size:13px;color:#495057;">${drRendered}</span></div>`);
                } else if (currentMode === 'cartesian') {
                    // Cartesian mode
                    const fPrimeRendered = renderMathFormula(`f'(x) = ${derivative}`);
                    parts.push(`<div style="margin-bottom:10px;line-height:1.8;"><strong style="font-size:14px;color:#2c3e50;">Pochodna f₁(x):</strong><br><span style="font-size:13px;color:#495057;">${fPrimeRendered}</span></div>`);
                }
            }
        }
        
        if (zeros && zeros.length > 0) {
            const zerosList = zeros.map(p => `x = ${p.x.toFixed(4)}`).join(', ');
            parts.push(`<div style="margin-bottom:12px;line-height:1.8;"><strong style="font-size:14px;color:#1976d2;">🎯 Miejsca zerowe:</strong><br><span style="font-size:13px;color:#37474f;">${zerosList}</span></div>`);
        }
        
        if (extrema && extrema.length > 0) {
            const extremaList = extrema.map(p => {
                const tag = p.type === 'min' ? 'min' : (p.type === 'max' ? 'max' : 'siodłowy');
                const emoji = p.type === 'min' ? '📉' : (p.type === 'max' ? '📈' : '〰️');
                return `${emoji} (${p.x.toFixed(4)}, ${p.y.toFixed(4)}) <em>${tag}</em>`;
            }).join('<br>');
            parts.push(`<div style="margin-bottom:12px;line-height:1.8;"><strong style="font-size:14px;color:#1976d2;">⛰️ Ekstrema:</strong><br><span style="font-size:13px;color:#37474f;">${extremaList}</span></div>`);
        }

        // Inflection points
        if (inflections && inflections.length > 0) {
            const inflList = inflections.map(p => `(${p.x.toFixed(4)}, ${p.y.toFixed(4)})`).join(', ');
            parts.push(`<div style="margin-bottom:12px;line-height:1.8;"><strong style="font-size:14px;color:#6a1b9a;">🔄 Punkty przegięcia:</strong><br><span style="font-size:13px;color:#4527a0;">${inflList}</span></div>`);
        }
        
        if (intersections && intersections.length > 0) {
            const intersectionsList = intersections.map(p => `(${p.x.toFixed(4)}, ${p.y.toFixed(4)})`).join(', ');
            parts.push(`<div style="margin-bottom:12px;line-height:1.8;"><strong style="font-size:14px;color:#1976d2;">✖️ Punkty przecięcia:</strong><br><span style="font-size:13px;color:#37474f;">${intersectionsList}</span></div>`);
        }
        
        if (integral !== null && integral !== undefined) {
            const mode = integral.mode || 'cartesian';
            let title = 'Całka oznaczona';
            let emoji = '∫';
            let rangeTxt = '';
            if (mode === 'cartesian') {
                title = 'Całka ∫ f(x) dx';
                emoji = '📊';
                if (isFinite(integral.a) && isFinite(integral.b)) rangeTxt = `[${integral.a.toFixed(2)}, ${integral.b.toFixed(2)}]`;
            } else if (mode === 'parametric') {
                title = 'Całka krzywoliniowa ∫ y dx';
                emoji = '〰️';
                if (isFinite(integral.a) && isFinite(integral.b)) rangeTxt = `t∈[${integral.a.toFixed(2)}, ${integral.b.toFixed(2)}]`;
            } else if (mode === 'polar') {
                title = 'Pole w biegunowych ½∫ r(θ)² dθ';
                emoji = '🎯';
                if (isFinite(integral.a) && isFinite(integral.b)) rangeTxt = `θ∈[${integral.a.toFixed(2)}, ${integral.b.toFixed(2)}]`;
            } else if (mode === '3d') {
                title = 'Podwójna całka ∬ z(x,y) dA';
                emoji = '📦';
                if (integral.xRange && integral.yRange) {
                    rangeTxt = `x∈[${integral.xRange.min.toFixed(2)}, ${integral.xRange.max.toFixed(2)}], y∈[${integral.yRange.min.toFixed(2)}, ${integral.yRange.max.toFixed(2)}]`;
                }
            }
            const rangeLabel = rangeTxt ? ` ${rangeTxt}` : '';
            parts.push(`<div style="margin-bottom:12px;line-height:1.8;background:linear-gradient(135deg,#e3f2fd 0%,#bbdefb 100%);padding:10px;border-radius:8px;border-left:4px solid #1976d2;"><strong style="font-size:15px;color:#1565c0;">${emoji} ${title}${rangeLabel}:</strong><br><span style="font-size:16px;color:#0d47a1;font-weight:700;">${Number(integral.value).toFixed(6)}</span></div>`);
        }
        
        // Display area between curves result
        if (currentAnalysisData.areaBetween !== null && currentAnalysisData.areaBetween !== undefined) {
            const { value, a, b } = currentAnalysisData.areaBetween;
            const title = 'Pole między krzywymi ∫|f₁(x)-f₂(x)|dx';
            const rangeTxt = (isFinite(a) && isFinite(b)) ? `[${a.toFixed(2)}, ${b.toFixed(2)}]` : '';
            const areaValue = Number(value);
            const valueLabel = isFinite(areaValue) ? areaValue.toFixed(6) : '—';
            parts.push(`<div style="margin-bottom:12px;line-height:1.8;background:linear-gradient(135deg,#fff3e0 0%,#ffe0b2 100%);padding:10px;border-radius:8px;border-left:4px solid #f57c00;"><strong style="font-size:15px;color:#e65100;">📐 ${title} ${rangeTxt}:</strong><br><span style="font-size:16px;color:#bf360c;font-weight:700;">${valueLabel}</span></div>`);
        }
        
        const placeholder = '<div style="color:#6c757d;font-size:13px;">Brak wyników analizy. Włącz opcje w panelu „Analiza” i narysuj wykres.</div>';
        const htmlOut = parts.length > 0 ? parts.join('') : placeholder;
        if (analysisResultsContent) analysisResultsContent.innerHTML = htmlOut;
        if (fsAnalysisEl) {
            fsAnalysisEl.innerHTML = htmlOut;
        }
        if (analysisResults) analysisResults.style.display = 'block';
        if (insightsToggle) { insightsToggle.style.display = 'block'; }
    }

    // Render function: builds traces and plots based on worker result
    function renderFromComputation(resultPayload, expression, expression2) {
        try {
            const plotDiv = myChartCanvas;
            if (myChart) {
                try { Plotly.purge(plotDiv); } catch (e) { }
                myChart = null;
            }

            const traces = [];
            // theme palette for traces/markers
            const t = getActiveTheme();
            const samples1 = resultPayload.samples1 || { x: [], y: [] };
            // If the worker returned a polar result, render using scatterpolar
            if (resultPayload.polar) {
                traces.push({
                    r: resultPayload.r || [],
                    theta: resultPayload.theta || [],
                    mode: 'lines',
                    type: 'scatterpolar',
                    name: `r(t) = ${resultPayload.rExpr || ''}`,
                    line: { color: (t.lines && t.lines.primary) || 'rgb(75,192,192)', width: 3 }
                });
            } else {
                traces.push({
                    x: samples1.x,
                    y: samples1.y,
                    mode: 'lines',
                    name: (resultPayload.mode === 'parametric') ? `parametric` : `f₁(x) = ${expression}`,
                    line: { color: (t.lines && t.lines.primary) || 'rgb(75,192,192)', width: 3 },
                    connectgaps: false
                });
            }

            if (resultPayload.samples2) {
                const samples2 = resultPayload.samples2;
                traces.push({
                    x: samples2.x,
                    y: samples2.y,
                    mode: 'lines',
                    name: `f₂(x) = ${expression2}`,
                    line: { color: (t.lines && t.lines.secondary) || 'rgb(255,99,132)', width: 3 },
                    connectgaps: false
                });
            }

            if (resultPayload.intersections && resultPayload.intersections.length > 0) {
                traces.push({
                    x: resultPayload.intersections.map(p => p.x),
                    y: resultPayload.intersections.map(p => p.y),
                    mode: 'markers',
                    name: 'Punkty przecięcia',
                    marker: { size: 12, color: (t.markers?.intersections?.color || 'red'), symbol: 'x', line: { width: 2, color: (t.markers?.intersections?.line || 'darkred') } }
                });
            }

            // Zera funkcji (miejsca zerowe)
            if (resultPayload.zeros && resultPayload.zeros.length > 0) {
                traces.push({
                    x: resultPayload.zeros.map(p => p.x),
                    y: resultPayload.zeros.map(p => p.y),
                    mode: 'markers',
                    name: 'Miejsca zerowe',
                    marker: { size: 10, color: (t.markers?.zeros?.color || 'blue'), symbol: 'circle', line: { width: 2, color: (t.markers?.zeros?.line || 'darkblue') } }
                });
            }

            // Ekstrema (punkty krytyczne)
            if (resultPayload.extrema && resultPayload.extrema.length > 0) {
                traces.push({
                    x: resultPayload.extrema.map(p => p.x),
                    y: resultPayload.extrema.map(p => p.y),
                    text: resultPayload.extrema.map(p => (p.type === 'min' ? 'min' : (p.type === 'max' ? 'max' : 'siodłowy/nieokreślone'))),
                    mode: 'markers',
                    name: 'Ekstrema',
                    marker: { size: 11, color: (t.markers?.extrema?.color || 'orange'), symbol: 'diamond', line: { width: 2, color: (t.markers?.extrema?.line || 'darkorange') } },
                    hovertemplate: 'Ekstremum (%{x:.4f}, %{y:.4f})<br>%{text}<extra></extra>'
                });
            }
            // Inflection points markers
            if (resultPayload.inflections && resultPayload.inflections.length > 0) {
                traces.push({
                    x: resultPayload.inflections.map(p => p.x),
                    y: resultPayload.inflections.map(p => p.y),
                    mode: 'markers',
                    name: 'Punkty przegięcia',
                    marker: { size: 12, color: (t.markers?.inflections?.color || 'purple'), symbol: 'triangle-up', line: { width: 2, color: (t.markers?.inflections?.line || '#4a148c') } },
                    hovertemplate: 'Przegięcie (%{x:.4f}, %{y:.4f})<extra></extra>'
                });
            }
            
            // Add shaded integral area if exists (cartesian)
            if (!resultPayload.polar && currentIntegralTrace) {
                if (Array.isArray(currentIntegralTrace)) {
                    // push all integral shading traces
                    traces.push(...currentIntegralTrace);
                } else {
                    traces.push(currentIntegralTrace);
                }
            }
            // Add polar wedge shading if exists (polar)
            if (resultPayload.polar && currentPolarIntegralTraces) {
                if (Array.isArray(currentPolarIntegralTraces)) {
                    traces.push(...currentPolarIntegralTraces);
                } else {
                    traces.push(currentPolarIntegralTraces);
                }
            }
            // Add parametric highlight if exists (parametric)
            if (resultPayload.mode === 'parametric' && currentParametricHighlightTrace) {
                traces.push(currentParametricHighlightTrace);
            }
            // Add derivative plot if requested and provided
            const derivativeCheckbox = document.getElementById('derivativePlotCheckbox');
            const showDeriv = derivativeCheckbox ? derivativeCheckbox.checked : false;
            
            if (resultPayload.mode === 'cartesian' && showDeriv) {
                if (resultPayload.derivativeSamples && resultPayload.derivativeSamples.x && resultPayload.derivativeSamples.y) {
                    traces.push({
                        x: resultPayload.derivativeSamples.x,
                        y: resultPayload.derivativeSamples.y,
                        mode: 'lines',
                        name: "f'(x)",
                        line: { color: (t.lines?.derivative1 || 'rgb(123, 31, 162)'), width: 2, dash: 'dash' },
                        connectgaps: false
                    });
                }
            } else if (resultPayload.mode === 'parametric' && showDeriv) {
                // Plot dx/dt and dy/dt vs t
                if (resultPayload.derivativeSamplesX && resultPayload.derivativeSamplesX.t) {
                    traces.push({
                        x: resultPayload.derivativeSamplesX.t,
                        y: resultPayload.derivativeSamplesX.value,
                        mode: 'lines',
                        name: "dx/dt",
                        line: { color: (t.lines?.derivative1 || 'rgb(123, 31, 162)'), width: 2, dash: 'dash' },
                        connectgaps: false,
                        yaxis: 'y2'
                    });
                }
                if (resultPayload.derivativeSamplesY && resultPayload.derivativeSamplesY.t) {
                    traces.push({
                        x: resultPayload.derivativeSamplesY.t,
                        y: resultPayload.derivativeSamplesY.value,
                        mode: 'lines',
                        name: "dy/dt",
                        line: { color: (t.lines?.derivative2 || 'rgb(156, 39, 176)'), width: 2, dash: 'dot' },
                        connectgaps: false,
                        yaxis: 'y2'
                    });
                }
            } else if (resultPayload.mode === 'polar' && showDeriv && resultPayload.polar) {
                // Plot dr/dt on polar chart
                if (resultPayload.derivativeSamplesR && resultPayload.derivativeSamplesR.theta) {
                    traces.push({
                        r: resultPayload.derivativeSamplesR.value,
                        theta: resultPayload.derivativeSamplesR.theta,
                        mode: 'lines',
                        type: 'scatterpolar',
                        name: "dr/dθ",
                        line: { color: (t.lines?.derivative1 || 'rgb(123, 31, 162)'), width: 2, dash: 'dash' }
                    });
                }
            }
            
            // Add loaded data points if exist (for curve fitting)
            if (loadedDataTrace) {
                traces.push(loadedDataTrace);
            }
            
            // Update analysis data and display
            currentAnalysisData.zeros = resultPayload.zeros || [];
            currentAnalysisData.extrema = resultPayload.extrema || [];
            currentAnalysisData.intersections = resultPayload.intersections || [];
            currentAnalysisData.inflections = resultPayload.inflections || [];
            currentAnalysisData.derivative = resultPayload.derivative || '';
            displayAnalysisResults();

            const xMin = parseNumberInput(xMinInput.value);
            const xMax = parseNumberInput(xMaxInput.value);
            const yMin = parseNumberInput(yMinInput.value);
            const yMax = parseNumberInput(yMaxInput.value);

            // Check if pi axis mode is enabled
            const piAxisCheckbox = document.getElementById('piAxisCheckbox');
            const usePiAxis = piAxisCheckbox ? piAxisCheckbox.checked : false;

            // Function to format tick labels in multiples of π
            function formatPiTick(val) {
                const ratio = val / Math.PI;
                const absRatio = Math.abs(ratio);
                
                // If very close to zero
                if (absRatio < 0.01) return '0';
                
                // Check for common fractions of π
                const fractions = [
                    [1, 'π'],
                    [2, '2π'],
                    [3, '3π'],
                    [4, '4π'],
                    [0.5, 'π/2'],
                    [0.25, 'π/4'],
                    [0.75, '3π/4'],
                    [1.5, '3π/2'],
                    [2.5, '5π/2'],
                    [1/3, 'π/3'],
                    [2/3, '2π/3'],
                    [1/6, 'π/6'],
                    [5/6, '5π/6']
                ];
                
                for (let [frac, label] of fractions) {
                    if (Math.abs(absRatio - frac) < 0.02) {
                        return ratio < 0 ? '-' + label : label;
                    }
                }
                
                // Otherwise show as decimal multiple of π
                if (absRatio < 10) {
                    const rounded = Math.round(ratio * 100) / 100;
                    if (Math.abs(rounded - 1) < 0.01) return ratio < 0 ? '-π' : 'π';
                    if (Math.abs(rounded) < 0.01) return '0';
                    return rounded + 'π';
                }
                
                // For large values, show normal number
                return val.toFixed(1);
            }

            // Default cartesian layout (theme-aware)
            let layout = {
                dragmode: 'pan',
                xaxis: { 
                    title: { text: usePiAxis ? 'x (rad)' : 'x', font: { size: 16, weight: 600 } }, 
                    range: [xMin, xMax], 
                    type: 'linear',
                    gridcolor: t.grid || '#e0e0e0',
                    gridwidth: 1,
                    tickfont: { size: 13, color: t.tick },
                    linecolor: t.axis,
                    tickmode: usePiAxis ? 'linear' : 'auto',
                    tick0: usePiAxis ? 0 : undefined,
                    dtick: usePiAxis ? Math.PI / 2 : undefined,
                    tickformat: usePiAxis ? '' : undefined,
                    tickvals: usePiAxis ? undefined : undefined,
                    ticktext: usePiAxis ? undefined : undefined
                },
                yaxis: { 
                    title: { text: 'f(x)', font: { size: 16, weight: 600 } }, 
                    range: [yMin, yMax], 
                    type: 'linear',
                    gridcolor: t.grid || '#e0e0e0',
                    gridwidth: 1,
                    tickfont: { size: 13, color: t.tick },
                    linecolor: t.axis
                },
                margin: { t: 40, l: 60, r: 30, b: 50 },
                showlegend: true,
                legend: { 
                    x: 0.02, 
                    y: 0.98, 
                    xanchor: 'left', 
                    yanchor: 'top', 
                    bgcolor: t.legendBg,
                    bordercolor: t.legendBorder || '#ccc',
                    borderwidth: 1,
                    font: { size: 13 }
                },
                plot_bgcolor: t.plot || '#fafafa',
                paper_bgcolor: t.paper || '#fff',
                font: { color: t.font }
            };

            // Add area between curves trace if available
            if (currentAreaBetweenTrace) {
                if (Array.isArray(currentAreaBetweenTrace)) {
                    traces.push(...currentAreaBetweenTrace);
                } else {
                    traces.push(currentAreaBetweenTrace);
                }
            }

            // If using π axis, generate custom tick values and labels
            if (usePiAxis) {
                const tickVals = [];
                const tickTexts = [];
                const step = Math.PI / 4; // π/4 increments
                let current = Math.ceil(xMin / step) * step;
                
                while (current <= xMax) {
                    tickVals.push(current);
                    tickTexts.push(formatPiTick(current));
                    current += step;
                }
                
                layout.xaxis.tickvals = tickVals;
                layout.xaxis.ticktext = tickTexts;
                layout.xaxis.tickmode = 'array';
            }

            // If polar, adjust layout for polar plotting
            if (resultPayload.polar) {
                const polarLayout = { 
                    polar: { 
                        radialaxis: { visible: true, showticklabels: true },
                        angularaxis: {
                            tickfont: { size: 13 }
                        }
                    } 
                };
                
                // If using π axis, format angular axis in polar plot
                if (usePiAxis) {
                    const polarTickVals = [];
                    const polarTickTexts = [];
                    for (let i = 0; i < 8; i++) {
                        const angle = i * Math.PI / 4;
                        polarTickVals.push(angle * 180 / Math.PI); // Plotly uses degrees for polar
                        polarTickTexts.push(formatPiTick(angle));
                    }
                    polarLayout.polar.angularaxis.tickvals = polarTickVals;
                    polarLayout.polar.angularaxis.ticktext = polarTickTexts;
                    polarLayout.polar.angularaxis.tickmode = 'array';
                }
                
                layout = Object.assign({}, layout, polarLayout);
            }

            // If we have integral decorations and we're in cartesian mode, inject them
            if (!resultPayload.polar && currentAnalysisData.integral && currentIntegralShapes) {
                layout.shapes = (layout.shapes || []).concat(currentIntegralShapes);
            }
            if (!resultPayload.polar && currentAnalysisData.integral && currentIntegralAnnotations) {
                layout.annotations = (layout.annotations || []).concat(currentIntegralAnnotations);
            }

            // Custom fullscreen modebar button (integrates with Plotly UI)
            const fsIcon = { width: 512, height: 512, path: 'M0,96 L0,0 96,0 96,32 32,32 32,96 Z M416,0 512,0 512,96 480,96 480,32 416,32 Z M0,416 32,416 32,480 96,480 96,512 0,512 Z M480,416 512,416 512,512 416,512 416,480 480,480 Z' };
            const fsButton = {
                name: 'fullscreen',
                title: 'Pełny ekran (F)',
                icon: fsIcon,
                click: () => {
                    try {
                        if (document.fullscreenElement === chartContainer) {
                            if (document.exitFullscreen) document.exitFullscreen();
                        } else if (chartContainer && chartContainer.requestFullscreen) {
                            chartContainer.requestFullscreen();
                        }
                        setTimeout(() => { try { Plotly.Plots.resize(plotDiv); } catch(_) {} }, 100);
                    } catch (_) {}
                }
            };

            const config = {
                responsive: true,
                scrollZoom: true,
                modeBarButtonsToRemove: ['select2d','lasso2d','zoom2d'],
                modeBarButtonsToAdd: [fsButton]
            };

            Plotly.newPlot(plotDiv, traces, layout, config).then(gd => {
                myChart = gd;
                // zainicjalizuj HUD zakresów
                updateFsRangeFromLayout(gd.layout);
                // zsynchronizuj lewy panel gdyby fullscreen był już aktywny
                syncFsControlsFromLayout(gd.layout);
                // jeżeli jesteśmy już w fullscreen, natychmiast zastosuj wygląd z panelu
                if (document.fullscreenElement === chartContainer) { try { applyFsControls(); } catch(_) {} }
                // zsynchronizuj i odśwież pola wejściowe w docku
                if (document.fullscreenElement === chartContainer) { try { buildFsInputsUI(); syncFsInputsFromMain(); syncFsIntegralFromMain(); syncFsBetweenFromMain(); buildFsParamsUI(); syncFsParamsFromMain(); updateFsDockModeVisibility(); } catch(_) {} }
                // jeśli fullscreen i kart., rozszerz zakresy o markery analizy, by były w pełni widoczne
                if (document.fullscreenElement === chartContainer) { try { expandRangeToFitMarkers(gd); } catch(_) {} }

                // update inputs/localStorage after pan/zoom
                plotDiv.on('plotly_relayout', () => {
                    try {
                        const xRange = gd.layout.xaxis.range || [xMin, xMax];
                        const yRange = gd.layout.yaxis.range || [yMin, yMax];
                        updateFsRangeFromLayout(gd.layout);
                        const newRanges = {
                            xMin: roundRange(validateRange(xRange[0])),
                            xMax: roundRange(validateRange(xRange[1])),
                            yMin: roundRange(validateRange(yRange[0])),
                            yMax: roundRange(validateRange(yRange[1]))
                        };
                        if (newRanges.xMin >= newRanges.xMax) { newRanges.xMin = -10; newRanges.xMax = 10; }
                        if (newRanges.yMin >= newRanges.yMax) { newRanges.yMin = -10; newRanges.yMax = 10; }
                        xMinInput.value = newRanges.xMin;
                        xMaxInput.value = newRanges.xMax;
                        yMinInput.value = newRanges.yMin;
                        yMaxInput.value = newRanges.yMax;
                        // Nie zapisujemy zakresów do localStorage - zawsze startujemy z domyślnymi
                        // Jeśli fullscreen, zaktualizuj pola zakresu w docku
                        try { syncFsInputsFromMain(); } catch(_) {}
                    } catch (e) { console.warn('Błąd podczas aktualizacji zakresów:', e); }
                });

                // Setup nav buttons same as before
                const getRanges = () => {
                    const xr = (myChart && myChart.layout && myChart.layout.xaxis && myChart.layout.xaxis.range) ? myChart.layout.xaxis.range : [xMin, xMax];
                    const yr = (myChart && myChart.layout && myChart.layout.yaxis && myChart.layout.yaxis.range) ? myChart.layout.yaxis.range : [yMin, yMax];
                    return { xr, yr };
                };

                if (zoomInBtn) zoomInBtn.onclick = () => {
                    const { xr, yr } = getRanges();
                    const xmid = (xr[0] + xr[1]) / 2;
                    const ymid = (yr[0] + yr[1]) / 2;
                    const xhalf = (xr[1] - xr[0]) * (1 - ZOOM_FACTOR) / 2;
                    const yhalf = (yr[1] - yr[0]) * (1 - ZOOM_FACTOR) / 2;
                    Plotly.relayout(plotDiv, { 'xaxis.range': [xmid - xhalf, xmid + xhalf], 'yaxis.range': [ymid - yhalf, ymid + yhalf] });
                };
                if (zoomOutBtn) zoomOutBtn.onclick = () => {
                    const { xr, yr } = getRanges();
                    const xmid = (xr[0] + xr[1]) / 2;
                    const ymid = (yr[0] + yr[1]) / 2;
                    const xhalf = (xr[1] - xr[0]) * (1 + ZOOM_FACTOR) / 2;
                    const yhalf = (yr[1] - yr[0]) * (1 + ZOOM_FACTOR) / 2;
                    Plotly.relayout(plotDiv, { 'xaxis.range': [xmid - xhalf, xmid + xhalf], 'yaxis.range': [ymid - yhalf, ymid + yhalf] });
                };
                if (panLeftBtn) panLeftBtn.onclick = () => { const { xr } = getRanges(); const shift = (xr[1] - xr[0]) * PAN_FACTOR; Plotly.relayout(plotDiv, { 'xaxis.range': [xr[0] - shift, xr[1] - shift] }); };
                if (panRightBtn) panRightBtn.onclick = () => { const { xr } = getRanges(); const shift = (xr[1] - xr[0]) * PAN_FACTOR; Plotly.relayout(plotDiv, { 'xaxis.range': [xr[0] + shift, xr[1] + shift] }); };
                if (panUpBtn) panUpBtn.onclick = () => { const { yr } = getRanges(); const shift = (yr[1] - yr[0]) * PAN_FACTOR; Plotly.relayout(plotDiv, { 'yaxis.range': [yr[0] + shift, yr[1] + shift] }); };
                if (panDownBtn) panDownBtn.onclick = () => { const { yr } = getRanges(); const shift = (yr[1] - yr[0]) * PAN_FACTOR; Plotly.relayout(plotDiv, { 'yaxis.range': [yr[0] - shift, yr[1] - shift] }); };
            });
            
            // Hide loading when done
            hideLoading();
        } catch (err) {
            console.error('Render error:', err);
            errorDisplay.textContent = `Błąd podczas renderowania: ${err.message}`;
            hideLoading();
        }
    }

    // Debounce helper
    function debounce(fn, wait) {
        let t = null;
        return function (...args) {
            if (t) clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    // Detect free symbol parameters in expression (excluding provided names and known functions)
    // excludeNames: array of symbol names to ignore (e.g., ['x'] or ['x','t'])
    function detectParameters(expr, excludeNames = ['x']) {
        if (!expr || expr.trim() === '') return [];
        try {
            const node = math.parse(expr);
            const params = new Set();
            node.traverse(function (n) {
                if (n && n.isSymbolNode) {
                    const name = n.name;
                    if (excludeNames && excludeNames.indexOf(name) >= 0) return;
                    // Exclude math functions by checking if parsing name as function fails
                    // Simple heuristic: common function names
                    const common = ['sin','cos','tan','asin','acos','atan','log','ln','sqrt','abs','exp','pow','max','min'];
                    if (common.indexOf(name) >= 0) return;
                    params.add(name);
                }
            });
            return Array.from(params);
        } catch (e) {
            return [];
        }
    }

    // Build parameter sliders UI
    function buildParamControls(params) {
        const container = document.getElementById('paramControls');
        if (!container) return;
        container.innerHTML = '';
        if (!params || params.length === 0) return;
        params.forEach(name => {
            const id = `slider-${name}`;
            const labelId = `label-${name}`;
            const minId = `min-${name}`;
            const maxId = `max-${name}`;
            const stepId = `step-${name}`;
            
            const wrapper = document.createElement('div');
            wrapper.className = 'param-item';
            wrapper.style.marginBottom = '10px';
            wrapper.style.padding = '8px';
            wrapper.style.background = '#f8f9fa';
            wrapper.style.borderRadius = '4px';
            wrapper.style.border = '1px solid #e0e0e0';

            // Główny label z wartością
            const label = document.createElement('label');
            label.setAttribute('for', id);
            label.innerHTML = `<strong>${name}</strong> = <span id="${labelId}" style="color:#4a90e2;font-weight:600;">1</span>`;
            label.style.display = 'block';
            label.style.marginBottom = '6px';
            label.style.fontSize = '13px';

            // Suwak
            const input = document.createElement('input');
            input.type = 'range';
            input.id = id;
            input.min = -5;
            input.max = 5;
            input.step = 0.1;
            input.value = 1;
            input.style.width = '100%';
            input.style.marginBottom = '6px';

            input.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                const lbl = document.getElementById(labelId);
                if (lbl) lbl.textContent = v.toFixed(2);
                debouncedPlot();
            });

            // Kontrolki zakresu (rozwijane)
            const rangeToggle = document.createElement('details');
            rangeToggle.style.marginTop = '4px';
            
            const rangeSummary = document.createElement('summary');
            rangeSummary.textContent = '⚙️ Zakres';
            rangeSummary.style.fontSize = '11px';
            rangeSummary.style.color = '#666';
            rangeSummary.style.cursor = 'pointer';
            rangeSummary.style.userSelect = 'none';
            
            const rangeContent = document.createElement('div');
            rangeContent.style.marginTop = '6px';
            rangeContent.style.display = 'grid';
            rangeContent.style.gridTemplateColumns = '1fr 1fr 1fr';
            rangeContent.style.gap = '4px';
            rangeContent.style.fontSize = '11px';
            
            // Min input
            const minWrapper = document.createElement('div');
            const minLabel = document.createElement('label');
            minLabel.textContent = 'Min:';
            minLabel.style.display = 'block';
            minLabel.style.fontSize = '10px';
            minLabel.style.color = '#666';
            const minInput = document.createElement('input');
            minInput.type = 'text';
            minInput.id = minId;
            minInput.value = -5;
            minInput.step = 0.5;
            minInput.style.width = '100%';
            minInput.style.padding = '2px 4px';
            minInput.style.fontSize = '11px';
            minWrapper.appendChild(minLabel);
            minWrapper.appendChild(minInput);
            
            // Max input
            const maxWrapper = document.createElement('div');
            const maxLabel = document.createElement('label');
            maxLabel.textContent = 'Max:';
            maxLabel.style.display = 'block';
            maxLabel.style.fontSize = '10px';
            maxLabel.style.color = '#666';
            const maxInput = document.createElement('input');
            maxInput.type = 'text';
            maxInput.id = maxId;
            maxInput.value = 5;
            maxInput.step = 0.5;
            maxInput.style.width = '100%';
            maxInput.style.padding = '2px 4px';
            maxInput.style.fontSize = '11px';
            maxWrapper.appendChild(maxLabel);
            maxWrapper.appendChild(maxInput);
            
            // Step input
            const stepWrapper = document.createElement('div');
            const stepLabel = document.createElement('label');
            stepLabel.textContent = 'Krok:';
            stepLabel.style.display = 'block';
            stepLabel.style.fontSize = '10px';
            stepLabel.style.color = '#666';
            const stepInput = document.createElement('input');
            stepInput.type = 'text';
            stepInput.id = stepId;
            stepInput.value = 0.1;
            stepInput.step = 0.01;
            stepInput.min = 0.01;
            stepInput.style.width = '100%';
            stepInput.style.padding = '2px 4px';
            stepInput.style.fontSize = '11px';
            stepWrapper.appendChild(stepLabel);
            stepWrapper.appendChild(stepInput);
            
            // Event listeners dla zakresu
            const updateRange = () => {
                const minVal = parseNumberInput(minInput.value);
                const maxVal = parseNumberInput(maxInput.value);
                const stepVal = parseNumberInput(stepInput.value);
                
                if (minVal < maxVal) {
                    input.min = minVal;
                    input.max = maxVal;
                    input.step = stepVal;
                    
                    // Upewnij się, że aktualna wartość jest w zakresie
                    const currentVal = parseFloat(input.value);
                    if (currentVal < minVal) {
                        input.value = minVal;
                        document.getElementById(labelId).textContent = minVal.toFixed(2);
                        debouncedPlot();
                    } else if (currentVal > maxVal) {
                        input.value = maxVal;
                        document.getElementById(labelId).textContent = maxVal.toFixed(2);
                        debouncedPlot();
                    }
                }
            };
            
            minInput.addEventListener('change', updateRange);
            maxInput.addEventListener('change', updateRange);
            stepInput.addEventListener('change', updateRange);
            
            rangeContent.appendChild(minWrapper);
            rangeContent.appendChild(maxWrapper);
            rangeContent.appendChild(stepWrapper);
            
            rangeToggle.appendChild(rangeSummary);
            rangeToggle.appendChild(rangeContent);

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            wrapper.appendChild(rangeToggle);
            container.appendChild(wrapper);
        });
    }

    // Collect current scope from sliders
    function collectScope() {
        const container = document.getElementById('paramControls');
        if (!container) return {};
        const inputs = container.querySelectorAll('input[type=range]');
        const scope = {};
        inputs.forEach(inp => {
            const name = inp.id.replace(/^slider-/, '');
            scope[name] = parseFloat(inp.value);
        });
        return scope;
    }

    // Debounced plot trigger used by sliders
    const debouncedPlot = debounce(() => { plotButton.click(); }, 80);

    // Zbuduj opcje próbkowania dla workera na podstawie presetów i bieżącego zakresu X
    function buildSamplingOptions(xMin, xMax) {
        const span = Math.abs(xMax - xMin) || 1;
        const preset = (samplingPreset && samplingPreset.value) || 'default';
        if (preset === 'fast') {
            return {
                absLimit: 1e5,
                maxDepth: 12,
                minStep: span / 200000,
                absEps: 2e-3,
                relEps: 2e-2,
            };
        } else if (preset === 'quality') {
            return {
                absLimit: 1e5,
                maxDepth: 20,
                minStep: span / 2000000,
                absEps: 5e-4,
                relEps: 5e-3,
            };
        }
        // Domyślny preset
        return {
            absLimit: 1e5,
            maxDepth: 16,
            minStep: span / 500000,
            absEps: 1e-3,
            relEps: 1e-2,
        };
    }

    // Watch expression input to detect params and create sliders
    const paramsUpdater = debounce(() => {
        const mode = (plotModeSelect && plotModeSelect.value) || 'cartesian';
        const exprs = [];
        if (mode === 'cartesian') {
            exprs.push(functionInput.value || '');
            if (function2Input && function2Input.value && function2Input.value.trim() !== '') exprs.push(function2Input.value);
        } else if (mode === 'parametric') {
            if (xParamInput && xParamInput.value) exprs.push(xParamInput.value);
            if (yParamInput && yParamInput.value) exprs.push(yParamInput.value);
        } else if (mode === 'polar') {
            if (rInput && rInput.value) exprs.push(rInput.value);
        } else if (mode === '3d') {
            const s = document.getElementById('surfaceInput');
            if (s && s.value) exprs.push(s.value);
        }

        const set = new Set();
        exprs.forEach(e => {
            try {
                const mode = (plotModeSelect && plotModeSelect.value) || 'cartesian';
                let exclude;
                if (mode === 'parametric' || mode === 'polar') exclude = ['t', 'x'];
                else if (mode === '3d') exclude = ['x', 'y'];
                else exclude = ['x'];
                detectParameters(e, exclude).forEach(p => set.add(p));
            } catch (err) { }
        });
        buildParamControls(Array.from(set));
    }, 300);

    // Helper function to clear all analysis visualizations
    function clearAllAnalysisData() {
        // Clear integral visualizations
        currentIntegralTrace = null;
        currentIntegralShapes = null;
        currentIntegralAnnotations = null;
        currentPolarIntegralTraces = null;
        currentParametricHighlightTrace = null;
        currentAreaBetweenTrace = null; // Clear area between trace
        // Clear all analysis data
        currentAnalysisData.zeros = [];
        currentAnalysisData.extrema = [];
    currentAnalysisData.intersections = [];
    currentAnalysisData.inflections = [];
        currentAnalysisData.integral = null;
        currentAnalysisData.derivative = '';
        currentAnalysisData.areaBetween = null; // Clear area between data
        // Reset panel but zostaw widoczny (pusty placeholder)
        const insightsToggle = document.getElementById('insightsToggle');
        if (analysisResultsContent) {
            analysisResultsContent.innerHTML = '<div style="color:#6c757d;font-size:13px;">Brak wyników analizy.</div>';
        }
        const fsAnalysisEl = document.getElementById('fsAnalysisResultsContent');
        if (fsAnalysisEl) {
            fsAnalysisEl.innerHTML = '<div style="color:#6c757d;font-size:12px;">Brak wyników analizy.</div>';
        }
        if (analysisResults) {
            analysisResults.style.display = 'block';
        }
        if (insightsToggle) { insightsToggle.style.display = 'block'; }
    }

    // Debounced plot refresh for function input changes
    let functionInputTimeout;
    function triggerDebouncedPlot() {
        clearTimeout(functionInputTimeout);
        functionInputTimeout = setTimeout(() => {
            if (plotButton) plotButton.click();
        }, 1000); // 1 second debounce
    }

    // Wire inputs so changing expressions updates detected parameters
    functionInput.addEventListener('input', () => {
        paramsUpdater();
        // Clear all analysis data when function changes
        clearAllAnalysisData();
        triggerDebouncedPlot();
    });
    if (function2Input) function2Input.addEventListener('input', () => {
        paramsUpdater();
        clearAllAnalysisData();
        triggerDebouncedPlot();
    });
    if (xParamInput) xParamInput.addEventListener('input', () => {
        paramsUpdater();
        clearAllAnalysisData();
        triggerDebouncedPlot();
    });
    if (yParamInput) yParamInput.addEventListener('input', () => {
        paramsUpdater();
        clearAllAnalysisData();
        triggerDebouncedPlot();
    });
    if (rInput) rInput.addEventListener('input', () => {
        paramsUpdater();
        clearAllAnalysisData();
        triggerDebouncedPlot();
    });
    const surfaceInputEl = document.getElementById('surfaceInput');
    if (surfaceInputEl) surfaceInputEl.addEventListener('input', () => {
        paramsUpdater();
        clearAllAnalysisData();
        triggerDebouncedPlot();
    });
    // initialize params for current mode/input
    paramsUpdater();

    // Pozwól rysować wykres także po wciśnięciu Enter w dowolnym polu
    const handleEnterPress = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            plotButton.click();
        }
    };
    functionInput.addEventListener('keypress', handleEnterPress);
    xMinInput.addEventListener('keypress', handleEnterPress);
    xMaxInput.addEventListener('keypress', handleEnterPress);
    yMinInput.addEventListener('keypress', handleEnterPress);
    yMaxInput.addEventListener('keypress', handleEnterPress);

    // Helper: simple percentile (no interpolation)
    function percentile(arr, p) {
        if (!arr || arr.length === 0) return NaN;
        const sorted = arr.slice().sort((a,b) => a - b);
        const idx = Math.floor((p/100) * (sorted.length - 1));
        return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
    }


    // Obsługa przycisków zakresu
    const presetButtons = document.querySelectorAll('.presets button');
    presetButtons.forEach(button => {
        button.addEventListener('click', () => {
            const range = parseInt(button.dataset.range);
            yMinInput.value = -range;
            yMaxInput.value = range;
            plotButton.click();
        });
    });

    // Obsługa przycisku reset widoku: czyści analizy i ustawia zakresy -10..10
    resetViewButton.addEventListener('click', () => {
        resetPlotViewAndAnalysis();
    });

    // Wspólna funkcja Reset: czyści analizy i ustawia domyślne zakresy, rysuje tylko funkcje
    function resetPlotViewAndAnalysis() {
        try {
            // Ustaw domyślne zakresy X/Y
            xMinInput.value = -10;
            xMaxInput.value = 10;
            yMinInput.value = -10;
            yMaxInput.value = 10;

            // Wyczyść wszystkie wizualizacje analizy i dane
            clearAllAnalysisData();

            // Odznacz przełączniki analizy (główne)
            const zerosCheck = document.getElementById('zerosCheckbox');
            const extremaCheck = document.getElementById('extremaCheckbox');
            const intersectionsCheck = document.getElementById('intersectionsCheckbox');
            const derivativeCheck = document.getElementById('derivativePlotCheckbox');
            const inflectionsCheck = document.getElementById('inflectionsCheckbox');
            if (zerosCheck) zerosCheck.checked = false;
            if (extremaCheck) extremaCheck.checked = false;
            if (intersectionsCheck) intersectionsCheck.checked = false;
            if (derivativeCheck) derivativeCheck.checked = false;
            if (inflectionsCheck) inflectionsCheck.checked = false;
            // (label toggle removed)

            // Zsynchronizuj przełączniki w panelu fullscreen (jeśli aktywny)
            try { syncFsAnalysisFromMain(); } catch(_) {}

            // Usuń komunikaty o błędach
            errorDisplay.textContent = '';

            // Przerysuj
            plotButton.click();

            // Jeśli jesteśmy w fullscreen – zaktualizuj HUD zakresów po chwili
            if (document.fullscreenElement === chartContainer && myChart) {
                setTimeout(() => { try { updateFsRangeFromLayout(myChart.layout); } catch(_) {} }, 120);
            }
        } catch (_) {}
    }

    // Obsługa przycisku czyszczenia analiz
    if (clearAnalysisButton) {
        clearAnalysisButton.addEventListener('click', () => {
            // Clear all analysis data
            clearAllAnalysisData();
            
            // Clear preview indicators
            const integralPreview = document.querySelector('.integral-controls .integral-preview');
            const betweenPreview = document.querySelector('.between-curves-controls .integral-preview');
            if (integralPreview) integralPreview.style.display = 'none';
            if (betweenPreview) betweenPreview.style.display = 'none';
            
            // Uncheck all analysis checkboxes
            const zerosCheck = document.getElementById('zerosCheckbox');
            const extremaCheck = document.getElementById('extremaCheckbox');
            const intersectionsCheck = document.getElementById('intersectionsCheckbox');
            const derivativeCheck = document.getElementById('derivativePlotCheckbox');
            const inflectionsCheck = document.getElementById('inflectionsCheckbox');
            
            if (zerosCheck) zerosCheck.checked = false;
            if (extremaCheck) extremaCheck.checked = false;
            if (intersectionsCheck) intersectionsCheck.checked = false;
            if (derivativeCheck) derivativeCheck.checked = false;
            if (inflectionsCheck) inflectionsCheck.checked = false;
            // label checkbox removed
            
            // Reset integral bounds to defaults
            if (integralA) integralA.value = '0';
            if (integralB) integralB.value = '1';
            if (betweenA) betweenA.value = '0';
            if (betweenB) betweenB.value = '1';
            
            // Clear error display
            errorDisplay.textContent = '';
            
            // Redraw plot with just the functions (no analysis)
            plotButton.click();
        });
    }

    // Zmiana presetu automatycznie odświeża wykres
    if (samplingPreset) {
        samplingPreset.addEventListener('change', () => {
            plotButton.click();
        });
    }
    
    // Pi axis checkbox - automatically refresh plot when changed
    const piAxisCheckbox = document.getElementById('piAxisCheckbox');
    if (piAxisCheckbox) {
        piAxisCheckbox.addEventListener('change', () => {
            plotButton.click();
        });
    }
    // Derivative plot toggle - refresh
    const derivativePlotCheckbox = document.getElementById('derivativePlotCheckbox');
    if (derivativePlotCheckbox) {
        derivativePlotCheckbox.addEventListener('change', () => {
            plotButton.click();
        });
    }
    
    // Auto-refresh when analysis checkboxes change
    const zerosCheckbox = document.getElementById('zerosCheckbox');
    if (zerosCheckbox) {
        zerosCheckbox.addEventListener('change', () => {
            plotButton.click();
        });
    }
    
    const extremaCheckbox = document.getElementById('extremaCheckbox');
    if (extremaCheckbox) {
        extremaCheckbox.addEventListener('change', () => {
            plotButton.click();
        });
    }
    const inflectionsCheckbox2 = document.getElementById('inflectionsCheckbox');
    if (inflectionsCheckbox2) {
        inflectionsCheckbox2.addEventListener('change', () => {
            plotButton.click();
        });
    }
    
    const intersectionsCheckbox = document.getElementById('intersectionsCheckbox');
    if (intersectionsCheckbox) {
        intersectionsCheckbox.addEventListener('change', () => {
            plotButton.click();
        });
    }
    
    // Auto-refresh when integral bounds change (with debounce)
    let integralUpdateTimeout;
    const autoRefreshIntegral = () => {
        clearTimeout(integralUpdateTimeout);
        integralUpdateTimeout = setTimeout(() => {
            // Only auto-refresh if we have valid bounds and button exists
            const a = parseNumberInput(integralA.value);
            const b = parseNumberInput(integralB.value);
            if (isFinite(a) && isFinite(b) && a < b && calculateIntegralButton) {
                // Trigger the integral calculation
                calculateIntegralButton.click();
            }
        }, 800); // 800ms debounce to avoid too many calculations
    };
    
    if (integralA) {
        integralA.addEventListener('input', autoRefreshIntegral);
        integralA.addEventListener('change', () => {
            clearTimeout(integralUpdateTimeout);
            if (calculateIntegralButton) calculateIntegralButton.click();
        });
    }
    
    if (integralB) {
        integralB.addEventListener('input', autoRefreshIntegral);
        integralB.addEventListener('change', () => {
            clearTimeout(integralUpdateTimeout);
            if (calculateIntegralButton) calculateIntegralButton.click();
        });
    }
    
    // Removed "Pokaż wartość całki" toggle and related logic

    // Calculate area between curves (cartesian only)
    if (calculateBetweenButton && calcWorker) {
        calculateBetweenButton.addEventListener('click', () => {
            const modeEl = document.getElementById('plotMode');
            const mode = (modeEl && modeEl.value) || 'cartesian';
            if (mode !== 'cartesian') {
                errorDisplay.textContent = 'Pole między krzywymi dostępne tylko w trybie kartezjańskim.';
                return;
            }

            const expr1 = (functionInput && functionInput.value) ? functionInput.value.trim() : '';
            const expr2 = (function2Input && function2Input.value) ? function2Input.value.trim() : '';
            if (!expr1 || !expr2) {
                errorDisplay.textContent = 'Wprowadź obie funkcje f₁(x) i f₂(x).';
                return;
            }

            if (!betweenA || !betweenB) {
                errorDisplay.textContent = 'Brak pól granic przedziału.';
                return;
            }

            const a = parseNumberInput(betweenA.value);
            const b = parseNumberInput(betweenB.value);
            if (!isFinite(a) || !isFinite(b) || a >= b) {
                errorDisplay.textContent = 'Nieprawidłowe granice całkowania (a < b).';
                return;
            }

            errorDisplay.textContent = 'Obliczanie pola...';
            currentAreaBetweenTrace = null;
            currentAnalysisData.areaBetween = null;

            const areaListener = (ev) => {
                const msg = ev.data;
                if (!msg) return;

                if (msg.type === 'areaBetweenResult') {
                    calcWorker.removeEventListener('message', areaListener);
                    const payload = msg.payload || {};
                    const xs = payload.xSamples || [];
                    const y1 = payload.y1Samples || [];
                    const y2 = payload.y2Samples || [];

                    if (!Array.isArray(xs) || !Array.isArray(y1) || !Array.isArray(y2) || xs.length !== y1.length || xs.length !== y2.length) {
                        errorDisplay.textContent = 'Nie udało się przygotować danych do wizualizacji pola.';
                        return;
                    }

                    const areaTraces = [];
                    let segmentX = [];
                    let segmentTop = [];
                    let segmentBottom = [];
                    let legendUsed = false;

                    const flushSegment = () => {
                        if (segmentX.length < 2) {
                            segmentX = [];
                            segmentTop = [];
                            segmentBottom = [];
                            return;
                        }

                        const baseTrace = {
                            x: [...segmentX],
                            mode: 'lines',
                            line: { color: 'rgba(0,0,0,0)' },
                            hoverinfo: 'skip',
                            connectgaps: false,
                            showlegend: false
                        };

                        const t = getActiveTheme();
                        areaTraces.push({
                            ...baseTrace,
                            y: [...segmentBottom]
                        });

                            areaTraces.push({
                            ...baseTrace,
                            y: [...segmentTop],
                            fill: 'tonexty',
                                fillcolor: t.shadeBetween,
                            name: 'Pole między krzywymi',
                            showlegend: !legendUsed
                        });

                        legendUsed = true;
                        segmentX = [];
                        segmentTop = [];
                        segmentBottom = [];
                    };

                    for (let i = 0; i < xs.length; i++) {
                        const xVal = xs[i];
                        const y1Val = y1[i];
                        const y2Val = y2[i];

                        if (!isFinite(xVal) || !isFinite(y1Val) || !isFinite(y2Val)) {
                            flushSegment();
                            continue;
                        }

                        segmentX.push(xVal);
                        const top = Math.max(y1Val, y2Val);
                        const bottom = Math.min(y1Val, y2Val);
                        segmentTop.push(top);
                        segmentBottom.push(bottom);
                    }

                    flushSegment();

                    if (areaTraces.length === 0) {
                        errorDisplay.textContent = 'Brak danych do zacieniowania pola.';
                        return;
                    }

                    const areaValue = Number(payload.value);
                    currentAreaBetweenTrace = areaTraces;
                    currentAnalysisData.areaBetween = {
                        value: areaValue,
                        a: Number(payload.a),
                        b: Number(payload.b)
                    };

                    errorDisplay.textContent = '';
                    displayAnalysisResults();
                    plotButton.click();
                } else if (msg.type === 'error' && msg.payload && msg.payload.message && msg.payload.message.includes('pola między krzywymi')) {
                    calcWorker.removeEventListener('message', areaListener);
                    errorDisplay.textContent = msg.payload.message;
                }
            };

            calcWorker.addEventListener('message', areaListener);
            calcWorker.postMessage({
                type: 'computeAreaBetween',
                payload: {
                    expression1: expr1,
                    expression2: expr2,
                    a,
                    b,
                    scope: collectScope()
                }
            });
        });
    }
    
    // Auto-calculate timer for live preview
    let integralAutoCalcTimer = null;
    let betweenAutoCalcTimer = null;

    // Function to show integral range preview
    function showIntegralPreview(a, b) {
        const integralControls = document.querySelector('.integral-controls');
        if (!integralControls) return;
        
        let preview = integralControls.querySelector('.integral-preview');
        if (!preview) {
            preview = document.createElement('div');
            preview.className = 'integral-preview';
            integralControls.appendChild(preview);
        }
        
        if (isFinite(a) && isFinite(b) && a < b) {
            preview.textContent = `📊 Zakres: [${a.toFixed(3)}, ${b.toFixed(3)}] — szerokość: ${(b - a).toFixed(3)}`;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    }

    // Function to show area between preview
    function showAreaBetweenPreview(a, b) {
        const betweenControls = document.querySelector('.between-curves-controls');
        if (!betweenControls) return;
        
        let preview = betweenControls.querySelector('.integral-preview');
        if (!preview) {
            preview = document.createElement('div');
            preview.className = 'integral-preview';
            betweenControls.appendChild(preview);
        }
        
        if (isFinite(a) && isFinite(b) && a < b) {
            preview.textContent = `📐 Zakres: [${a.toFixed(3)}, ${b.toFixed(3)}] — szerokość: ${(b - a).toFixed(3)}`;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    }

    // Auto-calculate for integral inputs
    if (integralA && integralB) {
        [integralA, integralB].forEach(input => {
            input.addEventListener('input', () => {
                const a = parseNumberInput(integralA.value);
                const b = parseNumberInput(integralB.value);
                showIntegralPreview(a, b);
                
                // Auto-calculate after 800ms of no typing
                clearTimeout(integralAutoCalcTimer);
                integralAutoCalcTimer = setTimeout(() => {
                    if (isFinite(a) && isFinite(b) && a < b && calculateIntegralButton) {
                        calculateIntegralButton.click();
                    }
                }, 800);
            });
        });
    }

    // Auto-calculate for area between inputs
    if (betweenA && betweenB) {
        [betweenA, betweenB].forEach(input => {
            input.addEventListener('input', () => {
                const a = parseNumberInput(betweenA.value);
                const b = parseNumberInput(betweenB.value);
                showAreaBetweenPreview(a, b);
                
                // Auto-calculate after 800ms of no typing
                clearTimeout(betweenAutoCalcTimer);
                betweenAutoCalcTimer = setTimeout(() => {
                    if (isFinite(a) && isFinite(b) && a < b && calculateBetweenButton) {
                        calculateBetweenButton.click();
                    }
                }, 800);
            });
        });
    }

    // Calculate integral button handler - supports all modes
    if (calculateIntegralButton && calcWorker) {
        calculateIntegralButton.addEventListener('click', () => {
            const modeEl = document.getElementById('plotMode');
            const mode = (modeEl && modeEl.value) || 'cartesian';

            // Read generic bounds a,b (used as: x-bounds for cartesian, t-bounds for parametric/polar)
            const a = parseNumberInput(integralA.value);
            const b = parseNumberInput(integralB.value);
            if (!isFinite(a) || !isFinite(b) || a >= b) {
                errorDisplay.textContent = 'Nieprawidłowe granice całki (a < b)';
                return;
            }

            // Reset previous cartesian shading if switching modes
            if (mode !== 'cartesian') {
                currentIntegralTrace = null;
                currentIntegralShapes = null;
                currentIntegralAnnotations = null;
            }
            // Reset polar traces when leaving polar mode
            if (mode === 'polar') {
                currentPolarIntegralTraces = null;
            }
            if (mode !== 'parametric') {
                currentParametricHighlightTrace = null;
            }

            errorDisplay.textContent = 'Obliczanie całki...';

            const integralListener = (ev) => {
                const msg = ev.data;
                if (!msg) return;

                if (msg.type === 'integralResult') {
                    const payload = msg.payload || {};
                    // Preserve display bounds for parametric/polar when angle mode = degrees
                    if (mode === 'parametric' || mode === 'polar') {
                        const angleModeEl = document.getElementById('angleMode');
                        const angleModeVal = angleModeEl ? angleModeEl.value : 'radians';
                        if (angleModeVal === 'degrees') {
                            // Override a,b for display with degree inputs
                            payload.a = a;
                            payload.b = b;
                            payload.unit = 'degrees';
                        } else {
                            payload.unit = 'radians';
                        }
                    }
                    currentAnalysisData.integral = Object.assign({ mode }, payload);

                    // Show results immediately
                    displayAnalysisResults();
                    errorDisplay.textContent = '';

                    // Visualization per mode (after displaying results)
                    if (mode === 'cartesian') {
                        const expression = functionInput.value;
                        createIntegralShading(expression, a, b);
                    } else if (mode === 'polar') {
                        // Do not draw polar integral area shading
                        currentPolarIntegralTraces = null;
                        // Refresh plot to ensure previous shading is cleared
                        plotButton.click();
                    } else if (mode === 'parametric') {
                        const angleModeEl = document.getElementById('angleMode');
                        const angleModeVal = angleModeEl ? angleModeEl.value : 'radians';
                        const aRad = (angleModeVal === 'degrees') ? a * Math.PI / 180 : a;
                        const bRad = (angleModeVal === 'degrees') ? b * Math.PI / 180 : b;
                        createParametricIntegralHighlight((xParamInput && xParamInput.value) || '', (yParamInput && yParamInput.value) || '', aRad, bRad);
                    } else {
                        // Trigger a replot to clear any old decorations
                        plotButton.click();
                    }

                    calcWorker.removeEventListener('message', integralListener);
                } else if (msg.type === 'error') {
                    errorDisplay.textContent = msg.payload.message;
                    calcWorker.removeEventListener('message', integralListener);
                }
            };

            calcWorker.addEventListener('message', integralListener);

            // Build payload per mode
            if (mode === 'cartesian') {
                const expression = functionInput.value;
                if (!expression || expression.trim() === '') {
                    errorDisplay.textContent = 'Wprowadź funkcję przed obliczeniem całki';
                    calcWorker.removeEventListener('message', integralListener);
                    return;
                }
                calcWorker.postMessage({
                    type: 'computeIntegral',
                    payload: { mode: 'cartesian', expression, a, b, scope: collectScope() }
                });
            } else if (mode === 'parametric') {
                const xExpr = (xParamInput && xParamInput.value) || '';
                const yExpr = (yParamInput && yParamInput.value) || '';
                if (!xExpr || !yExpr) {
                    errorDisplay.textContent = 'Wprowadź x(t) i y(t)';
                    calcWorker.removeEventListener('message', integralListener);
                    return;
                }
                const angleModeEl = document.getElementById('angleMode');
                const angleModeVal = angleModeEl ? angleModeEl.value : 'radians';
                const aRad = (angleModeVal === 'degrees') ? a * Math.PI / 180 : a;
                const bRad = (angleModeVal === 'degrees') ? b * Math.PI / 180 : b;
                calcWorker.postMessage({
                    type: 'computeIntegral',
                    payload: { mode: 'parametric', xExpr, yExpr, a: aRad, b: bRad, scope: collectScope() }
                });
            } else if (mode === 'polar') {
                const rExpr = (rInput && rInput.value) || '';
                if (!rExpr) {
                    errorDisplay.textContent = 'Wprowadź r(t)';
                    calcWorker.removeEventListener('message', integralListener);
                    return;
                }
                const angleModeEl = document.getElementById('angleMode');
                const angleModeVal = angleModeEl ? angleModeEl.value : 'radians';
                const aRad = (angleModeVal === 'degrees') ? a * Math.PI / 180 : a;
                const bRad = (angleModeVal === 'degrees') ? b * Math.PI / 180 : b;
                calcWorker.postMessage({
                    type: 'computeIntegral',
                    payload: { mode: 'polar', rExpr, a: aRad, b: bRad, scope: collectScope() }
                });
            } else if (mode === '3d') {
                const surfaceInput = document.getElementById('surfaceInput');
                const xMin3D = parseFloat(document.getElementById('xMin3D').value);
                const xMax3D = parseFloat(document.getElementById('xMax3D').value);
                const yMin3D = parseFloat(document.getElementById('yMin3D').value);
                const yMax3D = parseFloat(document.getElementById('yMax3D').value);
                if (!surfaceInput || !surfaceInput.value.trim()) {
                    errorDisplay.textContent = 'Wprowadź funkcję z(x,y)';
                    calcWorker.removeEventListener('message', integralListener);
                    return;
                }
                if (!isFinite(xMin3D) || !isFinite(xMax3D) || xMin3D >= xMax3D || !isFinite(yMin3D) || !isFinite(yMax3D) || yMin3D >= yMax3D) {
                    errorDisplay.textContent = 'Niepoprawny zakres X/Y dla 3D';
                    calcWorker.removeEventListener('message', integralListener);
                    return;
                }
                if (!isFinite(resolution3D) || resolution3D < 10 || resolution3D > 200) {
                    errorDisplay.textContent = 'Rozdzielczość musi być między 10 a 200';
                    calcWorker.removeEventListener('message', integralListener);
                    return;
                }
                calcWorker.postMessage({
                    type: 'computeIntegral',
                    payload: { mode: '3d', expr: surfaceInput.value, xRange: { min: xMin3D, max: xMax3D }, yRange: { min: yMin3D, max: yMax3D }, scope: collectScope() }
                });
            }
        });
    }
    
    // Create shaded area for integral visualization (clearer boundaries, pos/neg areas, band and labels)
    function createIntegralShading(expression, a, b) {
        try {
            const t = getActiveTheme();
            const node = math.parse(expression);
            const compiled = node.compile();
            const scope = collectScope();

            // Sample points in [a, b] range
            const steps = 200;
            const dx = (b - a) / steps;
            const xs = [];
            const ys = [];

            for (let i = 0; i <= steps; i++) {
                const x = a + i * dx;
                xs.push(x);
                try {
                    const y = compiled.evaluate(Object.assign({ x }, scope));
                    ys.push(isFinite(y) ? y : null);
                } catch (e) {
                    ys.push(null);
                }
            }

            // Build positive and negative area traces with zero-crossing interpolation
            const posX = [];
            const posY = [];
            const negX = [];
            const negY = [];

            for (let i = 0; i < xs.length; i++) {
                const x = xs[i], y = ys[i];
                const prevY = i > 0 ? ys[i - 1] : null;
                const prevX = i > 0 ? xs[i - 1] : null;

                if (y === null || y === undefined) {
                    posX.push(x); posY.push(null);
                    negX.push(x); negY.push(null);
                    continue;
                }

                // Insert zero-crossing point for cleaner boundary
                if (i > 0 && prevY !== null && prevY !== undefined && prevY * y < 0) {
                    const t = prevY / (prevY - y);
                    const xz = prevX + t * (x - prevX);
                    posX.push(xz); posY.push(0);
                    negX.push(xz); negY.push(0);
                }

                if (y >= 0) {
                    posX.push(x); posY.push(y);
                    negX.push(x); negY.push(null);
                } else {
                    posX.push(x); posY.push(null);
                    negX.push(x); negY.push(y);
                }
            }

            // Create fill traces
            const posTrace = {
                x: posX,
                y: posY,
                type: 'scatter',
                mode: 'lines',
                fill: 'tozeroy',
                fillcolor: t.shadePos, // theme-dependent
                line: { width: 0 },
                name: `∫ f(x) dx [${a.toFixed(2)}, ${b.toFixed(2)}]`,
                showlegend: true,
                hoverinfo: 'skip',
                cliponaxis: true
            };

            const negTrace = {
                x: negX,
                y: negY,
                type: 'scatter',
                mode: 'lines',
                fill: 'tozeroy',
                fillcolor: t.shadeNeg, // theme-dependent
                line: { width: 0 },
                name: 'Obszar całki (ujemny)',
                showlegend: false,
                hoverinfo: 'skip',
                cliponaxis: true
            };

            // Keep only traces that actually have visible segments
            const integralTraces = [];
            const hasPos = posY.some(v => v !== null && v !== 0);
            const hasNeg = negY.some(v => v !== null && v !== 0);
            if (hasPos) integralTraces.push(posTrace);
            if (hasNeg) integralTraces.push(negTrace);
            if (!hasPos && !hasNeg) {
                // fallback minimal (all zero) to keep legend entry
                integralTraces.push(posTrace);
            }
            currentIntegralTrace = integralTraces;

            // Create layout shapes: background band [a,b] and boundary lines at a, b
            currentIntegralShapes = [
                // subtle band spanning the interval [a,b]
                {
                    type: 'rect',
                    xref: 'x', yref: 'paper',
                    x0: a, x1: b, y0: 0, y1: 1,
                    fillcolor: t.shadeBetween,
                    line: { width: 0 },
                    layer: 'below'
                },
                // left boundary
                {
                    type: 'line',
                    xref: 'x', yref: 'paper',
                    x0: a, x1: a, y0: 0, y1: 1,
                    line: { color: t.shadeBetweenLine, width: 2, dash: 'dot' }
                },
                // right boundary
                {
                    type: 'line',
                    xref: 'x', yref: 'paper',
                    x0: b, x1: b, y0: 0, y1: 1,
                    line: { color: t.shadeBetweenLine, width: 2, dash: 'dot' }
                }
            ];

            // Annotations for a and b at the bottom axis
            currentIntegralAnnotations = [
                {
                    x: a, y: 0,
                    xref: 'x', yref: 'paper',
                    text: 'a',
                    showarrow: false,
                    xanchor: 'center', yanchor: 'top',
                    yshift: 12,
                    font: { size: 12, color: t.font }
                },
                {
                    x: b, y: 0,
                    xref: 'x', yref: 'paper',
                    text: 'b',
                    showarrow: false,
                    xanchor: 'center', yanchor: 'top',
                    yshift: 12,
                    font: { size: 12, color: t.font }
                }
            ];

            // Redraw plot with shading
            plotButton.click();

        } catch (err) {
            errorDisplay.textContent = `Błąd cieniowania: ${err.message}`;
        }
    }

    // Create polar wedge shading for ½ ∫ r(θ)^2 dθ over [a,b]
    function createPolarIntegralShading(rExpr, aRad, bRad) {
        try {
            const t = getActiveTheme();
            const nodeR = math.parse(rExpr);
            const compiledR = nodeR.compile();
            const scope = collectScope();
            const steps = 180;
            const dt = (bRad - aRad) / steps;
            const theta = [];
            const r = [];

            // Start at origin on θ=a
            theta.push((aRad * 180) / Math.PI);
            r.push(0);

            for (let i = 0; i <= steps; i++) {
                const t = aRad + i * dt;
                let rv = null;
                try {
                    const v = compiledR.evaluate(Object.assign({ t }, scope));
                    rv = isFinite(v) ? Math.max(0, v) : null; // non-negative radius for wedge
                } catch (e) {
                    rv = null;
                }
                theta.push((t * 180) / Math.PI);
                r.push(rv);
            }

            // Return to origin on θ=b
            theta.push((bRad * 180) / Math.PI);
            r.push(0);

            const wedgeTrace = {
                type: 'scatterpolar',
                theta,
                r,
                mode: 'lines',
                fill: 'toself',
                fillcolor: t.shadeBetween,
                line: { width: 0 },
                name: 'Obszar całki (polar)',
                showlegend: false,
                hoverinfo: 'skip'
            };

            currentPolarIntegralTraces = [wedgeTrace];
            // Redraw plot with wedge shading
            plotButton.click();
        } catch (err) {
            errorDisplay.textContent = `Błąd cieniowania (polar): ${err.message}`;
        }
    }

    // Create parametric segment highlight for t in [a,b]
    function createParametricIntegralHighlight(xExpr, yExpr, aRad, bRad) {
        try {
            const t = getActiveTheme();
            const nodeX = math.parse(xExpr);
            const nodeY = math.parse(yExpr);
            const compiledX = nodeX.compile();
            const compiledY = nodeY.compile();
            const scope = collectScope();
            const steps = 300;
            const dt = (bRad - aRad) / steps;
            const xs = [];
            const ys = [];
            for (let i = 0; i <= steps; i++) {
                const t = aRad + i * dt;
                let xv = null, yv = null;
                try { xv = compiledX.evaluate(Object.assign({ t }, scope)); } catch (e) { xv = null; }
                try { yv = compiledY.evaluate(Object.assign({ t }, scope)); } catch (e) { yv = null; }
                xs.push(isFinite(xv) ? xv : null);
                ys.push(isFinite(yv) ? yv : null);
            }
            currentParametricHighlightTrace = {
                x: xs,
                y: ys,
                type: 'scatter',
                mode: 'lines',
                line: { width: 5, color: t.shadeBetweenLine },
                name: 'Odcinek całki',
                showlegend: false,
                connectgaps: false
            };

            plotButton.click();
        } catch (err) {
            errorDisplay.textContent = `Błąd wyróżnienia (param): ${err.message}`;
        }
    }
    
    // === OBSŁUGA IMPORTU DANYCH ===
    
    /**
     * Parsuje tekst CSV do formatu { x: [], y: [], z: [] } (2D lub 3D)
     * Akceptuje przecinki, średniki i tabulatory jako delimitery.
     * Automatycznie wykrywa 2D (x,y) vs 3D (x,y,z) na podstawie liczby kolumn.
     */
    function parseCSVData(text) {
        const xValues = [];
        const yValues = [];
        const zValues = [];
        const lines = text.split('\n');
        let is3D = null; // Auto-detect: null, true, or false

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#')) continue; // Skip empty and comment lines

            // Wykryj delimiter (przecinek, średnik lub tabulator)
            const parts = trimmedLine.split(/[,;\t]/);

            if (parts.length >= 2) {
                const x = parseFloat(parts[0].trim().replace(',', '.')); // Zamień przecinek na kropkę (EU format)
                const y = parseFloat(parts[1].trim().replace(',', '.'));

                if (!isFinite(x) || !isFinite(y)) continue;

                xValues.push(x);
                yValues.push(y);

                // Check if 3D data (x, y, z)
                if (parts.length >= 3) {
                    const z = parseFloat(parts[2].trim().replace(',', '.'));
                    if (isFinite(z)) {
                        zValues.push(z);
                        if (is3D === null) is3D = true;
                    } else {
                        // Invalid z, treat as 2D
                        if (is3D === null) is3D = false;
                    }
                } else {
                    // Only 2 columns, it's 2D
                    if (is3D === null) is3D = false;
                }
            }
        }

        // If we detected 3D but don't have z for all points, it's inconsistent
        if (is3D && zValues.length !== xValues.length) {
            throw new Error('Niespójne dane: część wierszy ma 2 kolumny, część 3. Użyj jednolitego formatu.');
        }

        return { 
            x: xValues, 
            y: yValues, 
            z: is3D ? zValues : null,
            is3D: is3D || false
        };
    }

    /**
     * Parsuje dane JSON z API
     * Obsługuje formaty 2D i 3D:
     * 2D: {"data": [[x,y], ...]} lub [{x, y}, ...] lub [[x,y], ...]
     * 3D: {"data": [[x,y,z], ...]} lub [{x, y, z}, ...] lub [[x,y,z], ...]
     */
    function parseJSONData(json) {
        const xValues = [];
        const yValues = [];
        const zValues = [];
        
        let dataArray = json;
        
        // Jeśli JSON ma pole "data", użyj go
        if (json.data && Array.isArray(json.data)) {
            dataArray = json.data;
        }
        
        if (!Array.isArray(dataArray)) {
            throw new Error('Nieprawidłowy format JSON - oczekiwano tablicy');
        }
        
        let is3D = null;
        
        for (const item of dataArray) {
            let x, y, z;
            
            if (Array.isArray(item)) {
                if (item.length >= 2) {
                    x = parseFloat(item[0]);
                    y = parseFloat(item[1]);
                    
                    if (item.length >= 3) {
                        z = parseFloat(item[2]);
                        if (isFinite(z)) {
                            if (is3D === null) is3D = true;
                        }
                    } else {
                        if (is3D === null) is3D = false;
                    }
                }
            } else if (typeof item === 'object') {
                if (item.x !== undefined && item.y !== undefined) {
                    x = parseFloat(item.x);
                    y = parseFloat(item.y);
                    
                    if (item.z !== undefined) {
                        z = parseFloat(item.z);
                        if (isFinite(z)) {
                            if (is3D === null) is3D = true;
                        }
                    } else {
                        if (is3D === null) is3D = false;
                    }
                }
            } else {
                continue;
            }
            
            if (isFinite(x) && isFinite(y)) {
                xValues.push(x);
                yValues.push(y);
                if (is3D && isFinite(z)) {
                    zValues.push(z);
                }
            }
        }
        
        // Validate consistency
        if (is3D && zValues.length !== xValues.length) {
            throw new Error('Niespójne dane 3D w JSON');
        }
        
        return { 
            x: xValues, 
            y: yValues, 
            z: is3D ? zValues : null,
            is3D: is3D || false
        };
    }

    // Listener dla przycisku "Załaduj dane" (CSV)
    if (loadDataButton) {
        loadDataButton.addEventListener('click', () => {
            try {
                const data = parseCSVData(dataInput.value);
                
                if (data.x.length === 0) {
                    errorDisplay.textContent = 'Nie znaleziono poprawnych danych.';
                    loadedDataTrace = null;
                    loadedData3DTrace = null;
                    return;
                }

                if (data.is3D) {
                    // Dane 3D - stwórz ślad scatter3d
                    loadedDataTrace = null; // Clear 2D trace
                    const t = getActiveTheme();
                    const mc = (t.lines && t.lines.secondary) ? t.lines.secondary : 'rgba(50, 150, 230, 0.8)';
                    const ml = (t.lines && t.lines.primary) ? t.lines.primary : 'rgba(0, 100, 180, 1)';
                    loadedData3DTrace = {
                        x: data.x,
                        y: data.y,
                        z: data.z,
                        mode: 'markers',
                        type: 'scatter3d',
                        name: 'Dane 3D 📊',
                        marker: { 
                            color: mc, 
                            size: 5,
                            line: { color: ml, width: 0.5 }
                        }
                    };
                    errorDisplay.textContent = `✓ Załadowano ${data.x.length} punktów 3D.`;
                } else {
                    // Dane 2D - stwórz ślad scatter
                    loadedData3DTrace = null; // Clear 3D trace
                    loadedDataTrace = {
                        x: data.x,
                        y: data.y,
                        mode: 'markers',
                        type: 'scatter',
                        name: 'Dane 2D 📊',
                        marker: { 
                            color: 'rgba(230, 50, 50, 0.8)', 
                            size: 8, 
                            symbol: 'circle',
                            line: { color: 'rgba(180, 0, 0, 1)', width: 1 }
                        }
                    };
                    errorDisplay.textContent = `✓ Załadowano ${data.x.length} punktów 2D.`;
                }
                
                // Odśwież wykres, aby pokazać dane razem z bieżącą funkcją
                plotButton.click();

            } catch (err) {
                errorDisplay.textContent = `Błąd podczas ładowania danych: ${err.message}`;
                loadedDataTrace = null;
                loadedData3DTrace = null;
            }
        });
    }

    // Listener dla przycisku "Pobierz z URL" (API)
    if (fetchDataButton) {
        fetchDataButton.addEventListener('click', async () => {
            const url = dataURL.value.trim();
            
            if (!url) {
                errorDisplay.textContent = 'Wprowadź URL do API';
                return;
            }
            
            try {
                errorDisplay.textContent = 'Pobieranie danych z API...';
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const json = await response.json();
                const data = parseJSONData(json);
                
                if (data.x.length === 0) {
                    errorDisplay.textContent = 'API nie zwróciło poprawnych danych.';
                    loadedDataTrace = null;
                    loadedData3DTrace = null;
                    return;
                }

                if (data.is3D) {
                    // Dane 3D z API
                    loadedDataTrace = null;
                    const t = getActiveTheme();
                    const mc = (t.lines && t.lines.secondary) ? t.lines.secondary : 'rgba(50, 150, 230, 0.8)';
                    const ml = (t.lines && t.lines.primary) ? t.lines.primary : 'rgba(0, 100, 180, 1)';
                    loadedData3DTrace = {
                        x: data.x,
                        y: data.y,
                        z: data.z,
                        mode: 'markers',
                        type: 'scatter3d',
                        name: 'Dane 3D z API 🌐',
                        marker: { 
                            color: mc, 
                            size: 5,
                            line: { color: ml, width: 0.5 }
                        }
                    };
                    errorDisplay.textContent = `✓ Pobrano ${data.x.length} punktów 3D z API.`;
                } else {
                    // Dane 2D z API
                    loadedData3DTrace = null;
                    loadedDataTrace = {
                        x: data.x,
                        y: data.y,
                        mode: 'markers',
                        type: 'scatter',
                        name: 'Dane 2D z API 🌐',
                        marker: { 
                            color: 'rgba(50, 150, 230, 0.8)', 
                            size: 8, 
                            symbol: 'diamond',
                            line: { color: 'rgba(0, 100, 180, 1)', width: 1 }
                        }
                    };
                    errorDisplay.textContent = `✓ Pobrano ${data.x.length} punktów 2D z API.`;
                }
                
                // Odśwież wykres
                plotButton.click();

            } catch (err) {
                errorDisplay.textContent = `Błąd pobierania z API: ${err.message}`;
                loadedDataTrace = null;
            }
        });
    }

    // Listener dla przycisku "Wyczyść dane"
    if (clearDataButton) {
        clearDataButton.addEventListener('click', () => {
            loadedDataTrace = null;
            if (dataInput) dataInput.value = '';
            if (dataURL) dataURL.value = '';
            errorDisplay.textContent = 'Dane zostały wyczyszczone.';
            
            // Odśwież wykres (już bez danych)
            plotButton.click();
        });
    }
    
    // === KONIEC OBSŁUGI IMPORTU DANYCH ===

    // === HISTORIA WYKRESÓW ===
    
    // Load history from localStorage
    function loadHistory() {
        try {
            const saved = localStorage.getItem('plotHistory');
            if (saved) {
                plotHistory = JSON.parse(saved);
                // Limit to MAX_HISTORY_ITEMS
                if (plotHistory.length > MAX_HISTORY_ITEMS) {
                    plotHistory = plotHistory.slice(-MAX_HISTORY_ITEMS);
                }
            }
        } catch (e) {
            console.warn('Failed to load history:', e);
            plotHistory = [];
        }
        renderHistoryList();
    }

    // Save history to localStorage
    function saveHistory() {
        try {
            localStorage.setItem('plotHistory', JSON.stringify(plotHistory));
        } catch (e) {
            console.warn('Failed to save history:', e);
        }
    }

    // Capture current state snapshot
    function captureSnapshot() {
        const mode = (plotMode && plotMode.value) || 'cartesian';
        const timestamp = Date.now();
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        
        const snapshot = {
            id: timestamp,
            timestamp,
            timeStr,
            mode,
            cartesian: {
                expr1: (functionInput && functionInput.value) || '',
                expr2: (function2Input && function2Input.value) || '',
                xMin: (xMinInput && xMinInput.value) || '-10',
                xMax: (xMaxInput && xMaxInput.value) || '10',
                yMin: (yMinInput && yMinInput.value) || '-10',
                yMax: (yMaxInput && yMaxInput.value) || '10'
            },
            parametric: {
                xExpr: (document.getElementById('xParamInput') || {}).value || '',
                yExpr: (document.getElementById('yParamInput') || {}).value || '',
                tMin: (document.getElementById('tMinInput') || {}).value || '-6.28',
                tMax: (document.getElementById('tMaxInput') || {}).value || '6.28'
            },
            polar: {
                rExpr: (document.getElementById('rInput') || {}).value || '',
                thetaMin: (document.getElementById('thetaMinInput') || {}).value || '0',
                thetaMax: (document.getElementById('thetaMaxInput') || {}).value || '6.28'
            },
            '3d': {
                expr: (document.getElementById('surfaceInput') || {}).value || '',
                xMin: (document.getElementById('xMin3D') || {}).value || '-5',
                xMax: (document.getElementById('xMax3D') || {}).value || '5',
                yMin: (document.getElementById('yMin3D') || {}).value || '-5',
                yMax: (document.getElementById('yMax3D') || {}).value || '5',
                resolution: (document.getElementById('resolution3D') || {}).value || '50'
            },
            analysis: {
                zeros: (document.getElementById('zerosCheckbox') || {}).checked || false,
                extrema: (document.getElementById('extremaCheckbox') || {}).checked || false,
                inflections: (document.getElementById('inflectionsCheckbox') || {}).checked || false,
                intersections: (document.getElementById('intersectionsCheckbox') || {}).checked || false,
                derivative: (document.getElementById('derivativePlotCheckbox') || {}).checked || false
            },
            params: collectScope()
        };
        
        // Generate label based on mode and expression
        if (mode === 'cartesian') {
            snapshot.label = snapshot.cartesian.expr1 || 'f(x)';
        } else if (mode === 'parametric') {
            snapshot.label = 'parametric';
        } else if (mode === 'polar') {
            snapshot.label = `r(θ) = ${snapshot.polar.rExpr || '...'}`.substring(0, 30);
        } else if (mode === '3d') {
            snapshot.label = `z(x,y) = ${snapshot['3d'].expr || '...'}`.substring(0, 30);
        }
        
        console.log('Captured snapshot:', snapshot);
        return snapshot;
    }

    // Add snapshot to history
    function addToHistory(snapshot) {
        plotHistory.push(snapshot);
        if (plotHistory.length > MAX_HISTORY_ITEMS) {
            plotHistory.shift(); // Remove oldest
        }
        saveHistory();
        renderHistoryList();
    }

    // Restore state from snapshot
    function restoreSnapshot(snapshot) {
        if (!snapshot) return;
        
        // Set mode
        if (plotMode) plotMode.value = snapshot.mode;
        
        // Restore data based on mode
        if (snapshot.mode === 'cartesian') {
            functionInput.value = snapshot.cartesian.expr1;
            function2Input.value = snapshot.cartesian.expr2;
            xMinInput.value = snapshot.cartesian.xMin;
            xMaxInput.value = snapshot.cartesian.xMax;
            yMinInput.value = snapshot.cartesian.yMin;
            yMaxInput.value = snapshot.cartesian.yMax;
        } else if (snapshot.mode === 'parametric') {
            const xParam = document.getElementById('xParamInput');
            const yParam = document.getElementById('yParamInput');
            const tMin = document.getElementById('tMinInput');
            const tMax = document.getElementById('tMaxInput');
            if (xParam) xParam.value = snapshot.parametric.xExpr;
            if (yParam) yParam.value = snapshot.parametric.yExpr;
            if (tMin) tMin.value = snapshot.parametric.tMin;
            if (tMax) tMax.value = snapshot.parametric.tMax;
        } else if (snapshot.mode === 'polar') {
            const rInput = document.getElementById('rInput');
            const thetaMin = document.getElementById('thetaMinInput');
            const thetaMax = document.getElementById('thetaMaxInput');
            if (rInput) rInput.value = snapshot.polar.rExpr;
            if (thetaMin) thetaMin.value = snapshot.polar.thetaMin;
            if (thetaMax) thetaMax.value = snapshot.polar.thetaMax;
        } else if (snapshot.mode === '3d') {
            const surface = document.getElementById('surfaceInput');
            const xMin3D = document.getElementById('xMin3D');
            const xMax3D = document.getElementById('xMax3D');
            const yMin3D = document.getElementById('yMin3D');
            const yMax3D = document.getElementById('yMax3D');
            const res3D = document.getElementById('resolution3D');
            if (surface) surface.value = snapshot['3d'].expr;
            if (xMin3D) xMin3D.value = snapshot['3d'].xMin;
            if (xMax3D) xMax3D.value = snapshot['3d'].xMax;
            if (yMin3D) yMin3D.value = snapshot['3d'].yMin;
            if (yMax3D) yMax3D.value = snapshot['3d'].yMax;
            if (res3D) res3D.value = snapshot['3d'].resolution;
        }
        
        // Restore analysis checkboxes
        const zerosCheck = document.getElementById('zerosCheckbox');
        const extremaCheck = document.getElementById('extremaCheckbox');
        const inflectionsCheck = document.getElementById('inflectionsCheckbox');
        const intersectionsCheck = document.getElementById('intersectionsCheckbox');
        const derivativeCheck = document.getElementById('derivativePlotCheckbox');
        
        if (zerosCheck) zerosCheck.checked = snapshot.analysis.zeros;
        if (extremaCheck) extremaCheck.checked = snapshot.analysis.extrema;
        if (inflectionsCheck) inflectionsCheck.checked = snapshot.analysis.inflections;
        if (intersectionsCheck) intersectionsCheck.checked = snapshot.analysis.intersections;
        if (derivativeCheck) derivativeCheck.checked = snapshot.analysis.derivative;
        
        // Restore parameters
        if (snapshot.params && typeof snapshot.params === 'object') {
            Object.keys(snapshot.params).forEach(name => {
                const slider = document.getElementById(`slider-${name}`);
                const label = document.getElementById(`label-${name}`);
                if (slider) {
                    slider.value = snapshot.params[name];
                    if (label) label.textContent = Number(snapshot.params[name]).toFixed(2);
                }
            });
        }
        
        // Update mode visibility
        updateModeVisibility();
        
        // Trigger re-detection of params and replot
        paramsUpdater();
        
        // Small delay to let UI settle, then plot
        setTimeout(() => {
            if (plotButton) plotButton.click();
        }, 100);
    }

    // Render history list
    function renderHistoryList() {
        const fsHistoryListEl = document.getElementById('fsHistoryList');
        if (!historyList && !fsHistoryListEl) {
            console.warn('historyList elements not found!');
            return;
        }
        
        console.log('Rendering history, items:', plotHistory.length);
        
        if (plotHistory.length === 0) {
            if (historyList) historyList.innerHTML = '<div style="text-align:center;color:#999;font-size:11px;padding:10px;">Brak historii</div>';
            if (fsHistoryListEl) fsHistoryListEl.innerHTML = '<div style="text-align:center;color:#999;font-size:11px;padding:10px;">Brak historii</div>';
            return;
        }
        
        // Reverse to show newest first
        const reversed = plotHistory.slice().reverse();
        
        console.log('Reversed history:', reversed);
        
        const htmlContent = reversed.map((snap, idx) => {
            console.log(`Rendering snap ${idx}:`, snap);
            const modeEmoji = { cartesian: '📊', parametric: '〰️', polar: '🎯', '3d': '📦' }[snap.mode] || '📈';
            const label = (snap.label || 'Wykres').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const timeStr = snap.timeStr || 'brak czasu';
            const html = `<div class="history-item" data-id="${snap.id}">
    <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <div style="flex:1;overflow:hidden;margin-right:8px;min-width:0;">
            <strong>${modeEmoji} ${label}</strong>
            <div style="font-size:10px;color:#666;margin-top:2px;">${timeStr}</div>
        </div>
        <button class="history-delete" data-id="${snap.id}" onclick="event.stopPropagation();" title="Usuń">✕</button>
    </div>
</div>`;
            console.log(`HTML for snap ${idx}:`, html);
            return html;
        }).join('');
        
        console.log('Final HTML:', htmlContent);
        if (historyList) historyList.innerHTML = htmlContent;
        if (fsHistoryListEl) fsHistoryListEl.innerHTML = htmlContent;
        
        // Add click listeners to restore
        const bindListEvents = (container) => {
            if (!container) return;
            container.querySelectorAll('.history-item').forEach(item => {
                const id = parseInt(item.dataset.id);
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('history-delete')) return;
                    const snap = plotHistory.find(s => s.id === id);
                    if (snap) restoreSnapshot(snap);
                });
            });
            container.querySelectorAll('.history-delete').forEach(btn => {
                const id = parseInt(btn.dataset.id);
                btn.addEventListener('click', () => {
                    plotHistory = plotHistory.filter(s => s.id !== id);
                    saveHistory();
                    renderHistoryList();
                });
            });
        };
        bindListEvents(historyList);
        bindListEvents(fsHistoryListEl);
    }

    // Clear history button
    function clearHistoryAction() {
        if (confirm('Czy na pewno chcesz wyczyścić całą historię?')) {
            plotHistory = [];
            saveHistory();
            renderHistoryList();
        }
    }
    if (clearHistoryButton) {
        clearHistoryButton.addEventListener('click', clearHistoryAction);
    }
    if (fsClearHistoryButton) {
        fsClearHistoryButton.addEventListener('click', clearHistoryAction);
    }

    // Load history on startup
    loadHistory();
    // Ustaw szybki preset próbkowania przy pierwszym uruchomieniu (dla szybkości)
    try {
        if (samplingPreset && !localStorage.getItem('samplingPresetInit')) {
            samplingPreset.value = 'fast';
            samplingPreset.dispatchEvent(new Event('change', { bubbles: true }));
            localStorage.setItem('samplingPresetInit', '1');
        }
    } catch(_) {}
    // Jednorazowy auto-plot na starcie, aby od razu coś ładnego wyświetlić
    try {
        if (!localStorage.getItem('initialPlotted')) {
            setTimeout(() => { const btn = document.getElementById('plotButton'); if (btn) btn.click(); }, 50);
            localStorage.setItem('initialPlotted', '1');
        }
    } catch(_) {}
    
    // === KONIEC HISTORII ===

    // Funkcja pomocnicza do wykrycia okresowości funkcji
    function detectPeriodicity(compiled, maxTest = 100, scope = {}) {
        const samples = [];
        const tolerance = 0.001;

        // Zbierz próbki (używamy scope jeśli dostępny)
        for (let x = 0; x <= maxTest; x += 0.1) {
            try {
                const y = compiled.evaluate(Object.assign({ x }, scope));
                if (isFinite(y)) {
                    samples.push({ x, y });
                }
            } catch (e) { }
        }

        // Szukaj okresowości przez analizę przecięć z osią Y
        const crossings = [];
        for (let i = 1; i < samples.length; i++) {
            if ((samples[i-1].y <= 0 && samples[i].y > 0) || 
                (samples[i-1].y >= 0 && samples[i].y < 0)) {
                crossings.push(samples[i].x);
            }
        }

        // Oblicz różnice między kolejnymi przecięciami
        const periods = [];
        for (let i = 1; i < crossings.length; i++) {
            const period = crossings[i] - crossings[i-1];
            if (period > tolerance) {
                periods.push(period);
            }
        }

        // Jeśli znaleziono powtarzający się okres
        if (periods.length >= 2) {
            const avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
            return avgPeriod;
        }

        return null;
    }

    // Funkcja pomocnicza do znalezienia zakresu X z zerami i ekstremami
    function findInterestingXRange(expr, scope = {}) {
    try {
            const node = math.parse(expr);
            const compiled = node.compile();
            // Najpierw sprawdź czy funkcja jest okresowa (weź pod uwagę scope)
            const period = detectPeriodicity(compiled, 100, scope);
            if (period) {
                const periodsToShow = 4; // Ile okresów pokazać
                return {
                    min: Math.round(-period * (periodsToShow/2) * 100) / 100,
                    max: Math.round(period * (periodsToShow/2) * 100) / 100
                };
            }

            // Jeśli funkcja nie jest okresowa, szukaj charakterystycznych punktów
            const derivative = math.derivative(expr, 'x');
            const derivCompiled = derivative.compile();

            const testPoints = [];
            const step = 0.5;
            for (let x = -50; x <= 50; x += step) {
                try {
                    const y = compiled.evaluate(Object.assign({ x }, scope));
                    const dy = derivCompiled.evaluate(Object.assign({ x }, scope));
                    if (Math.abs(y) < 0.1 || Math.abs(dy) < 0.1) {
                        testPoints.push(x);
                    }
                } catch (e) { }
            }

            if (testPoints.length === 0) {
                return { min: -10, max: 10 }; // domyślny zakres
            }

            const xMin = Math.min(...testPoints);
            const xMax = Math.max(...testPoints);
            const range = xMax - xMin;
            const padding = Math.max(2, range * 0.2);

            return {
                min: Math.round((xMin - padding) * 100) / 100,
                max: Math.round((xMax + padding) * 100) / 100
            };
        } catch (e) {
            return { min: -10, max: 10 }; // w razie błędu
        }
    }

    // Funkcja pomocnicza do znalezienia zakresu Y
    function findYRange(compiled, xMin, xMax, scope = {}) {
        const sampleCount = 500;
        const ys = [];
        const step = (xMax - xMin) / sampleCount;
        const ABS_LIMIT = 1e6;

        for (let i = 0; i <= sampleCount; i++) {
            const x = xMin + i * step;
            try {
                const y = compiled.evaluate(Object.assign({ x }, scope));
                if (isFinite(y) && Math.abs(y) < ABS_LIMIT) ys.push(y);
            } catch (e) { }
        }

        if (ys.length === 0) {
            return null;
        }

        // Use robust percentiles to ignore outliers
        const low = percentile(ys, 2.5);
        const high = percentile(ys, 97.5);
        if (!isFinite(low) || !isFinite(high) || low >= high) {
            // fallback: use min/max trimmed
            const finite = ys.filter(v => isFinite(v)).slice(0, 1000);
            if (finite.length === 0) return null;
            const minv = Math.min(...finite);
            const maxv = Math.max(...finite);
            if (!isFinite(minv) || !isFinite(maxv) || minv >= maxv) return null;
            const padding2 = Math.max(0.1, 0.05 * (maxv - minv));
            return { min: Math.round((minv - padding2) * 100) / 100, max: Math.round((maxv + padding2) * 100) / 100 };
        }

        const padding = 0.05 * (high - low);
        return {
            min: Math.round((low - padding) * 100) / 100,
            max: Math.round((high + padding) * 100) / 100
        };
    }

    // Auto-fit handler
    if (autoFitBtn) {
        autoFitBtn.addEventListener('click', () => {
            const expr = functionInput.value;
            const scope = collectScope();
            if (!expr) {
                errorDisplay.textContent = 'Wpisz funkcję przed Auto-fit.';
                return;
            }

            // Najpierw znajdź zakres X
            const xRange = findInterestingXRange(expr, scope);
            xMinInput.value = xRange.min;
            xMaxInput.value = xRange.max;

            // Następnie oblicz zakres Y dla nowego zakresu X
            let compiled;
            try {
                compiled = math.parse(expr).compile();
            } catch (e) {
                errorDisplay.textContent = 'Błąd kompilacji funkcji.';
                return;
            }

            const yRange = findYRange(compiled, xRange.min, xRange.max, scope);
            if (!yRange) {
                errorDisplay.textContent = 'Nie udało się wyliczyć rozsądnego zakresu Y.';
                return;
            }

            yMinInput.value = yRange.min;
            yMaxInput.value = yRange.max;
            plotButton.click();
        });
    }

    // Extend renderFromComputation to support polar traces
    const originalRender = renderFromComputation;
    // we already have function renderFromComputation declared above; update it in-place by
    // relying on resultPayload flags inside the existing function. (No replacement needed here.)

    // Loading indicator helper
    const loadingIndicator = document.getElementById('loadingIndicator');
    function showLoading(text = 'Obliczanie...') {
        if (loadingIndicator) {
            const textEl = loadingIndicator.querySelector('.loading-text');
            if (textEl) textEl.textContent = text;
            loadingIndicator.classList.add('active');
        }
    }
    function hideLoading() {
        if (loadingIndicator) {
            loadingIndicator.classList.remove('active');
        }
    }

    // Obsługa kliknięcia przycisku "Rysuj"
    plotButton.addEventListener('click', () => {
    const mode = (plotModeSelect && plotModeSelect.value) || 'cartesian';
    errorDisplay.textContent = '';
    showLoading('Generowanie wykresu...');
        try {
            // Stałe dla rysowania wykresu
            const JUMP_THRESHOLD = 10;
            const ABS_MAG_LIMIT = 1e5;

            // Delegacja do workera: build a payload depending on mode
            // Przygotuj zakresy i dane do wykresu
            const xMin = parseNumberInput(xMinInput.value);
            const xMax = parseNumberInput(xMaxInput.value);
            if (!(isFinite(xMin) && isFinite(xMax)) || xMin >= xMax) {
                throw new Error("Niepoprawne wartości X min / X max.");
            }

            // Pobierz i waliduj zakres Y
            const yMin = parseNumberInput(yMinInput.value);
            const yMax = parseNumberInput(yMaxInput.value);
            if (!(isFinite(yMin) && isFinite(yMax)) || yMin >= yMax) {
                throw new Error("Niepoprawne wartości Y min / Y max.");
            }

            // Delegate heavy computation to worker (if available)
            const plotDiv = myChartCanvas; // myChartCanvas jest elementem DOM (zamieniliśmy canvas na div)
            if (calcWorker) {
                // show temporary status
                errorDisplay.textContent = 'Obliczanie...';
                const function2Input = document.getElementById('function2Input');
                const expression2 = function2Input.value.trim();
                const zerosChecked = (document.getElementById('zerosCheckbox') || {}).checked;
                const extremaChecked = (document.getElementById('extremaCheckbox') || {}).checked;
                const intersectionsChecked = (document.getElementById('intersectionsCheckbox') || {}).checked;
                const derivativePlotChecked = (document.getElementById('derivativePlotCheckbox') || {}).checked;
                const inflectionsChecked = (document.getElementById('inflectionsCheckbox') || {}).checked;
                // Build payload depending on mode
                const basePayload = {
                    xMin, xMax, yMin, yMax,
                    initialPoints: 200,
                    options: buildSamplingOptions(xMin, xMax),
                    calculateZeros: Boolean(zerosChecked),
                    calculateExtrema: Boolean(extremaChecked),
                    calculateIntersections: Boolean(intersectionsChecked),
                    scope: collectScope(),
                    calculateDerivativePlot: Boolean(derivativePlotChecked),
                    calculateInflections: Boolean(inflectionsChecked)
                };

                let payload = Object.assign({}, basePayload);
                payload.mode = mode;
                if (mode === 'cartesian') {
                    payload.expression = functionInput.value;
                    payload.expression2 = expression2;
                } else if (mode === 'parametric') {
                    payload.xExpr = (xParamInput && xParamInput.value) || '';
                    payload.yExpr = (yParamInput && yParamInput.value) || '';
                    payload.tMin = parseNumberInput((tMinInput && tMinInput.value) || -6.28);
                    payload.tMax = parseNumberInput((tMaxInput && tMaxInput.value) || 6.28);
                } else if (mode === 'polar') {
                    payload.rExpr = (rInput && rInput.value) || '';
                    payload.tMin = parseNumberInput((thetaMinInput && thetaMinInput.value) || 0);
                    payload.tMax = parseNumberInput((thetaMaxInput && thetaMaxInput.value) || 6.28);
                } else if (mode === '3d') {
                    const surfaceInput = document.getElementById('surfaceInput');
                    const xMin3D = parseNumberInput(document.getElementById('xMin3D').value);
                    const xMax3D = parseNumberInput(document.getElementById('xMax3D').value);
                    const yMin3D = parseNumberInput(document.getElementById('yMin3D').value);
                    const yMax3D = parseNumberInput(document.getElementById('yMax3D').value);
                    const resolution3D = parseNumberInput(document.getElementById('resolution3D').value);

                    if (!surfaceInput || !surfaceInput.value.trim()) {
                        throw new Error('Wprowadź funkcję z(x,y)');
                    }
                    if (!isFinite(xMin3D) || !isFinite(xMax3D) || xMin3D >= xMax3D || !isFinite(yMin3D) || !isFinite(yMax3D) || yMin3D >= yMax3D) {
                        throw new Error('Niepoprawne wartości X min/max dla wykresu 3D');
                    }
                    if (!isFinite(resolution3D) || resolution3D < 10 || resolution3D > 200) {
                        throw new Error('Rozdzielczość musi być między 10 a 200');
                    }

                    payload = {
                        mode: '3d',
                        expr: surfaceInput.value,
                        xRange: { min: xMin3D, max: xMax3D },
                        yRange: { min: yMin3D, max: yMax3D },
                        resolution: resolution3D,
                        scope: collectScope()
                    };
                }

                // Create a one-time message handler for this compute request
                const onMessage = (ev) => {
                    const msg = ev.data;
                    if (!msg) return;
                    
                    // Handle errors first
                    if (msg.type === 'error') {
                        errorDisplay.textContent = `Błąd obliczeń: ${msg.payload.message}`;
                        calcWorker.removeEventListener('message', onMessage);
                        return;
                    }
                    
                    // Handle successful results
                    if (msg.type === 'result') {
                        if (msg.payload.mode === '3d') {
                            handle3DPlot(msg.payload);
                        } else {
                            // pass through the returned payload for other modes
                            renderFromComputation(msg.payload, functionInput.value, expression2);
                            errorDisplay.textContent = '';
                        }
                        calcWorker.removeEventListener('message', onMessage);
                        hideLoading();
                    }
                };
                
                calcWorker.addEventListener('message', onMessage);
                calcWorker.postMessage({ type: 'compute', payload });
                
                // Save to history after successful plot initiation
                const snapshot = captureSnapshot();
                addToHistory(snapshot);
                
                return; // wait for worker to respond
            }

            // Fallback (no worker): do a lightweight inline sampling so the UI still works
            try {
                const scope = collectScope();
                const sampleCount = 600;
                if (mode === 'cartesian') {
                    const expr = functionInput.value;
                    const expr2 = (function2Input && function2Input.value) ? function2Input.value : '';
                    const compiled = math.parse(expr).compile();
                    const compiled2 = expr2 ? math.parse(expr2).compile() : null;
                    const xs = [];
                    const ys = [];
                    const xs2 = [];
                    const ys2 = [];
                    const step = (xMax - xMin) / sampleCount;
                    for (let i = 0; i <= sampleCount; i++) {
                        const x = xMin + i * step;
                        try {
                            const y = compiled.evaluate(Object.assign({ x }, scope));
                            xs.push(x);
                            ys.push(isFinite(y) ? y : null);
                        } catch (e) { xs.push(x); ys.push(null); }
                        if (compiled2) {
                            try {
                                const y2 = compiled2.evaluate(Object.assign({ x }, scope));
                                xs2.push(x);
                                ys2.push(isFinite(y2) ? y2 : null);
                            } catch (e) { xs2.push(x); ys2.push(null); }
                        }
                    }
                    renderFromComputation({ mode: 'cartesian', samples1: { x: xs, y: ys }, samples2: compiled2 ? { x: xs2, y: ys2 } : null, intersections: [], zeros: [], extrema: [] }, functionInput.value, expr2 || '');
                    errorDisplay.textContent = '';
                    return;
                } else if (mode === 'parametric') {
                    const xExpr = (xParamInput && xParamInput.value) || '';
                    const yExpr = (yParamInput && yParamInput.value) || '';
                    const tMin = parseNumberInput((tMinInput && tMinInput.value) || '-6.28');
                    const tMax = parseNumberInput((tMaxInput && tMaxInput.value) || '6.28');
                    const compiledX = math.parse(xExpr).compile();
                    const compiledY = math.parse(yExpr).compile();
                    const xs = [];
                    const ys = [];
                    for (let i = 0; i <= sampleCount; i++) {
                        const t = tMin + (tMax - tMin) * (i / sampleCount);
                        try {
                            const xv = compiledX.evaluate(Object.assign({ t }, scope));
                            const yv = compiledY.evaluate(Object.assign({ t }, scope));
                            xs.push(isFinite(xv) ? xv : null);
                            ys.push(isFinite(yv) ? yv : null);
                        } catch (e) { xs.push(null); ys.push(null); }
                    }
                    renderFromComputation({ mode: 'parametric', samples1: { x: xs, y: ys } }, '', '');
                    errorDisplay.textContent = '';
                    return;
                } else if (mode === 'polar') {
                    const rExpr = (rInput && rInput.value) || '';
                    const tMin = parseNumberInput((thetaMinInput && thetaMinInput.value) || '0');
                    const tMax = parseNumberInput((thetaMaxInput && thetaMaxInput.value) || '6.28');
                    const compiledR = math.parse(rExpr).compile();
                    const rs = [];
                    const thetas = [];
                    for (let i = 0; i <= sampleCount; i++) {
                        const t = tMin + (tMax - tMin) * (i / sampleCount);
                        try {
                            const rv = compiledR.evaluate(Object.assign({ t }, scope));
                            rs.push(isFinite(rv) ? rv : null);
                            thetas.push((t * 180) / Math.PI);
                        } catch (e) { rs.push(null); thetas.push(null); }
                    }
                    renderFromComputation({ mode: 'polar', polar: true, r: rs, theta: thetas, rExpr }, '', '');
                    errorDisplay.textContent = '';
                    return;
                }
            } catch (err) {
                console.error('Fallback plotting error:', err);
                errorDisplay.textContent = `Błąd: ${err.message}`;
                return;
            }

            // koniec obsługi przycisków nawigacji

        } catch (err) {
            // Obsługa błędów: pokaż komunikat i wyczyść wykres
            console.error(err);
            errorDisplay.textContent = `Błąd: ${err.message}`;
            hideLoading();
            try {
                if (myChart && typeof Plotly !== 'undefined') {
                    Plotly.purge(myChartCanvas);
                }
            } catch (e) {
                // ignore
            }
            myChart = null;
        }
    });
});