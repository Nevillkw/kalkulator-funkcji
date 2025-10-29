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
		self.onmessage = function (ev) {
			const msg = ev.data;
			if (!msg) return;
			const requestId = msg && msg.payload ? msg.payload.requestId : undefined;

			// Integral computations
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
						} catch (e) { compiledDXDT = null; }
						const integrand = (t) => {
							let yv = NaN, dxdt = NaN;
							try { yv = compiledY.evaluate(Object.assign({ t }, scope)); } catch (_) { yv = NaN; }
							if (compiledDXDT) {
								try { dxdt = compiledDXDT.evaluate(Object.assign({ t }, scope)); } catch (_) { dxdt = NaN; }
							} else {
								try {
									const compiledX = math.parse(xExpr).compile();
									const h = Math.max(1e-5, Math.abs(b - a) / 1e6);
									const xm = compiledX.evaluate(Object.assign({ t: t - h }, scope));
									const xp = compiledX.evaluate(Object.assign({ t: t + h }, scope));
									dxdt = (xp - xm) / (2 * h);
								} catch (_) { dxdt = NaN; }
							}
							const v = yv * dxdt;
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
							try { r = compiledR.evaluate(Object.assign({ t }, scope)); } catch (_) { r = NaN; }
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
						const nx = 120, ny = 120;
						const hx = (xRange.max - xRange.min) / nx;
						const hy = (yRange.max - yRange.min) / ny;
						function f(x, y) {
							try {
								const v = compiledZ.evaluate(Object.assign({ x, y }, scope));
								return (isFinite(v) ? v : 0);
							} catch (_) { return 0; }
						}
						const Iy = new Array(nx + 1).fill(0);
						for (let i = 0; i <= nx; i++) {
							const x = xRange.min + i * hx;
							let sumY = 0;
							for (let j = 0; j <= ny; j++) {
								const y = yRange.min + j * hy;
								const w = (j === 0 || j === ny) ? 1 : 2;
								sumY += w * f(x, y);
							}
							Iy[i] = (hy / 2) * sumY;
						}
						let sumX = 0;
						for (let i = 0; i <= nx; i++) {
							const w = (i === 0 || i === nx) ? 1 : 2;
							sumX += w * Iy[i];
						}
						const volume = (hx / 2) * sumX;
						resultPayload = { value: volume, mode: '3d', xRange, yRange, expr };
					}
					self.postMessage({ type: 'integralResult', requestId, payload: resultPayload });
				} catch (err) {
					self.postMessage({ type: 'error', requestId, payload: { message: `Błąd obliczania całki: ${err.message}` } });
				}
				return;
			}

			if (msg.type !== 'compute') return;
			const { expression, expression2, xMin, xMax, yMin, yMax, initialPoints, options, calculateZeros, calculateExtrema, calculateIntersections, mode } = msg.payload;
			const opts = Object.assign({ absLimit: 1e5, maxDepth: 16, minStep: Math.abs((xMax - xMin) || 1) / 500000, absEps: 1e-3, relEps: 1e-2 }, options || {});

			try {
				const scope = msg.payload && msg.payload.scope ? msg.payload.scope : {};

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
						if (calculateIntersections) {
							intersections = findIntersections(compiled1, compiled2, xMin, xMax, yMin, yMax, opts.segments || 400, opts, scope);
						}
					}

					let zeros = [];
					let extrema = [];
					let derivString = '';
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
							extrema = findIntersections(compiledDeriv, compiledZero, xMin, xMax, yMin, yMax, opts.segments || 400, opts, scope);
							let compiledSecond = null;
							try {
								const secondNode = math.derivative(derivNode, 'x');
								compiledSecond = secondNode.compile();
							} catch (_) { compiledSecond = null; }
							const EPS = 1e-6;
							extrema = extrema.map(p => {
								const yVal = safeEval(compiled1, p.x, scope);
								let type = 'unknown';
								let f2 = NaN;
								if (compiledSecond) {
									try { f2 = compiledSecond.evaluate(Object.assign({ x: p.x }, scope)); } catch (_) { f2 = NaN; }
									if (isFinite(f2)) {
										if (f2 > EPS) type = 'min'; else if (f2 < -EPS) type = 'max'; else type = 'flat';
									}
								}
								return { x: p.x, y: yVal, type, f2 };
							});
						} catch (_) { extrema = []; }
					}

					let derivativeSamples = null;
					if (msg.payload && msg.payload.calculateDerivativePlot) {
						try {
							const derivNode = math.derivative(expression, 'x');
							try { derivString = derivNode.toString(); } catch (_) { derivString = ''; }
							const compiledDeriv = derivNode.compile();
							derivativeSamples = generateSamples(compiledDeriv, xMin, xMax, initialPoints || 50, opts, scope);
						} catch (_) { derivString = ''; derivativeSamples = null; }
					}

					self.postMessage({ type: 'result', requestId, payload: { mode: 'cartesian', samples1, samples2, intersections, zeros, extrema, derivative: derivString, derivativeSamples } });
					return;
				}

				if (mode === 'parametric') {
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
							} catch (_) { xs.push(null); ys.push(null); }
						}

						let dxString = '';
						let dyString = '';
						let derivativeSamplesX = null;
						let derivativeSamplesY = null;
						if (msg.payload && msg.payload.calculateDerivativePlot && xExpr && yExpr) {
							try {
								const dxNode = math.derivative(xExpr, 't');
								dxString = dxNode.toString();
								const dyNode = math.derivative(yExpr, 't');
								dyString = dyNode.toString();
								try {
									const compiledDX = dxNode.compile();
									const compiledDY = dyNode.compile();
									const dxVals = [];
									const dyVals = [];
									const tVals = [];
									for (let i = 0; i <= points; i++) {
										const t = tMin + i * dt;
										tVals.push(t);
										try {
											const dxv = compiledDX.evaluate(Object.assign({ t }, scope));
											const dyv = compiledDY.evaluate(Object.assign({ t }, scope));
											dxVals.push(isFinite(dxv) ? dxv : null);
											dyVals.push(isFinite(dyv) ? dyv : null);
										} catch (_) { dxVals.push(null); dyVals.push(null); }
									}
									derivativeSamplesX = { t: tVals, value: dxVals };
									derivativeSamplesY = { t: tVals, value: dyVals };
								} catch (_) { }
							} catch (_) { }
						}

						self.postMessage({ type: 'result', requestId, payload: { mode: 'parametric', samples1: { x: xs, y: ys }, tMin, tMax, derivative: { dx: dxString, dy: dyString }, derivativeSamplesX, derivativeSamplesY } });
					} catch (e) {
						self.postMessage({ type: 'error', requestId, payload: { message: e.message || String(e) } });
					}
					return;
				}

				if (mode === 'polar') {
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
								const thetaDeg = (t * 180) / Math.PI;
								rs.push(isFinite(rv) ? rv : null);
								thetas.push(isFinite(rv) ? thetaDeg : null);
							} catch (_) { rs.push(null); thetas.push(null); }
						}

						let drString = '';
						let derivativeSamplesR = null;
						if (msg.payload && msg.payload.calculateDerivativePlot && rExpr) {
							try {
								const drNode = math.derivative(rExpr, 't');
								drString = drNode.toString();
								try {
									const compiledDR = drNode.compile();
									const drVals = [];
									const thetaVals = [];
									for (let i = 0; i <= points; i++) {
										const t = tMin + i * dt;
										const thetaDeg = (t * 180) / Math.PI;
										thetaVals.push(thetaDeg);
										try {
											const drv = compiledDR.evaluate(Object.assign({ t }, scope));
											drVals.push(isFinite(drv) ? drv : null);
										} catch (_) { drVals.push(null); }
									}
									derivativeSamplesR = { theta: thetaVals, value: drVals };
								} catch (_) { }
							} catch (_) { }
						}

						self.postMessage({ type: 'result', requestId, payload: { mode: 'polar', polar: true, r: rs, theta: thetas, rExpr, tMin, tMax, derivative: drString, derivativeSamplesR } });
					} catch (e) {
						self.postMessage({ type: 'error', requestId, payload: { message: e.message || String(e) } });
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
						self.postMessage({ type: 'result', requestId, payload: { mode: '3d', ...data } });
					} catch (e) {
						self.postMessage({ type: 'error', requestId, payload: { message: e.message || String(e) } });
					}
					return;
				}
			} catch (err) {
				self.postMessage({ type: 'error', requestId, payload: { message: err.message || String(err) } });
			}
		};
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
		let derivString = '';
		if (calculateZeros) {
			const zeroNode = math.parse('0');
			const compiledZero = zeroNode.compile();
			zeros = findIntersections(compiled1, compiledZero, xMin, xMax, yMin, yMax, opts.segments || 400, opts, scope);
		}
		
		// Compute extrema independently if requested
		if (calculateExtrema) {
			try {
				const derivNode = math.derivative(expression, 'x');
				const compiledDeriv = derivNode.compile();
				const zeroNode = math.parse('0');
				const compiledZero = zeroNode.compile();
				// Find roots of derivative == 0 (extrema)
				extrema = findIntersections(compiledDeriv, compiledZero, xMin, xMax, yMin, yMax, opts.segments || 400, opts, scope);
				// Second derivative for classification
				let compiledSecond = null;
				try {
					const secondNode = math.derivative(derivNode, 'x');
					compiledSecond = secondNode.compile();
				} catch (_) { compiledSecond = null; }
				const EPS = 1e-6;
				// For extrema we want the y value on the original function and a type based on f''(x)
				extrema = extrema.map(p => {
					const yVal = safeEval(compiled1, p.x, scope);
					let type = 'unknown';
					let f2 = NaN;
					if (compiledSecond) {
						try { f2 = compiledSecond.evaluate(Object.assign({ x: p.x }, scope)); } catch (_) { f2 = NaN; }
						if (isFinite(f2)) {
							if (f2 > EPS) type = 'min';
							else if (f2 < -EPS) type = 'max';
							else type = 'flat';
						}
					}
					return { x: p.x, y: yVal, type, f2 };
				});
			} catch (e) {
				// If extrema computation failed, leave extrema empty
				extrema = [];
			}
		}
		
		// Compute derivative only if checkbox is checked
		let derivativeSamples = null;
		if (msg.payload && msg.payload.calculateDerivativePlot) {
			try {
				const derivNode = math.derivative(expression, 'x');
				try { derivString = derivNode.toString(); } catch (e) { derivString = ''; }
				const compiledDeriv = derivNode.compile();
				
				// Compute derivative samples for plotting
				derivativeSamples = generateSamples(compiledDeriv, xMin, xMax, initialPoints || 50, opts, scope);
			} catch (e) {
				// If derivative parsing failed, leave derivative empty
				derivString = '';
				derivativeSamples = null;
			}
		}			self.postMessage({ type: 'result', payload: { mode: 'cartesian', samples1, samples2, intersections, zeros, extrema, derivative: derivString, derivativeSamples } });
		}            self.postMessage({ type: 'result', requestId, payload: { mode: 'cartesian', samples1, samples2, intersections, zeros, extrema, derivative: derivString, derivativeSamples } });
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
				
				// Compute derivatives dx/dt, dy/dt only if checkbox is checked
				let dxString = '';
				let dyString = '';
				let derivativeSamplesX = null;
				let derivativeSamplesY = null;
				
				if (msg.payload && msg.payload.calculateDerivativePlot && xExpr && yExpr) {
					try {
						const dxNode = math.derivative(xExpr, 't');
						dxString = dxNode.toString();
						const dyNode = math.derivative(yExpr, 't');
						dyString = dyNode.toString();
						
						// Sample dx/dt and dy/dt for plotting
						try {
							const compiledDX = dxNode.compile();
							const compiledDY = dyNode.compile();
							const dxVals = [];
							const dyVals = [];
							const tVals = [];
							for (let i = 0; i <= points; i++) {
								const t = tMin + i * dt;
								tVals.push(t);
								try {
									const dxv = compiledDX.evaluate(Object.assign({ t }, scope));
									const dyv = compiledDY.evaluate(Object.assign({ t }, scope));
									dxVals.push(isFinite(dxv) ? dxv : null);
									dyVals.push(isFinite(dyv) ? dyv : null);
								} catch (_) {
									dxVals.push(null);
									dyVals.push(null);
								}
							}
							derivativeSamplesX = { t: tVals, value: dxVals };
							derivativeSamplesY = { t: tVals, value: dyVals };
						} catch (_) { /* ignore sampling errors */ }
					} catch (_) { /* derivative computation failed */ }
				}
				
				self.postMessage({ 
				self.postMessage({ 
					type: 'result', 
					requestId,
					payload: { 
						mode: 'parametric', 
						samples1: { x: xs, y: ys }, 
						tMin, 
						tMax,
						derivative: { dx: dxString, dy: dyString },
						derivativeSamplesX,
						derivativeSamplesY
					} 
				});
			} catch (e) {
				self.postMessage({ type: 'error', requestId, payload: { message: e.message || String(e) } });
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
				
				// Compute derivative dr/dt only if checkbox is checked
				let drString = '';
				let derivativeSamplesR = null;
				
				if (msg.payload && msg.payload.calculateDerivativePlot && rExpr) {
					try {
						const drNode = math.derivative(rExpr, 't');
						drString = drNode.toString();
						
						// Sample dr/dt for plotting
						try {
							const compiledDR = drNode.compile();
							const drVals = [];
							const thetaVals = [];
							for (let i = 0; i <= points; i++) {
								const t = tMin + i * dt;
								const thetaDeg = (t * 180) / Math.PI;
								thetaVals.push(thetaDeg);
								try {
									const drv = compiledDR.evaluate(Object.assign({ t }, scope));
									drVals.push(isFinite(drv) ? drv : null);
								} catch (_) {
									drVals.push(null);
								}
							}
							derivativeSamplesR = { theta: thetaVals, value: drVals };
						} catch (_) { /* ignore sampling errors */ }
					} catch (_) { /* derivative computation failed */ }
				}
				
				self.postMessage({ 
				self.postMessage({ 
					type: 'result', 
					requestId,
					payload: { 
						mode: 'polar', 
						polar: true, 
						r: rs, 
						theta: thetas, 
						rExpr, 
						tMin, 
						tMax,
						derivative: drString,
						derivativeSamplesR
					} 
				});
			} catch (e) {
				self.postMessage({ type: 'error', requestId, payload: { message: e.message || String(e) } });
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
				// Do not compute or return gradient for 3D mode (disabled by request)
                self.postMessage({ 
				self.postMessage({ 
					type: 'result', 
					requestId,
					payload: { 
						mode: '3d', 
						...data,
						// derivative removed
					} 
				});
            } catch (e) {
				self.postMessage({ type: 'error', requestId, payload: { message: e.message || String(e) } });
            }
            return;
        }
	} catch (err) {
		self.postMessage({ type: 'error', requestId, payload: { message: err.message || String(err) } });
	}
};

