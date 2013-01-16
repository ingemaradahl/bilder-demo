/*jslint smarttabs:true laxcomma: true*/

var config = {
	compilerURL: "cmp/cgicomp",
	debug: true,
	newName : "untitled-%d",
	inputDelay: 1000, // μs
	framebufferSize : 512,
	defaultImage: "images/factory.jpg",
	files: {
		defaultFile: "tests/bloom.fl",
		root: "predefined/",
		fetch: [
			  "tests/sample.fl"
			, "tests/bloom.fl"

			, "src/example.fl"
			, "src/simple.fl"
			, "src/emboss.fl"
			, "src/edge.fl"
			, "src/gaussian.fl"
			, "src/bilateral.fl"
			, "src/sepia.fl"
			, "src/retro.fl"

			, "inc/colors.fl"
			, "inc/gaussian.fl"
			, "inc/bloom.fl"
			, "inc/emboss.fl"
			, "inc/edge.fl"
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
