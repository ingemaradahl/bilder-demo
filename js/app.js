/*jslint browser: true smarttabs: true */ /*global config $ jQuery sprintf templates Editor vec2 */

function App() {
	"use strict";

	if (App.prototype.__instance)
		return App.prototype.__instance;
	App.prototype.__instance = this;

	this.error = new ErrorDisplay();
	this.program = null;

	var canvas = $("canvas");
	var controls = $("#app-inputs");
	this.gl = null; // DEBUGGING

	var gl = null;

	var buildInputGUI = function() {

	}.bind(this);


	this.initGL = function () {
		this.gl = canvas[0].getContext("experimental-webgl") ||
					canvas[0].getContext("webgl");

		if (!this.gl) {
			this.error.post("Unable to initialize WebGL");
			Editor().disableCompile();
			return;
		}

		gl = this.gl;
		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		//gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	};

	this.refresh = function () {
		$(".app-inputs").position({my: "left top", at: "right top", of: "canvas"});
	};

	this.resolution = function() {
		return vec2.createFrom(canvas.width(), canvas.height());
	};

	this.buildProgram = function(p) {
		this.program = new Program(gl, p);
		buildInputGUI();
	};

	this.loadImage = (function() {
		var imgCache = {};
		return function(url) {
			// return gl-texture
		};
	})();

	canvas.resizable({resize: this.refresh});
	this.refresh();
}

var Program = (function() {
	var compileVertex = function(gl) {
		var shader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(shader, config.glsl.vertex);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			var errmsg = sprintf(
				"While compiling built in vertex shader:\n%s",
				gl.getShaderInfoLog(shader)
			);
			App().error.post(errmsg, "Shader Error");
			return null;
		}

		return shader;
	};

	var vertexShader = null;
	var vertices = [ -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0 ];
	var quad = null;

	return function(gl, program) {
		if (!vertexShader) {
			vertexShader = compileVertex(gl);
			if (!vertexShader) {
				Editor().disableCompile();
				return;
			}
		}

		if (!quad) {
			quad = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, quad);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
		}

		this.inputs = {}; // { name: type }
		var inputValues = {}; // { name: value }
		var outputs = {}; // { name: gl.texture }

		var glPrograms = {};
		var graph = program.graph;

		var prependGLSLHeader = function (src) {
			var precision = config.glsl.precision;
			for (var type in {float: null}) {
				src = templates.glsl.precision(precision, type) + src;
			}

			return src;
		};

		var compileShader = function(shaderObj) {
			var src = shaderObj.shader;
			src = prependGLSLHeader(src);

			var shader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(shader, src);
			gl.compileShader(shader);

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				var errmsg = sprintf(
					"While compiling %s:\n%s",
					shaderObj.name,
					gl.getShaderInfoLog(shader)
				);
				App().error.post(errmsg, "Shader Error");
				console.log(src);
				return null;
			}

			var program = gl.createProgram();
			gl.attachShader(program, vertexShader);
			gl.attachShader(program, shader);
			gl.linkProgram(program);

			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				var linkerr = sprintf(
					"While linking program %s:\n%s",
					shaderObj.name,
					"LINK ERROR"
				);
				App().error.post(linkerr, "Shader Error");
				return null;
			}

			program.positionAttrib = gl.getAttribLocation(program, "aVertexPosition");
			gl.enableVertexAttribArray(program.position0Attrib);

			program.uniforms = {};
			var uniforms = findUniforms(shaderObj.name, graph);
			for (var name in uniforms) {
				program.uniforms[name] = gl.getUniformLocation(program, name);

				// Some programs may have their uniforms unreferenced, which
				// means that the GLSL compiler will optimize them away..
				if (program.uniforms[name])
					program.uniforms[name].type = uniforms[name];
				else
					delete program.uniforms[name];
			}

			Editor().stopLoadAnim();
			return program;
		};

		/*
		 * Finds all uniforms used by the given GLSL shader.
		 *
		 * returns { name : type}
		 */
		var findUniforms = function(shader, graph) {
			var inputs = {};

			var find = function(g) {
				if (graph.filename === shader) {
					for (var i=0; i<g.inputs.length; i++) {
						var input = g.inputs[i];

						if (input.name in inputs)
							continue;

						if (input.type === "node") {
							inputs[input.name] = "texture";
							find(input.node);
						}
						else
							inputs[input.name] = input.type;
					}
				}
				else {
					for (var j=0; j<g.inputs.length; j++) {
						var input_ = g.inputs[j];
						if (input_.type === "node")
							find(input_.node);
					}
				}
			};

			find(graph);
			return inputs;
		};


		/*
		 * Collects all possible uniforms for the entire filter program, and
		 * stores the result in this.inputs as a dict of { name: type }
		 */
		var collectInputs = function (graph) {
			for (var i=0; i<graph.inputs.length; i++) {
				var input = graph.inputs[i];

				if (input.name in this.inputs)
					continue;

				if (input.type === "node")
					collectInputs(input.node);
				else if (input.name !== config.glsl.resolutionUniform)
					this.inputs[input.name] = input.type;
			}
		}.bind(this);

		var runShader = function (shader, inputs) {
			var program;

			if (typeof(shader) === "string")
				program = glPrograms[shader];
			else
				program = shader;

			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			gl.useProgram(program);

			gl.bindBuffer(gl.ARRAY_BUFFER, quad);
			gl.vertexAttribPointer(program, 2, gl.FLOAT, false, 0, 0);

			for (var name in program.uniforms) {
				if (!(name in inputValues)) {
					App().error.post(sprintf("Input value '%s' not set", name));
					return;
				}

				var uniform = program.uniforms[name];
				var binder = null;
				switch(uniform.type) {
				case "vec2":
					binder = gl.uniform2fv.bind(gl);
					break;
				case "vec3":
					binder = gl.uniform3fv.bind(gl);
					break;
				case "vec4":
					binder = gl.uniform4fv.bind(gl);
					break;
				case "float":
					binder = gl.uniform1f.bind(gl);
					break;
				case "texture":
				case "int":
					binder = gl.uniform1i.bind(gl);
					break;
				}

				binder(uniform, inputValues[name]);
			}

			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}.bind(this);

		this.run = function(shader) {
			// TEMP
			runShader(shader);
		};

		this.setInputs = function(inputs) {
			// TODO: Check inputs
			inputValues = inputs;

			// Add fl_Resolution input
			inputValues[config.glsl.resolutionUniform] = App().resolution();
		};

		// Compile shaders
		for (var i=0; i<program.shaders.length; i++) {
			var name = program.shaders[i].name;
			glPrograms[name] = compileShader(program.shaders[i]);
		}

		collectInputs(graph);

		// Temp
		this.setInputs({});
		this.run(graph.filename);
	};
})();


