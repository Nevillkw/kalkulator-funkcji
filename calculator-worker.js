// Worker: calculator-worker.js
// Responsibilities:
// - Import math.js
// - Compile expressions
// - Perform adaptive sampling to produce x/y arrays
// - Find intersections between two functions
// - Post results back to main thread

// Load math.js inside worker
importScripts('https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.4.1/math.js');

// Safe evaluator wrapper
function safeEval(compiled, x, scope = {}) {
	try {
		const ctx = Object.assign({}, scope, { x });
		const y = compiled.evaluate(ctx);
		if (isFinite(y)) return y;
	} catch (e) { }
	return NaN;
}

// Helper: validity of a sampled y-value considering absolute magnitude limit
function isValidValue(y, opts) {
    return isFinite(y) && Math.abs(y) <= (opts.absLimit || 1e6);
}

// Numerical integration using Simpson's rule
function computeDefiniteIntegral(compiled, a, b, scope = {}, steps = 1000) {
    if (!isFinite(a) || !isFinite(b) || a >= b) {
        throw new Error('Nieprawidłowe granice całki');
    }
    
    const n = Math.max(steps, 100);
    const h = (b - a) / n;
    let sum = 0;
    
    try {
        // Simpson's 1/3 rule
        const fa = safeEval(compiled, a, scope);
        const fb = safeEval(compiled, b, scope);
        
        if (!isFinite(fa) || !isFinite(fb)) {
            // Fall back to trapezoidal if endpoints are problematic
            return computeTrapezoidalIntegral(compiled, a, b, scope, steps);
        }
        
        sum = fa + fb;
        
        for (let i = 1; i < n; i++) {
            const x = a + i * h;
            const y = safeEval(compiled, x, scope);
            if (!isFinite(y)) {
                // If we hit a singularity, fall back to trapezoidal
                return computeTrapezoidalIntegral(compiled, a, b, scope, steps);
            }
            sum += (i % 2 === 0 ? 2 : 4) * y;
        }
        
        return (h / 3) * sum;
    } catch (e) {
        throw new Error(`Błąd podczas obliczania całki: ${e.message}`);
    }
}

// Trapezoidal rule fallback
function computeTrapezoidalIntegral(compiled, a, b, scope = {}, steps = 1000) {
    const n = Math.max(steps, 100);
    const h = (b - a) / n;
    let sum = 0;
    
    for (let i = 0; i <= n; i++) {
        const x = a + i * h;
        const y = safeEval(compiled, x, scope);
        if (isFinite(y)) {
            sum += (i === 0 || i === n) ? y : 2 * y;
        }
    }
    
    return (h / 2) * sum;
}// When crossing into a singular/invalid region from the left (finite -> invalid),
// find the last finite point as close as possible to the boundary using bisection.
function findLastFiniteBefore(compiled, xLeft, xRight, yLeft, opts, scope = {}) {
	let left = xLeft;
	let right = xRight;
	let yAtLeft = yLeft;
	const maxIter = opts.maxDepth || 32;
	for (let i = 0; i < maxIter && Math.abs(right - left) > (opts.minStep || 1e-8); i++) {
		const mid = (left + right) / 2;
		const yMid = safeEval(compiled, mid, scope);
		if (isValidValue(yMid, opts)) {
			left = mid;
			yAtLeft = yMid;
		} else {
			right = mid;
		}
	}
	return { x: left, y: yAtLeft };
}

// When exiting a singular/invalid region into finite (invalid -> finite),
// find the first finite point from the left boundary using bisection.
function findFirstFiniteAfter(compiled, xLeftInvalid, xRight, yRight, opts, scope = {}) {
	let left = xLeftInvalid;
	let right = xRight;
	let yAtRight = yRight;
	const maxIter = opts.maxDepth || 32;
	for (let i = 0; i < maxIter && Math.abs(right - left) > (opts.minStep || 1e-8); i++) {
		const mid = (left + right) / 2;
		const yMid = safeEval(compiled, mid, scope);
		if (isValidValue(yMid, opts)) {
			right = mid;
			yAtRight = yMid;
		} else {
			left = mid;
		}
	}
	return { x: right, y: yAtRight };
}

