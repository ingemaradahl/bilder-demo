/*jslint smarttabs:true laxcomma: true*/

var config = {
	compilerURL: "cmp/cgibildc",
	debug: false,
	newName : "untitled-%d",
	inputDelay: 1000, // μs
	autosaveDelay: 1000,
	framebufferSize : 512,
	defaultImage: "images/lena.png",
	files: {
		defaultFile: "src/edge.bild",
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
	},
	images: {
		//'images/lena.png': { author: "Playboy", attribution: "http://www.playboy.com", description: "Lena"}
		  'images/oslo.jpg': { author: "HaraldMM", attribution: "http://www.flickr.com/photos/haraldmm/4754512932/sizes/l/in/photostream/", description: "Oslo"}
		, 'images/desert.jpg': { author: "Monica Guy", attribution: "http://www.flickr.com/photos/53881187@N02/4983982785/sizes/l/in/photostream/", description: "Desert"}
	}
};