function ErrorDisplay() {
	"use strict";

	var errorBox = $("#error-box");
	var errors = [];

	var nl2br = function(str) {
		return str.replace(/\n/, "</br>");
	};

	var ErrorMessage = function(str, type) {
		type = type || "Error";
		var box = $(templates.error(type, nl2br(str))).appendTo(errorBox).fadeIn();

		this.destroy = function() {
			box.fadeOut(function() { box.remove(); });

			for (var i=0; i<errors.length; i++) {
				if (errors[i] === this)
					delete errors[i];
			}
		};

		box.find(".ui-icon-close").click(this.destroy.bind(this));
	};

	this.post = function(str, type) {
		Editor().stopLoadAnim();
		errors.push(new ErrorMessage(str, type));
	};

	this.clear = function() {
		for (var i=0; i<errors.length; i++) {
			if(errors[i])
				errors[i].destroy();
		}

		errors = [];
	};
}

function MessageBus() {
	"use strict";

	var routing = {};

	this.subscribe = function(title, fn) {
		if (!(title in routing))
			routing[title] = [];

		routing[title].push(fn);
	};

	this.unsubscribe = function(title, fn) {
		if (!(title in routing))
			return;

		for (var i=0; i<routing[title].length; i++) {
			if (routing[title][i] === fn)
				delete routing[title][i];
		}
	};

	this.post = function(title, message) {
		if (!(title in routing))
			return;

		for (var i=0; i<routing[title].length; i++) {
			if (routing[title][i])
				routing[title][i](message);
		}
	};
}