// Adaptive sampling (recursive)
function sampleAdaptively(compiled, x1, x2, y1, y2, opts, scope = {}, depth = 0) {
	const maxDepth = opts.maxDepth || 16;
	const minStep = Math.abs(x2 - x1) <= 0 ? 0 : (opts.minStep || 1e-8);

	const xMid = (x1 + x2) / 2;
	const yMid = safeEval(compiled, xMid, scope);

	// If mid is invalid or too large, it's very likely a vertical asymptote inside (x1,x2).
	if (!isValidValue(yMid, opts)) {
		// If we're already at minimal resolution, return a break between segments.
		if (depth >= maxDepth || Math.abs(x2 - x1) <= minStep) {
			return [[x1, y1], [xMid, null], [x2, y2]];
		}

		// Try to pin the boundaries on both sides of the singularity
		const leftBoundary = findLastFiniteBefore(compiled, x1, xMid, y1, opts, scope);
		const rightBoundary = findFirstFiniteAfter(compiled, xMid, x2, y2, opts, scope);

		// Recursively refine on both sides of the break
		const leftSeg = sampleAdaptively(compiled, x1, leftBoundary.x, y1, leftBoundary.y, opts, scope, depth + 1);
		const rightSeg = sampleAdaptively(compiled, rightBoundary.x, x2, rightBoundary.y, y2, opts, scope, depth + 1);

		const breakX = (leftBoundary.x + rightBoundary.x) / 2;
		return [...leftSeg, [breakX, null], ...rightSeg];
	}

	const yInterpolated = (y1 + y2) / 2;
	const error = Math.abs(yMid - yInterpolated);
	const relativeError = error / (Math.abs(y2 - y1) + 1e-12);

	if (depth >= maxDepth || (Math.abs(x2 - x1) <= minStep) || (error < (opts.absEps || 1e-3) && relativeError < (opts.relEps || 1e-2))) {
		return [[x1, y1], [x2, y2]];
	}

	const left = sampleAdaptively(compiled, x1, xMid, y1, yMid, opts, scope, depth + 1);
	const right = sampleAdaptively(compiled, xMid, x2, yMid, y2, opts, scope, depth + 1);
	return [...left.slice(0, -1), ...right];
}

// Generate sampled arrays for a single compiled function
function generateSamples(compiled, xMin, xMax, initialPoints = 50, opts = {}, scope = {}) {
	const xValues = [];
	const yValues = [];
	const baseStep = (xMax - xMin) / initialPoints;
	let prevX = null;
	let prevY = null;
    let lastInvalidX = null; // track where we entered an invalid region

	for (let i = 0; i <= initialPoints; i++) {
		const x = xMin + i * baseStep;
		const y = safeEval(compiled, x, scope);
		const yValid = isValidValue(y, opts);
		if (yValid) {
			if (prevY !== null) {
				// normal adaptive refinement between two valid points
				const samples = sampleAdaptively(compiled, prevX, x, prevY, y, opts, scope);
				for (const [sx, sy] of samples) {
					xValues.push(sx);
					yValues.push(sy);
				}
			} else if (lastInvalidX !== null) {
				// We were in an invalid region, now re-entering valid domain: pin the boundary
				const boundary = findFirstFiniteAfter(compiled, lastInvalidX, x, y, opts, scope);
				// Add the boundary point very close to the singularity
				xValues.push(boundary.x);
				yValues.push(boundary.y);
				// Connect from boundary to current point adaptively
				const samples = sampleAdaptively(compiled, boundary.x, x, boundary.y, y, opts, scope);
				for (const [sx, sy] of samples) {
					xValues.push(sx);
					yValues.push(sy);
				}
			}
			prevX = x;
			prevY = y;
			lastInvalidX = null;
		} else {
			// Entering or staying in a gap/infinite region
			if (prevY !== null) {
				// We crossed from finite -> invalid; refine towards the asymptote to keep the curve close
				const boundary = findLastFiniteBefore(compiled, prevX, x, prevY, opts, scope);
				xValues.push(boundary.x);
				yValues.push(boundary.y);
			}
			// Mark a break at current x
			xValues.push(x);
			yValues.push(null);
			prevY = null;
			lastInvalidX = x;
		}
	}

	// Ensure last point at xMax
	if (xValues.length === 0 || xValues[xValues.length - 1] < xMax) {
		const x = xMax;
	const y = safeEval(compiled, x, scope);
		const yToPush = (isFinite(y) && Math.abs(y) <= (opts.absLimit || 1e6)) ? y : null;
		if (!isFinite(y) || Math.abs(y) > (opts.absLimit || 1e6)) {
			if (yValues.length > 0) yValues[yValues.length - 1] = null;
		}
		xValues.push(x);
		yValues.push(yToPush);
	}

	return { x: xValues, y: yValues };
}

