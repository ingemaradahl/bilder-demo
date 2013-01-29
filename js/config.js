/*jslint smarttabs:true laxcomma: true*/

var config = {
	compilerURL: "cmp/cgibildc",
	debug: false,
	newName : "untitled-%d",
	inputDelay: 1000, // μs
	autosaveDelay: 1000,
	framebufferSize : 512,
	defaultImage: "images/factory.jpg",
	files: {
		defaultFile: "tests/bloom.bild",
		root: "predefined/",
		fetch: [
			  "tests/sample.bild"
			, "tests/bloom.bild"

			, "src/example.bild"
			, "src/simple.bild"
			, "src/emboss.bild"
			, "src/edge.bild"
			, "src/gaussian.bild"
			, "src/bilateral.bild"
			, "src/sepia.bild"
			, "src/retro.bild"

			, "inc/colors.bild"
			, "inc/gaussian.bild"
			, "inc/bloom.bild"
			, "inc/emboss.bild"
			, "inc/edge.bild"
			, "inc/localCorrection.bild"
		]
	},
	glsl: {
		precision: "highp",
		resolutionUniform: "fl_Resolution",
		vertex: "attribute vec2 aVertexPosition;\n\n"+
		        "void main(void) {\n" +
		        "	gl_Position = vec4(aVertexPosition, 0.0, 1.0);\n" +
		        "}"
	}
};
