/*jslint smarttabs:true laxcomma: true*/

var config = {
	compilerURL: "cmp/cgicomp",
	debug: false,
	newName : "untitled-%d",
	framebufferSize : 512,
	files: {
		defaultFile: "bad/Issue21.fl",
		root: "predefined/",
		fetch: [
			  "tests/sample.fl"
			, "tests/blur.fl"

			, "src/example.fl"
			, "src/gaussian.fl"
			, "src/simple.fl"

			, "bad/Issue4.fl"
			, "bad/Issue6.fl"
			, "bad/Issue17.fl"
			, "bad/Issue21.fl"
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