// Generate data for 3D surface plot
function generate3DSurface(expr, xRange, yRange, resolution, scope = {}) {
    try {
        console.log('Generowanie danych 3D:', { expr, xRange, yRange, resolution });
	const compiledExpr = math.parse(expr).compile();
        
        // Generuj wartości x i y (tablice jednowymiarowe dla osi)
        const x_vals = Array.from({ length: resolution }, (_, i) => 
            xRange.min + (i * (xRange.max - xRange.min) / (resolution - 1))
        );
        const y_vals = Array.from({ length: resolution }, (_, i) => 
            yRange.min + (i * (yRange.max - yRange.min) / (resolution - 1))
        );
        
        // Inicjalizuj macierz z (macierz 2D dla wartości z)
        const z_matrix = Array(resolution).fill().map(() => Array(resolution).fill(null));
        // Oblicz wartości z dla każdego punktu (x,y)
        for (let i = 0; i < resolution; i++) {
            const y = y_vals[i];
            for (let j = 0; j < resolution; j++) {
                const x = x_vals[j];
                try {
					const z = compiledExpr.evaluate(Object.assign({ x, y }, scope));
                    // Sprawdź, czy wartość jest skończona i rozsądna
                    if (isFinite(z) && Math.abs(z) < 1e6) {
                        z_matrix[i][j] = z;
                    } else {
                        z_matrix[i][j] = null;
                    }
                } catch (e) {
                    z_matrix[i][j] = null;
                }
            }
        }
        
        // Sprawdź, czy mamy jakieś poprawne dane
        let hasValidData = false;
        for (let row of z_matrix) {
            if (row.some(z => z !== null)) {
                hasValidData = true;
                break;
            }
        }
        
        if (!hasValidData) {
            throw new Error('Nie udało się obliczyć żadnych poprawnych wartości dla tej funkcji');
        }

		return {
            x: x_vals,
            y: y_vals,
            z: z_matrix
        };
    } catch (error) {
        throw new Error(`Błąd w generowaniu powierzchni 3D: ${error.message}`);
    }
}

// Find intersections between two compiled functions
function findIntersections(compiled1, compiled2, xMin, xMax, yMin, yMax, segments = 400, opts = {}, scope = {}) {
	const results = [];
	const dx = (xMax - xMin) / segments;

	const diff = (x) => {
		const a = safeEval(compiled1, x, scope);
		const b = safeEval(compiled2, x, scope);
		if (isFinite(a) && isFinite(b)) return a - b;
		return NaN;
	};

	const bisect = (a, b, eps = opts.intersectionEps || 1e-8, maxIter = opts.intersectionMaxIter || 60) => {
		let fa = diff(a);
		let fb = diff(b);
		if (!isFinite(fa) || !isFinite(fb) || fa * fb > 0) return null;
		for (let i = 0; i < maxIter; i++) {
			const m = (a + b) / 2;
			const fm = diff(m);
			if (!isFinite(fm)) return null;
			if (Math.abs(fm) < eps) return m;
			if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
		}
		return (a + b) / 2;
	};

	for (let i = 0; i < segments; i++) {
		const a = xMin + i * dx;
		const b = a + dx;
		const fa = diff(a);
		const fb = diff(b);
		if (isFinite(fa) && isFinite(fb) && fa * fb <= 0) {
			const xRoot = bisect(a, b);
			if (xRoot !== null && isFinite(xRoot) && xRoot >= xMin && xRoot <= xMax) {
				const yRoot = safeEval(compiled1, xRoot, scope);
				if (isFinite(yRoot) && yRoot >= yMin && yRoot <= yMax) {
					const isDuplicate = results.some(p => Math.abs(p.x - xRoot) < dx / 2);
					if (!isDuplicate) results.push({ x: xRoot, y: yRoot });
				}
			}
		}
	}
	return results;
}

