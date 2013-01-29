/*jslint smarttabs:true laxcomma: true*/

var config = {
	compilerURL: "cmp/cgibildc",
	debug: false,
	newName : "untitled-%d",
	inputDelay: 1400, // μs
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
		  'images/oslo.jpg': { author: "HaraldMM", attribution: "http://www.flickr.com/photos/haraldmm/4754512932/sizes/l/in/photostream/", description: "Oslo"}
		, 'images/desert.jpg': { author: "Monica Guy", attribution: "http://www.flickr.com/photos/53881187@N02/4983982785/sizes/l/in/photostream/", description: "Desert" }
		, 'images/train.jpg': { author: "Arthur Araújo", attribution: "http://www.flickr.com/photos/tutzstyle/8426670212/", description: "Old train" }
		, 'images/yellow_train.jpg': { author: "Bart", attribution: "http://www.flickr.com/photos/89246112@N00/8352439289/in/photostream/", description: "Yellow train" }
		, 'images/bridge.jpg': { author: "Railways of Australia", attribution: "http://www.flickr.com/photos/railwayofaustralia/8425520163/in/photostream/", description: "Asplin Bridge" }
		, 'images/waterfall.jpg': { author: "aksynth", attribution: "http://www.flickr.com/photos/23313207@N00/8426609538/sizes/l/in/photostream/", description: "Waterfall" }
	}
};
