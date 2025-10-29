// Global variables for data traces
let loadedDataTrace = null; // Trace dla importowanych danych 2D (CSV/API)
let loadedData3DTrace = null; // Trace dla importowanych danych 3D (CSV/API)

// Funkcja do renderowania wykresu 3D
function handle3DPlot(data) {
    console.log('Otrzymane dane 3D:', data);
    
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
                gridcolor: '#d0d0d0',
                gridwidth: 2
            },
            yaxis: { 
                title: { text: 'Y', font: { size: 14, weight: 600 } },
                gridcolor: '#d0d0d0',
                gridwidth: 2
            },
            zaxis: { 
                title: { text: 'Z', font: { size: 14, weight: 600 } },
                gridcolor: '#d0d0d0',
                gridwidth: 2
            },
            camera: {
                eye: { x: 1.5, y: 1.5, z: 1.5 }
            },
            aspectmode: 'cube'
        },
        autosize: true,
        margin: { l: 0, r: 0, b: 0, t: 50 }
    };

    console.log('Konfiguracja wykresu:', { traces, layout });
    
    // Wyczyść poprzedni wykres
    Plotly.purge('myChart');
    
    // Renderuj nowy wykres
    Plotly.newPlot('myChart', traces, layout, {
        responsive: true,
        displayModeBar: true,
        modeBarButtons: [[
            'toImage', 
            'zoom3d', 
            'pan3d', 
            'orbitRotation', 
            'resetCameraDefault3d'
        ]]
    }).then(() => {
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
    const modeHelper = document.getElementById('modeHelper');
    const plotMode = document.getElementById('plotMode');
    const samplingPreset = document.getElementById('samplingPreset');
    const calculateIntegralButton = document.getElementById('calculateIntegralButton');
    const integralA = document.getElementById('integralA');
    const integralB = document.getElementById('integralB');
    const analysisResults = document.getElementById('analysisResults');
    const analysisResultsContent = document.getElementById('analysisResultsContent');
    const dataInput = document.getElementById('dataInput');
    const dataURL = document.getElementById('dataURL');
    const loadDataButton = document.getElementById('loadDataButton');
    const fetchDataButton = document.getElementById('fetchDataButton');
    const clearDataButton = document.getElementById('clearDataButton');

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

    // Obsługa kliknięć w szybkie funkcje
    document.querySelectorAll('.quick-functions span').forEach(span => {
        span.addEventListener('click', (e) => {
            const func = e.target.getAttribute('data-func');
            if (func) {
                if (lastActiveInput) {
                    // Zachowaj pozycję kursora
                    const start = lastActiveInput.selectionStart;
                    const end = lastActiveInput.selectionEnd;
                    const text = lastActiveInput.value;
                    
                    // Wstaw funkcję
                    lastActiveInput.value = text.substring(0, start) + func + text.substring(end);
                    
                    // Przywróć fokus i ustaw kursor
                    lastActiveInput.focus();
                    lastActiveInput.setSelectionRange(start + func.length, start + func.length);
                } else {
                    // Jeśli nie było aktywnego pola, użyj domyślnego dla aktualnego trybu
                    insertFunction(func);
                }
            }
        });
    });

    // Funkcja do aktualizacji pomocy i przykładów
    function updateModeUI(mode) {
        // Ukryj wszystkie zestawy szybkich funkcji i inputów
        document.querySelectorAll('.quick-functions').forEach(set => set.style.display = 'none');
        document.getElementById('cartesianInputs').style.display = 'none';
        document.getElementById('parametricInputs').style.display = 'none';
        document.getElementById('polarInputs').style.display = 'none';
        document.getElementById('3dInputs').style.display = 'none';
        
        // Pokaż odpowiedni zestaw szybkich funkcji
        const quickFunctionsId = mode + 'QuickFunctions';
        const quickFunctions = document.getElementById(quickFunctionsId);
        if (quickFunctions) quickFunctions.style.display = 'block';
        
        // Pokaż odpowiednie pola wprowadzania
        const inputsId = mode + 'Inputs';
        const inputs = document.getElementById(inputsId);
        if (inputs) inputs.style.display = 'block';
        
        // Aktualizuj tekst pomocniczy
        const helperTexts = {
            cartesian: 'Użyj zmiennej x do zdefiniowania funkcji, np. sin(x) lub x^2',
            parametric: 'Użyj zmiennej t do zdefiniowania obu równań x(t) i y(t)',
            polar: 'Użyj zmiennej t do zdefiniowania równania r(t) w układzie biegunowym',
            '3d': 'Użyj zmiennych x i y do zdefiniowania funkcji powierzchni z(x,y), np. sin(x)*cos(y)'
        };
        modeHelper.textContent = helperTexts[mode] || '';

        // Tryb 3D: ustaw domyślną funkcję i fokus, a także zainicjuj suwaki parametrów
        if (mode === '3d') {
            const s = document.getElementById('surfaceInput');
            if (s) {
                if (!s.value || s.value.trim() === '') {
                    s.value = 'a*x + b*y + c';
                }
                // Fokus i kursor na końcu
                s.focus();
                try {
                    const len = s.value.length;
                    s.setSelectionRange(len, len);
                } catch (_) {}
            }
            // Jeśli dostępny, odśwież wykryte parametry, aby pokazać suwaki a,b,c
            try {
                if (typeof paramsUpdater !== 'undefined' && paramsUpdater) paramsUpdater();
            } catch (_) {}
        }
    }

    // Słuchacz zmiany trybu
    if (plotMode) {
        plotMode.addEventListener('change', (e) => {
            updateModeUI(e.target.value);
        });
        // Inicjalizacja przy załadowaniu
        updateModeUI(plotMode.value);
    }
        const presetButtons = document.querySelectorAll('.presets button');
    
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
            // rebuild param controls for the newly selected mode (paramsUpdater is defined later)
            try {
                if (typeof paramsUpdater !== 'undefined' && paramsUpdater) paramsUpdater();
            } catch (e) { /* paramsUpdater not ready yet; will be initialized shortly */ }
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

    // Przywróć ostatnie zakresy z localStorage
    try {
        const savedRanges = JSON.parse(localStorage.getItem('chartRanges')) || {};
        if (savedRanges.xMin) xMinInput.value = roundRange(validateRange(savedRanges.xMin));
        if (savedRanges.xMax) xMaxInput.value = roundRange(validateRange(savedRanges.xMax));
        if (savedRanges.yMin) yMinInput.value = roundRange(validateRange(savedRanges.yMin));
        if (savedRanges.yMax) yMaxInput.value = roundRange(validateRange(savedRanges.yMax));
    } catch (e) {
        console.warn('Nie udało się wczytać zapisanych zakresów:', e);
        // Ustaw wartości domyślne
        xMinInput.value = -10;
        xMaxInput.value = 10;
        yMinInput.value = -10;
        yMaxInput.value = 10;
    }
    let myChart = null; // referencja do wykresu Plotly (graph div)
    let currentIntegralTrace = null; // track shaded integral area (can be a single trace or an array of traces)
    let currentIntegralShapes = null; // layout shapes for integral (band + boundaries)
    let currentIntegralAnnotations = null; // layout annotations for integral (labels a, b)
    let currentAnalysisData = { zeros: [], extrema: [], intersections: [], integral: null }; // store for display
    let currentPolarIntegralTraces = null; // polar wedge and optional label marker
    let currentParametricHighlightTrace = null; // highlighted segment for t in [a,b]
    
    // Calculator worker - handles heavy computations
    let calcWorker = null;
    try {
        calcWorker = new Worker('calculator-worker.js');
    } catch (e) {
        console.warn('Nie udało się utworzyć Web Workera:', e);
        calcWorker = null;
    }

    // Function to display analysis results
    function displayAnalysisResults() {
        if (!analysisResults || !analysisResultsContent) return;
        
        const { zeros, extrema, integral, intersections } = currentAnalysisData;
        const parts = [];
        
        if (zeros && zeros.length > 0) {
            const zerosList = zeros.map(p => `x = ${p.x.toFixed(4)}`).join(', ');
            parts.push(`<div style="margin-bottom:10px;line-height:1.6;"><strong style="font-size:14px;color:#2c3e50;">Miejsca zerowe:</strong><br><span style="font-size:13px;color:#495057;">${zerosList}</span></div>`);
        }
        
        if (extrema && extrema.length > 0) {
            const extremaList = extrema.map(p => `(${p.x.toFixed(4)}, ${p.y.toFixed(4)})`).join(', ');
            parts.push(`<div style="margin-bottom:10px;line-height:1.6;"><strong style="font-size:14px;color:#2c3e50;">Ekstrema:</strong><br><span style="font-size:13px;color:#495057;">${extremaList}</span></div>`);
        }
        
        if (intersections && intersections.length > 0) {
            const intersectionsList = intersections.map(p => `(${p.x.toFixed(4)}, ${p.y.toFixed(4)})`).join(', ');
            parts.push(`<div style="margin-bottom:10px;line-height:1.6;"><strong style="font-size:14px;color:#2c3e50;">Punkty przecięcia:</strong><br><span style="font-size:13px;color:#495057;">${intersectionsList}</span></div>`);
        }
        
        if (integral !== null && integral !== undefined) {
            const mode = integral.mode || 'cartesian';
            let title = 'Całka oznaczona';
            let rangeTxt = '';
            if (mode === 'cartesian') {
                title = 'Całka ∫ f(x) dx';
                if (isFinite(integral.a) && isFinite(integral.b)) rangeTxt = `[${integral.a.toFixed(2)}, ${integral.b.toFixed(2)}]`;
            } else if (mode === 'parametric') {
                title = 'Całka parametryczna ∫ y dx';
                if (isFinite(integral.a) && isFinite(integral.b)) rangeTxt = `t∈[${integral.a.toFixed(2)}, ${integral.b.toFixed(2)}]`;
            } else if (mode === 'polar') {
                title = 'Pole w biegunowych ½∫ r(θ)² dθ';
                if (isFinite(integral.a) && isFinite(integral.b)) rangeTxt = `θ∈[${integral.a.toFixed(2)}, ${integral.b.toFixed(2)}]`;
            } else if (mode === '3d') {
                title = 'Podwójna całka ∬ z(x,y) dA';
                if (integral.xRange && integral.yRange) {
                    rangeTxt = `x∈[${integral.xRange.min.toFixed(2)}, ${integral.xRange.max.toFixed(2)}], y∈[${integral.yRange.min.toFixed(2)}, ${integral.yRange.max.toFixed(2)}]`;
                }
            }
            const rangeLabel = rangeTxt ? ` ${rangeTxt}` : '';
            parts.push(`<div style="margin-bottom:10px;line-height:1.6;"><strong style="font-size:14px;color:#2c3e50;">${title}${rangeLabel}:</strong><br><span style="font-size:14px;color:#495057;font-weight:600;">${Number(integral.value).toFixed(6)}</span></div>`);
        }
        
        if (parts.length > 0) {
            analysisResultsContent.innerHTML = parts.join('');
            analysisResults.style.display = 'block';
        } else {
            analysisResults.style.display = 'none';
        }
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
            const samples1 = resultPayload.samples1 || { x: [], y: [] };
            // If the worker returned a polar result, render using scatterpolar
            if (resultPayload.polar) {
                traces.push({
                    r: resultPayload.r || [],
                    theta: resultPayload.theta || [],
                    mode: 'lines',
                    type: 'scatterpolar',
                    name: `r(t) = ${resultPayload.rExpr || ''}`,
                    line: { color: 'rgb(75,192,192)', width: 3 }
                });
            } else {
                traces.push({
                    x: samples1.x,
                    y: samples1.y,
                    mode: 'lines',
                    name: (resultPayload.mode === 'parametric') ? `parametric` : `f₁(x) = ${expression}`,
                    line: { color: 'rgb(75,192,192)', width: 3 },
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
                    line: { color: 'rgb(255,99,132)', width: 3 },
                    connectgaps: false
                });
            }

            if (resultPayload.intersections && resultPayload.intersections.length > 0) {
                traces.push({
                    x: resultPayload.intersections.map(p => p.x),
                    y: resultPayload.intersections.map(p => p.y),
                    mode: 'markers',
                    name: 'Punkty przecięcia',
                    marker: { size: 12, color: 'red', symbol: 'x', line: { width: 2, color: 'darkred' } }
                });
            }

            // Zera funkcji (miejsca zerowe)
            if (resultPayload.zeros && resultPayload.zeros.length > 0) {
                traces.push({
                    x: resultPayload.zeros.map(p => p.x),
                    y: resultPayload.zeros.map(p => p.y),
                    mode: 'markers',
                    name: 'Miejsca zerowe',
                    marker: { size: 10, color: 'blue', symbol: 'circle', line: { width: 2, color: 'darkblue' } }
                });
            }

            // Ekstrema (punkty krytyczne)
            if (resultPayload.extrema && resultPayload.extrema.length > 0) {
                traces.push({
                    x: resultPayload.extrema.map(p => p.x),
                    y: resultPayload.extrema.map(p => p.y),
                    mode: 'markers',
                    name: 'Ekstrema',
                    marker: { size: 11, color: 'orange', symbol: 'diamond', line: { width: 2, color: 'darkorange' } }
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
            
            // Add loaded data points if exist (for curve fitting)
            if (loadedDataTrace) {
                traces.push(loadedDataTrace);
            }
            
            // Update analysis data and display
            currentAnalysisData.zeros = resultPayload.zeros || [];
            currentAnalysisData.extrema = resultPayload.extrema || [];
            currentAnalysisData.intersections = resultPayload.intersections || [];
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

            // Default cartesian layout
            let layout = {
                dragmode: 'pan',
                xaxis: { 
                    title: { text: usePiAxis ? 'x (rad)' : 'x', font: { size: 16, weight: 600 } }, 
                    range: [xMin, xMax], 
                    type: 'linear',
                    gridcolor: '#e0e0e0',
                    gridwidth: 1,
                    tickfont: { size: 13 },
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
                    gridcolor: '#e0e0e0',
                    gridwidth: 1,
                    tickfont: { size: 13 }
                },
                margin: { t: 40, l: 60, r: 30, b: 50 },
                showlegend: true,
                legend: { 
                    x: 0.02, 
                    y: 0.98, 
                    xanchor: 'left', 
                    yanchor: 'top', 
                    bgcolor: 'rgba(255,255,255,0.95)',
                    bordercolor: '#ccc',
                    borderwidth: 1,
                    font: { size: 13 }
                },
                plot_bgcolor: '#fafafa',
                paper_bgcolor: '#fff'
            };

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

            const config = { responsive: true, scrollZoom: true, modeBarButtonsToRemove: ['select2d','lasso2d','zoom2d'] };

            Plotly.newPlot(plotDiv, traces, layout, config).then(gd => {
                myChart = gd;

                // update inputs/localStorage after pan/zoom
                plotDiv.on('plotly_relayout', () => {
                    try {
                        const xRange = gd.layout.xaxis.range || [xMin, xMax];
                        const yRange = gd.layout.yaxis.range || [yMin, yMax];
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
                        localStorage.setItem('chartRanges', JSON.stringify(newRanges));
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
        } catch (err) {
            console.error('Render error:', err);
            errorDisplay.textContent = `Błąd podczas renderowania: ${err.message}`;
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

    // Wire inputs so changing expressions updates detected parameters
    functionInput.addEventListener('input', paramsUpdater);
    if (function2Input) function2Input.addEventListener('input', paramsUpdater);
    if (xParamInput) xParamInput.addEventListener('input', paramsUpdater);
    if (yParamInput) yParamInput.addEventListener('input', paramsUpdater);
    if (rInput) rInput.addEventListener('input', paramsUpdater);
    const surfaceInputEl = document.getElementById('surfaceInput');
    if (surfaceInputEl) surfaceInputEl.addEventListener('input', paramsUpdater);
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
    presetButtons.forEach(button => {
        button.addEventListener('click', () => {
            const range = parseInt(button.dataset.range);
            yMinInput.value = -range;
            yMaxInput.value = range;
            plotButton.click();
        });
    });

    // Obsługa przycisku reset widoku
    resetViewButton.addEventListener('click', () => {
        // Reset both X and Y ranges to defaults and re-plot
        xMinInput.value = -10;
        xMaxInput.value = 10;
        yMinInput.value = -10;
        yMaxInput.value = 10;
        plotButton.click();
    });

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
    // Show integral value label toggle - refresh when changed
    const showIntegralLabel = document.getElementById('showIntegralLabel');
    if (showIntegralLabel) {
        showIntegralLabel.addEventListener('change', () => {
            // Rebuild current visualization if any
            const modeEl = document.getElementById('plotMode');
            const mode = (modeEl && modeEl.value) || 'cartesian';
            if (currentAnalysisData.integral) {
                if (mode === 'cartesian' && currentAnalysisData.integral.a != null && currentAnalysisData.integral.b != null) {
                    // rebuild cartesian shading to include/exclude label (value is added in annotations later)
                    const expression = functionInput.value;
                    createIntegralShading(expression, currentAnalysisData.integral.a, currentAnalysisData.integral.b);
                } else {
                    // For polar/parametric, just trigger a replot so label is applied via traces
                    plotButton.click();
                }
            } else {
                plotButton.click();
            }
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

                    // Visualization per mode
                    if (mode === 'cartesian') {
                        const expression = functionInput.value;
                        createIntegralShading(expression, a, b);
                    } else if (mode === 'polar') {
                        const angleModeEl = document.getElementById('angleMode');
                        const angleModeVal = angleModeEl ? angleModeEl.value : 'radians';
                        const aRad = (angleModeVal === 'degrees') ? a * Math.PI / 180 : a;
                        const bRad = (angleModeVal === 'degrees') ? b * Math.PI / 180 : b;
                        createPolarIntegralShading(payload.rExpr, aRad, bRad);
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

                    displayAnalysisResults();
                    errorDisplay.textContent = '';
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
                const xMin3D = parseNumberInput(document.getElementById('xMin3D').value);
                const xMax3D = parseNumberInput(document.getElementById('xMax3D').value);
                const yMin3D = parseNumberInput(document.getElementById('yMin3D').value);
                const yMax3D = parseNumberInput(document.getElementById('yMax3D').value);
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
                fillcolor: 'rgba(76, 175, 80, 0.28)', // greenish for positive area
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
                fillcolor: 'rgba(244, 67, 54, 0.25)', // reddish for negative area
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
                    fillcolor: 'rgba(100, 150, 255, 0.08)',
                    line: { width: 0 },
                    layer: 'below'
                },
                // left boundary
                {
                    type: 'line',
                    xref: 'x', yref: 'paper',
                    x0: a, x1: a, y0: 0, y1: 1,
                    line: { color: 'rgba(100, 150, 255, 0.9)', width: 2, dash: 'dot' }
                },
                // right boundary
                {
                    type: 'line',
                    xref: 'x', yref: 'paper',
                    x0: b, x1: b, y0: 0, y1: 1,
                    line: { color: 'rgba(100, 150, 255, 0.9)', width: 2, dash: 'dot' }
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
                    font: { size: 12, color: '#2c3e50' }
                },
                {
                    x: b, y: 0,
                    xref: 'x', yref: 'paper',
                    text: 'b',
                    showarrow: false,
                    xanchor: 'center', yanchor: 'top',
                    yshift: 12,
                    font: { size: 12, color: '#2c3e50' }
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
                fillcolor: 'rgba(100,150,255,0.25)',
                line: { width: 0 },
                name: 'Obszar całki (polar)',
                showlegend: false,
                hoverinfo: 'skip'
            };

            // Optional label marker inside wedge if enabled
            const showLabelEl = document.getElementById('showIntegralLabel');
            const showLabel = showLabelEl ? showLabelEl.checked : false;
            const extraTraces = [wedgeTrace];
            if (showLabel && currentAnalysisData.integral && Number.isFinite(currentAnalysisData.integral.value)) {
                const mid = (aRad + bRad) / 2;
                // find a reasonable radius for label (half of max r in the wedge)
                const maxR = r.reduce((m, v) => (isFinite(v) && v > m ? v : m), 0);
                const labelR = maxR * 0.5;
                extraTraces.push({
                    type: 'scatterpolar',
                    theta: [(mid * 180) / Math.PI],
                    r: [labelR],
                    mode: 'text',
                    text: [`∫ = ${Number(currentAnalysisData.integral.value).toFixed(4)}`],
                    textposition: 'middle center',
                    textfont: { size: 12, color: '#2c3e50' },
                    showlegend: false,
                });
            }

            currentPolarIntegralTraces = extraTraces;
            // Redraw plot with wedge shading
            plotButton.click();
        } catch (err) {
            errorDisplay.textContent = `Błąd cieniowania (polar): ${err.message}`;
        }
    }

    // Create parametric segment highlight for t in [a,b]
    function createParametricIntegralHighlight(xExpr, yExpr, aRad, bRad) {
        try {
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
                line: { width: 5, color: 'rgba(100,150,255,0.9)' },
                name: 'Odcinek całki',
                showlegend: false,
                connectgaps: false
            };

            // Optional label at mid-point if enabled
            const showLabelEl = document.getElementById('showIntegralLabel');
            const showLabel = showLabelEl ? showLabelEl.checked : false;
            if (showLabel && currentAnalysisData.integral && Number.isFinite(currentAnalysisData.integral.value)) {
                const tMid = (aRad + bRad) / 2;
                let xm = null, ym = null;
                try { xm = nodeX.compile().evaluate(Object.assign({ t: tMid }, scope)); } catch (e) { }
                try { ym = nodeY.compile().evaluate(Object.assign({ t: tMid }, scope)); } catch (e) { }
                if (isFinite(xm) && isFinite(ym)) {
                    // Add small text marker as a separate trace
                    currentParametricHighlightTrace.text = [`∫ = ${Number(currentAnalysisData.integral.value).toFixed(4)}`];
                    currentParametricHighlightTrace.mode = 'lines+text';
                    currentParametricHighlightTrace.textposition = 'top center';
                    currentParametricHighlightTrace.textfont = { size: 12, color: '#2c3e50' };
                }
            }

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
                    loadedData3DTrace = {
                        x: data.x,
                        y: data.y,
                        z: data.z,
                        mode: 'markers',
                        type: 'scatter3d',
                        name: 'Dane 3D 📊',
                        marker: { 
                            color: 'rgba(230, 50, 50, 0.8)', 
                            size: 5,
                            line: { color: 'rgba(180, 0, 0, 1)', width: 0.5 }
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
                    loadedData3DTrace = {
                        x: data.x,
                        y: data.y,
                        z: data.z,
                        mode: 'markers',
                        type: 'scatter3d',
                        name: 'Dane 3D z API 🌐',
                        marker: { 
                            color: 'rgba(50, 150, 230, 0.8)', 
                            size: 5,
                            line: { color: 'rgba(0, 100, 180, 1)', width: 0.5 }
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

    // Obsługa kliknięcia przycisku "Rysuj"
    plotButton.addEventListener('click', () => {
    const mode = (plotModeSelect && plotModeSelect.value) || 'cartesian';
    errorDisplay.textContent = '';
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
                // Build payload depending on mode
                const basePayload = {
                    xMin, xMax, yMin, yMax,
                    initialPoints: 200,
                    options: buildSamplingOptions(xMin, xMax),
                    calculateZeros: Boolean(zerosChecked),
                    calculateExtrema: Boolean(extremaChecked),
                    calculateIntersections: Boolean(intersectionsChecked),
                    scope: collectScope()
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
                    if (!isFinite(xMin3D) || !isFinite(xMax3D) || xMin3D >= xMax3D) {
                        throw new Error('Niepoprawne wartości X min/max dla wykresu 3D');
                    }
                    if (!isFinite(yMin3D) || !isFinite(yMax3D) || yMin3D >= yMax3D) {
                        throw new Error('Niepoprawne wartości Y min/max dla wykresu 3D');
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
                    }
                };
                
                calcWorker.addEventListener('message', onMessage);
                calcWorker.postMessage({ type: 'compute', payload });
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
                    const tMin = parseFloat((tMinInput && tMinInput.value) || -6.28);
                    const tMax = parseFloat((tMaxInput && tMaxInput.value) || 6.28);
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
                    const tMin = parseFloat((thetaMinInput && thetaMinInput.value) || 0);
                    const tMax = parseFloat((thetaMaxInput && thetaMaxInput.value) || 6.28);
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