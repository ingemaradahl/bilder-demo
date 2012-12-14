/*jslint browser: true smarttabs: true */ /*global config $ jQuery sprintf templates Editor vec2 */

function App() {
	"use strict";

	if (App.prototype.__instance)
		return App.prototype.__instance;
	App.prototype.__instance = this;

	this.error = new ErrorDisplay();
	this.messages = new MessageBus();
	this.imgCache = {};
	this.inputs = new Inputs();
	this.program = null;

	this.messages.subscribe("new-input-controls", this.inputs.addInputs);

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
	};

	/*
	 * Returns WebGL texture
	 */
	this.getGLImage = function(url) {
		if (!(url in this.imgCache))
			return null;

		return this.imgCache[url];
	};

	/*
	 * Loads an image url into a WebGL texture and emits the "new-gl-image"
	 * message. If a callback is given, it will be called as well.
	 *
	 * The message body/callback argument is { url: string, texture: gl-texture}
	 */
	this.loadImage = function(url, callback) {
		var image = new Image();

		function isPowerOfTwo(x) {
			return (x & (x - 1)) === 0;
		}

		function nextHighestPowerOfTwo(x) {
			--x;
			for (var i = 1; i < 32; i <<= 1) {
				x = x | x >> i;
			}
			return x + 1;
		}

		var finalize = function() {
			//Images might have to be resized, see
			//http://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences#Non-Power_of_Two_Texture_Support
			if (!isPowerOfTwo(image.width) || !isPowerOfTwo(image.height)) {
				// Scale up the texture to the next highest power of two dimensions.
				var canvas = document.createElement("canvas");
				canvas.width = nextHighestPowerOfTwo(image.width);
				canvas.height = nextHighestPowerOfTwo(image.height);
				var ctx = canvas.getContext("2d");
				ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
				image = canvas;
			}

			var texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

			this.messages.post("new-gl-image", {url: url, texture: texture});

			this.imgCache[url] = texture;

			if (callback)
				callback({url: url, texture: texture});
		}.bind(this);

		image.onload = finalize;
		image.src = url;
	};

	this.refresh = function () {
		canvas[0].width = canvas.width();
		canvas[0].height = canvas.height();

		// TODO: Improve this, and maybe even remove when programs are run in
		// real time. Also set new viewport dimension and resolution uniform
		// values
		if (App().program) {
			App().program.run();
		}

		controls.height($("canvas").innerHeight() - $(0.8).toPx());
		$("#editor").position({my: "left top", at: "left bottom", of: "canvas", offset: "0em 6em"});

		controls.position({my: "left top", at: "right top", of: "canvas", offset: "6em 0em"});
		controls.width($(window).width() - controls.position().left - $(1.8).toPx());
	};

	this.resolution = function() {
		return vec2.createFrom(canvas.width(), canvas.height());
	};

	this.buildProgram = function(p) {
		buildInputGUI();
		this.program = new Program(gl, p);
		this.messages.post("new-input-controls", this.program.inputs);
	};

	var setInput = function(inputs) {
		if (this.program)
			this.program.setInputs(inputs);
	}.bind(this);

	canvas.resizable({resize: this.refresh});
	this.messages.subscribe("new-inputs", setInput);
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

		var newImage = function (img) {
			if (!img || !img.url || !img.texture)
				return;

			// Find missing textures
			var missing = 0;
			for (var name in inputValues) {
				if (inputValues[name] === img.url) {
					inputValues[name] = img.texture;
				}
				else if (typeof(inputValues[name]) === "string") {
					missing++;
				}
			}

			// A bit tacky to do this here, but whatever :P
			if (missing === 0)
				this.run();
		}.bind(this);

		var runShader = function (shader, inputs) {
			var program;
			var textureUnit = 0;
			var value;

			if (typeof(shader) === "string")
				program = glPrograms[shader];
			else
				program = shader;

			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			gl.useProgram(program);

			gl.bindBuffer(gl.ARRAY_BUFFER, quad);
			gl.vertexAttribPointer(program.positionAttrib, 2, gl.FLOAT, false, 0, 0);

			//TEMP
			var res = App().resolution();
			gl.viewport(0, 0, res[0], res[1]);


			for (var name in program.uniforms) {
				if (!(name in inputValues)) {
					App().error.post(sprintf("Input value '%s' not set", name));
					return;
				}

				var uniform = program.uniforms[name];
				var binder = null;
				value = inputValues[name];
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
					value = textureUnit++;
					gl.activeTexture(gl.TEXTURE0 + value);
					gl.bindTexture(gl.TEXTURE_2D, inputValues[name]);
				case "int":
					binder = gl.uniform1i.bind(gl);
					break;
				default:
					console.log("Bad uniform type: '%s' for '%s'", typeof(uniform.type), name);
					return;
				}

				binder(uniform, value);
			}



			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}.bind(this);

		this.run = function() {
			// TEMP
			runShader(graph.filename);
		};

		this.setInputs = function(inputs) {
			inputs = inputs || {};

			var mustWait = false;
			for (var name in this.inputs) {
				var type = this.inputs[name];
				var value = inputs[name];

				switch (type) {
				case "float":
				case "int":
					if (typeof(value) !== "number") {
						console.log(sprintf("Bad value for input %s: %s", name, value));
						return;
					}
					inputValues[name] = value;
					break;
				case "vec2":
				case "vec3":
				case "vec4":
					if (!value || value.constructor !== Float32Array) {
						console.log(sprintf("Bad value for input %s: %s", name, value));
						return;
					}
					inputValues[name] = value;
					break;
				case "texture":
					var url = value;
					if (url in App().imgCache) {
						inputValues[name] = App().getGLImage(url);
					}
					else {
						App().loadImage(url);
						inputValues[name] = url;
						mustWait = true;
					}
					break;
				}
			}

			// Add fl_Resolution input
			inputValues[config.glsl.resolutionUniform] = App().resolution();

			if (!mustWait)
				this.run(inputValues);
		};

		this.destroy = function() {
			App().unsubscribe("new-gl-image", newImage);
			// TODO: remove programs from gl and stuff!
		};

		// Compile shaders
		for (var i=0; i<program.shaders.length; i++) {
			var name = program.shaders[i].name;
			glPrograms[name] = compileShader(program.shaders[i]);

			if (!glPrograms[name])
				return;
		}

		collectInputs(graph);

		App().messages.subscribe("new-gl-image", newImage);
		//App().messages.post("new-input-controls", this.inputs);
	};
})();

