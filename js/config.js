/*jslint smarttabs:true */

var config = {
	compilerURL: "cmp/cgicomp",
	newName : "untitled-%d",
	defaultFile: "src/simple.fl",
	filters: ["src/example.fl", "src/gaussion.fl", "src/simple.fl"],
	glsl: {
		precision: "highp",
		resolutionUniform: "fl_Resolution",
		vertex: "attribute vec2 aVertexPosition;\n\n"+
		        "void main(void) {\n" +
		        "	gl_Position = vec4(aVertexPosition, 0.0, 1.0);\n" +
		        "}"
	}
};