// Message handler
self.onmessage = function (ev) {
	const msg = ev.data;
	if (!msg) return;
	
	// Handle integral calculation separately
	if (msg.type === 'computeIntegral') {
		try {
			const { mode } = msg.payload;
			const scope = msg.payload.scope || {};
			let resultPayload = { value: NaN };
			if (!mode || mode === 'cartesian') {
				const { expression, a, b } = msg.payload;
				const node = math.parse(expression);
				const compiled = node.compile();
				const integralValue = computeDefiniteIntegral(compiled, a, b, scope || {}, 2000);
				resultPayload = { value: integralValue, a, b, expression, mode: 'cartesian' };
			} else if (mode === 'parametric') {
				const { xExpr, yExpr, a, b } = msg.payload;
				if (!xExpr || !yExpr) throw new Error('Brak wyrażeń parametrycznych x(t), y(t)');
				const compiledY = math.parse(yExpr).compile();
				let compiledDXDT = null;
				try {
					const dxdtNode = math.derivative(xExpr, 't');
					compiledDXDT = dxdtNode.compile();
				} catch (e) {
					compiledDXDT = null;
				}
				// integrand: y(t) * x'(t)
				const integrand = (t) => {
					let yv = NaN;
					let dxdt = NaN;
					try { yv = compiledY.evaluate(Object.assign({ t }, scope)); } catch (e) { yv = NaN; }
					if (compiledDXDT) {
						try { dxdt = compiledDXDT.evaluate(Object.assign({ t }, scope)); } catch (e) { dxdt = NaN; }
					} else {
						// numeric derivative for x'(t)
						try {
							const compiledX = math.parse(xExpr).compile();
							const h = Math.max(1e-5, Math.abs(b - a) / 1e6);
							const xm = compiledX.evaluate(Object.assign({ t: t - h }, scope));
							const xp = compiledX.evaluate(Object.assign({ t: t + h }, scope));
							dxdt = (xp - xm) / (2 * h);
						} catch (e) { dxdt = NaN; }
					}
					const v = yv * dxdt;
					return (isFinite(v) ? v : NaN);
				};
				// integrate integrand over [a,b]
				const steps = 2000;
				const n = Math.max(steps, 200);
				const h = (b - a) / n;
				let sum = 0;
				const f0 = integrand(a);
				const fn = integrand(b);
				if (!isFinite(f0) || !isFinite(fn)) throw new Error('Nieprawidłowe wartości na granicach całki');
				sum = f0 + fn;
				for (let i = 1; i < n; i++) {
					const t = a + i * h;
					const ft = integrand(t);
					if (!isFinite(ft)) throw new Error('Integrand nieokreślony w przedziale parametrycznym');
					sum += (i % 2 === 0 ? 2 : 4) * ft;
				}
				resultPayload = { value: (h / 3) * sum, a, b, mode: 'parametric', xExpr, yExpr };
			} else if (mode === 'polar') {
				const { rExpr, a, b } = msg.payload;
				if (!rExpr) throw new Error('Brak wyrażenia r(t)');
				const compiledR = math.parse(rExpr).compile();
				const integrand = (t) => {
					let r = NaN;
					try { r = compiledR.evaluate(Object.assign({ t }, scope)); } catch (e) { r = NaN; }
					const v = 0.5 * r * r;
					return (isFinite(v) ? v : NaN);
				};
				const steps = 2000;
				const n = Math.max(steps, 200);
				const h = (b - a) / n;
				let sum = 0;
				const f0 = integrand(a);
				const fn = integrand(b);
				if (!isFinite(f0) || !isFinite(fn)) throw new Error('Nieprawidłowe wartości na granicach całki');
				sum = f0 + fn;
				for (let i = 1; i < n; i++) {
					const t = a + i * h;
					const ft = integrand(t);
					if (!isFinite(ft)) throw new Error('Integrand nieokreślony w przedziale biegunowym');
					sum += (i % 2 === 0 ? 2 : 4) * ft;
				}
				resultPayload = { value: (h / 3) * sum, a, b, mode: 'polar', rExpr };
			} else if (mode === '3d') {
				const { expr, xRange, yRange } = msg.payload;
				if (!expr || !xRange || !yRange) throw new Error('Brak danych do całki 3D');
				const compiledZ = math.parse(expr).compile();
				// Iterated trapezoidal rule over rectangle
				const nx = 120; // reasonable resolution in worker
				const ny = 120;
				const hx = (xRange.max - xRange.min) / nx;
				const hy = (yRange.max - yRange.min) / ny;
				function f(x, y) {
					try {
						const v = compiledZ.evaluate(Object.assign({ x, y }, scope));
						return (isFinite(v) ? v : 0);
					} catch (e) { return 0; }
				}
				// Integrate over y for each x
				const Iy = new Array(nx + 1).fill(0);
				for (let i = 0; i <= nx; i++) {
					const x = xRange.min + i * hx;
					let sumY = 0;
					for (let j = 0; j <= ny; j++) {
						const y = yRange.min + j * hy;
						const w = (j === 0 || j === ny) ? 1 : 2; // trapezoid weights
						sumY += w * f(x, y);
					}
					Iy[i] = (hy / 2) * sumY;
				}
				// Integrate Iy over x
				let sumX = 0;
				for (let i = 0; i <= nx; i++) {
					const w = (i === 0 || i === nx) ? 1 : 2;
					sumX += w * Iy[i];
				}
				const volume = (hx / 2) * sumX;
				resultPayload = { value: volume, mode: '3d', xRange, yRange, expr };
			}
			self.postMessage({ 
				type: 'integralResult', 
				payload: resultPayload 
			});
		} catch (err) {
			self.postMessage({ 
				type: 'error', 
				payload: { message: `Błąd obliczania całki: ${err.message}` } 
			});
		}
		return;
	}
	
	if (msg.type !== 'compute') return;
	const { expression, expression2, xMin, xMax, yMin, yMax, initialPoints, options, calculateZeros, calculateExtrema, calculateIntersections, mode } = msg.payload;
	const opts = Object.assign({ absLimit: 1e5, maxDepth: 16, minStep: Math.abs((xMax - xMin) || 1)/500000, absEps: 1e-3, relEps: 1e-2 }, options || {});

	try {
		const scope = msg.payload && msg.payload.scope ? msg.payload.scope : {};

		// Handle different modes: cartesian (default), parametric, polar
		if (!mode || mode === 'cartesian') {
			const node1 = math.parse(expression);
			const compiled1 = node1.compile();
			const samples1 = generateSamples(compiled1, xMin, xMax, initialPoints || 50, opts, scope);

			let samples2 = null;
			let intersections = [];
			if (expression2) {
				const node2 = math.parse(expression2);
				const compiled2 = node2.compile();
				samples2 = generateSamples(compiled2, xMin, xMax, initialPoints || 50, opts, scope);
				// Calculate intersections only if checkbox is checked
				if (calculateIntersections) {
					intersections = findIntersections(compiled1, compiled2, xMin, xMax, yMin, yMax, opts.segments || 400, opts, scope);
				}
			}

			// Compute zeros and extrema for f1 if requested
			let zeros = [];
			let extrema = [];
			if (calculateZeros) {
				const zeroNode = math.parse('0');
				const compiledZero = zeroNode.compile();
				zeros = findIntersections(compiled1, compiledZero, xMin, xMax, yMin, yMax, opts.segments || 400, opts, scope);
			}
			if (calculateExtrema) {
				try {
					const derivNode = math.derivative(expression, 'x');
					const compiledDeriv = derivNode.compile();
					const zeroNode = math.parse('0');
					const compiledZero = zeroNode.compile();
					// Find roots of derivative == 0 (extrema)
					extrema = findIntersections(compiledDeriv, compiledZero, xMin, xMax, yMin, yMax, opts.segments || 400, opts, scope);
					// For extrema we want the y value on the original function
					extrema = extrema.map(p => ({ x: p.x, y: safeEval(compiled1, p.x, scope) }));
				} catch (e) {
					// If derivative parsing failed, leave extrema empty
					extrema = [];
				}
			}

			self.postMessage({ type: 'result', payload: { mode: 'cartesian', samples1, samples2, intersections, zeros, extrema } });
			return;
		}

		if (mode === 'parametric') {
			// Parametric mode: payload.xExpr, payload.yExpr, payload.tMin, payload.tMax
			const xExpr = msg.payload.xExpr || '';
			const yExpr = msg.payload.yExpr || '';
			const tMin = Number.isFinite(msg.payload.tMin) ? msg.payload.tMin : -6.28;
			const tMax = Number.isFinite(msg.payload.tMax) ? msg.payload.tMax : 6.28;
			const points = initialPoints || 800;
			try {
				const nodeX = math.parse(xExpr);
				const nodeY = math.parse(yExpr);
				const compiledX = nodeX.compile();
				const compiledY = nodeY.compile();
				const xs = [];
				const ys = [];
				const dt = (tMax - tMin) / points;
				for (let i = 0; i <= points; i++) {
					const t = tMin + i * dt;
					try {
						const xv = compiledX.evaluate(Object.assign({ t }, scope));
						const yv = compiledY.evaluate(Object.assign({ t }, scope));
						xs.push(isFinite(xv) ? xv : null);
						ys.push(isFinite(yv) ? yv : null);
					} catch (e) {
						xs.push(null);
						ys.push(null);
					}
				}
				self.postMessage({ type: 'result', payload: { mode: 'parametric', samples1: { x: xs, y: ys }, tMin, tMax } });
			} catch (e) {
				self.postMessage({ type: 'error', payload: { message: e.message || String(e) } });
			}
			return;
		}

		if (mode === 'polar') {
			// Polar mode: payload.rExpr, payload.tMin, payload.tMax
			const rExpr = msg.payload.rExpr || '';
			const tMin = Number.isFinite(msg.payload.tMin) ? msg.payload.tMin : 0;
			const tMax = Number.isFinite(msg.payload.tMax) ? msg.payload.tMax : 6.28;
			const points = initialPoints || 800;
			try {
				const nodeR = math.parse(rExpr);
				const compiledR = nodeR.compile();
				const rs = [];
				const thetas = [];
				const dt = (tMax - tMin) / points;
				for (let i = 0; i <= points; i++) {
					const t = tMin + i * dt;
					try {
						const rv = compiledR.evaluate(Object.assign({ t }, scope));
						// Convert theta to degrees for Plotly polar (more human-friendly)
						const thetaDeg = (t * 180) / Math.PI;
						rs.push(isFinite(rv) ? rv : null);
						thetas.push(isFinite(rv) ? thetaDeg : null);
					} catch (e) {
						rs.push(null);
						thetas.push(null);
					}
				}
				self.postMessage({ type: 'result', payload: { mode: 'polar', polar: true, r: rs, theta: thetas, rExpr, tMin, tMax } });
			} catch (e) {
				self.postMessage({ type: 'error', payload: { message: e.message || String(e) } });
			}
			return;
		}

		if (mode === '3d') {
            try {
                const expr = msg.payload.expr || '';
                const xRange = {
                    min: Number.isFinite(msg.payload.xRange.min) ? msg.payload.xRange.min : -5,
                    max: Number.isFinite(msg.payload.xRange.max) ? msg.payload.xRange.max : 5
                };
                const yRange = {
                    min: Number.isFinite(msg.payload.yRange.min) ? msg.payload.yRange.min : -5,
                    max: Number.isFinite(msg.payload.yRange.max) ? msg.payload.yRange.max : 5
                };
                const resolution = msg.payload.resolution || 50;
				const scope = msg.payload.scope || {};
				const data = generate3DSurface(expr, xRange, yRange, resolution, scope);
                self.postMessage({ type: 'result', payload: { mode: '3d', ...data } });
            } catch (e) {
                self.postMessage({ type: 'error', payload: { message: e.message || String(e) } });
            }
            return;
        }
	} catch (err) {
		self.postMessage({ type: 'error', payload: { message: err.message || String(err) } });
	}
};