function Inputs() {
	"use strict";

	var input_values = {};

	/*
	 * Sends all the input values.
	 */
	var sendInputs = function() {
		App().messages.post("new-inputs", input_values);
	}.bind(this);

	/*
	 * All input widgets.
	 */
	var textureWidget = function(name) {
		var div = $('<div/>');
		div.append(name + ": ");

		input_values[name] = "/images/lena.jpg";

		// on update
		var onUpdate = function() {
			input_values[name] = this.value;
			sendInputs();
		};

		// create the input box.
		div.append($('<input/>', {
				type: 'text',
				value: '/images/lena.jpg',
				name: 'uniform_' + name
			}).addClass('uniform_input').change(onUpdate));

		return div;
	};
	var numberWidget = function(name) {
		var div = $('<div/>');
		div.append(name + ": ");

		input_values[name] = Number("0.0"); // TODO: Different depending on int or float.

		// on update
		var onUpdate = function() {
			input_values[name] = Number(this.value);
			sendInputs();
		};

		// create the input box.
		div.append($('<input/>', {
				type: 'text',
				value: '0.0',
				name: 'uniform_' + name
			}).addClass('uniform_input').change(onUpdate));

		return div;
	};
	var vectorWidget = function(size) {
		return function(name) {
			var div = $('<div/>');
			div.append(name + ": ");

			var field_values = [];

			var updateValues = function() {
				var fun = {2: vec2, 3: vec3, 4: vec4}[size];
				input_values[name] = fun.createFrom.apply(fun, field_values);
				sendInputs();
			};

			// on update
			var onUpdate = function(index) {
				return function() {
					field_values[index] = Number(this.value);
					updateValues();
				};
			};

			for (var i=0; i<size; i++) {
				// set inital value
				field_values[i] = 0.0;

				// create the input box.
				div.append($('<input/>', {
						type: 'text',
						value: '0.0',
						name: 'uniform_' + name
					}).addClass('uniform_input').change(onUpdate(i)));
			}

			input_values[name] = field_values;
			updateValues();

			return div;
		};
	};
	var widgets = {
			'texture': textureWidget,
			'float': numberWidget,
			'int': numberWidget,
			'vec2': vectorWidget(2),
			'vec3': vectorWidget(3),
			'vec4': vectorWidget(4)
		};

	/*
	 * Called by MessageBus when there are new inputs from a shader.
	 */
	this.addInputs = function(ins) {
		var panel = $("#app-inputs-widgets");
		// TODO: If there have been no changes - store the old values.
		// clean up.
		input_values = {};
		panel.html("");

		// create widgets for all the inputs.
		for (var name in ins) {
			if (ins[name] in widgets)
				panel.append(widgets[ins[name]](name));
			else
				panel.append('unhandled input type: ' + ins[name] + "<br/>");
		}

		// and do an initial input update.
		sendInputs();
		App().refresh();
	}.bind(this);
}

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

	var InfoMessage = function(str, type) {
		type = type || "Warning";
		var box = $(templates.info(type, nl2br(str))).appendTo(errorBox).fadeIn();

		this.destroy = function() {
			box.fadeOut(function() { box.remove(); });

			for (var i=0; i<errors.length; i++) {
				if (errors[i] === this)
					delete errors[i];
			}
		};

		setTimeout(this.destroy.bind(this), 5000);
		box.find(".ui-icon-close").click(this.destroy.bind(this));
	};

	this.post = function(str, type) {
		Editor().stopLoadAnim();
		errors.push(new ErrorMessage(str, type));
	};

	this.postWarning = function(str, type) {
		errors.push(new InfoMessage(str, type));
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
