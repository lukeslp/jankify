function drawField(field, particles, steps, col = null) {
	for (p of particles) {
		if (col) {
			p.targetColor = col;
		}
		p.maxSteps = steps;
	}

	// loadPixels is expensive; refresh every few substeps instead of every frame.
	// Canvas was created with willReadFrequently (see willReadFrequently.js).
	for (let i = 0; i < steps; i++) {
		if (i % 3 === 0) loadPixels();
		for (var j = 0; j < particles.length; j++) {
			particles[j].applyField(field);
			particles[j].update();
			particles[j].draw();

			if (particles[j].steps > particles[j].maxSteps) {
				particles.splice(j, 1);
			}
		}
	}
}

function getPixel(x, y) {
	if (x < 0 || y < 0 || x > width || y > height) {
		return null;
	}

	let d = pixelDensity();
	let p = pixels;
	let xx = floor(x)
	let yy = floor(y)
	const i = 4 * d * (yy * d * width + xx);
	const [r, g, b] = [p[i], p[i + 1], p[i + 2]];

	if (!r || !g || !b) {
		return null;
	}

	return color(r, g, b)
}