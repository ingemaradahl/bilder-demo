/*jslint smarttabs:true */

var config = {
	compilerURL: "cmp/cgicomp",
	newName : "untitled-%d",
	files: {
		defaultFile: "tests/sample.fl",
		root: "predefined/",
		fetch: ["tests/sample.fl", "src/example.fl", "src/gaussion.fl", "src/simple.fl", "bad/Issue4.fl", "bad/Issue6.fl"]
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
